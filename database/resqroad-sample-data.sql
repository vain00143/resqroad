-- ResQRoad sample database (MySQL 8.0)
--
-- The complete database: every table (see database/schema.sql for comments
-- on each one) filled with the sample data from `npm run seed`:
--   12 sample accounts (fictional people: 1 administrator, 3 maintenance
--   crews, 8 residents) and 21 sample reports with their full history and
--   photo names. No real people's data.
--
-- Passwords are stored as bcrypt hashes. The sample sign-ins are listed in
-- README.md under "Sample accounts".
--
-- To load it on a computer that has no `resqroad` database yet, open the
-- MySQL prompt (mysql -u root -p) and run:
--   source C:/path/to/Project/database/resqroad-sample-data.sql
-- It stops with "Table ... already exists" instead of overwriting an
-- existing resqroad database.

-- MySQL dump 10.13  Distrib 8.0.44, for Win64 (x86_64)
--
-- Host: 127.0.0.1    Database: resqroad
-- ------------------------------------------------------
-- Server version	8.0.44

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Current Database: `resqroad`
--

CREATE DATABASE /*!32312 IF NOT EXISTS*/ `resqroad` /*!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci */ /*!80016 DEFAULT ENCRYPTION='N' */;

USE `resqroad`;

--
-- Table structure for table `photos`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `photos` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `report_id` int unsigned NOT NULL,
  `kind` enum('evidence','before','after') COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(160) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Original file name',
  `file_path` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `mime_type` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `size_bytes` int unsigned DEFAULT NULL,
  `sort_order` tinyint unsigned NOT NULL DEFAULT '0',
  `uploaded_by` int unsigned DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `replaced_at` datetime(3) DEFAULT NULL COMMENT 'Set on earlier repair photos when a repair is resubmitted',
  PRIMARY KEY (`id`),
  KEY `photos_report` (`report_id`,`kind`),
  KEY `photos_uploader_fk` (`uploaded_by`),
  CONSTRAINT `photos_report_fk` FOREIGN KEY (`report_id`) REFERENCES `reports` (`id`) ON DELETE CASCADE,
  CONSTRAINT `photos_uploader_fk` FOREIGN KEY (`uploaded_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=44 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `photos`
--

LOCK TABLES `photos` WRITE;
/*!40000 ALTER TABLE `photos` DISABLE KEYS */;
INSERT INTO `photos` (`id`, `report_id`, `kind`, `name`, `file_path`, `mime_type`, `size_bytes`, `sort_order`, `uploaded_by`, `created_at`, `replaced_at`) VALUES (1,1048,'evidence','rpt-1048.jpg',NULL,NULL,NULL,0,NULL,'2026-10-21 19:34:36.663',NULL);
INSERT INTO `photos` (`id`, `report_id`, `kind`, `name`, `file_path`, `mime_type`, `size_bytes`, `sort_order`, `uploaded_by`, `created_at`, `replaced_at`) VALUES (2,1047,'evidence','rpt-1047.jpg',NULL,NULL,NULL,0,NULL,'2026-10-19 23:10:36.663',NULL);
INSERT INTO `photos` (`id`, `report_id`, `kind`, `name`, `file_path`, `mime_type`, `size_bytes`, `sort_order`, `uploaded_by`, `created_at`, `replaced_at`) VALUES (3,1046,'evidence','rpt-1046.jpg',NULL,NULL,NULL,0,NULL,'2026-10-17 23:10:36.663',NULL);
INSERT INTO `photos` (`id`, `report_id`, `kind`, `name`, `file_path`, `mime_type`, `size_bytes`, `sort_order`, `uploaded_by`, `created_at`, `replaced_at`) VALUES (4,1045,'evidence','rpt-1045.jpg',NULL,NULL,NULL,0,NULL,'2026-10-14 23:10:36.663',NULL);
INSERT INTO `photos` (`id`, `report_id`, `kind`, `name`, `file_path`, `mime_type`, `size_bytes`, `sort_order`, `uploaded_by`, `created_at`, `replaced_at`) VALUES (5,1044,'evidence','rpt-1044.jpg',NULL,NULL,NULL,0,NULL,'2026-10-09 23:10:36.663',NULL);
INSERT INTO `photos` (`id`, `report_id`, `kind`, `name`, `file_path`, `mime_type`, `size_bytes`, `sort_order`, `uploaded_by`, `created_at`, `replaced_at`) VALUES (6,1043,'evidence','rpt-1043.jpg',NULL,NULL,NULL,0,NULL,'2026-10-05 23:10:36.663',NULL);
INSERT INTO `photos` (`id`, `report_id`, `kind`, `name`, `file_path`, `mime_type`, `size_bytes`, `sort_order`, `uploaded_by`, `created_at`, `replaced_at`) VALUES (7,1043,'before','repair-before.jpg',NULL,NULL,NULL,1,NULL,'2026-10-05 23:10:36.663',NULL);
INSERT INTO `photos` (`id`, `report_id`, `kind`, `name`, `file_path`, `mime_type`, `size_bytes`, `sort_order`, `uploaded_by`, `created_at`, `replaced_at`) VALUES (8,1043,'after','repair-after.jpg',NULL,NULL,NULL,2,NULL,'2026-10-05 23:10:36.663',NULL);
INSERT INTO `photos` (`id`, `report_id`, `kind`, `name`, `file_path`, `mime_type`, `size_bytes`, `sort_order`, `uploaded_by`, `created_at`, `replaced_at`) VALUES (9,1042,'evidence','rpt-1042.jpg',NULL,NULL,NULL,0,NULL,'2026-09-19 23:10:36.663',NULL);
INSERT INTO `photos` (`id`, `report_id`, `kind`, `name`, `file_path`, `mime_type`, `size_bytes`, `sort_order`, `uploaded_by`, `created_at`, `replaced_at`) VALUES (10,1042,'before','plaridel-before.jpg',NULL,NULL,NULL,1,NULL,'2026-09-19 23:10:36.663',NULL);
INSERT INTO `photos` (`id`, `report_id`, `kind`, `name`, `file_path`, `mime_type`, `size_bytes`, `sort_order`, `uploaded_by`, `created_at`, `replaced_at`) VALUES (11,1042,'after','plaridel-after.jpg',NULL,NULL,NULL,2,NULL,'2026-09-19 23:10:36.663',NULL);
INSERT INTO `photos` (`id`, `report_id`, `kind`, `name`, `file_path`, `mime_type`, `size_bytes`, `sort_order`, `uploaded_by`, `created_at`, `replaced_at`) VALUES (12,1041,'evidence','rpt-1041.jpg',NULL,NULL,NULL,0,NULL,'2026-09-05 23:10:36.663',NULL);
INSERT INTO `photos` (`id`, `report_id`, `kind`, `name`, `file_path`, `mime_type`, `size_bytes`, `sort_order`, `uploaded_by`, `created_at`, `replaced_at`) VALUES (13,1051,'evidence','rpt-1051.jpg',NULL,NULL,NULL,0,NULL,'2026-10-21 15:58:36.663',NULL);
INSERT INTO `photos` (`id`, `report_id`, `kind`, `name`, `file_path`, `mime_type`, `size_bytes`, `sort_order`, `uploaded_by`, `created_at`, `replaced_at`) VALUES (14,1052,'evidence','rpt-1052.jpg',NULL,NULL,NULL,0,NULL,'2026-10-21 11:10:36.663',NULL);
INSERT INTO `photos` (`id`, `report_id`, `kind`, `name`, `file_path`, `mime_type`, `size_bytes`, `sort_order`, `uploaded_by`, `created_at`, `replaced_at`) VALUES (15,1053,'evidence','rpt-1053.jpg',NULL,NULL,NULL,0,NULL,'2026-10-21 03:58:36.663',NULL);
INSERT INTO `photos` (`id`, `report_id`, `kind`, `name`, `file_path`, `mime_type`, `size_bytes`, `sort_order`, `uploaded_by`, `created_at`, `replaced_at`) VALUES (16,1031,'evidence','rpt-1031.jpg',NULL,NULL,NULL,0,NULL,'2026-03-07 23:10:36.663',NULL);
INSERT INTO `photos` (`id`, `report_id`, `kind`, `name`, `file_path`, `mime_type`, `size_bytes`, `sort_order`, `uploaded_by`, `created_at`, `replaced_at`) VALUES (17,1031,'before','rpt-1031-before.jpg',NULL,NULL,NULL,1,NULL,'2026-03-07 23:10:36.663',NULL);
INSERT INTO `photos` (`id`, `report_id`, `kind`, `name`, `file_path`, `mime_type`, `size_bytes`, `sort_order`, `uploaded_by`, `created_at`, `replaced_at`) VALUES (18,1031,'after','rpt-1031-after.jpg',NULL,NULL,NULL,2,NULL,'2026-03-07 23:10:36.663',NULL);
INSERT INTO `photos` (`id`, `report_id`, `kind`, `name`, `file_path`, `mime_type`, `size_bytes`, `sort_order`, `uploaded_by`, `created_at`, `replaced_at`) VALUES (19,1032,'evidence','rpt-1032.jpg',NULL,NULL,NULL,0,NULL,'2026-03-21 23:10:36.663',NULL);
INSERT INTO `photos` (`id`, `report_id`, `kind`, `name`, `file_path`, `mime_type`, `size_bytes`, `sort_order`, `uploaded_by`, `created_at`, `replaced_at`) VALUES (20,1032,'before','rpt-1032-before.jpg',NULL,NULL,NULL,1,NULL,'2026-03-21 23:10:36.663',NULL);
INSERT INTO `photos` (`id`, `report_id`, `kind`, `name`, `file_path`, `mime_type`, `size_bytes`, `sort_order`, `uploaded_by`, `created_at`, `replaced_at`) VALUES (21,1032,'after','rpt-1032-after.jpg',NULL,NULL,NULL,2,NULL,'2026-03-21 23:10:36.663',NULL);
INSERT INTO `photos` (`id`, `report_id`, `kind`, `name`, `file_path`, `mime_type`, `size_bytes`, `sort_order`, `uploaded_by`, `created_at`, `replaced_at`) VALUES (22,1033,'evidence','rpt-1033.jpg',NULL,NULL,NULL,0,NULL,'2026-04-08 23:10:36.663',NULL);
INSERT INTO `photos` (`id`, `report_id`, `kind`, `name`, `file_path`, `mime_type`, `size_bytes`, `sort_order`, `uploaded_by`, `created_at`, `replaced_at`) VALUES (23,1033,'before','rpt-1033-before.jpg',NULL,NULL,NULL,1,NULL,'2026-04-08 23:10:36.663',NULL);
INSERT INTO `photos` (`id`, `report_id`, `kind`, `name`, `file_path`, `mime_type`, `size_bytes`, `sort_order`, `uploaded_by`, `created_at`, `replaced_at`) VALUES (24,1033,'after','rpt-1033-after.jpg',NULL,NULL,NULL,2,NULL,'2026-04-08 23:10:36.663',NULL);
INSERT INTO `photos` (`id`, `report_id`, `kind`, `name`, `file_path`, `mime_type`, `size_bytes`, `sort_order`, `uploaded_by`, `created_at`, `replaced_at`) VALUES (25,1034,'evidence','rpt-1034.jpg',NULL,NULL,NULL,0,NULL,'2026-05-03 23:10:36.663',NULL);
INSERT INTO `photos` (`id`, `report_id`, `kind`, `name`, `file_path`, `mime_type`, `size_bytes`, `sort_order`, `uploaded_by`, `created_at`, `replaced_at`) VALUES (26,1035,'evidence','rpt-1035.jpg',NULL,NULL,NULL,0,NULL,'2026-05-16 23:10:36.663',NULL);
INSERT INTO `photos` (`id`, `report_id`, `kind`, `name`, `file_path`, `mime_type`, `size_bytes`, `sort_order`, `uploaded_by`, `created_at`, `replaced_at`) VALUES (27,1035,'before','rpt-1035-before.jpg',NULL,NULL,NULL,1,NULL,'2026-05-16 23:10:36.663',NULL);
INSERT INTO `photos` (`id`, `report_id`, `kind`, `name`, `file_path`, `mime_type`, `size_bytes`, `sort_order`, `uploaded_by`, `created_at`, `replaced_at`) VALUES (28,1035,'after','rpt-1035-after.jpg',NULL,NULL,NULL,2,NULL,'2026-05-16 23:10:36.663',NULL);
INSERT INTO `photos` (`id`, `report_id`, `kind`, `name`, `file_path`, `mime_type`, `size_bytes`, `sort_order`, `uploaded_by`, `created_at`, `replaced_at`) VALUES (29,1036,'evidence','rpt-1036.jpg',NULL,NULL,NULL,0,NULL,'2026-06-10 23:10:36.663',NULL);
INSERT INTO `photos` (`id`, `report_id`, `kind`, `name`, `file_path`, `mime_type`, `size_bytes`, `sort_order`, `uploaded_by`, `created_at`, `replaced_at`) VALUES (30,1036,'before','rpt-1036-before.jpg',NULL,NULL,NULL,1,NULL,'2026-06-10 23:10:36.663',NULL);
INSERT INTO `photos` (`id`, `report_id`, `kind`, `name`, `file_path`, `mime_type`, `size_bytes`, `sort_order`, `uploaded_by`, `created_at`, `replaced_at`) VALUES (31,1036,'after','rpt-1036-after.jpg',NULL,NULL,NULL,2,NULL,'2026-06-10 23:10:36.663',NULL);
INSERT INTO `photos` (`id`, `report_id`, `kind`, `name`, `file_path`, `mime_type`, `size_bytes`, `sort_order`, `uploaded_by`, `created_at`, `replaced_at`) VALUES (32,1037,'evidence','rpt-1037.jpg',NULL,NULL,NULL,0,NULL,'2026-07-09 23:10:36.663',NULL);
INSERT INTO `photos` (`id`, `report_id`, `kind`, `name`, `file_path`, `mime_type`, `size_bytes`, `sort_order`, `uploaded_by`, `created_at`, `replaced_at`) VALUES (33,1037,'before','rpt-1037-before.jpg',NULL,NULL,NULL,1,NULL,'2026-07-09 23:10:36.663',NULL);
INSERT INTO `photos` (`id`, `report_id`, `kind`, `name`, `file_path`, `mime_type`, `size_bytes`, `sort_order`, `uploaded_by`, `created_at`, `replaced_at`) VALUES (34,1037,'after','rpt-1037-after.jpg',NULL,NULL,NULL,2,NULL,'2026-07-09 23:10:36.663',NULL);
INSERT INTO `photos` (`id`, `report_id`, `kind`, `name`, `file_path`, `mime_type`, `size_bytes`, `sort_order`, `uploaded_by`, `created_at`, `replaced_at`) VALUES (35,1038,'evidence','rpt-1038.jpg',NULL,NULL,NULL,0,NULL,'2026-08-05 23:10:36.663',NULL);
INSERT INTO `photos` (`id`, `report_id`, `kind`, `name`, `file_path`, `mime_type`, `size_bytes`, `sort_order`, `uploaded_by`, `created_at`, `replaced_at`) VALUES (36,1038,'before','rpt-1038-before.jpg',NULL,NULL,NULL,1,NULL,'2026-08-05 23:10:36.663',NULL);
INSERT INTO `photos` (`id`, `report_id`, `kind`, `name`, `file_path`, `mime_type`, `size_bytes`, `sort_order`, `uploaded_by`, `created_at`, `replaced_at`) VALUES (37,1038,'after','rpt-1038-after.jpg',NULL,NULL,NULL,2,NULL,'2026-08-05 23:10:36.663',NULL);
INSERT INTO `photos` (`id`, `report_id`, `kind`, `name`, `file_path`, `mime_type`, `size_bytes`, `sort_order`, `uploaded_by`, `created_at`, `replaced_at`) VALUES (38,1039,'evidence','rpt-1039.jpg',NULL,NULL,NULL,0,NULL,'2026-08-24 23:10:36.664',NULL);
INSERT INTO `photos` (`id`, `report_id`, `kind`, `name`, `file_path`, `mime_type`, `size_bytes`, `sort_order`, `uploaded_by`, `created_at`, `replaced_at`) VALUES (39,1039,'before','rpt-1039-before.jpg',NULL,NULL,NULL,1,NULL,'2026-08-24 23:10:36.664',NULL);
INSERT INTO `photos` (`id`, `report_id`, `kind`, `name`, `file_path`, `mime_type`, `size_bytes`, `sort_order`, `uploaded_by`, `created_at`, `replaced_at`) VALUES (40,1039,'after','rpt-1039-after.jpg',NULL,NULL,NULL,2,NULL,'2026-08-24 23:10:36.664',NULL);
INSERT INTO `photos` (`id`, `report_id`, `kind`, `name`, `file_path`, `mime_type`, `size_bytes`, `sort_order`, `uploaded_by`, `created_at`, `replaced_at`) VALUES (41,1040,'evidence','rpt-1040.jpg',NULL,NULL,NULL,0,NULL,'2026-09-10 23:10:36.664',NULL);
INSERT INTO `photos` (`id`, `report_id`, `kind`, `name`, `file_path`, `mime_type`, `size_bytes`, `sort_order`, `uploaded_by`, `created_at`, `replaced_at`) VALUES (42,1040,'before','rpt-1040-before.jpg',NULL,NULL,NULL,1,NULL,'2026-09-10 23:10:36.664',NULL);
INSERT INTO `photos` (`id`, `report_id`, `kind`, `name`, `file_path`, `mime_type`, `size_bytes`, `sort_order`, `uploaded_by`, `created_at`, `replaced_at`) VALUES (43,1040,'after','rpt-1040-after.jpg',NULL,NULL,NULL,2,NULL,'2026-09-10 23:10:36.664',NULL);
/*!40000 ALTER TABLE `photos` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `report_history`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `report_history` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `report_id` int unsigned NOT NULL,
  `status` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `actor` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `actor_id` int unsigned DEFAULT NULL,
  `note` text COLLATE utf8mb4_unicode_ci COMMENT 'Reason shown to the resident or crew',
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `history_report` (`report_id`,`created_at`),
  KEY `history_actor_fk` (`actor_id`),
  CONSTRAINT `history_actor_fk` FOREIGN KEY (`actor_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `history_report_fk` FOREIGN KEY (`report_id`) REFERENCES `reports` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=85 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `report_history`
--

LOCK TABLES `report_history` WRITE;
/*!40000 ALTER TABLE `report_history` DISABLE KEYS */;
INSERT INTO `report_history` (`id`, `report_id`, `status`, `description`, `actor`, `actor_id`, `note`, `created_at`) VALUES (1,1048,'submitted','Report received from a citizen.','ResQRoad',5,NULL,'2026-10-21 19:34:36.663');
INSERT INTO `report_history` (`id`, `report_id`, `status`, `description`, `actor`, `actor_id`, `note`, `created_at`) VALUES (2,1047,'submitted','Report received from a citizen.','ResQRoad',6,NULL,'2026-10-19 23:10:36.663');
INSERT INTO `report_history` (`id`, `report_id`, `status`, `description`, `actor`, `actor_id`, `note`, `created_at`) VALUES (3,1047,'under_review','Administrator started reviewing this report.','Admin User',1,NULL,'2026-10-21 11:10:36.663');
INSERT INTO `report_history` (`id`, `report_id`, `status`, `description`, `actor`, `actor_id`, `note`, `created_at`) VALUES (4,1046,'submitted','Report received from a citizen.','ResQRoad',7,NULL,'2026-10-17 23:10:36.663');
INSERT INTO `report_history` (`id`, `report_id`, `status`, `description`, `actor`, `actor_id`, `note`, `created_at`) VALUES (5,1046,'verified','Administrator confirmed the reported road damage.','Admin User',1,NULL,'2026-10-19 11:10:36.663');
INSERT INTO `report_history` (`id`, `report_id`, `status`, `description`, `actor`, `actor_id`, `note`, `created_at`) VALUES (6,1045,'submitted','Report received from a citizen.','ResQRoad',9,NULL,'2026-10-14 23:10:36.663');
INSERT INTO `report_history` (`id`, `report_id`, `status`, `description`, `actor`, `actor_id`, `note`, `created_at`) VALUES (7,1045,'verified','Administrator confirmed the report.','Admin User',1,NULL,'2026-10-15 23:10:36.663');
INSERT INTO `report_history` (`id`, `report_id`, `status`, `description`, `actor`, `actor_id`, `note`, `created_at`) VALUES (8,1045,'assigned','Assigned to Juan Reyes.','Administrator',1,NULL,'2026-10-16 23:10:36.663');
INSERT INTO `report_history` (`id`, `report_id`, `status`, `description`, `actor`, `actor_id`, `note`, `created_at`) VALUES (9,1044,'submitted','Report received from a citizen.','ResQRoad',8,NULL,'2026-10-09 23:10:36.663');
INSERT INTO `report_history` (`id`, `report_id`, `status`, `description`, `actor`, `actor_id`, `note`, `created_at`) VALUES (10,1044,'verified','Administrator confirmed the report.','Admin User',1,NULL,'2026-10-11 23:10:36.663');
INSERT INTO `report_history` (`id`, `report_id`, `status`, `description`, `actor`, `actor_id`, `note`, `created_at`) VALUES (11,1044,'assigned','Assigned to Ana Cruz.','Administrator',1,NULL,'2026-10-12 23:10:36.663');
INSERT INTO `report_history` (`id`, `report_id`, `status`, `description`, `actor`, `actor_id`, `note`, `created_at`) VALUES (12,1044,'in_progress','Repair inspection has started.','Ana Cruz',3,NULL,'2026-10-18 23:10:36.663');
INSERT INTO `report_history` (`id`, `report_id`, `status`, `description`, `actor`, `actor_id`, `note`, `created_at`) VALUES (13,1043,'submitted','Report received from a citizen.','ResQRoad',10,NULL,'2026-10-05 23:10:36.663');
INSERT INTO `report_history` (`id`, `report_id`, `status`, `description`, `actor`, `actor_id`, `note`, `created_at`) VALUES (14,1043,'verified','Administrator confirmed the report.','Admin User',1,NULL,'2026-10-07 23:10:36.663');
INSERT INTO `report_history` (`id`, `report_id`, `status`, `description`, `actor`, `actor_id`, `note`, `created_at`) VALUES (15,1043,'assigned','Assigned to Juan Reyes.','Administrator',1,NULL,'2026-10-08 23:10:36.663');
INSERT INTO `report_history` (`id`, `report_id`, `status`, `description`, `actor`, `actor_id`, `note`, `created_at`) VALUES (16,1043,'in_progress','Repair inspection has started.','Juan Reyes',2,NULL,'2026-10-12 23:10:36.663');
INSERT INTO `report_history` (`id`, `report_id`, `status`, `description`, `actor`, `actor_id`, `note`, `created_at`) VALUES (17,1043,'repair_submitted','Repair submitted for admin verification.','Juan Reyes',2,NULL,'2026-10-21 08:46:36.663');
INSERT INTO `report_history` (`id`, `report_id`, `status`, `description`, `actor`, `actor_id`, `note`, `created_at`) VALUES (18,1042,'submitted','Report received from a citizen.','ResQRoad',11,NULL,'2026-09-19 23:10:36.663');
INSERT INTO `report_history` (`id`, `report_id`, `status`, `description`, `actor`, `actor_id`, `note`, `created_at`) VALUES (19,1042,'verified','Administrator confirmed the report.','Admin User',1,NULL,'2026-09-20 23:10:36.663');
INSERT INTO `report_history` (`id`, `report_id`, `status`, `description`, `actor`, `actor_id`, `note`, `created_at`) VALUES (20,1042,'assigned','Assigned to Leo Santos.','Administrator',1,NULL,'2026-09-21 23:10:36.663');
INSERT INTO `report_history` (`id`, `report_id`, `status`, `description`, `actor`, `actor_id`, `note`, `created_at`) VALUES (21,1042,'in_progress','Repair work started.','Leo Santos',4,NULL,'2026-09-24 23:10:36.663');
INSERT INTO `report_history` (`id`, `report_id`, `status`, `description`, `actor`, `actor_id`, `note`, `created_at`) VALUES (22,1042,'repair_submitted','Repair submitted for admin verification.','Leo Santos',4,NULL,'2026-09-26 23:10:36.663');
INSERT INTO `report_history` (`id`, `report_id`, `status`, `description`, `actor`, `actor_id`, `note`, `created_at`) VALUES (23,1042,'resolved','Administrator verified the repair and closed the report.','Admin User',1,NULL,'2026-09-27 23:10:36.663');
INSERT INTO `report_history` (`id`, `report_id`, `status`, `description`, `actor`, `actor_id`, `note`, `created_at`) VALUES (24,1041,'submitted','Report received from a citizen.','ResQRoad',12,NULL,'2026-09-05 23:10:36.663');
INSERT INTO `report_history` (`id`, `report_id`, `status`, `description`, `actor`, `actor_id`, `note`, `created_at`) VALUES (25,1041,'duplicate','Marked as a duplicate of another nearby report.','Admin User',1,NULL,'2026-09-06 23:10:36.663');
INSERT INTO `report_history` (`id`, `report_id`, `status`, `description`, `actor`, `actor_id`, `note`, `created_at`) VALUES (26,1051,'submitted','Report received from a citizen.','ResQRoad',6,NULL,'2026-10-21 15:58:36.663');
INSERT INTO `report_history` (`id`, `report_id`, `status`, `description`, `actor`, `actor_id`, `note`, `created_at`) VALUES (27,1052,'submitted','Report received from a citizen.','ResQRoad',7,NULL,'2026-10-21 11:10:36.663');
INSERT INTO `report_history` (`id`, `report_id`, `status`, `description`, `actor`, `actor_id`, `note`, `created_at`) VALUES (28,1053,'submitted','Report received from a citizen.','ResQRoad',8,NULL,'2026-10-21 03:58:36.663');
INSERT INTO `report_history` (`id`, `report_id`, `status`, `description`, `actor`, `actor_id`, `note`, `created_at`) VALUES (29,1031,'submitted','Report received from a citizen.','ResQRoad',5,NULL,'2026-03-07 23:10:36.663');
INSERT INTO `report_history` (`id`, `report_id`, `status`, `description`, `actor`, `actor_id`, `note`, `created_at`) VALUES (30,1031,'verified','Administrator confirmed the reported road damage.','Admin User',1,NULL,'2026-03-08 23:10:36.663');
INSERT INTO `report_history` (`id`, `report_id`, `status`, `description`, `actor`, `actor_id`, `note`, `created_at`) VALUES (31,1031,'assigned','Assigned to Leo Santos.','Admin User',1,NULL,'2026-03-09 23:10:36.663');
INSERT INTO `report_history` (`id`, `report_id`, `status`, `description`, `actor`, `actor_id`, `note`, `created_at`) VALUES (32,1031,'in_progress','Repair work started.','Leo Santos',4,NULL,'2026-03-10 23:10:36.663');
INSERT INTO `report_history` (`id`, `report_id`, `status`, `description`, `actor`, `actor_id`, `note`, `created_at`) VALUES (33,1031,'repair_submitted','Repair submitted for admin verification.','Leo Santos',4,NULL,'2026-03-16 23:10:36.663');
INSERT INTO `report_history` (`id`, `report_id`, `status`, `description`, `actor`, `actor_id`, `note`, `created_at`) VALUES (34,1031,'resolved','Administrator verified the repair and closed the report.','Admin User',1,NULL,'2026-03-17 23:10:36.663');
INSERT INTO `report_history` (`id`, `report_id`, `status`, `description`, `actor`, `actor_id`, `note`, `created_at`) VALUES (35,1032,'submitted','Report received from a citizen.','ResQRoad',9,NULL,'2026-03-21 23:10:36.663');
INSERT INTO `report_history` (`id`, `report_id`, `status`, `description`, `actor`, `actor_id`, `note`, `created_at`) VALUES (36,1032,'verified','Administrator confirmed the reported road damage.','Admin User',1,NULL,'2026-03-22 23:10:36.663');
INSERT INTO `report_history` (`id`, `report_id`, `status`, `description`, `actor`, `actor_id`, `note`, `created_at`) VALUES (37,1032,'assigned','Assigned to Juan Reyes.','Admin User',1,NULL,'2026-03-23 23:10:36.663');
INSERT INTO `report_history` (`id`, `report_id`, `status`, `description`, `actor`, `actor_id`, `note`, `created_at`) VALUES (38,1032,'in_progress','Repair work started.','Juan Reyes',2,NULL,'2026-03-24 23:10:36.663');
INSERT INTO `report_history` (`id`, `report_id`, `status`, `description`, `actor`, `actor_id`, `note`, `created_at`) VALUES (39,1032,'repair_submitted','Repair submitted for admin verification.','Juan Reyes',2,NULL,'2026-03-27 23:10:36.663');
INSERT INTO `report_history` (`id`, `report_id`, `status`, `description`, `actor`, `actor_id`, `note`, `created_at`) VALUES (40,1032,'resolved','Administrator verified the repair and closed the report.','Admin User',1,NULL,'2026-03-28 23:10:36.663');
INSERT INTO `report_history` (`id`, `report_id`, `status`, `description`, `actor`, `actor_id`, `note`, `created_at`) VALUES (41,1033,'submitted','Report received from a citizen.','ResQRoad',6,NULL,'2026-04-08 23:10:36.663');
INSERT INTO `report_history` (`id`, `report_id`, `status`, `description`, `actor`, `actor_id`, `note`, `created_at`) VALUES (42,1033,'verified','Administrator confirmed the reported road damage.','Admin User',1,NULL,'2026-04-09 23:10:36.663');
INSERT INTO `report_history` (`id`, `report_id`, `status`, `description`, `actor`, `actor_id`, `note`, `created_at`) VALUES (43,1033,'assigned','Assigned to Ana Cruz.','Admin User',1,NULL,'2026-04-10 23:10:36.663');
INSERT INTO `report_history` (`id`, `report_id`, `status`, `description`, `actor`, `actor_id`, `note`, `created_at`) VALUES (44,1033,'in_progress','Repair work started.','Ana Cruz',3,NULL,'2026-04-11 23:10:36.663');
INSERT INTO `report_history` (`id`, `report_id`, `status`, `description`, `actor`, `actor_id`, `note`, `created_at`) VALUES (45,1033,'repair_submitted','Repair submitted for admin verification.','Ana Cruz',3,NULL,'2026-04-16 23:10:36.663');
INSERT INTO `report_history` (`id`, `report_id`, `status`, `description`, `actor`, `actor_id`, `note`, `created_at`) VALUES (46,1033,'resolved','Administrator verified the repair and closed the report.','Admin User',1,NULL,'2026-04-17 23:10:36.663');
INSERT INTO `report_history` (`id`, `report_id`, `status`, `description`, `actor`, `actor_id`, `note`, `created_at`) VALUES (47,1034,'submitted','Report received from a citizen.','ResQRoad',10,NULL,'2026-05-03 23:10:36.663');
INSERT INTO `report_history` (`id`, `report_id`, `status`, `description`, `actor`, `actor_id`, `note`, `created_at`) VALUES (48,1034,'rejected','Administrator rejected this report.','Admin User',1,'Inspection found no road damage at the reported location.','2026-05-04 23:10:36.663');
INSERT INTO `report_history` (`id`, `report_id`, `status`, `description`, `actor`, `actor_id`, `note`, `created_at`) VALUES (49,1035,'submitted','Report received from a citizen.','ResQRoad',7,NULL,'2026-05-16 23:10:36.663');
INSERT INTO `report_history` (`id`, `report_id`, `status`, `description`, `actor`, `actor_id`, `note`, `created_at`) VALUES (50,1035,'verified','Administrator confirmed the reported road damage.','Admin User',1,NULL,'2026-05-17 23:10:36.663');
INSERT INTO `report_history` (`id`, `report_id`, `status`, `description`, `actor`, `actor_id`, `note`, `created_at`) VALUES (51,1035,'assigned','Assigned to Leo Santos.','Admin User',1,NULL,'2026-05-18 23:10:36.663');
INSERT INTO `report_history` (`id`, `report_id`, `status`, `description`, `actor`, `actor_id`, `note`, `created_at`) VALUES (52,1035,'in_progress','Repair work started.','Leo Santos',4,NULL,'2026-05-19 23:10:36.663');
INSERT INTO `report_history` (`id`, `report_id`, `status`, `description`, `actor`, `actor_id`, `note`, `created_at`) VALUES (53,1035,'repair_submitted','Repair submitted for admin verification.','Leo Santos',4,NULL,'2026-05-23 23:10:36.663');
INSERT INTO `report_history` (`id`, `report_id`, `status`, `description`, `actor`, `actor_id`, `note`, `created_at`) VALUES (54,1035,'resolved','Administrator verified the repair and closed the report.','Admin User',1,NULL,'2026-05-24 23:10:36.663');
INSERT INTO `report_history` (`id`, `report_id`, `status`, `description`, `actor`, `actor_id`, `note`, `created_at`) VALUES (55,1036,'submitted','Report received from a citizen.','ResQRoad',11,NULL,'2026-06-10 23:10:36.663');
INSERT INTO `report_history` (`id`, `report_id`, `status`, `description`, `actor`, `actor_id`, `note`, `created_at`) VALUES (56,1036,'verified','Administrator confirmed the reported road damage.','Admin User',1,NULL,'2026-06-11 23:10:36.663');
INSERT INTO `report_history` (`id`, `report_id`, `status`, `description`, `actor`, `actor_id`, `note`, `created_at`) VALUES (57,1036,'assigned','Assigned to Juan Reyes.','Admin User',1,NULL,'2026-06-12 23:10:36.663');
INSERT INTO `report_history` (`id`, `report_id`, `status`, `description`, `actor`, `actor_id`, `note`, `created_at`) VALUES (58,1036,'in_progress','Repair work started.','Juan Reyes',2,NULL,'2026-06-13 23:10:36.663');
INSERT INTO `report_history` (`id`, `report_id`, `status`, `description`, `actor`, `actor_id`, `note`, `created_at`) VALUES (59,1036,'repair_submitted','Repair submitted for admin verification.','Juan Reyes',2,NULL,'2026-06-21 23:10:36.663');
INSERT INTO `report_history` (`id`, `report_id`, `status`, `description`, `actor`, `actor_id`, `note`, `created_at`) VALUES (60,1036,'resolved','Administrator verified the repair and closed the report.','Admin User',1,NULL,'2026-06-22 23:10:36.663');
INSERT INTO `report_history` (`id`, `report_id`, `status`, `description`, `actor`, `actor_id`, `note`, `created_at`) VALUES (61,1037,'submitted','Report received from a citizen.','ResQRoad',12,NULL,'2026-07-09 23:10:36.663');
INSERT INTO `report_history` (`id`, `report_id`, `status`, `description`, `actor`, `actor_id`, `note`, `created_at`) VALUES (62,1037,'verified','Administrator confirmed the reported road damage.','Admin User',1,NULL,'2026-07-10 23:10:36.663');
INSERT INTO `report_history` (`id`, `report_id`, `status`, `description`, `actor`, `actor_id`, `note`, `created_at`) VALUES (63,1037,'assigned','Assigned to Ana Cruz.','Admin User',1,NULL,'2026-07-11 23:10:36.663');
INSERT INTO `report_history` (`id`, `report_id`, `status`, `description`, `actor`, `actor_id`, `note`, `created_at`) VALUES (64,1037,'in_progress','Repair work started.','Ana Cruz',3,NULL,'2026-07-12 23:10:36.663');
INSERT INTO `report_history` (`id`, `report_id`, `status`, `description`, `actor`, `actor_id`, `note`, `created_at`) VALUES (65,1037,'repair_submitted','Repair submitted for admin verification.','Ana Cruz',3,NULL,'2026-07-15 23:10:36.663');
INSERT INTO `report_history` (`id`, `report_id`, `status`, `description`, `actor`, `actor_id`, `note`, `created_at`) VALUES (66,1037,'resolved','Administrator verified the repair and closed the report.','Admin User',1,NULL,'2026-07-16 23:10:36.663');
INSERT INTO `report_history` (`id`, `report_id`, `status`, `description`, `actor`, `actor_id`, `note`, `created_at`) VALUES (67,1038,'submitted','Report received from a citizen.','ResQRoad',5,NULL,'2026-08-05 23:10:36.663');
INSERT INTO `report_history` (`id`, `report_id`, `status`, `description`, `actor`, `actor_id`, `note`, `created_at`) VALUES (68,1038,'verified','Administrator confirmed the reported road damage.','Admin User',1,NULL,'2026-08-06 23:10:36.663');
INSERT INTO `report_history` (`id`, `report_id`, `status`, `description`, `actor`, `actor_id`, `note`, `created_at`) VALUES (69,1038,'assigned','Assigned to Juan Reyes.','Admin User',1,NULL,'2026-08-07 23:10:36.663');
INSERT INTO `report_history` (`id`, `report_id`, `status`, `description`, `actor`, `actor_id`, `note`, `created_at`) VALUES (70,1038,'in_progress','Repair work started.','Juan Reyes',2,NULL,'2026-08-08 23:10:36.663');
INSERT INTO `report_history` (`id`, `report_id`, `status`, `description`, `actor`, `actor_id`, `note`, `created_at`) VALUES (71,1038,'repair_submitted','Repair submitted for admin verification.','Juan Reyes',2,NULL,'2026-08-10 23:10:36.663');
INSERT INTO `report_history` (`id`, `report_id`, `status`, `description`, `actor`, `actor_id`, `note`, `created_at`) VALUES (72,1038,'resolved','Administrator verified the repair and closed the report.','Admin User',1,NULL,'2026-08-11 23:10:36.664');
INSERT INTO `report_history` (`id`, `report_id`, `status`, `description`, `actor`, `actor_id`, `note`, `created_at`) VALUES (73,1039,'submitted','Report received from a citizen.','ResQRoad',9,NULL,'2026-08-24 23:10:36.664');
INSERT INTO `report_history` (`id`, `report_id`, `status`, `description`, `actor`, `actor_id`, `note`, `created_at`) VALUES (74,1039,'verified','Administrator confirmed the reported road damage.','Admin User',1,NULL,'2026-08-25 23:10:36.664');
INSERT INTO `report_history` (`id`, `report_id`, `status`, `description`, `actor`, `actor_id`, `note`, `created_at`) VALUES (75,1039,'assigned','Assigned to Ana Cruz.','Admin User',1,NULL,'2026-08-26 23:10:36.664');
INSERT INTO `report_history` (`id`, `report_id`, `status`, `description`, `actor`, `actor_id`, `note`, `created_at`) VALUES (76,1039,'in_progress','Repair work started.','Ana Cruz',3,NULL,'2026-08-27 23:10:36.664');
INSERT INTO `report_history` (`id`, `report_id`, `status`, `description`, `actor`, `actor_id`, `note`, `created_at`) VALUES (77,1039,'repair_submitted','Repair submitted for admin verification.','Ana Cruz',3,NULL,'2026-09-01 23:10:36.664');
INSERT INTO `report_history` (`id`, `report_id`, `status`, `description`, `actor`, `actor_id`, `note`, `created_at`) VALUES (78,1039,'resolved','Administrator verified the repair and closed the report.','Admin User',1,NULL,'2026-09-02 23:10:36.664');
INSERT INTO `report_history` (`id`, `report_id`, `status`, `description`, `actor`, `actor_id`, `note`, `created_at`) VALUES (79,1040,'submitted','Report received from a citizen.','ResQRoad',6,NULL,'2026-09-10 23:10:36.664');
INSERT INTO `report_history` (`id`, `report_id`, `status`, `description`, `actor`, `actor_id`, `note`, `created_at`) VALUES (80,1040,'verified','Administrator confirmed the reported road damage.','Admin User',1,NULL,'2026-09-11 23:10:36.664');
INSERT INTO `report_history` (`id`, `report_id`, `status`, `description`, `actor`, `actor_id`, `note`, `created_at`) VALUES (81,1040,'assigned','Assigned to Leo Santos.','Admin User',1,NULL,'2026-09-12 23:10:36.664');
INSERT INTO `report_history` (`id`, `report_id`, `status`, `description`, `actor`, `actor_id`, `note`, `created_at`) VALUES (82,1040,'in_progress','Repair work started.','Leo Santos',4,NULL,'2026-09-13 23:10:36.664');
INSERT INTO `report_history` (`id`, `report_id`, `status`, `description`, `actor`, `actor_id`, `note`, `created_at`) VALUES (83,1040,'repair_submitted','Repair submitted for admin verification.','Leo Santos',4,NULL,'2026-09-17 23:10:36.664');
INSERT INTO `report_history` (`id`, `report_id`, `status`, `description`, `actor`, `actor_id`, `note`, `created_at`) VALUES (84,1040,'resolved','Administrator verified the repair and closed the report.','Admin User',1,NULL,'2026-09-18 23:10:36.664');
/*!40000 ALTER TABLE `report_history` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `report_notes`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `report_notes` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `report_id` int unsigned NOT NULL,
  `note` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `actor` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `actor_id` int unsigned DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `notes_report` (`report_id`,`created_at`),
  KEY `notes_actor_fk` (`actor_id`),
  CONSTRAINT `notes_actor_fk` FOREIGN KEY (`actor_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `notes_report_fk` FOREIGN KEY (`report_id`) REFERENCES `reports` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `report_notes`
--

LOCK TABLES `report_notes` WRITE;
/*!40000 ALTER TABLE `report_notes` DISABLE KEYS */;
/*!40000 ALTER TABLE `report_notes` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `reports`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `reports` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `title` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `road` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `location` varchar(160) COLLATE utf8mb4_unicode_ci NOT NULL,
  `latitude` decimal(9,6) NOT NULL,
  `longitude` decimal(9,6) NOT NULL,
  `severity` enum('Low','Medium','High') COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('submitted','under_review','verified','assigned','in_progress','repair_submitted','resolved','rejected','duplicate') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'submitted',
  `reporter_id` int unsigned DEFAULT NULL,
  `assigned_to` int unsigned DEFAULT NULL,
  `assigned_name` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Kept even if the crew account is deleted',
  `repair_notes` text COLLATE utf8mb4_unicode_ci,
  `repair_submitted_at` datetime(3) DEFAULT NULL,
  `reported_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `reports_status` (`status`),
  KEY `reports_reporter` (`reporter_id`),
  KEY `reports_assigned` (`assigned_to`),
  KEY `reports_location` (`latitude`,`longitude`),
  CONSTRAINT `reports_assigned_fk` FOREIGN KEY (`assigned_to`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `reports_reporter_fk` FOREIGN KEY (`reporter_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=1054 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `reports`
--

LOCK TABLES `reports` WRITE;
/*!40000 ALTER TABLE `reports` DISABLE KEYS */;
INSERT INTO `reports` (`id`, `title`, `road`, `location`, `latitude`, `longitude`, `severity`, `description`, `status`, `reporter_id`, `assigned_to`, `assigned_name`, `repair_notes`, `repair_submitted_at`, `reported_at`, `updated_at`) VALUES (1031,'Washed-out shoulder after heavy rain','Malolos–Paombong Road','Paombong, Bulacan',14.831100,120.789400,'Medium','The road shoulder washed out after the typhoon, leaving a drop-off along the lane edge.','resolved',5,4,'Leo Santos','Rebuilt the shoulder with compacted base course and resurfaced the edge.','2026-03-16 23:10:36.663','2026-03-07 23:10:36.663','2026-03-17 23:10:36.663');
INSERT INTO `reports` (`id`, `title`, `road`, `location`, `latitude`, `longitude`, `severity`, `description`, `status`, `reporter_id`, `assigned_to`, `assigned_name`, `repair_notes`, `repair_submitted_at`, `reported_at`, `updated_at`) VALUES (1032,'Pothole cluster near the bus stop','MacArthur Highway','Tikay, Malolos City',14.870500,120.818900,'High','Several potholes in the outer lane beside the bus stop force jeepneys into the middle lane.','resolved',9,2,'Juan Reyes','Cold-patched four potholes and sealed the surrounding cracks.','2026-03-27 23:10:36.663','2026-03-21 23:10:36.663','2026-03-28 23:10:36.663');
INSERT INTO `reports` (`id`, `title`, `road`, `location`, `latitude`, `longitude`, `severity`, `description`, `status`, `reporter_id`, `assigned_to`, `assigned_name`, `repair_notes`, `repair_submitted_at`, `reported_at`, `updated_at`) VALUES (1033,'Sunken manhole cover','Pulilan–Baliuag Road','Pulilan, Bulacan',14.902100,120.849200,'Medium','A manhole cover has sunk below the road surface and jolts passing vehicles.','resolved',6,3,'Ana Cruz','Raised the manhole frame to grade and patched the surrounding asphalt.','2026-04-16 23:10:36.663','2026-04-08 23:10:36.663','2026-04-17 23:10:36.663');
INSERT INTO `reports` (`id`, `title`, `road`, `location`, `latitude`, `longitude`, `severity`, `description`, `status`, `reporter_id`, `assigned_to`, `assigned_name`, `repair_notes`, `repair_submitted_at`, `reported_at`, `updated_at`) VALUES (1034,'Uneven patch at the crossing','Guiguinto Road','Tabe, Guiguinto',14.833700,120.879100,'Low','The pavement at the pedestrian crossing feels uneven.','rejected',10,NULL,NULL,NULL,NULL,'2026-05-03 23:10:36.663','2026-05-04 23:10:36.663');
INSERT INTO `reports` (`id`, `title`, `road`, `location`, `latitude`, `longitude`, `severity`, `description`, `status`, `reporter_id`, `assigned_to`, `assigned_name`, `repair_notes`, `repair_submitted_at`, `reported_at`, `updated_at`) VALUES (1035,'Deep rut in the left lane','Plaridel Bypass Road','Lalangan, Plaridel',14.895200,120.865300,'High','A long rut in the left lane holds water and is hard to see at night.','resolved',7,4,'Leo Santos','Milled the damaged lane section and laid new asphalt.','2026-05-23 23:10:36.663','2026-05-16 23:10:36.663','2026-05-24 23:10:36.663');
INSERT INTO `reports` (`id`, `title`, `road`, `location`, `latitude`, `longitude`, `severity`, `description`, `status`, `reporter_id`, `assigned_to`, `assigned_name`, `repair_notes`, `repair_submitted_at`, `reported_at`, `updated_at`) VALUES (1036,'Crumbling pavement edge','Calumpit–Pulilan Road','Calumpit, Bulacan',14.910500,120.780100,'Low','The pavement edge is crumbling into the drainage canal.','resolved',11,2,'Juan Reyes','Reinforced the pavement edge and cleared the canal inlet.','2026-06-21 23:10:36.663','2026-06-10 23:10:36.663','2026-06-22 23:10:36.663');
INSERT INTO `reports` (`id`, `title`, `road`, `location`, `latitude`, `longitude`, `severity`, `description`, `status`, `reporter_id`, `assigned_to`, `assigned_name`, `repair_notes`, `repair_submitted_at`, `reported_at`, `updated_at`) VALUES (1037,'Pothole beside the church entrance','Paseo del Congreso','Barasoain, Malolos City',14.857800,120.813900,'Medium','A pothole beside the church entrance is in the path of tricycles dropping off passengers.','resolved',12,3,'Ana Cruz','Filled and compacted the pothole with hot-mix asphalt.','2026-07-15 23:10:36.663','2026-07-09 23:10:36.663','2026-07-16 23:10:36.663');
INSERT INTO `reports` (`id`, `title`, `road`, `location`, `latitude`, `longitude`, `severity`, `description`, `status`, `reporter_id`, `assigned_to`, `assigned_name`, `repair_notes`, `repair_submitted_at`, `reported_at`, `updated_at`) VALUES (1038,'Large pothole on the service road','NLEX Service Road','Sta. Rita, Guiguinto',14.845600,120.890200,'High','A large pothole on the service road has already caused a flat tire.','resolved',5,2,'Juan Reyes','Emergency patch completed the same day; full repair done after curing.','2026-08-10 23:10:36.663','2026-08-05 23:10:36.663','2026-08-11 23:10:36.664');
INSERT INTO `reports` (`id`, `title`, `road`, `location`, `latitude`, `longitude`, `severity`, `description`, `status`, `reporter_id`, `assigned_to`, `assigned_name`, `repair_notes`, `repair_submitted_at`, `reported_at`, `updated_at`) VALUES (1039,'Cracked asphalt near the market','Mabini Street','Santo Rosario, Malolos City',14.844100,120.812600,'Low','Alligator cracking is spreading across the lane near the market.','resolved',9,3,'Ana Cruz','Sealed the cracks and applied a surface treatment.','2026-09-01 23:10:36.664','2026-08-24 23:10:36.664','2026-09-02 23:10:36.664');
INSERT INTO `reports` (`id`, `title`, `road`, `location`, `latitude`, `longitude`, `severity`, `description`, `status`, `reporter_id`, `assigned_to`, `assigned_name`, `repair_notes`, `repair_submitted_at`, `reported_at`, `updated_at`) VALUES (1040,'Damaged lane at the bridge approach','Calumpit Bridge Road','Calumpit, Bulacan',14.916300,120.767800,'Medium','The bridge approach slab has separated from the road, leaving a bump.','resolved',6,4,'Leo Santos','Leveled the approach slab joint and patched the transition.','2026-09-17 23:10:36.664','2026-09-10 23:10:36.664','2026-09-18 23:10:36.664');
INSERT INTO `reports` (`id`, `title`, `road`, `location`, `latitude`, `longitude`, `severity`, `description`, `status`, `reporter_id`, `assigned_to`, `assigned_name`, `repair_notes`, `repair_submitted_at`, `reported_at`, `updated_at`) VALUES (1041,'Repeat report near the municipal hall','Capitol View Park Road','Guinhawa, Malolos City',14.846600,120.811000,'Low','This report refers to an existing pothole report nearby.','duplicate',12,NULL,NULL,NULL,NULL,'2026-09-05 23:10:36.663','2026-09-06 23:10:36.663');
INSERT INTO `reports` (`id`, `title`, `road`, `location`, `latitude`, `longitude`, `severity`, `description`, `status`, `reporter_id`, `assigned_to`, `assigned_name`, `repair_notes`, `repair_submitted_at`, `reported_at`, `updated_at`) VALUES (1042,'Resolved road damage near the town plaza','Plaridel Bypass Road','Plaridel, Bulacan',14.886400,120.857400,'Medium','A damaged patch on the roadside was reported and repaired.','resolved',11,4,'Leo Santos','Repaired and leveled the road surface.','2026-09-26 23:10:36.663','2026-09-19 23:10:36.663','2026-09-27 23:10:36.663');
INSERT INTO `reports` (`id`, `title`, `road`, `location`, `latitude`, `longitude`, `severity`, `description`, `status`, `reporter_id`, `assigned_to`, `assigned_name`, `repair_notes`, `repair_submitted_at`, `reported_at`, `updated_at`) VALUES (1043,'Pothole repaired near the barangay hall','Tikay Road','Tikay, Malolos City',14.872800,120.814100,'Medium','Road damage near the barangay hall was reported for inspection and repair.','repair_submitted',10,2,'Juan Reyes','Filled the damaged section and cleared loose material from the lane.','2026-10-21 08:46:36.663','2026-10-05 23:10:36.663','2026-10-21 08:46:36.663');
INSERT INTO `reports` (`id`, `title`, `road`, `location`, `latitude`, `longitude`, `severity`, `description`, `status`, `reporter_id`, `assigned_to`, `assigned_name`, `repair_notes`, `repair_submitted_at`, `reported_at`, `updated_at`) VALUES (1044,'Small pothole expanding after rain','Dakila Road','Dakila, Malolos City',14.859200,120.828200,'Low','A small pothole has started to spread near the shoulder of the road.','in_progress',8,3,'Ana Cruz',NULL,NULL,'2026-10-09 23:10:36.663','2026-10-18 23:10:36.663');
INSERT INTO `reports` (`id`, `title`, `road`, `location`, `latitude`, `longitude`, `severity`, `description`, `status`, `reporter_id`, `assigned_to`, `assigned_name`, `repair_notes`, `repair_submitted_at`, `reported_at`, `updated_at`) VALUES (1045,'Road damage at the intersection','Sta. Isabel Road','Sta. Isabel, Malolos City',14.842000,120.808800,'High','The damaged patch is near an intersection and is difficult to avoid during busy hours.','assigned',9,2,'Juan Reyes',NULL,NULL,'2026-10-14 23:10:36.663','2026-10-16 23:10:36.663');
INSERT INTO `reports` (`id`, `title`, `road`, `location`, `latitude`, `longitude`, `severity`, `description`, `status`, `reporter_id`, `assigned_to`, `assigned_name`, `repair_notes`, `repair_submitted_at`, `reported_at`, `updated_at`) VALUES (1046,'Broken road surface near the bridge','Calumpit Bridge Road','Calumpit, Bulacan',14.918900,120.765200,'High','A damaged section of the lane is wide enough to affect motorcycles and cars.','verified',7,NULL,NULL,NULL,NULL,'2026-10-17 23:10:36.663','2026-10-19 11:10:36.663');
INSERT INTO `reports` (`id`, `title`, `road`, `location`, `latitude`, `longitude`, `severity`, `description`, `status`, `reporter_id`, `assigned_to`, `assigned_name`, `repair_notes`, `repair_submitted_at`, `reported_at`, `updated_at`) VALUES (1047,'Pothole beside the school crossing','Longos Road','Longos, Malolos City',14.868100,120.796400,'Medium','There is a pothole near the pedestrian crossing. It gets harder to see after rain.','under_review',6,NULL,NULL,NULL,NULL,'2026-10-19 23:10:36.663','2026-10-21 11:10:36.663');
INSERT INTO `reports` (`id`, `title`, `road`, `location`, `latitude`, `longitude`, `severity`, `description`, `status`, `reporter_id`, `assigned_to`, `assigned_name`, `repair_notes`, `repair_submitted_at`, `reported_at`, `updated_at`) VALUES (1048,'Deep pothole near the public market','MacArthur Highway','Guinhawa, Malolos City',14.847400,120.812200,'High','A deep pothole in the right lane is causing drivers to swerve. Reported near the public market entrance.','submitted',5,NULL,NULL,NULL,NULL,'2026-10-21 19:34:36.663','2026-10-21 19:34:36.663');
INSERT INTO `reports` (`id`, `title`, `road`, `location`, `latitude`, `longitude`, `severity`, `description`, `status`, `reporter_id`, `assigned_to`, `assigned_name`, `repair_notes`, `repair_submitted_at`, `reported_at`, `updated_at`) VALUES (1051,'Pothole outside the health center','Mabini Street','Santiago, Malolos City',14.850600,120.817100,'Medium','A pothole near the health center entrance may cause vehicles to swerve.','submitted',6,NULL,NULL,NULL,NULL,'2026-10-21 15:58:36.663','2026-10-21 15:58:36.663');
INSERT INTO `reports` (`id`, `title`, `road`, `location`, `latitude`, `longitude`, `severity`, `description`, `status`, `reporter_id`, `assigned_to`, `assigned_name`, `repair_notes`, `repair_submitted_at`, `reported_at`, `updated_at`) VALUES (1052,'Cracked pavement near the terminal','Mojon Road','Mojon, Malolos City',14.853100,120.805800,'Low','A cracked section of pavement is starting to break apart near the terminal.','submitted',7,NULL,NULL,NULL,NULL,'2026-10-21 11:10:36.663','2026-10-21 11:10:36.663');
INSERT INTO `reports` (`id`, `title`, `road`, `location`, `latitude`, `longitude`, `severity`, `description`, `status`, `reporter_id`, `assigned_to`, `assigned_name`, `repair_notes`, `repair_submitted_at`, `reported_at`, `updated_at`) VALUES (1053,'Deep road damage near the public school','Paseo del Congreso','Bulihan, Malolos City',14.858800,120.818600,'High','A deep damaged patch is close to the public school and affects passing vehicles.','submitted',8,NULL,NULL,NULL,NULL,'2026-10-21 03:58:36.663','2026-10-21 03:58:36.663');
/*!40000 ALTER TABLE `reports` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `sessions`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `sessions` (
  `token_hash` char(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` int unsigned NOT NULL,
  `client` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'web' COMMENT 'web or mobile',
  `user_agent` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `last_seen_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `expires_at` datetime(3) NOT NULL,
  PRIMARY KEY (`token_hash`),
  KEY `sessions_user` (`user_id`),
  KEY `sessions_expires` (`expires_at`),
  CONSTRAINT `sessions_user_fk` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `sessions`
--

LOCK TABLES `sessions` WRITE;
/*!40000 ALTER TABLE `sessions` DISABLE KEYS */;
/*!40000 ALTER TABLE `sessions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `users`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `password_hash` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `role` enum('admin','maintenance','citizen') COLLATE utf8mb4_unicode_ci NOT NULL,
  `team` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Maintenance crews only',
  `active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `deleted_at` datetime(3) DEFAULT NULL COMMENT 'Deleted crew accounts keep their row for report history',
  PRIMARY KEY (`id`),
  UNIQUE KEY `users_email` (`email`),
  KEY `users_role` (`role`)
) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` (`id`, `name`, `email`, `password_hash`, `role`, `team`, `active`, `created_at`, `updated_at`, `deleted_at`) VALUES (1,'Admin User','admin@resqroad.ph','$2b$10$nnEmJ9AJyfDU2avNU9fijOznnH1r9LjwRgG.a4/kej1CnbYIBqWHG','admin',NULL,1,'2025-12-25 23:10:35.811','2026-10-21 23:10:35.894',NULL);
INSERT INTO `users` (`id`, `name`, `email`, `password_hash`, `role`, `team`, `active`, `created_at`, `updated_at`, `deleted_at`) VALUES (2,'Juan Reyes','juan.reyes@resqroad.ph','$2b$10$uQCZElSJ1coNA31WUiEpz.c4KIctby691zoCehbhrJAdfVZE/ZbH2','maintenance','North road crew',1,'2026-01-04 23:10:35.896','2026-10-21 23:10:35.957',NULL);
INSERT INTO `users` (`id`, `name`, `email`, `password_hash`, `role`, `team`, `active`, `created_at`, `updated_at`, `deleted_at`) VALUES (3,'Ana Cruz','ana.cruz@resqroad.ph','$2b$10$uuAakNvShIU.bdlf8BVeH.rIEyomRAwCq4jQZjUlYy0H5tJ37Ryc.','maintenance','Central road crew',1,'2026-01-04 23:10:35.960','2026-10-21 23:10:36.025',NULL);
INSERT INTO `users` (`id`, `name`, `email`, `password_hash`, `role`, `team`, `active`, `created_at`, `updated_at`, `deleted_at`) VALUES (4,'Leo Santos','leo.santos@resqroad.ph','$2b$10$/jIgRF3d8AWnkPukk5CZOORRRijuWTyiuLZBcyGuo3nYtrcwkS1Te','maintenance','South road crew',1,'2026-01-04 23:10:36.028','2026-10-21 23:10:36.102',NULL);
INSERT INTO `users` (`id`, `name`, `email`, `password_hash`, `role`, `team`, `active`, `created_at`, `updated_at`, `deleted_at`) VALUES (5,'Maria Santos','maria.santos@example.com','$2b$10$mdVeKNUHonhcJ6bWkOGDUOjDGpwSyv74.8XLJqcjvEqfJ4bFPv1Bq','citizen',NULL,1,'2026-02-03 23:10:36.104','2026-10-21 23:10:36.176',NULL);
INSERT INTO `users` (`id`, `name`, `email`, `password_hash`, `role`, `team`, `active`, `created_at`, `updated_at`, `deleted_at`) VALUES (6,'Jose Dela Cruz','jose.delacruz@example.com','$2b$10$4l8z1e52GN6M.KwIvrfJfuRztCMxQMTE7edkPh/r2rZwMw/7YHRgS','citizen',NULL,1,'2026-02-23 23:10:36.177','2026-10-21 23:10:36.251',NULL);
INSERT INTO `users` (`id`, `name`, `email`, `password_hash`, `role`, `team`, `active`, `created_at`, `updated_at`, `deleted_at`) VALUES (7,'Ana Reyes','ana.reyes@example.com','$2b$10$2adJLfUyovLI3d0qc7F1keLn5NdheY/w..cBpQZp.fwWRjKcdT3TG','citizen',NULL,1,'2026-03-15 23:10:36.252','2026-10-21 23:10:36.314',NULL);
INSERT INTO `users` (`id`, `name`, `email`, `password_hash`, `role`, `team`, `active`, `created_at`, `updated_at`, `deleted_at`) VALUES (8,'Pedro Garcia','pedro.garcia@example.com','$2b$10$Ms8kwM0Hi2lXtITfCNmRKuYk6dCf7bHkYHAzJJSj32dTr59EoA0g.','citizen',NULL,0,'2026-04-04 23:10:36.317','2026-10-21 23:10:36.397',NULL);
INSERT INTO `users` (`id`, `name`, `email`, `password_hash`, `role`, `team`, `active`, `created_at`, `updated_at`, `deleted_at`) VALUES (9,'Rosa Mendoza','rosa.mendoza@example.com','$2b$10$vTsPno0TwGn/IJCqJvV2WeNHv2R/nU9TlzsS9F3bzHnXDeAwawyfe','citizen',NULL,1,'2026-04-24 23:10:36.398','2026-10-21 23:10:36.461',NULL);
INSERT INTO `users` (`id`, `name`, `email`, `password_hash`, `role`, `team`, `active`, `created_at`, `updated_at`, `deleted_at`) VALUES (10,'Luis Flores','luis.flores@example.com','$2b$10$TLFq.ydHfZL8DPn2MpB8h.9L5f7TyKr14A37nkIK6WL5wpmQFFAOW','citizen',NULL,1,'2026-05-24 23:10:36.463','2026-10-21 23:10:36.531',NULL);
INSERT INTO `users` (`id`, `name`, `email`, `password_hash`, `role`, `team`, `active`, `created_at`, `updated_at`, `deleted_at`) VALUES (11,'Carla Bautista','carla.bautista@example.com','$2b$10$o2Ye3a4JzgRb6aepDIBNm.MhsaxItkbjCG996jM/tPhVElCHUU7r6','citizen',NULL,1,'2026-07-23 23:10:36.531','2026-10-21 23:10:36.593',NULL);
INSERT INTO `users` (`id`, `name`, `email`, `password_hash`, `role`, `team`, `active`, `created_at`, `updated_at`, `deleted_at`) VALUES (12,'Elena Navarro','elena.navarro@example.com','$2b$10$XH6i75bWhz4AwX0LHzDJJuljyq4SN6f/CaiG/Nh5msyOWNXvNbBaa','citizen',NULL,1,'2026-08-22 23:10:36.596','2026-10-21 23:10:36.660',NULL);
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-10-22  7:10:55
