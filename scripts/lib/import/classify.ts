import { normalizeForMatch } from "./normalize";

/** Canonical subcategory labels (stored with Spanish accents). */
export const SUBCATEGORY_CANONICAL: Record<string, string> = {
  ANALGESICO: "ANALGÉSICOS",
  ANALGESICOS: "ANALGÉSICOS",
  "ANALGESICO ADULTO": "ANALGÉSICOS",
  ANTIPERTENSIVO: "ANTIHIPERTENSIVOS",
  ANTHIPERTENSIVO: "ANTIHIPERTENSIVOS",
  ANTIHIPERTENSIVO: "ANTIHIPERTENSIVOS",
  ANTIHIPERTENSIVOS: "ANTIHIPERTENSIVOS",
  ANTIBIOTICO: "ANTIBIÓTICOS",
  ANTIBIOTICOS: "ANTIBIÓTICOS",
  "ANTIBIOTICOS PEDIAT": "ANTIBIÓTICOS PEDIÁTRICOS",
  "ANTIBIOTICOS PEDIATRICOS": "ANTIBIÓTICOS PEDIÁTRICOS",
  "ANTIBIOTICOS PEDIÁTRICOS": "ANTIBIÓTICOS PEDIÁTRICOS",
  "ANTIBIOTICOS ENDOVENOSOS": "ANTIBIÓTICOS ENDOVENOSOS",
  ANTIFLAMATORIO: "ANTIINFLAMATORIOS",
  ANTIINFLAMATORIO: "ANTIINFLAMATORIOS",
  "ANTIINFLAMATORIO NO ESTEROIDE (AINE)": "ANTIINFLAMATORIOS AINE",
  "ANTIINFLAMATORIO NO ESTEROIDE (AINE) - INHIBIDOR COX-2": "ANTIINFLAMATORIOS AINE",
  HIPOGLICEMIANTE: "HIPOGLICEMIANTES",
  HIPOGLICEMIANTES: "HIPOGLICEMIANTES",
  GASTROINTESTINAL: "GASTROINTESTINAL",
  DIGESTIVO: "GASTROINTESTINAL",
  "PROTECTOR GASTRICO": "PROTECTORES GÁSTRICOS",
  "PROTECTORES GASTICOS ORAL": "PROTECTORES GÁSTRICOS",
  CARDIOLOGIA: "CARDIOVASCULAR",
  CARDIOLOGÍA: "CARDIOVASCULAR",
  CIRCULACION: "CARDIOVASCULAR",
  CIRCULACIÓN: "CARDIOVASCULAR",
  SUERO: "HIDRATACIÓN Y SOLUCIONES",
  SOLUCIONES: "HIDRATACIÓN Y SOLUCIONES",
  ELECTROLITOS: "HIDRATACIÓN Y SOLUCIONES",
  "HIDRATACION ORAL": "HIDRATACIÓN ORAL",
  "HIDRATACIÓN ORAL": "HIDRATACIÓN ORAL",
  VITAMINA: "VITAMINAS Y SUPLEMENTOS",
  VITAMINAS: "VITAMINAS Y SUPLEMENTOS",
  PEDIATRICO: "PEDIÁTRICOS",
  PEDIATRICOS: "PEDIÁTRICOS",
  PEDIÁTRICO: "PEDIÁTRICOS",
  PEDIÁTRICOS: "PEDIÁTRICOS",
  OFTALMOLOGIA: "OFTALMOLOGÍA",
  OFTALMOLOGÍA: "OFTALMOLOGÍA",
  ANTIMICOTICOS: "ANTIMICÓTICOS",
  ANTIMICÓTICOS: "ANTIMICÓTICOS",
  ANTIALERGICOS: "ANTIALÉRGICOS",
  ANTIALÉRGICOS: "ANTIALÉRGICOS",
  ANTIALERGICO: "ANTIALÉRGICOS",
  ANTIALÉRGICO: "ANTIALÉRGICOS",
  ANTIEMETICO: "ANTIEMÉTICOS",
  ANTIEMÉTICO: "ANTIEMÉTICOS",
  ANTIEMETICOS: "ANTIEMÉTICOS",
  ANTIEMÉTICOS: "ANTIEMÉTICOS",
  ANTICONVULSIVANTES: "ANTICONVULSIVANTES",
  BRONCODILATADORES: "RESPIRATORIO - BRONCODILATADORES",
  "ANTICONGESTIVOS NASALES": "RESPIRATORIO - ANTICONGESTIVOS NASALES",
  ESTEROIDE: "ESTEROIDES",
  ESTEROIDES: "ESTEROIDES",
  RENAL: "RENAL",
  TRAUMATOLOGIA: "TRAUMATOLOGÍA",
  TRAUMATOLOGÍA: "TRAUMATOLOGÍA",
  "RELAJANTE MUSCULAR": "RELAJANTES MUSCULARES",
  "RELAJANTES MUSCULARES": "RELAJANTES MUSCULARES",
  "ANTI-HEMORROIDAL": "ANTIHEMORROIDALES",
  ANTIHEMORROIDAL: "ANTIHEMORROIDALES",
  DESPARASITANTE: "ANTIPARASITARIOS",
  ANTIPARASITARIO: "ANTIPARASITARIOS",
  ANTIPARASITARIOS: "ANTIPARASITARIOS",
  INSUMOS: "INSUMOS MÉDICOS",
  "INSUMO MEDICO": "INSUMOS MÉDICOS",
  "INSUMOS MEDICOS": "INSUMOS MÉDICOS",
  "INSUMO MÉDICO": "INSUMOS MÉDICOS",
  "INSUMOS MÉDICOS": "INSUMOS MÉDICOS",
  EQUIPO: "EQUIPOS MÉDICOS",
  JERINGAS: "JERINGAS",
  ANTISEPTICO: "ANTISÉPTICOS",
  ANTISÉPTICO: "ANTISÉPTICOS",
  WATA: "CURACIÓN",
  GASA: "CURACIÓN",
  GASAS: "CURACIÓN",
  GUANTES: "INSUMOS MÉDICOS",
  MASCARILLA: "INSUMOS MÉDICOS",
  MASCARILLAS: "INSUMOS MÉDICOS",
  CATETER: "INSUMOS MÉDICOS",
  CATÉTER: "INSUMOS MÉDICOS",
  SONDA: "INSUMOS MÉDICOS",
  VARIOS: "SIN CLASIFICAR",
  MEDICINA: "SIN CLASIFICAR",
  MEDICAMENTOS: "SIN CLASIFICAR",
  "MEDICAMENTOS SURTIDOS": "MEDICAMENTOS SURTIDOS",
  ADULTO: "SIN CLASIFICAR",
  "CAJA DE EMERGENCIA": "CAJA DE EMERGENCIA",
};

