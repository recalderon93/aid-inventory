import * as XLSX from "xlsx";
import type { RawExcelRow } from "./types";

const MEDICINAS_HEADERS = ["CAJA #", "CLASIFICACION", "DESCRIPCION", "PRESENTACION", "CANT", "UND MEDIDA"];

function normalizeHeader(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

function findHeaderRow(rows: unknown[][], expected: string[]): number {
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const row = rows[i] ?? [];
    const normalized = row.map(normalizeHeader);
    const hits = expected.filter((header) =>
      normalized.some((cell) => cell.includes(normalizeHeader(header)))
    );
    if (hits.length >= 4) return i;
  }
  return -1;
}

function rowToObject(headers: string[], row: unknown[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (let i = 0; i < headers.length; i++) {
    result[headers[i]!] = String(row[i] ?? "").trim();
  }
  return result;
}

function parseMedicinasSheet(sheet: XLSX.WorkSheet, sheetName: string): RawExcelRow[] {
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" });
  const headerRowIndex = findHeaderRow(rows, MEDICINAS_HEADERS);
  if (headerRowIndex < 0) return [];

  const headerRow = rows[headerRowIndex] ?? [];
  const headers = MEDICINAS_HEADERS;
  const hasCategoryColumn = headerRow.some((cell) => normalizeHeader(cell) === "CATEGORY");
  const output: RawExcelRow[] = [];

  for (let i = headerRowIndex + 1; i < rows.length; i++) {
    const row = rows[i] ?? [];
    if (row.every((cell) => String(cell ?? "").trim() === "")) continue;

    const mapped = rowToObject(headers, row);
    const categoryColumn = hasCategoryColumn
      ? String(row[headers.length] ?? "").trim()
      : undefined;

    output.push({
      sheetName,
      rowNumber: i + 1,
      sourceBox: mapped["CAJA #"] ?? "",
      classification: mapped.CLASIFICACION ?? "",
      description: mapped.DESCRIPCION ?? "",
      presentation: mapped.PRESENTACION ?? "",
      quantity: mapped.CANT ?? "",
      unitOfMeasure: mapped["UND MEDIDA"] ?? "",
      salida: String(row[6] ?? "").trim(),
      categoryColumn,
    });
  }

  return output;
}

function parseNota1Sheet(sheet: XLSX.WorkSheet, sheetName: string): RawExcelRow[] {
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" });
  const headerRowIndex = findHeaderRow(rows, MEDICINAS_HEADERS);
  if (headerRowIndex < 0) return [];

  const output: RawExcelRow[] = [];
  for (let i = headerRowIndex + 1; i < rows.length; i++) {
    const row = rows[i] ?? [];
    if (row.every((cell) => String(cell ?? "").trim() === "")) continue;

    const cells = [...row];
    while (cells.length > 0 && String(cells[0] ?? "").trim() === "") {
      cells.shift();
    }

    const mapped = rowToObject(MEDICINAS_HEADERS, cells);
    output.push({
      sheetName,
      rowNumber: i + 1,
      sourceBox: mapped["CAJA #"] ?? "",
      classification: mapped.CLASIFICACION ?? "",
      description: mapped.DESCRIPCION ?? "",
      presentation: mapped.PRESENTACION ?? "",
      quantity: mapped.CANT ?? "",
      unitOfMeasure: mapped["UND MEDIDA"] ?? "",
      salida: String(cells[6] ?? "").trim(),
    });
  }

  return output;
}

function parseGenericSheet(sheet: XLSX.WorkSheet, sheetName: string): RawExcelRow[] {
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" });
  const output: RawExcelRow[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] ?? [];
    if (row.every((cell) => String(cell ?? "").trim() === "")) continue;

    const cells = row.map((cell) => String(cell ?? "").trim());
    output.push({
      sheetName,
      rowNumber: i + 1,
      sourceBox: cells[0] ?? cells[1] ?? "",
      classification: cells[1] ?? cells[2] ?? "",
      description: cells[2] ?? cells[3] ?? "",
      presentation: cells[3] ?? cells[4] ?? "",
      quantity: cells[4] ?? cells[5] ?? "",
      unitOfMeasure: cells[5] ?? cells[6] ?? "",
      salida: cells[6] ?? cells[7] ?? "",
    });
  }

  return output;
}

export interface ParsedWorkbook {
  medicinas: RawExcelRow[];
  nota1: RawExcelRow[];
  insumos: RawExcelRow[];
  hoja1: RawExcelRow[];
}

export function parseWorkbook(filePath: string): ParsedWorkbook {
  const workbook = XLSX.readFile(filePath, { cellDates: false });
  const getSheet = (name: string) => workbook.Sheets[name];

  return {
    medicinas: getSheet("MEDICINAS") ? parseMedicinasSheet(getSheet("MEDICINAS")!, "MEDICINAS") : [],
    nota1: getSheet("NOTA 1") ? parseNota1Sheet(getSheet("NOTA 1")!, "NOTA 1") : [],
    insumos: getSheet("INSUMOS") ? parseGenericSheet(getSheet("INSUMOS")!, "INSUMOS") : [],
    hoja1: getSheet("Hoja1") ? parseGenericSheet(getSheet("Hoja1")!, "Hoja1") : [],
  };
}
