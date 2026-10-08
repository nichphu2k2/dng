DROP TABLE IF EXISTS `device_types`;

CREATE TABLE `device_types` (
  `id` char(5) NOT NULL,
  `name` varchar(255) NOT NULL,
  `type` enum('Camera','Sensor') NOT NULL,
  `description` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_device_types_name` (`name`),
  KEY `idx_device_types_type` (`type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

LOCK TABLES `device_types` WRITE;
INSERT INTO `device_types` VALUES ('00001','CAMERA','Camera','Original device type','2026-07-24 17:44:41','2026-07-28 08:42:33'),('00002','SENSOR','Sensor','Original device type','2026-07-24 17:44:21','2026-07-28 08:42:33');
UNLOCK TABLES;