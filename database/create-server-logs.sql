USE bebeu;

CREATE TABLE IF NOT EXISTS server_logs (
  server_logs_idx VARCHAR(64) NOT NULL,
  server_logs_level VARCHAR(20) NOT NULL,
  server_logs_message VARCHAR(500) NOT NULL,
  server_logs_details LONGTEXT NULL,
  server_logs_line LONGTEXT NOT NULL,
  server_logs_created_at DATETIME NOT NULL,
  PRIMARY KEY (server_logs_idx),
  KEY idx_server_logs_created_at (server_logs_created_at),
  KEY idx_server_logs_level_created_at (server_logs_level, server_logs_created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
