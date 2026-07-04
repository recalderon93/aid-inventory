import type {
  ClassifiedRow,
  ManualReviewRow,
  RawExcelRow,
  ReviewAction,
} from "./types";

const SUGGESTED_FIX: Record<string, string> = {
  CATEGORY_UNCLEAR_IMPORTED_AS_SIN_CLASIFICAR:
    "Review CLASIFICACION and assign a proper subcategory in the app.",
  PRESENTATION_MISSING: "Add presentation/dosage if known.",
  UNIT_OF_MEASURE_MISSING: "Add unit of measure if known.",
  QUANTITY_INVALID_PRODUCT_IMPORTED_WITHOUT_STOCK:
    "Verify quantity in Excel and add stock manually if needed.",
  ROW_IMPORTED_BUT_NEEDS_REVIEW: "Review cleaned values before relying on this row.",
  ROW_SKIPPED_NO_VALID_PRODUCT_DESCRIPTION:
    "Fix or remove non-product rows in the source spreadsheet.",
  DUPLICATE_ROW_SKIPPED: "Remove duplicate rows in Excel or merge quantities manually.",
  NO_MATCH_IN_MEDICINAS_FOR_NOTA_1:
    "Ensure the product exists in MEDICINAS with matching description/presentation/unit/box.",
  MULTIPLE_PRODUCT_MATCHES_FOR_NOTA_1:
    "Disambiguate NOTA 1 row with exact presentation, unit, or CAJA #.",
  NOTA_1_QUANTITY_EXCEEDS_AVAILABLE_STOCK:
    "Verify NOTA 1 quantity or MEDICINAS stock; do not auto-balance.",
  ORDER_ITEM_IMPORTED_WITH_WARNING: "Review matched order item before finalizing.",
};

function actionForReason(reason: string, skipped: boolean): ReviewAction {
  if (skipped) {
    if (reason === "DUPLICATE_ROW_SKIPPED") return "DUPLICATE_SKIPPED";
    if (reason.startsWith("NO_MATCH") || reason.startsWith("MULTIPLE")) return "ORDER_ITEM_SKIPPED";
    if (reason === "NOTA_1_QUANTITY_EXCEEDS_AVAILABLE_STOCK") return "OUT_TRANSACTION_SKIPPED";
    return "SKIPPED";
  }
  if (reason === "QUANTITY_INVALID_PRODUCT_IMPORTED_WITHOUT_STOCK") {
    return "PRODUCT_IMPORTED_WITHOUT_STOCK";
  }
  if (reason.startsWith("NO_MATCH") || reason.startsWith("MULTIPLE")) return "ORDER_ITEM_SKIPPED";
  if (reason === "NOTA_1_QUANTITY_EXCEEDS_AVAILABLE_STOCK") return "OUT_TRANSACTION_SKIPPED";
  return "IMPORTED_WITH_WARNING";
}

export function buildManualReviewRow(input: {
  row: ClassifiedRow | RawExcelRow;
  reason: string;
  actionTaken?: ReviewAction;
  matchedProductId?: string;
  matchedOrderId?: string;
  skipped?: boolean;
}): ManualReviewRow {
  const row = input.row;
  const isClassified = "cleanedDescription" in row;
  const skipped = input.skipped ?? (isClassified ? row.skipped : false);
  const reason = input.reason;

  return {
    sheet_name: row.sheetName,
    row_number: row.rowNumber,
    action_taken: input.actionTaken ?? actionForReason(reason, skipped),
    review_status: "PENDING_REVIEW",
    source_box: isClassified ? row.sourceBox : row.sourceBox,
    original_classification: isClassified ? row.originalClassification : row.classification,
    normalized_classification: isClassified ? row.normalizedClassification : "",
    inferred_category: isClassified ? row.category : "",
    inferred_subcategory: isClassified ? row.subcategory : "",
    description: isClassified ? row.description : row.description,
    cleaned_description: isClassified ? row.cleanedDescription : "",
    presentation: isClassified ? row.presentation ?? "" : row.presentation,
    cleaned_presentation: isClassified ? row.cleanedPresentation ?? "" : "",
    quantity: isClassified ? String(row.quantity ?? "") : row.quantity,
    unit_of_measure: isClassified ? row.unitOfMeasure ?? "" : row.unitOfMeasure,
    cleaned_unit_of_measure: isClassified ? row.cleanedUnitOfMeasure ?? "" : "",
    salida: isClassified ? row.salida ?? "" : row.salida,
    matched_product_id: input.matchedProductId ?? "",
    matched_order_id: input.matchedOrderId ?? "",
    reason,
    suggested_fix: SUGGESTED_FIX[reason] ?? "Review source row and update spreadsheet or database.",
    original_row_json: JSON.stringify(row),
  };
}

export function collectManualReviewRows(input: {
  medicinasRows: ClassifiedRow[];
  nota1Rows: ClassifiedRow[];
  nota1MatchReasons: Map<number, string>;
  ignoredInsumos: RawExcelRow[];
  ignoredHoja1: RawExcelRow[];
  orderId?: string;
}): ManualReviewRow[] {
  const review: ManualReviewRow[] = [];

  for (const row of input.medicinasRows) {
    if (row.skipped && row.skipReason) {
      review.push(
        buildManualReviewRow({ row, reason: row.skipReason, skipped: true })
      );
      continue;
    }

    for (const warning of row.warnings) {
      if (warning === "ROW_IMPORTED_BUT_NEEDS_REVIEW") continue;
      review.push(buildManualReviewRow({ row, reason: warning }));
    }
  }

  for (const row of input.nota1Rows) {
    const matchReason = input.nota1MatchReasons.get(row.rowNumber);
    if (matchReason) {
      review.push(
        buildManualReviewRow({
          row,
          reason: matchReason,
          skipped: row.skipped || matchReason.startsWith("NO_MATCH") || matchReason.startsWith("MULTIPLE"),
          matchedOrderId: input.orderId,
        })
      );
    } else if (row.warnings.length > 0) {
      for (const warning of row.warnings) {
        if (warning === "ROW_IMPORTED_BUT_NEEDS_REVIEW") continue;
        review.push(buildManualReviewRow({ row, reason: warning, matchedOrderId: input.orderId }));
      }
    }
  }

  for (const row of [...input.ignoredInsumos, ...input.ignoredHoja1]) {
    review.push(
      buildManualReviewRow({
        row,
        reason: "ROW_SKIPPED_SHEET_IGNORED_FOR_IMPORT",
        actionTaken: "SKIPPED",
        skipped: true,
      })
    );
  }

  return review;
}

export const MANUAL_REVIEW_COLUMNS: (keyof ManualReviewRow)[] = [
  "sheet_name",
  "row_number",
  "action_taken",
  "review_status",
  "source_box",
  "original_classification",
  "normalized_classification",
  "inferred_category",
  "inferred_subcategory",
  "description",
  "cleaned_description",
  "presentation",
  "cleaned_presentation",
  "quantity",
  "unit_of_measure",
  "cleaned_unit_of_measure",
  "salida",
  "matched_product_id",
  "matched_order_id",
  "reason",
  "suggested_fix",
  "original_row_json",
];
