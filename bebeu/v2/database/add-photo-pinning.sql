USE bebeu;

ALTER TABLE photos
  ADD COLUMN IF NOT EXISTS photos_is_pinned TINYINT(1) NOT NULL DEFAULT 0 AFTER photos_sort_order,
  ADD COLUMN IF NOT EXISTS photos_pinned_at DATETIME NULL AFTER photos_is_pinned;

CREATE INDEX IF NOT EXISTS idx_photos_order_pin_sort
  ON photos (
    photos_order_idx,
    photos_product_index,
    photos_is_pinned,
    photos_pinned_at,
    photos_sort_order
  );
