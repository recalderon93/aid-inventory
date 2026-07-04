export interface InventoryExportRow {
  quantity: number;
  slot: { number: string } | null;
  donation_item: {
    subcategory: string | null;
    description: string;
    presentation: string | null;
    unit_of_measurement: string | null;
  } | null;
}

export const INVENTORY_EXPORT_COLUMNS = [
  "CAJA #",
  "CLASIFICACION",
  "DESCRIPCION",
  "PRESENTACION",
  "CANT",
  "UND MEDIDA",
] as const;

export function mapInventoryToExportRows(rows: InventoryExportRow[]) {
  return rows.map((row) => ({
    "CAJA #": row.slot?.number ?? "",
    CLASIFICACION: row.donation_item?.subcategory ?? "",
    DESCRIPCION: row.donation_item?.description ?? "",
    PRESENTACION: row.donation_item?.presentation ?? "",
    CANT: row.quantity,
    "UND MEDIDA": row.donation_item?.unit_of_measurement ?? "",
  }));
}
