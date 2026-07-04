const NON_PRODUCT_PATTERNS = [
  /^CAJA\s*#?$/i,
  /^CLASIFICACION$/i,
  /^DESCRIPCION$/i,
  /^PRESENTACION$/i,
  /^CANT\.?$/i,
  /^UND\.?\s*MEDIDA$/i,
  /^TOTAL/i,
  /^SUBTOTAL/i,
  /^NOTA DE ENTREGA/i,
  /^DESPACHO ALMACEN/i,
  /^TRASLADO A/i,
  /^EXISTENCIA$/i,
  /^SALIDA$/i,
  /^SALDO$/i,
  /^# CAJAS$/i,
  /^\d{1,2}\/\d{1,2}\/\d{2,4}$/,
];

const TYPO_REPLACEMENTS: [RegExp, string][] = [
  [/\bMLG\b/g, "MG"],
  [/\bMGS\b/g, "MG"],
  [/\bANTHIPERTENSIVO\b/g, "ANTIHIPERTENSIVO"],
  [/\bANTIFLAMATORIO\b/g, "ANTIINFLAMATORIO"],
  [/\bGASTICOS\b/g, "GÁSTRICOS"],
  [/\bGASTICO\b/g, "GÁSTRICO"],
  [/\bACETOMINOFEN\b/g, "ACETAMINOFEN"],
];

export function normalizeForMatch(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

export function cleanText(value: unknown): string | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  let text = raw.replace(/\s+/g, " ");
  for (const [pattern, replacement] of TYPO_REPLACEMENTS) {
    text = text.replace(pattern, replacement);
  }
  return text.toUpperCase();
}

export function cleanPresentation(value: unknown): string | null {
  const cleaned = cleanText(value);
  if (!cleaned) return null;
  return cleaned.replace(/\bMLG\b/g, "MG").replace(/\bMGS\b/g, "MG");
}

export function cleanUnitOfMeasure(value: unknown): string | null {
  const cleaned = cleanText(value);
  if (!cleaned) return null;
  const normalized = normalizeForMatch(cleaned);
  if (["UNID", "UND", "UNIDAD", "UNIDADES", "UNDS"].includes(normalized)) {
    return "UNDS";
  }
  return cleaned;
}

export function wasUnitCanonicalized(original: unknown, cleaned: string | null): boolean {
  if (!cleaned) return false;
  const orig = normalizeForMatch(original);
  const norm = normalizeForMatch(cleaned);
  return orig !== norm && ["UNID", "UND", "UNIDAD", "UNIDADES"].includes(orig) && norm === "UNDS";
}

export function parseQuantity(value: unknown): number | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const num = Number(raw.replace(",", "."));
  if (!Number.isFinite(num) || num <= 0) return null;
  if (!Number.isInteger(num)) {
    if (Math.abs(num - Math.round(num)) < 0.001) {
      return Math.round(num);
    }
    return null;
  }
  return num;
}

export function isNonProductDescription(description: string | null): boolean {
  if (!description) return true;
  const trimmed = description.trim();
  if (!trimmed) return true;
  const normalized = normalizeForMatch(trimmed);
  return NON_PRODUCT_PATTERNS.some((pattern) => pattern.test(normalized));
}

export function cleanSourceBox(value: unknown): string | null {
  const cleaned = cleanText(value);
  if (!cleaned || cleaned === "CAJA #") return null;
  return cleaned;
}

export function productKey(parts: {
  description: string;
  presentation: string | null;
  unitOfMeasure: string | null;
  category: string;
  subcategory: string;
}): string {
  return [
    normalizeForMatch(parts.category),
    normalizeForMatch(parts.subcategory),
    normalizeForMatch(parts.description),
    normalizeForMatch(parts.presentation ?? ""),
    normalizeForMatch(parts.unitOfMeasure ?? ""),
  ].join("|");
}

export function excelRowKey(parts: {
  sourceBox: string;
  description: string;
  presentation: string | null;
  unitOfMeasure: string | null;
  category: string;
  subcategory: string;
}): string {
  return [
    normalizeForMatch(parts.sourceBox),
    normalizeForMatch(parts.category),
    normalizeForMatch(parts.subcategory),
    normalizeForMatch(parts.description),
    normalizeForMatch(parts.presentation ?? ""),
    normalizeForMatch(parts.unitOfMeasure ?? ""),
  ].join("|");
}

export function sqlEscape(value: string): string {
  return value.replace(/'/g, "''");
}

export function csvEscape(value: string): string {
  if (value.includes('"') || value.includes(",") || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