const INSUMOS_KEYWORDS = [
  "INSUMOS",
  "INSUMO MEDICO",
  "INSUMOS MEDICOS",
  "INSUMO MÉDICO",
  "INSUMOS MÉDICOS",
  "EQUIPO",
  "JERINGAS",
  "ANTISEPTICO",
  "ANTISÉPTICO",
  "WATA",
  "GASA",
  "GASAS",
  "GUANTES",
  "MASCARILLA",
  "MASCARILLAS",
  "CATETER",
  "CATÉTER",
  "SONDA",
];

const PEDIATRIC_KEYWORDS = [
  "PEDIATRICO",
  "PEDIÁTRICO",
  "PEDIATRICOS",
  "PEDIÁTRICOS",
  "PEDIAT",
  "PED ",
  "NIÑOS",
  "INFANTIL",
  "BEBE",
  "BEBÉ",
  "KIDS",
  "CHILDREN",
];

const SUBCATEGORY_LOOKUP = new Map<string, string>(
  Object.entries(SUBCATEGORY_CANONICAL).map(([key, value]) => [normalizeForMatch(key), value])
);

export function isPediatricText(...values: (string | null | undefined)[]): boolean {
  const combined = normalizeForMatch(values.filter(Boolean).join(" "));
  return PEDIATRIC_KEYWORDS.some((keyword) => combined.includes(normalizeForMatch(keyword)));
}

