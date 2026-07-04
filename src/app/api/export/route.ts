import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth-helpers";
import { canManageUsers } from "@/lib/permissions";
import {
  INVENTORY_EXPORT_COLUMNS,
  mapInventoryToExportRows,
  type InventoryExportRow,
} from "@/lib/export-inventory";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profile = await getCurrentProfile();
  if (!profile || !canManageUsers(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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

  const rows = mapInventoryToExportRows((data ?? []) as unknown as InventoryExportRow[]);

  const worksheet = XLSX.utils.json_to_sheet(rows, {
    header: [...INVENTORY_EXPORT_COLUMNS],
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
