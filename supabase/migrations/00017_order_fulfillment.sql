-- Order fulfillment: picks, merma, RPCs

-- Extend enums
ALTER TYPE inventory_transaction_type ADD VALUE IF NOT EXISTS 'merma';
ALTER TYPE order_item_status ADD VALUE IF NOT EXISTS 'issue';

-- Orders: track completion with issues
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS has_issues BOOLEAN NOT NULL DEFAULT false;

-- Order items: issue tracking
ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS issue_reason TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- Inventory transactions: link to order item + reason
ALTER TABLE inventory_transactions
  ADD COLUMN IF NOT EXISTS order_item_id UUID REFERENCES order_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reason TEXT;

CREATE INDEX IF NOT EXISTS idx_inventory_transactions_order_id
  ON inventory_transactions(order_id);

CREATE INDEX IF NOT EXISTS idx_inventory_transactions_order_item_id
  ON inventory_transactions(order_item_id);

-- Order item picks (per-slot fulfillment)
CREATE TABLE order_item_picks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  order_item_id UUID NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
  donation_item_id UUID NOT NULL REFERENCES donation_items(id) ON DELETE RESTRICT,
  slot_id UUID NOT NULL REFERENCES slots(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('draft', 'confirmed', 'cancelled')),
  inventory_transaction_id UUID UNIQUE REFERENCES inventory_transactions(id) ON DELETE SET NULL,
  picked_by_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  picked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_order_item_picks_order_item ON order_item_picks(order_item_id);
CREATE INDEX idx_order_item_picks_order ON order_item_picks(order_id);
CREATE INDEX idx_order_item_picks_slot_item ON order_item_picks(slot_id, donation_item_id);

CREATE TRIGGER order_item_picks_updated_at
  BEFORE UPDATE ON order_item_picks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE order_item_picks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read order item picks"
  ON order_item_picks FOR SELECT
  TO authenticated
  USING (true);

-- Fix overlapping orders RLS policies
DROP POLICY IF EXISTS "Staff and admin can manage orders" ON orders;

CREATE POLICY "Admin staff collaborator can update orders"
  ON orders FOR UPDATE
  TO authenticated
  USING (public.get_user_role() IN ('admin', 'staff', 'collaborator'))
  WITH CHECK (public.get_user_role() IN ('admin', 'staff', 'collaborator'));

DROP POLICY IF EXISTS "Admin and staff can create orders" ON orders;
DROP POLICY IF EXISTS "Admin staff and collaborator can create orders" ON orders;

CREATE POLICY "Admin staff and collaborator can create orders"
  ON orders FOR INSERT
  TO authenticated
  WITH CHECK (public.get_user_role() IN ('admin', 'staff', 'collaborator'));

-- Helper: assert user can handle orders
CREATE OR REPLACE FUNCTION public.assert_can_handle_orders()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF public.get_user_role() NOT IN ('admin', 'staff', 'collaborator') THEN
    RAISE EXCEPTION 'Insufficient permissions';
  END IF;
END;
$$;

-- Helper: assert user is admin or staff
CREATE OR REPLACE FUNCTION public.assert_admin_or_staff()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF public.get_user_role() NOT IN ('admin', 'staff') THEN
    RAISE EXCEPTION 'Insufficient permissions';
  END IF;
END;
$$;

