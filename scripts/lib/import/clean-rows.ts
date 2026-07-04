import { classifyRow } from "./classify";
import {
  cleanPresentation,
  cleanSourceBox,
  cleanText,
  cleanUnitOfMeasure,
  isNonProductDescription,
  parseQuantity,
  wasUnitCanonicalized,
} from "./normalize";
import type { ClassifiedRow, CleanedRow, RawExcelRow } from "./types";

export function cleanRawRow(raw: RawExcelRow): CleanedRow {
  const cleanedDescription = cleanText(raw.description);
  const cleanedPresentation = cleanPresentation(raw.presentation);
  const cleanedUnitOfMeasure = cleanUnitOfMeasure(raw.unitOfMeasure);
  const sourceBox = cleanSourceBox(raw.sourceBox) ?? "";
  const warnings: string[] = [];

  if (wasUnitCanonicalized(raw.unitOfMeasure, cleanedUnitOfMeasure)) {
    warnings.push("UNIT_CANONICALIZED");
  }

  if (cleanedDescription && !cleanedPresentation) {
    warnings.push("PRESENTATION_MISSING");
  }
  if (cleanedDescription && !cleanedUnitOfMeasure) {
    warnings.push("UNIT_OF_MEASURE_MISSING");
  }

  const quantity = parseQuantity(raw.quantity);
  if (cleanedDescription && quantity === null && String(raw.quantity ?? "").trim()) {
    warnings.push("QUANTITY_INVALID_PRODUCT_IMPORTED_WITHOUT_STOCK");
  } else if (cleanedDescription && quantity === null) {
    warnings.push("QUANTITY_INVALID_PRODUCT_IMPORTED_WITHOUT_STOCK");
  }

  let skipped = false;
  let skipReason: string | undefined;

  if (!cleanedDescription || isNonProductDescription(cleanedDescription)) {
    skipped = true;
    skipReason = "ROW_SKIPPED_NO_VALID_PRODUCT_DESCRIPTION";
  }

  return {
    sheetName: raw.sheetName,
    rowNumber: raw.rowNumber,
    sourceBox,
    originalClassification: String(raw.classification ?? "").trim(),
    normalizedClassification: "",
    description: String(raw.description ?? "").trim(),
    cleanedDescription: cleanedDescription ?? "",
    presentation: raw.presentation?.trim() || null,
    cleanedPresentation,
    quantity,
    unitOfMeasure: raw.unitOfMeasure?.trim() || null,
    cleanedUnitOfMeasure,
    salida: raw.salida?.trim() || null,
    categoryColumn: raw.categoryColumn?.trim() || null,
    warnings,
    skipped,
    skipReason,
  };
}

export function classifyCleanedRow(cleaned: CleanedRow): ClassifiedRow {
  const classification = classifyRow({
    classification: cleaned.originalClassification,
    description: cleaned.cleanedDescription,
    unitOfMeasure: cleaned.cleanedUnitOfMeasure,
    categoryColumn: cleaned.categoryColumn,
  });

  const warnings = [...cleaned.warnings];
  if (classification.unclear) {
    warnings.push("CATEGORY_UNCLEAR_IMPORTED_AS_SIN_CLASIFICAR");
  }
  if (warnings.length > 0 && !cleaned.skipped) {
    warnings.push("ROW_IMPORTED_BUT_NEEDS_REVIEW");
  }

  return {
    ...cleaned,
    normalizedClassification: classification.normalizedClassification,
    category: classification.category,
    subcategory: classification.subcategory,
    classificationUnclear: classification.unclear,
    warnings: [...new Set(warnings)],
  };
}

export function processRawRows(rows: RawExcelRow[]): ClassifiedRow[] {
  return rows.map((raw) => classifyCleanedRow(cleanRawRow(raw)));
}
