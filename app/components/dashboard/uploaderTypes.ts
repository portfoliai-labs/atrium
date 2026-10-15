import { StandardTransaction } from "../../models/Report";
import { TransactionValidationResult } from "../../lib/parser";

export interface UploadedFileState {
  id: string;
  fileName: string;
  rawData: Record<string, unknown>[];
  previewData: StandardTransaction[];
  manualMap: Partial<Record<keyof StandardTransaction, string>>;
  detectedBroker: string;
  // "auto" (detected from the mapped column's values) or a pattern the user picked explicitly.
  dateFormat: string;
  // The pattern actually used to parse the date column right now (same as dateFormat once
  // the user picks one explicitly; the resolved guess while it's still "auto").
  resolvedDateFormat: string;
  // True when auto-detection couldn't confidently pick one format — prompts the user to confirm.
  dateFormatAmbiguous: boolean;
  isValid: boolean;
  missingFields: string[];
  hasOrdersWithoutTime: boolean;
  validationErrors: TransactionValidationResult;
  confirmed: boolean;
  // The portfolio this file's rows will be saved into.
  portfolioUuid: string;
}