-- Helper: check order handler access
CREATE OR REPLACE FUNCTION public.can_access_order_handler(p_order_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role user_role;
  v_prepared_by UUID;
BEGIN
  v_role := public.get_user_role();
  IF v_role = 'admin' THEN
    RETURN true;
  END IF;
  SELECT prepared_by_user_id INTO v_prepared_by FROM orders WHERE id = p_order_id;
  RETURN v_prepared_by IS NULL OR v_prepared_by = auth.uid();
END;
$$;

-- Start order: pending -> in_progress
CREATE OR REPLACE FUNCTION public.start_order(p_order_id UUID)
RETURNS orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order orders;
  v_role user_role;
  v_uid UUID := auth.uid();
BEGIN
  PERFORM public.assert_can_handle_orders();

  SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  v_role := public.get_user_role();

  IF v_order.status = 'completed' OR v_order.status = 'cancelled' THEN
    RAISE EXCEPTION 'Order cannot be started';
  END IF;

  IF v_order.status = 'in_progress' THEN
    IF v_role <> 'admin' AND v_order.prepared_by_user_id IS NOT NULL AND v_order.prepared_by_user_id <> v_uid THEN
      RAISE EXCEPTION 'Order is being handled by another user';
    END IF;
    RETURN v_order;
  END IF;

  IF v_order.status <> 'pending' THEN
    RAISE EXCEPTION 'Order is not pending';
  END IF;

  UPDATE orders
  SET
    status = 'in_progress',
    prepared_by_user_id = v_uid,
    prepared_at = now()
  WHERE id = p_order_id
  RETURNING * INTO v_order;

  INSERT INTO order_history (order_id, changed_by, field, old_value, new_value)
  VALUES (p_order_id, v_uid, 'status', 'pending', 'in_progress');

  RETURN v_order;
END;
$$;

-- Confirm picks for an order item (atomic, progressive)
CREATE OR REPLACE FUNCTION public.confirm_order_item_picks(
  p_order_item_id UUID,
  p_picks JSONB
)
RETURNS order_items
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item order_items;
  v_order orders;
  v_pick JSONB;
  v_slot_id UUID;
  v_qty INTEGER;
  v_inv inventory;
  v_new_fulfilled INTEGER;
  v_remaining INTEGER;
  v_txn_id UUID;
  v_uid UUID := auth.uid();
BEGIN
  PERFORM public.assert_can_handle_orders();

  SELECT * INTO v_item FROM order_items WHERE id = p_order_item_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order item not found';
  END IF;

  IF v_item.donation_item_id IS NULL THEN
    RAISE EXCEPTION 'Order item has no product';
  END IF;

  IF v_item.status IN ('fulfilled', 'issue', 'cancelled') THEN
    RAISE EXCEPTION 'Order item cannot be picked';
  END IF;

  SELECT * INTO v_order FROM orders WHERE id = v_item.order_id FOR UPDATE;
  IF v_order.status <> 'in_progress' THEN
    RAISE EXCEPTION 'Order is not in progress';
  END IF;

  IF NOT public.can_access_order_handler(v_order.id) THEN
    RAISE EXCEPTION 'Order is being handled by another user';
  END IF;

  v_remaining := v_item.requested_quantity - v_item.fulfilled_quantity;

  FOR v_pick IN SELECT * FROM jsonb_array_elements(p_picks)
  LOOP
    v_slot_id := (v_pick->>'slot_id')::UUID;
    v_qty := (v_pick->>'quantity')::INTEGER;

    IF v_qty IS NULL OR v_qty <= 0 THEN
      CONTINUE;
    END IF;

    IF v_qty > v_remaining THEN
      RAISE EXCEPTION 'Cannot pick more than remaining quantity (%)', v_remaining;
    END IF;

    SELECT * INTO v_inv
    FROM inventory
    WHERE slot_id = v_slot_id AND donation_item_id = v_item.donation_item_id
    FOR UPDATE;

    IF NOT FOUND OR v_inv.quantity < v_qty THEN
      RAISE EXCEPTION 'Not enough stock in slot';
    END IF;

    INSERT INTO inventory_transactions (
      type,
      donation_item_id,
      from_slot_id,
      order_id,
      order_item_id,
      quantity,
      reason,
      created_by_user_id,
      notes
    ) VALUES (
      'order_fulfillment',
      v_item.donation_item_id,
      v_slot_id,
      v_order.id,
      v_item.id,
      v_qty,
      'ORDER_PICK',
      v_uid,
      'Order ' || v_order.order_number
    )
    RETURNING id INTO v_txn_id;

    UPDATE inventory SET quantity = quantity - v_qty WHERE id = v_inv.id;

    INSERT INTO order_item_picks (
      order_id,
      order_item_id,
      donation_item_id,
      slot_id,
      quantity,
      status,
      inventory_transaction_id,
      picked_by_user_id,
      picked_at
    ) VALUES (
      v_order.id,
      v_item.id,
      v_item.donation_item_id,
      v_slot_id,
      v_qty,
      'confirmed',
      v_txn_id,
      v_uid,
      now()
    );

    v_remaining := v_remaining - v_qty;
  END LOOP;

  SELECT COALESCE(SUM(quantity), 0)::INTEGER INTO v_new_fulfilled
  FROM order_item_picks
  WHERE order_item_id = v_item.id AND status = 'confirmed';

  UPDATE order_items
  SET
    fulfilled_quantity = v_new_fulfilled,
    status = CASE
      WHEN v_new_fulfilled >= requested_quantity THEN 'fulfilled'::order_item_status
      WHEN v_new_fulfilled > 0 THEN 'partially_fulfilled'::order_item_status
      ELSE 'pending'::order_item_status
    END
  WHERE id = v_item.id
  RETURNING * INTO v_item;

  RETURN v_item;
END;
$$;

-- Record merma (shrinkage / loss)
CREATE OR REPLACE FUNCTION public.record_merma(
  p_slot_id UUID,
  p_donation_item_id UUID,
  p_quantity INTEGER,
  p_reason TEXT,
  p_notes TEXT DEFAULT NULL,
  p_order_id UUID DEFAULT NULL,
  p_order_item_id UUID DEFAULT NULL
)
RETURNS inventory_transactions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inv inventory;
  v_txn inventory_transactions;
  v_uid UUID := auth.uid();
BEGIN
  PERFORM public.assert_can_handle_orders();

  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'Quantity must be positive';
  END IF;

  IF p_reason IS NULL OR trim(p_reason) = '' THEN
    RAISE EXCEPTION 'Reason is required';
  END IF;

  SELECT * INTO v_inv
  FROM inventory
  WHERE slot_id = p_slot_id AND donation_item_id = p_donation_item_id
  FOR UPDATE;

  IF NOT FOUND OR v_inv.quantity < p_quantity THEN
    RAISE EXCEPTION 'Not enough stock for merma';
  END IF;

  INSERT INTO inventory_transactions (
    type,
    donation_item_id,
    from_slot_id,
    order_id,
    order_item_id,
    quantity,
    reason,
    created_by_user_id,
    notes
  ) VALUES (
    'merma',
    p_donation_item_id,
    p_slot_id,
    p_order_id,
    p_order_item_id,
    p_quantity,
    p_reason,
    v_uid,
    p_notes
  )
  RETURNING * INTO v_txn;

  UPDATE inventory SET quantity = quantity - p_quantity WHERE id = v_inv.id;

  INSERT INTO audit_logs (action, entity_type, entity_id, actor_id, metadata)
  VALUES (
    'record_merma',
    'inventory_transaction',
    v_txn.id,
    v_uid,
    jsonb_build_object(
      'slot_id', p_slot_id,
      'donation_item_id', p_donation_item_id,
      'quantity', p_quantity,
      'reason', p_reason
    )
  );

  RETURN v_txn;
END;
$$;

-- Mark order item as issue
CREATE OR REPLACE FUNCTION public.mark_order_item_issue(
  p_order_item_id UUID,
  p_reason TEXT,
  p_notes TEXT DEFAULT NULL
)
RETURNS order_items
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item order_items;
  v_order orders;
  v_uid UUID := auth.uid();
  v_role user_role;
BEGIN
  v_role := public.get_user_role();
  IF v_uid IS NULL OR v_role NOT IN ('admin', 'staff', 'collaborator') THEN
    RAISE EXCEPTION 'Insufficient permissions';
  END IF;

  SELECT * INTO v_item FROM order_items WHERE id = p_order_item_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order item not found';
  END IF;

  SELECT * INTO v_order FROM orders WHERE id = v_item.order_id FOR UPDATE;
  IF v_order.status <> 'in_progress' THEN
    RAISE EXCEPTION 'Order is not in progress';
  END IF;

  IF v_role = 'collaborator' AND v_order.prepared_by_user_id IS NOT NULL AND v_order.prepared_by_user_id <> v_uid THEN
    RAISE EXCEPTION 'Order is being handled by another user';
  END IF;

  IF p_reason IS NULL OR trim(p_reason) = '' THEN
    RAISE EXCEPTION 'Issue reason is required';
  END IF;

  UPDATE order_items
  SET
    status = 'issue',
    issue_reason = p_reason,
    notes = COALESCE(p_notes, notes)
  WHERE id = p_order_item_id
  RETURNING * INTO v_item;

  RETURN v_item;
END;
$$;

-- Complete order (idempotent)
CREATE OR REPLACE FUNCTION public.complete_order(p_order_id UUID)
RETURNS orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order orders;
  v_uid UUID := auth.uid();
  v_role user_role;
  v_open_count INTEGER;
  v_issue_count INTEGER;
BEGIN
  PERFORM public.assert_can_handle_orders();

  SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  IF v_order.status = 'completed' THEN
    RETURN v_order;
  END IF;

  IF v_order.status <> 'in_progress' THEN
    RAISE EXCEPTION 'Order is not in progress';
  END IF;

  v_role := public.get_user_role();
  IF NOT public.can_access_order_handler(p_order_id) AND v_role <> 'admin' THEN
    RAISE EXCEPTION 'Order is being handled by another user';
  END IF;

  SELECT COUNT(*) INTO v_open_count
  FROM order_items
  WHERE order_id = p_order_id
    AND status NOT IN ('fulfilled', 'issue', 'cancelled', 'unavailable');

  IF v_open_count > 0 THEN
    RAISE EXCEPTION 'Not all items are fulfilled or marked as issue';
  END IF;

  SELECT COUNT(*) INTO v_issue_count
  FROM order_items
  WHERE order_id = p_order_id AND status = 'issue';

  IF v_issue_count > 0 AND v_role NOT IN ('admin', 'staff') THEN
    RAISE EXCEPTION 'Only admin or staff can complete orders with issues';
  END IF;

  UPDATE orders
  SET
    status = 'completed',
    has_issues = (v_issue_count > 0),
    completed_by_user_id = v_uid,
    completed_at = now()
  WHERE id = p_order_id
  RETURNING * INTO v_order;

  INSERT INTO order_history (order_id, changed_by, field, old_value, new_value)
  VALUES (p_order_id, v_uid, 'status', 'in_progress', 'completed');

  RETURN v_order;
END;
$$;

-- Cancel order (admin/staff, no confirmed picks)
CREATE OR REPLACE FUNCTION public.cancel_order(
  p_order_id UUID,
  p_notes TEXT DEFAULT NULL
)
RETURNS orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order orders;
  v_pick_count INTEGER;
  v_uid UUID := auth.uid();
BEGIN
  PERFORM public.assert_admin_or_staff();

  SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  IF v_order.status IN ('completed', 'cancelled') THEN
    RAISE EXCEPTION 'Order cannot be cancelled';
  END IF;

  SELECT COUNT(*) INTO v_pick_count
  FROM order_item_picks
  WHERE order_id = p_order_id AND status = 'confirmed';

  IF v_pick_count > 0 THEN
    RAISE EXCEPTION 'Cannot cancel order with confirmed picks';
  END IF;

  INSERT INTO order_history (order_id, changed_by, field, old_value, new_value)
  VALUES (p_order_id, v_uid, 'status', v_order.status::TEXT, 'cancelled');

  UPDATE orders
  SET
    status = 'cancelled',
    cancelled_at = now(),
    requester_notes = COALESCE(p_notes, requester_notes)
  WHERE id = p_order_id
  RETURNING * INTO v_order;

  RETURN v_order;
END;
$$;

GRANT EXECUTE ON FUNCTION public.start_order(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_order_item_picks(UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_merma(UUID, UUID, INTEGER, TEXT, TEXT, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_order_item_issue(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_order(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_order(UUID, TEXT) TO authenticated;
