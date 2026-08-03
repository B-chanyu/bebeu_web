CREATE DATABASE IF NOT EXISTS bebeu
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE bebeu;

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS staff_requests;
DROP TABLE IF EXISTS app_settings;
DROP TABLE IF EXISTS keep_notes;
DROP TABLE IF EXISTS admin_memos;
DROP TABLE IF EXISTS attendance;
DROP TABLE IF EXISTS work_logs;
DROP TABLE IF EXISTS photos;
DROP TABLE IF EXISTS order_step_memos;
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS branches;
SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE branches (
  branches_idx VARCHAR(64) NOT NULL,
  branches_name VARCHAR(80) NOT NULL,
  branches_created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (branches_idx)
);

CREATE TABLE users (
  users_idx VARCHAR(64) NOT NULL,
  users_branch_idx VARCHAR(64) NULL,
  users_name VARCHAR(80) NOT NULL,
  users_phone VARCHAR(30) NULL,
  users_role VARCHAR(40) NOT NULL DEFAULT 'staff',
  users_password_hash VARCHAR(128) NULL,
  users_is_active TINYINT(1) NOT NULL DEFAULT 1,
  users_clocked_in TINYINT(1) NOT NULL DEFAULT 0,
  users_clock_in_at DATETIME NULL,
  users_created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (users_idx),
  KEY idx_users_branch (users_branch_idx),
  CONSTRAINT fk_users_branch FOREIGN KEY (users_branch_idx) REFERENCES branches (branches_idx)
);

CREATE TABLE orders (
  orders_idx VARCHAR(64) NOT NULL,
  orders_branch_idx VARCHAR(64) NULL,
  orders_serial VARCHAR(40) NOT NULL,
  orders_registration_date VARCHAR(8) NOT NULL DEFAULT '26/06/09',
  orders_route_type VARCHAR(40) NOT NULL,
  orders_customer_name VARCHAR(80) NULL,
  orders_customer_phone VARCHAR(30) NULL,
  orders_customer_address VARCHAR(255) NULL,
  orders_product_type VARCHAR(40) NULL,
  orders_brand VARCHAR(80) NULL,
  orders_model_name VARCHAR(120) NULL,
  orders_request_memo TEXT NULL,
  orders_worker VARCHAR(80) NULL,
  orders_current_step CHAR(2) NOT NULL DEFAULT '01',
  orders_legacy_step_code CHAR(2) NULL,
  orders_status VARCHAR(40) NOT NULL DEFAULT 'active',
  orders_share_status VARCHAR(40) NOT NULL DEFAULT 'not_shared',
  orders_naver_cafe_status VARCHAR(40) NOT NULL DEFAULT '대기',
  orders_naver_cafe_url VARCHAR(500) NULL,
  orders_naver_cafe_posted_at DATETIME NULL,
  orders_naver_cafe_error TEXT NULL,
  orders_is_urgent TINYINT(1) NOT NULL DEFAULT 0,
  orders_created_by VARCHAR(64) NULL,
  orders_created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  orders_updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  orders_completed_at DATETIME NULL,
  PRIMARY KEY (orders_idx),
  KEY idx_orders_serial (orders_serial),
  KEY idx_orders_status_step (orders_status, orders_current_step),
  KEY idx_orders_created_at (orders_created_at),
  CONSTRAINT fk_orders_branch FOREIGN KEY (orders_branch_idx) REFERENCES branches (branches_idx),
  CONSTRAINT fk_orders_created_by FOREIGN KEY (orders_created_by) REFERENCES users (users_idx)
);

CREATE TABLE order_step_memos (
  order_step_memos_idx VARCHAR(64) NOT NULL,
  order_step_memos_order_idx VARCHAR(64) NOT NULL,
  order_step_memos_step_code CHAR(2) NOT NULL,
  order_step_memos_memo TEXT NULL,
  order_step_memos_updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (order_step_memos_idx),
  UNIQUE KEY uk_order_step_memos_order_step (order_step_memos_order_idx, order_step_memos_step_code),
  CONSTRAINT fk_step_memos_order FOREIGN KEY (order_step_memos_order_idx) REFERENCES orders (orders_idx) ON DELETE CASCADE
);