export function isInsumosClassification(classification: string, description: string): boolean {
  const combined = normalizeForMatch(`${classification} ${description}`);
  return INSUMOS_KEYWORDS.some((keyword) => {
    const norm = normalizeForMatch(keyword);
    return combined.includes(norm) || combined.split(" ").includes(norm);
  });
}

function lookupSubcategory(raw: string): string | null {
  const normalized = normalizeForMatch(raw);
  if (SUBCATEGORY_LOOKUP.has(normalized)) {
    return SUBCATEGORY_LOOKUP.get(normalized)!;
  }
  for (const [key, value] of SUBCATEGORY_LOOKUP) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return value;
    }
  }
  return null;
}

function applyPediatricSuffix(baseSubcategory: string, pediatric: boolean): string {
  if (!pediatric) return baseSubcategory;
  if (baseSubcategory.includes("PEDIÁTRIC")) return baseSubcategory;
  if (baseSubcategory === "SIN CLASIFICAR") return "PEDIÁTRICOS";
  if (baseSubcategory.endsWith("S")) {
    return `${baseSubcategory.slice(0, -1)} PEDIÁTRICOS`.replace("Ó PEDIÁTRICOS", "OS PEDIÁTRICOS");
  }
  return `${baseSubcategory} PEDIÁTRICOS`;
}

export interface ClassificationResult {
  category: string;
  subcategory: string;
  normalizedClassification: string;
  unclear: boolean;
}

export function classifyRow(input: {
  classification: string;
  description: string;
  unitOfMeasure: string | null;
  categoryColumn?: string | null;
}): ClassificationResult {
  const classification = input.classification.trim();
  const description = input.description.trim();
  const pediatric = isPediatricText(classification, description, input.unitOfMeasure);

  if (input.categoryColumn?.trim()) {
    const fromColumn = lookupSubcategory(input.categoryColumn) ?? input.categoryColumn.trim().toUpperCase();
    const isSupply = isInsumosClassification(input.categoryColumn, description);
    return {
      category: isSupply ? "INSUMOS" : "MEDICINAS",
      subcategory: applyPediatricSuffix(fromColumn, pediatric),
      normalizedClassification: normalizeForMatch(input.categoryColumn),
      unclear: false,
    };
  }

  const isSupply = isInsumosClassification(classification, description);
  const normalizedClassification = normalizeForMatch(classification);

  if (isSupply) {
    const mapped = lookupSubcategory(classification) ?? lookupSubcategory(description) ?? "INSUMOS MÉDICOS";
    return {
      category: "INSUMOS",
      subcategory: applyPediatricSuffix(mapped, pediatric),
      normalizedClassification,
      unclear: !lookupSubcategory(classification) && !lookupSubcategory(description),
    };
  }

  const mapped =
    lookupSubcategory(classification) ??
    lookupSubcategory(description) ??
    lookupSubcategory(normalizedClassification.replace(/ PEDIAT(RICO|RICOS)?$/, ""));

  if (mapped) {
    const subcategory = applyPediatricSuffix(mapped, pediatric && !mapped.includes("PEDIÁTRIC"));
    return {
      category: "MEDICINAS",
      subcategory,
      normalizedClassification,
      unclear: false,
    };
  }

  if (!classification) {
    return {
      category: "MEDICINAS",
      subcategory: pediatric ? "PEDIÁTRICOS" : "SIN CLASIFICAR",
      normalizedClassification,
      unclear: true,
    };
  }

  return {
    category: "MEDICINAS",
    subcategory: pediatric ? "PEDIÁTRICOS" : "SIN CLASIFICAR",
    normalizedClassification,
    unclear: true,
  };
}
