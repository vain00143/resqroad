-- ResQRoad database schema (MySQL 8.0+, also works on MariaDB 10.4+ / XAMPP).
-- `npm run db:setup` creates the database and runs this file. Every statement
-- is safe to run again: it only creates what is missing.
--
-- All times are stored in UTC.

CREATE TABLE IF NOT EXISTS users (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name          VARCHAR(80)  NOT NULL,
  email         VARCHAR(120) NOT NULL,
  password_hash VARCHAR(100) NOT NULL,
  role          ENUM('admin', 'maintenance', 'citizen') NOT NULL,
  team          VARCHAR(80)  NULL COMMENT 'Maintenance crews only',
  active        TINYINT(1)   NOT NULL DEFAULT 1,
  created_at    DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at    DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  deleted_at    DATETIME(3)  NULL COMMENT 'Deleted crew accounts keep their row for report history',
  PRIMARY KEY (id),
  UNIQUE KEY users_email (email),
  KEY users_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Signed-in devices. Only a SHA-256 hash of each session token is stored.
CREATE TABLE IF NOT EXISTS sessions (
  token_hash   CHAR(64)     NOT NULL,
  user_id      INT UNSIGNED NOT NULL,
  client       VARCHAR(20)  NOT NULL DEFAULT 'web' COMMENT 'web or mobile',
  user_agent   VARCHAR(255) NULL,
  created_at   DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  last_seen_at DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  expires_at   DATETIME(3)  NOT NULL,
  PRIMARY KEY (token_hash),
  KEY sessions_user (user_id),
  KEY sessions_expires (expires_at),
  CONSTRAINT sessions_user_fk FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Road damage reports. The public report ID is "RPT-" followed by `id`.
CREATE TABLE IF NOT EXISTS reports (
  id                  INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  title               VARCHAR(120)  NOT NULL,
  road                VARCHAR(120)  NOT NULL,
  location            VARCHAR(160)  NOT NULL,
  latitude            DECIMAL(9, 6) NOT NULL,
  longitude           DECIMAL(9, 6) NOT NULL,
  severity            ENUM('Low', 'Medium', 'High') NOT NULL,
  description         TEXT          NOT NULL,
  status              ENUM('submitted', 'under_review', 'verified', 'assigned', 'in_progress',
                           'repair_submitted', 'resolved', 'rejected', 'duplicate') NOT NULL DEFAULT 'submitted',
  reporter_id         INT UNSIGNED  NULL,
  client_key          VARCHAR(64)   NULL COMMENT 'Idempotency-Key from the app: a retried upload returns this report',
  assigned_to         INT UNSIGNED  NULL,
  assigned_name       VARCHAR(80)   NULL COMMENT 'Kept even if the crew account is deleted',
  repair_notes        TEXT          NULL,
  repair_client_key   VARCHAR(64)   NULL COMMENT 'Idempotency-Key of the latest repair upload',
  repair_submitted_at DATETIME(3)   NULL,
  reported_at         DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at          DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY reports_status (status),
  KEY reports_reporter (reporter_id),
  UNIQUE KEY reports_client_key (reporter_id, client_key),
  KEY reports_assigned (assigned_to),
  KEY reports_location (latitude, longitude),
  CONSTRAINT reports_reporter_fk FOREIGN KEY (reporter_id) REFERENCES users (id) ON DELETE SET NULL,
  CONSTRAINT reports_assigned_fk FOREIGN KEY (assigned_to) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=1001 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Every workflow decision, in order. Shown on the report timeline.
CREATE TABLE IF NOT EXISTS report_history (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  report_id   INT UNSIGNED NOT NULL,
  status      VARCHAR(20)  NOT NULL,
  description VARCHAR(255) NOT NULL,
  actor       VARCHAR(80)  NOT NULL,
  actor_id    INT UNSIGNED NULL,
  note        TEXT         NULL COMMENT 'Reason shown to the resident or crew',
  created_at  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY history_report (report_id, created_at),
  CONSTRAINT history_report_fk FOREIGN KEY (report_id) REFERENCES reports (id) ON DELETE CASCADE,
  CONSTRAINT history_actor_fk FOREIGN KEY (actor_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Internal staff notes. Only administrators can read them.
CREATE TABLE IF NOT EXISTS report_notes (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  report_id  INT UNSIGNED NOT NULL,
  note       TEXT         NOT NULL,
  actor      VARCHAR(80)  NOT NULL,
  actor_id   INT UNSIGNED NULL,
  created_at DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY notes_report (report_id, created_at),
  CONSTRAINT notes_report_fk FOREIGN KEY (report_id) REFERENCES reports (id) ON DELETE CASCADE,
  CONSTRAINT notes_actor_fk FOREIGN KEY (actor_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Evidence and repair photos. The image files live in storage/photos/;
-- `file_path` is relative to that folder. Sample reports list file names only
-- (file_path is NULL), and the website shows stock road photos for them.
CREATE TABLE IF NOT EXISTS photos (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  report_id   INT UNSIGNED NOT NULL,
  kind        ENUM('evidence', 'before', 'after') NOT NULL,
  name        VARCHAR(160) NOT NULL COMMENT 'Original file name',
  file_path   VARCHAR(255) NULL,
  mime_type   VARCHAR(40)  NULL,
  size_bytes  INT UNSIGNED NULL,
  sort_order  TINYINT UNSIGNED NOT NULL DEFAULT 0,
  uploaded_by INT UNSIGNED NULL,
  created_at  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  replaced_at DATETIME(3)  NULL COMMENT 'Set on earlier repair photos when a repair is resubmitted',
  PRIMARY KEY (id),
  KEY photos_report (report_id, kind),
  CONSTRAINT photos_report_fk FOREIGN KEY (report_id) REFERENCES reports (id) ON DELETE CASCADE,
  CONSTRAINT photos_uploader_fk FOREIGN KEY (uploaded_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Photo files kept in the database (PHOTO_STORAGE=database), for hosts with
-- no permanent disk. Served from /uploads/<file_path>, like files on disk.
CREATE TABLE IF NOT EXISTS photo_data (
  photo_id   INT UNSIGNED NOT NULL,
  file_path  VARCHAR(255) NOT NULL,
  mime_type  VARCHAR(40)  NOT NULL,
  data       MEDIUMBLOB   NOT NULL,
  PRIMARY KEY (photo_id),
  UNIQUE KEY photo_data_path (file_path),
  CONSTRAINT photo_data_photo_fk FOREIGN KEY (photo_id) REFERENCES photos (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
