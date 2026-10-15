import Papa from "papaparse";
import * as XLSX from "xlsx";
import { decodeCsvBuffer } from "./encoding";
import { detectTableBounds } from "./tableBounds";

export type RawRow = Record<string, string>;

export interface ParsedFile {
  fileName: string;
  headers: string[];
  rows: RawRow[]; // in original file order, metadata/footer rows already stripped
  totalRows: number;
  skippedHeaderRows: number;
  skippedFooterRows: number;
}

function dedupeHeaders(raw: string[]): string[] {
  const seen = new Map<string, number>();
  return raw.map((h, i) => {
    const name = (h ?? "").toString().trim() || `Column ${i + 1}`;
    const count = seen.get(name) ?? 0;
    seen.set(name, count + 1);
    return count === 0 ? name : `${name} (${count + 1})`;
  });
}

function toRawRows(headers: string[], dataRows: string[][]): RawRow[] {
  return dataRows.map((row) => {
    const record: RawRow = {};
    headers.forEach((h, i) => {
      record[h] = (row[i] ?? "").toString();
    });
    return record;
  });
}

async function parseCsvLike(file: File): Promise<string[][]> {
  const buffer = await file.arrayBuffer();
  const text = decodeCsvBuffer(buffer);
  const result = Papa.parse<string[]>(text, {
    header: false,
    skipEmptyLines: "greedy",
    // Italian broker exports commonly use ";" — Papa picks whichever of these best
    // explains the file's rows rather than defaulting to ",".
    delimitersToGuess: [",", ";", "\t", "|"],
  });
  return result.data;
}

async function parseSpreadsheet(file: File): Promise<string[][]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  // raw: false keeps dates/numbers as the display strings the file shows (e.g. "15/05/2026",
  // "55,92") — the mapping/profiling logic works on strings the same way it does for CSV.
  return XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, defval: "", raw: false });
}

export async function parseImportFile(file: File): Promise<ParsedFile> {
  const isCsvLike = /\.(csv|tsv|txt)$/i.test(file.name);
  const rawRows = isCsvLike ? await parseCsvLike(file) : await parseSpreadsheet(file);

  const { headerIndex, dataStart, dataEnd } = detectTableBounds(rawRows);
  const headers = dedupeHeaders(rawRows[headerIndex] ?? []);
  const dataRows = rawRows.slice(dataStart, dataEnd);

  return {
    fileName: file.name,
    headers,
    rows: toRawRows(headers, dataRows),
    totalRows: dataRows.length,
    skippedHeaderRows: headerIndex,
    skippedFooterRows: rawRows.length - dataEnd,
  };
}
