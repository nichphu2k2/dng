DROP TABLE IF EXISTS `monitors`;

CREATE TABLE `monitors` (
  `id` int NOT NULL AUTO_INCREMENT,
  `plane_id` char(5) NOT NULL,
  `device_id` char(5) NOT NULL,
  `x` decimal(10,6) NOT NULL,
  `y` decimal(10,6) NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_monitors_plane_device` (`plane_id`,`device_id`),
  UNIQUE KEY `monitors_plane_id_device_id` (`plane_id`,`device_id`),
  KEY `idx_monitors_plane_id` (`plane_id`),
  KEY `idx_monitors_device_id` (`device_id`),
  KEY `monitors_plane_id` (`plane_id`),
  KEY `monitors_device_id` (`device_id`),
  CONSTRAINT `fk_monitors_device` FOREIGN KEY (`device_id`) REFERENCES `devices` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_monitors_plane` FOREIGN KEY (`plane_id`) REFERENCES `planes` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=249 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;