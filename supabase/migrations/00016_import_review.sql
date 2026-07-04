-- Import review queue and consolidation audit trail

CREATE TYPE import_review_status AS ENUM (
  'PENDING_REVIEW',
  'IN_REVIEW',
  'RESOLVED',
  'IGNORED'
);

ALTER TABLE donation_items
  ADD COLUMN IF NOT EXISTS needs_review BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_donation_items_needs_review
  ON donation_items(needs_review)
  WHERE needs_review = true AND deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS import_review_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL,
  entity_id UUID,
  source_file TEXT NOT NULL,
  source_sheet TEXT,
  source_row_number INTEGER,
  action_taken TEXT NOT NULL,
  warning_code TEXT NOT NULL,
  warning_message TEXT,
  original_row_json JSONB,
  suggested_fix TEXT,
  review_status import_review_status NOT NULL DEFAULT 'PENDING_REVIEW',
  resolved_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_import_review_status ON import_review_items(review_status);
CREATE INDEX IF NOT EXISTS idx_import_review_warning ON import_review_items(warning_code);
CREATE INDEX IF NOT EXISTS idx_import_review_action ON import_review_items(action_taken);
CREATE INDEX IF NOT EXISTS idx_import_review_entity ON import_review_items(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_import_review_source ON import_review_items(source_file, source_row_number);

CREATE TRIGGER import_review_items_updated_at
  BEFORE UPDATE ON import_review_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE IF NOT EXISTS import_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  source_file TEXT NOT NULL,
  source_row_number INTEGER,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_import_audit_logs_entity ON import_audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_import_audit_logs_source ON import_audit_logs(source_file, source_row_number);
CREATE INDEX IF NOT EXISTS idx_import_audit_logs_action ON import_audit_logs(action);

ALTER TABLE import_review_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read import review items"
  ON import_review_items FOR SELECT
  USING (public.get_user_role() = 'admin');

CREATE POLICY "Admins can insert import review items"
  ON import_review_items FOR INSERT
  WITH CHECK (public.get_user_role() = 'admin');

CREATE POLICY "Admins can update import review items"
  ON import_review_items FOR UPDATE
  USING (public.get_user_role() = 'admin')
  WITH CHECK (public.get_user_role() = 'admin');

CREATE POLICY "Admins can read import audit logs"
  ON import_audit_logs FOR SELECT
  USING (public.get_user_role() = 'admin');

CREATE POLICY "Admins can insert import audit logs"
  ON import_audit_logs FOR INSERT
  WITH CHECK (public.get_user_role() = 'admin');
