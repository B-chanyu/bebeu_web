USE bebeu;

ALTER TABLE photos
  ADD COLUMN IF NOT EXISTS photos_sort_order INT NOT NULL DEFAULT 0 AFTER photos_product_index;

CREATE INDEX IF NOT EXISTS idx_photos_order_step_sort
  ON photos (photos_order_idx, photos_step_code, photos_product_index, photos_sort_order);
