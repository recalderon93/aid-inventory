import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { createClient } from "@/lib/supabase/server";

interface ExportRow {
  quantity: number;
  slot: { number: string } | null;
  donation_item: {
    subcategory: string | null;
    description: string;
    presentation: string | null;
    unit_of_measurement: string | null;
  } | null;
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("inventory")
    .select(`
      quantity,
      slot:slots(number),
      donation_item:donation_items(subcategory, description, presentation, unit_of_measurement)
    `)
    .gt("quantity", 0)
    .order("slot_id");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = ((data ?? []) as unknown as ExportRow[]).map((row) => ({
    "CAJA #": row.slot?.number ?? "",
    CLASIFICACION: row.donation_item?.subcategory ?? "",
    DESCRIPCION: row.donation_item?.description ?? "",
    PRESENTACION: row.donation_item?.presentation ?? "",
    CANT: row.quantity,
    "UND MEDIDA": row.donation_item?.unit_of_measurement ?? "",
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows, {
    header: ["CAJA #", "CLASIFICACION", "DESCRIPCION", "PRESENTACION", "CANT", "UND MEDIDA"],
  });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Inventario");

  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="inventario.xlsx"`,
    },
  });
}
