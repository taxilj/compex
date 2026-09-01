-- Prevent duplicate line numbers and multiple winning quotes. If historical
-- data violates either invariant, this migration fails rather than silently
-- choosing or deleting commercial data.
CREATE UNIQUE INDEX "rfq_items_rfq_id_line_number_key"
  ON "rfq_items"("rfq_id", "line_number");

CREATE UNIQUE INDEX "vendor_quotes_one_selected_per_rfq_item"
  ON "vendor_quotes"("rfq_item_id")
  WHERE "status" = 'SELECTED';
