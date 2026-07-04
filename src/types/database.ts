export type UserRole = "admin" | "staff" | "collaborator";
export type UserStatus = "active" | "inactive" | "on_hold" | "disabled";
export type SlotStatus = "active" | "inactive" | "archived" | "shipped" | "reserved";
export type DonationItemStatus = "active" | "out_of_stock" | "needed" | "archived";
export type OrderStatus = "draft" | "pending" | "in_progress" | "ready_for_pickup" | "completed" | "cancelled";
export type OrderItemStatus = "pending" | "partially_fulfilled" | "fulfilled" | "unavailable" | "cancelled";
export type InventoryTransactionType =
  | "inbound"
  | "outbound"
  | "relocation"
  | "adjustment"
  | "order_fulfillment"
  | "slot_deactivation"
  | "slot_shipment";

export type ImportReviewStatus = "PENDING_REVIEW" | "IN_REVIEW" | "RESOLVED" | "IGNORED";

export interface Profile {
  id: string;
  name: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  phone: string | null;
  role: UserRole;
  status: UserStatus;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  last_login_at: string | null;
}

export interface AuditLog {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  actor_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface OrderHistory {
  id: string;
  order_id: string;
  changed_by: string | null;
  field: string;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
}

export interface ImportReviewItem {
  id: string;
  entity_type: string;
  entity_id: string | null;
  source_file: string;
  source_sheet: string | null;
  source_row_number: number | null;
  action_taken: string;
  warning_code: string;
  warning_message: string | null;
  original_row_json: Record<string, unknown> | null;
  suggested_fix: string | null;
  review_status: ImportReviewStatus;
  resolved_by: string | null;
  resolved_at: string | null;
  resolution_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ImportAuditLog {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  source_file: string;
  source_row_number: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface Slot {
  id: string;
  warehouse_id: string;
  number: string;
  name: string | null;
  status: SlotStatus;
  created_at: string;
  updated_at: string;
}

export interface DonationItem {
  id: string;
  category: string;
  subcategory: string | null;
  description: string;
  presentation: string | null;
  unit_of_measurement: string | null;
  status: DonationItemStatus;
  needs_review: boolean;
  created_at: string;
  updated_at: string;
}

export interface InventoryRow {
  id: string;
  slot_id: string;
  donation_item_id: string;
  quantity: number;
  slot?: Slot;
  donation_item?: DonationItem;
}

export interface InventoryTransaction {
  id: string;
  type: InventoryTransactionType;
  donation_item_id: string;
  from_slot_id: string | null;
  to_slot_id: string | null;
  order_id: string | null;
  quantity: number;
  created_by_user_id: string | null;
  notes: string | null;
  created_at: string;
  donation_item?: DonationItem;
  from_slot?: Slot;
  to_slot?: Slot;
}

export interface Order {
  id: string;
  order_number: string;
  requester_name: string;
  requester_phone: string | null;
  requester_email: string | null;
  requester_address: string | null;
  requester_city: string | null;
  requester_state: string | null;
  requester_notes: string | null;
  status: OrderStatus;
  created_by_user_id: string | null;
  prepared_by_user_id: string | null;
  completed_by_user_id: string | null;
  created_at: string;
  updated_at: string;
  prepared_at: string | null;
  completed_at: string | null;
}

export interface OrderItem {
  id: string;
  order_id: string;
  donation_item_id: string | null;
  requested_quantity: number;
  fulfilled_quantity: number;
  status: OrderItemStatus;
  donation_item?: DonationItem;
}

export const VENEZUELAN_STATES = [
  "Amazonas", "Anzoátegui", "Apure", "Aragua", "Barinas", "Bolívar",
  "Carabobo", "Cojedes", "Delta Amacuro", "Distrito Capital", "Falcón",
  "Guárico", "Lara", "Mérida", "Miranda", "Monagas", "Nueva Esparta",
  "Portuguesa", "Sucre", "Táchira", "Trujillo", "La Guaira", "Yaracuy", "Zulia",
] as const;