CREATE TABLE photos (
  photos_idx VARCHAR(64) NOT NULL,
  photos_order_idx VARCHAR(64) NOT NULL,
  photos_product_index TINYINT UNSIGNED NOT NULL DEFAULT 1,
  photos_sort_order INT NOT NULL DEFAULT 0,
  photos_is_pinned TINYINT(1) NOT NULL DEFAULT 0,
  photos_pinned_at DATETIME NULL,
  photos_step_code CHAR(2) NOT NULL,
  photos_step_name VARCHAR(40) NOT NULL,
  photos_legacy_step_code CHAR(2) NULL,
  photos_legacy_step_name VARCHAR(40) NULL,
  photos_file_path VARCHAR(500) NOT NULL,
  photos_url VARCHAR(500) NOT NULL,
  photos_display_file_path VARCHAR(500) NULL,
  photos_display_url VARCHAR(500) NULL,
  photos_original_file_name VARCHAR(255) NULL,
  photos_mime_type VARCHAR(120) NULL,
  photos_memo TEXT NULL,
  photos_uploaded_by VARCHAR(80) NULL,
  photos_uploaded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  photos_is_deleted TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (photos_idx),
  KEY idx_photos_order_product_step (photos_order_idx, photos_product_index, photos_step_code),
  KEY idx_photos_order_step_sort (photos_order_idx, photos_step_code, photos_product_index, photos_sort_order),
  KEY idx_photos_order_pin_sort (photos_order_idx, photos_product_index, photos_is_pinned, photos_pinned_at, photos_sort_order),
  CONSTRAINT fk_photos_order FOREIGN KEY (photos_order_idx) REFERENCES orders (orders_idx) ON DELETE CASCADE
);

CREATE TABLE work_logs (
  work_logs_idx VARCHAR(64) NOT NULL,
  work_logs_order_idx VARCHAR(64) NOT NULL,
  work_logs_serial VARCHAR(40) NOT NULL,
  work_logs_action_type VARCHAR(80) NOT NULL,
  work_logs_memo TEXT NULL,
  work_logs_worker VARCHAR(80) NULL,
  work_logs_created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (work_logs_idx),
  KEY idx_work_logs_order (work_logs_order_idx, work_logs_created_at),
  CONSTRAINT fk_logs_order FOREIGN KEY (work_logs_order_idx) REFERENCES orders (orders_idx) ON DELETE CASCADE
);

CREATE TABLE attendance (
  attendance_idx VARCHAR(64) NOT NULL,
  attendance_user_idx VARCHAR(64) NOT NULL,
  attendance_user_name VARCHAR(80) NOT NULL,
  attendance_action_type VARCHAR(20) NOT NULL,
  attendance_created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (attendance_idx),
  KEY idx_attendance_user (attendance_user_idx, attendance_created_at),
  CONSTRAINT fk_attendance_user FOREIGN KEY (attendance_user_idx) REFERENCES users (users_idx)
);

CREATE TABLE admin_memos (
  admin_memos_idx VARCHAR(64) NOT NULL,
  admin_memos_title VARCHAR(120) NOT NULL,
  admin_memos_body TEXT NOT NULL,
  admin_memos_created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (admin_memos_idx)
);

CREATE TABLE keep_notes (
  keep_notes_idx VARCHAR(64) NOT NULL,
  keep_notes_owner_user_idx VARCHAR(64) NOT NULL,
  keep_notes_owner_name VARCHAR(80) NOT NULL,
  keep_notes_type VARCHAR(20) NOT NULL DEFAULT 'text',
  keep_notes_title VARCHAR(255) NULL,
  keep_notes_body TEXT NULL,
  keep_notes_items_json LONGTEXT NULL,
  keep_notes_collaborators_json LONGTEXT NULL,
  keep_notes_is_pinned TINYINT(1) NOT NULL DEFAULT 0,
  keep_notes_created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  keep_notes_updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  keep_notes_deleted_at DATETIME NULL,
  PRIMARY KEY (keep_notes_idx),
  KEY idx_keep_notes_owner_updated (keep_notes_owner_user_idx, keep_notes_updated_at),
  KEY idx_keep_notes_pinned_updated (keep_notes_is_pinned, keep_notes_updated_at)
);

CREATE TABLE staff_requests (
  staff_requests_idx VARCHAR(64) NOT NULL,
  staff_requests_user_idx VARCHAR(64) NOT NULL,
  staff_requests_request_type VARCHAR(60) NOT NULL,
  staff_requests_title VARCHAR(120) NOT NULL,
  staff_requests_body TEXT NULL,
  staff_requests_status VARCHAR(40) NOT NULL DEFAULT 'open',
  staff_requests_created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  staff_requests_resolved_at DATETIME NULL,
  PRIMARY KEY (staff_requests_idx),
  KEY idx_staff_requests_user_status (staff_requests_user_idx, staff_requests_status),
  CONSTRAINT fk_requests_user FOREIGN KEY (staff_requests_user_idx) REFERENCES users (users_idx)
);

CREATE TABLE app_settings (
  app_settings_key VARCHAR(120) NOT NULL,
  app_settings_value LONGTEXT NULL,
  app_settings_updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (app_settings_key)
);
