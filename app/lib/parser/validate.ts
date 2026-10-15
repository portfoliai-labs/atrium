import { StandardTransaction } from "../../models/Report";
import { ValidationError, TransactionValidationResult } from "./types";
import { REQUIRED_FIELDS } from "./config";
import {
  ACCRUED_INTEREST_OPERATIONS, AMOUNT_OPTIONAL, OPERATION_LABELS, PRICE_REQUIRED, QUANTITY_REQUIRED, WITHHOLDING_OPERATIONS,
  isCashOperation, isOperation,
} from "../operations";

// --- Private helpers ---

const hasTimeComponent = (date: string): boolean =>
  /T\d{2}:\d{2}/.test(date) || /\s\d{2}:\d{2}/.test(date);

// --- Regex constants ---

// Date-only, or a datetime with an optional seconds/fractional-seconds/timezone suffix
const ISO_DATE_RE   = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])([T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/;
const CURRENCY_RE   = /^[A-Z]{3}$/;
const ISIN_RE       = /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/;
const TICKER_RE     = /^[A-Z0-9.\-]{1,20}$/i;

// --- Public validators ---

/**
 * Checks that all required fields (including ticker) are mapped. Also detects
 * missing time components.
 */
export const validateMapping = (data: StandardTransaction[]) => {
  if (data.length === 0) return {
    isValid: false,
    missingFields: REQUIRED_FIELDS.map(String),
    hasOrdersWithoutTime: false,
  };

  // A cash movement names no security, and a transfer_out or a reward may have no amount.
  const missingFields: string[] = REQUIRED_FIELDS.filter(field =>
    data.some(row => {
      if (field === "ticker" && isCashOperation(row.operation)) return false;
      if (field === "ticker" && row.assetId) return false;
      if (field === "amount" && AMOUNT_OPTIONAL.includes(row.operation)) return false;
      const val = row[field as keyof StandardTransaction];
      return val === undefined || val === null || val === "" || (typeof val === "number" && isNaN(val));
    })
  ).map(String);

  const hasOrdersWithoutTime = data.some(
    row => row.date && row.date !== "" && !hasTimeComponent(row.date),
  );

  return { isValid: missingFields.length === 0, missingFields, hasOrdersWithoutTime };
};

/**
 * Validates the actual values of each transaction row against domain rules.
 * Returns a structured result with per-field error counts and invalid row count.
 */
export const validateTransactions = (data: StandardTransaction[]): TransactionValidationResult => {
  const errors: ValidationError[] = [];

  data.forEach((row, i) => {
    if (!row.date || !ISO_DATE_RE.test(row.date))
      errors.push({ field: "date", row: i, message: "Must be ISO format YYYY-MM-DD, optionally with a time (YYYY-MM-DDTHH:mm)" });

    if (row.isin && !ISIN_RE.test(row.isin))
      errors.push({ field: "isin", row: i, message: `Invalid ISIN format: "${row.isin}"` });

    if (row.ticker && !TICKER_RE.test(row.ticker))
      errors.push({ field: "ticker", row: i, message: `Invalid ticker format: "${row.ticker}"` });

    const op = row.operation;
    if (!isOperation(op)) {
      errors.push({ field: "operation", row: i, message: `Not an operation: "${op}"` });
      return;
    }
    const cash = isCashOperation(op);

    const amountGiven = typeof row.amount === "number" && !isNaN(row.amount);
    if (AMOUNT_OPTIONAL.includes(op)) {
      if (amountGiven && row.amount < 0)
        errors.push({ field: "amount", row: i, message: "Must be 0 or more" });
    } else if (!amountGiven || row.amount <= 0) {
      errors.push({ field: "amount", row: i, message: "Must be a positive number" });
    }

    const hasQuantity = row.quantity !== null && row.quantity !== undefined;
    const hasPrice = row.price !== null && row.price !== undefined;

    if (cash) {
      if (hasQuantity || hasPrice || row.ticker || row.isin || row.listingId || row.assetId)
        errors.push({ field: "ticker", row: i, message: `A ${OPERATION_LABELS[op].toLowerCase()} moves cash only: no security, quantity or price` });
    } else if (!row.listingId && !row.assetId && !row.ticker) {
      errors.push({ field: "ticker", row: i, message: "Pick a security" });
    }

    if (QUANTITY_REQUIRED.includes(op)) {
      if (!hasQuantity || typeof row.quantity !== "number" || isNaN(row.quantity) || row.quantity <= 0)
        errors.push({ field: "quantity", row: i, message: "Must be a positive number" });
    } else if (!cash && hasQuantity && (typeof row.quantity !== "number" || isNaN(row.quantity) || row.quantity <= 0)) {
      errors.push({ field: "quantity", row: i, message: "Must be a positive number" });
    }

    if (PRICE_REQUIRED.includes(op)) {
      if (!hasPrice || typeof row.price !== "number" || isNaN(row.price) || row.price < 0)
        errors.push({ field: "price", row: i, message: "Must be a positive number" });
    } else if (!cash && hasPrice && (typeof row.price !== "number" || isNaN(row.price) || row.price < 0)) {
      errors.push({ field: "price", row: i, message: "Must be a positive number" });
    }

    if (op === "dividend" && hasQuantity !== hasPrice)
      errors.push({
        field: hasQuantity ? "price" : "quantity",
        row: i,
        message: "Quantity and Price must both be provided (paid in shares) or both left blank (paid in cash)",
      });

    if (row.withholdingTax != null) {
      if (!WITHHOLDING_OPERATIONS.includes(op))
        errors.push({ field: "withholdingTax", row: i, message: "Only a dividend or a coupon has a withholding tax" });
      else if (isNaN(row.withholdingTax) || row.withholdingTax < 0 || (amountGiven && row.withholdingTax > row.amount))
        errors.push({ field: "withholdingTax", row: i, message: "The withholding tax is 0 up to the gross amount" });
    }

    if (row.accruedInterest != null) {
      if (!ACCRUED_INTEREST_OPERATIONS.includes(op))
        errors.push({ field: "accruedInterest", row: i, message: "Only a buy or a sell has accrued interest" });
      else if (isNaN(row.accruedInterest) || row.accruedInterest < 0)
        errors.push({ field: "accruedInterest", row: i, message: "The accrued interest is 0 or more" });
    }

    if (op === "reward" && !row.rewardKind)
      errors.push({ field: "rewardKind", row: i, message: "Say whether it's staking or an airdrop" });

    if (op === "fx_conversion") {
      if (row.counterAmount == null || isNaN(row.counterAmount) || row.counterAmount <= 0)
        errors.push({ field: "counterAmount", row: i, message: "The amount received must be a positive number" });
      if (!row.counterCurrency || !CURRENCY_RE.test(row.counterCurrency))
        errors.push({ field: "counterCurrency", row: i, message: "The currency received must be a 3-letter ISO code" });
      else if (row.counterCurrency === row.currency)
        errors.push({ field: "counterCurrency", row: i, message: "The currency received must differ from the one changed" });
    }

    if (!row.currency || !CURRENCY_RE.test(row.currency))
      errors.push({ field: "currency", row: i, message: "Must be a 3-letter ISO code (e.g. EUR, USD)" });

    if (typeof row.fees !== "number" || isNaN(row.fees) || row.fees < 0)
      errors.push({ field: "fees", row: i, message: "Must be a non-negative number (defaults to 0 if absent)" });
  });

  const errorsByField: Record<string, number> = {};
  const rowsWithErrors = new Set<number>();
  for (const err of errors) {
    errorsByField[err.field] = (errorsByField[err.field] || 0) + 1;
    rowsWithErrors.add(err.row);
  }

  return { isValid: errors.length === 0, errors, errorsByField, invalidRowCount: rowsWithErrors.size };
};
