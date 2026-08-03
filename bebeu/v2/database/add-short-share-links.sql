USE bebeu;

CREATE TABLE IF NOT EXISTS share_links (
  share_links_idx VARCHAR(16) NOT NULL,
  share_links_order_idx VARCHAR(64) NOT NULL,
  share_links_hidden_photo_ids LONGTEXT NULL,
  share_links_customer_memo TEXT NULL,
  share_links_created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  share_links_updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (share_links_idx),
  UNIQUE KEY uk_share_links_order_idx (share_links_order_idx),
  KEY idx_share_links_updated_at (share_links_updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
