import { MappingTarget } from "../../../models/Import";

export const FIELD_LABELS: Record<MappingTarget, string> = {
  date: "Date",
  type: "Type",
  amount: "Amount",
  quantity: "Quantity",
  price: "Price",
  fees: "Fees",
  accrued_interest: "Accrued interest",
  currency: "Currency",
  ticker: "Ticker",
  isin: "ISIN",
  name: "Name",
  broker: "Broker",
};

export const NUMERIC_TARGETS: MappingTarget[] = ["amount", "quantity", "price", "fees", "accrued_interest"];
