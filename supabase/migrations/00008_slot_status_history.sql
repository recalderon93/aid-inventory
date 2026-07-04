-- Slot status history

CREATE TABLE slot_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_id UUID NOT NULL REFERENCES slots(id) ON DELETE CASCADE,
  old_status slot_status,
  new_status slot_status NOT NULL,
  changed_by_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_slot_status_history_slot_id ON slot_status_history(slot_id);
