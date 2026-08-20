-- Unique constraint: one follow-up per (rfq, type) to prevent duplicate scheduling
ALTER TABLE follow_ups ADD CONSTRAINT follow_ups_rfq_id_type_key UNIQUE (rfq_id, type);

-- Indexes for hot query columns identified in pre-merge review
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_assigned_to_id ON leads(assigned_to_id);
CREATE INDEX IF NOT EXISTS idx_follow_ups_rfq_id ON follow_ups(rfq_id);
CREATE INDEX IF NOT EXISTS idx_follow_ups_status ON follow_ups(status);
CREATE INDEX IF NOT EXISTS idx_quotations_rfq_id ON quotations(rfq_id);
CREATE INDEX IF NOT EXISTS idx_quotations_status ON quotations(status);
