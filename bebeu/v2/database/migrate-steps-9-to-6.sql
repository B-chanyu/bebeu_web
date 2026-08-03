USE bebeu;

-- 9단계 -> 6단계
-- 01       -> 01 접수
-- 02,03,04 -> 02 세탁 전 · 탈거 (기존 구성품 포함)
-- 05,06    -> 03 세탁 후 · 살균
-- 07       -> 04 배송대기
-- 08       -> 05 문자전송
-- 09       -> 06 완료

CREATE TABLE IF NOT EXISTS app_migrations (
  app_migrations_idx VARCHAR(100) NOT NULL,
  app_migrations_description VARCHAR(255) NOT NULL,
  app_migrations_applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (app_migrations_idx)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DELIMITER //

DROP PROCEDURE IF EXISTS migrate_steps_9_to_6//
CREATE PROCEDURE migrate_steps_9_to_6()
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM app_migrations
    WHERE app_migrations_idx = 'steps_9_to_6_v1'
  ) THEN
    -- 원본 전체 백업: 마이그레이션 직전 데이터가 보존됩니다.
    CREATE TABLE IF NOT EXISTS migration_backup_20260618_orders LIKE orders;
    INSERT IGNORE INTO migration_backup_20260618_orders
    SELECT * FROM orders;

    CREATE TABLE IF NOT EXISTS migration_backup_20260618_photos LIKE photos;
    INSERT IGNORE INTO migration_backup_20260618_photos
    SELECT * FROM photos;

    CREATE TABLE IF NOT EXISTS migration_backup_20260618_step_memos LIKE order_step_memos;
    INSERT IGNORE INTO migration_backup_20260618_step_memos
    SELECT * FROM order_step_memos;

    -- 각 행에도 기존 단계값을 남겨 추후 확인할 수 있게 합니다.
    ALTER TABLE orders
      ADD COLUMN IF NOT EXISTS orders_legacy_step_code CHAR(2) NULL
      AFTER orders_current_step;

    ALTER TABLE photos
      ADD COLUMN IF NOT EXISTS photos_legacy_step_code CHAR(2) NULL
      AFTER photos_step_name,
      ADD COLUMN IF NOT EXISTS photos_legacy_step_name VARCHAR(40) NULL
      AFTER photos_legacy_step_code;

    UPDATE orders
    SET orders_legacy_step_code = orders_current_step
    WHERE orders_legacy_step_code IS NULL;

    UPDATE photos
    SET
      photos_legacy_step_code = photos_step_code,
      photos_legacy_step_name = photos_step_name
    WHERE photos_legacy_step_code IS NULL;

    SET SESSION group_concat_max_len = 1048576;

    DROP TEMPORARY TABLE IF EXISTS tmp_step_memos_6;
    CREATE TEMPORARY TABLE tmp_step_memos_6 (
      order_idx VARCHAR(64) NOT NULL,
      step_code CHAR(2) NOT NULL,
      memo LONGTEXT NULL,
      updated_at DATETIME NOT NULL,
      PRIMARY KEY (order_idx, step_code)
    ) ENGINE=InnoDB;

    INSERT INTO tmp_step_memos_6 (order_idx, step_code, memo, updated_at)
    SELECT
      order_step_memos_order_idx,
      CASE order_step_memos_step_code
        WHEN '01' THEN '01'
        WHEN '02' THEN '02'
        WHEN '03' THEN '02'
        WHEN '04' THEN '02'
        WHEN '05' THEN '03'
        WHEN '06' THEN '03'
        WHEN '07' THEN '04'
        WHEN '08' THEN '05'
        WHEN '09' THEN '06'
        ELSE order_step_memos_step_code
      END,
      GROUP_CONCAT(
        NULLIF(TRIM(order_step_memos_memo), '')
        ORDER BY order_step_memos_step_code
        SEPARATOR '\n'
      ),
      MAX(order_step_memos_updated_at)
    FROM order_step_memos
    GROUP BY
      order_step_memos_order_idx,
      CASE order_step_memos_step_code
        WHEN '01' THEN '01'
        WHEN '02' THEN '02'
        WHEN '03' THEN '02'
        WHEN '04' THEN '02'
        WHEN '05' THEN '03'
        WHEN '06' THEN '03'
        WHEN '07' THEN '04'
        WHEN '08' THEN '05'
        WHEN '09' THEN '06'
        ELSE order_step_memos_step_code
      END;

    START TRANSACTION;

    UPDATE orders
    SET orders_current_step = CASE orders_legacy_step_code
      WHEN '01' THEN '01'
      WHEN '02' THEN '02'
      WHEN '03' THEN '02'
      WHEN '04' THEN '02'
      WHEN '05' THEN '03'
      WHEN '06' THEN '03'
      WHEN '07' THEN '04'
      WHEN '08' THEN '05'
      WHEN '09' THEN '06'
      ELSE orders_current_step
    END;

    UPDATE orders
    SET
      orders_status = CASE
        WHEN orders_current_step IN ('04', '05', '06') THEN '완료'
        ELSE '진행중'
      END,
      orders_completed_at = CASE
        WHEN orders_current_step IN ('04', '05', '06')
          THEN COALESCE(orders_completed_at, NOW())
        ELSE NULL
      END;

    UPDATE photos
    SET
      photos_step_code = CASE photos_legacy_step_code
        WHEN '01' THEN '01'
        WHEN '02' THEN '02'
        WHEN '03' THEN '02'
        WHEN '04' THEN '02'
        WHEN '05' THEN '03'
        WHEN '06' THEN '03'
        WHEN '07' THEN '04'
        WHEN '08' THEN '05'
        WHEN '09' THEN '06'
        ELSE photos_step_code
      END,
      photos_step_name = CASE photos_legacy_step_code
        WHEN '01' THEN '접수'
        WHEN '02' THEN '세탁 전 · 탈거'
        WHEN '03' THEN '세탁 전 · 탈거'
        WHEN '04' THEN '세탁 전 · 탈거'
        WHEN '05' THEN '세탁 후 · 살균'
        WHEN '06' THEN '세탁 후 · 살균'
        WHEN '07' THEN '배송대기'
        WHEN '08' THEN '문자전송'
        WHEN '09' THEN '완료'
        ELSE photos_step_name
      END;

    DELETE FROM order_step_memos;

    INSERT INTO order_step_memos (
      order_step_memos_idx,
      order_step_memos_order_idx,
      order_step_memos_step_code,
      order_step_memos_memo,
      order_step_memos_updated_at
    )
    SELECT
      CONCAT('sm-', MD5(CONCAT(order_idx, '|', step_code))),
      order_idx,
      step_code,
      memo,
      updated_at
    FROM tmp_step_memos_6;

    INSERT INTO app_migrations (
      app_migrations_idx,
      app_migrations_description,
      app_migrations_applied_at
    ) VALUES (
      'steps_9_to_6_v1',
      '9단계를 6단계 그룹으로 통합',
      NOW()
    );

    COMMIT;
    DROP TEMPORARY TABLE IF EXISTS tmp_step_memos_6;
  END IF;
END//

DELIMITER ;

CALL migrate_steps_9_to_6();
DROP PROCEDURE IF EXISTS migrate_steps_9_to_6;

-- 적용 결과 확인
SELECT orders_current_step, orders_status, COUNT(*) AS order_count
FROM orders
GROUP BY orders_current_step, orders_status
ORDER BY orders_current_step, orders_status;

SELECT photos_step_code, photos_step_name, COUNT(*) AS photo_count
FROM photos
GROUP BY photos_step_code, photos_step_name
ORDER BY photos_step_code, photos_step_name;

SELECT *
FROM app_migrations
WHERE app_migrations_idx = 'steps_9_to_6_v1';
