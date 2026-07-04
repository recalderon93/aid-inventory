#!/usr/bin/env python3
"""Regenerate supabase/seed.sql from the Excel sample."""
import re
import uuid
import zipfile
import xml.etree.ElementTree as ET
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SAMPLE = ROOT / "docs/samples/INVENTARIO CARITAS STEPHANY.xlsx"
OUTPUT = ROOT / "supabase/seed.sql"
NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}


def uid(name: str) -> str:
    return str(uuid.uuid5(uuid.NAMESPACE_DNS, f"aid-inventory.{name}"))


def infer_category(sub: str) -> str:
    sub = sub.strip().upper()
    if sub == "INSUMO MEDICO":
        return "Medical Supply"
    medicine_keywords = [
        "ANALGES",
        "ANTIBIOT",
        "ANTIHIPERT",
        "ANTIINFLAM",
        "ANTISEPT",
        "CORTICO",
        "VITAMINA",
        "ANTIGRIP",
        "ANTIASMAT",
        "LAXANTE",
        "ANTIDIAB",
        "UROLOG",
        "ANTIEMET",
        "EMOLIENT",
        "ALCALINIZ",
        "SOLUCION ELECTROLIT",
        "HIDRATANTE",
        "CICATRIZ",
        "PROTECTOR",
        "RELAJANTE",
        "ANTIAGREG",
        "SUPLEMENTO",
    ]
    if any(k in sub for k in medicine_keywords):
        return "Medicine"
    return "Other"


def esc(s: str) -> str:
    return s.replace("'", "''")


def main() -> None:
    with zipfile.ZipFile(SAMPLE) as z:
        shared = []
        root = ET.fromstring(z.read("xl/sharedStrings.xml"))
        for si in root.findall("m:si", NS):
            texts = [t.text or "" for t in si.findall(".//m:t", NS)]
            shared.append("".join(texts))
        root = ET.fromstring(z.read("xl/worksheets/sheet1.xml"))
        rows = []
        for row in root.findall(".//m:sheetData/m:row", NS):
            cells = {}
            for c in row.findall("m:c", NS):
                ref = c.get("r", "")
                col = re.match(r"([A-Z]+)", ref).group(1) if ref else ""
                t = c.get("t")
                v = c.find("m:v", NS)
                if v is None or v.text is None:
                    val = ""
                elif t == "s":
                    val = shared[int(v.text)]
                else:
                    val = v.text
                cells[col] = val
            rows.append([cells.get(c, "") for c in ["A", "B", "C", "D", "E", "F"]])

    data = rows[2:]
    warehouse_id = "00000000-0000-0000-0000-000000000001"

    slots: dict[str, str] = {}
    items: dict[str, dict] = {}
    inventory: dict[tuple[str, str], int] = defaultdict(int)

    for r in data:
        slot_num = str(r[0]).strip()
        sub = str(r[1]).strip()
        desc = str(r[2]).strip()
        pres = str(r[3]).strip() or None
        qty = int(float(r[4])) if str(r[4]).strip() else 0
        unit = str(r[5]).strip() or None
        if not slot_num or slot_num == "CAJA #":
            continue
        slot_id = uid(f"slot-{slot_num}")
        slots[slot_num] = slot_id
        item_key = f"{sub}|{desc}|{pres or ''}|{unit or ''}"
        item_id = uid(f"item-{item_key}")
        items[item_key] = {
            "id": item_id,
            "category": infer_category(sub),
            "subcategory": sub,
            "description": desc,
            "presentation": pres,
            "unit": unit,
        }
        if qty > 0:
            inventory[(slot_id, item_id)] += qty

    lines = [
        "-- Seed data from INVENTARIO CARITAS STEPHANY.xlsx",
        "-- Safe to re-run: clears seed tables first, merges duplicate slot+item rows",
        "BEGIN;",
        "",
        "-- Clear previous seed data (keeps users/profiles/warehouse)",
        "TRUNCATE TABLE",
        "  inventory_transactions,",
        "  order_items,",
        "  orders,",
        "  inventory,",
        "  slot_status_history,",
        "  donation_items,",
        "  slots",
        "RESTART IDENTITY CASCADE;",
        "",
        "INSERT INTO slots (id, warehouse_id, number, name, status) VALUES",
    ]

    slot_vals = []
    for num, sid in sorted(slots.items(), key=lambda x: int(x[0]) if x[0].isdigit() else x[0]):
        slot_vals.append(f"  ('{sid}', '{warehouse_id}', '{num}', 'Caja {num}', 'active')")
    lines.append(",\n".join(slot_vals))
    lines.append(";")
    lines.append("")
    lines.append(
        "INSERT INTO donation_items (id, category, subcategory, description, presentation, unit_of_measurement, status) VALUES"
    )

    item_vals = []
    for item in items.values():
        pres = "NULL" if item["presentation"] is None else "'" + esc(item["presentation"]) + "'"
        unit = "NULL" if item["unit"] is None else "'" + esc(item["unit"]) + "'"
        item_vals.append(
            f"  ('{item['id']}', '{item['category']}', '{esc(item['subcategory'])}', "
            f"'{esc(item['description'])}', {pres}, {unit}, 'active')"
        )
    lines.append(",\n".join(item_vals))
    lines.append(";")
    lines.append("")
    lines.append("INSERT INTO inventory (slot_id, donation_item_id, quantity) VALUES")

    inv_vals = []
    for (sid, iid), qty in sorted(inventory.items(), key=lambda x: (x[0][0], x[0][1])):
        inv_vals.append(f"  ('{sid}', '{iid}', {qty})")
    lines.append(",\n".join(inv_vals))
    lines.append(";")
    lines.append("")
    lines.append("COMMIT;")
    lines.append("")

    OUTPUT.write_text("\n".join(lines))
    print(f"Wrote {OUTPUT} ({len(slots)} slots, {len(items)} items, {len(inventory)} inventory rows)")


if __name__ == "__main__":
    main()
