DROP TABLE IF EXISTS `devices`;

CREATE TABLE `devices` (
  `id` varchar(5) NOT NULL,
  `name` varchar(255) NOT NULL,
  `device_type_id` varchar(5) NOT NULL,
  `device_type_name` varchar(255) NOT NULL,
  `status` tinyint NOT NULL DEFAULT '0',
  `rtsp1` text,
  `rtsp1_status` int NOT NULL DEFAULT '0',
  `rtsp2` text,
  `rtsp2_status` int NOT NULL DEFAULT '0',
  `pair` int NOT NULL DEFAULT '0',
  `pair_id` int NOT NULL DEFAULT '0',
  `link` int NOT NULL DEFAULT '0',
  `icon1` text,
  `icon2` text,
  `modbus` text,
  `description` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_devices_device_type_id` (`device_type_id`),
  KEY `idx_devices_pair` (`pair`),
  KEY `idx_devices_link` (`link`),
  CONSTRAINT `fk_devices_device_type` FOREIGN KEY (`device_type_id`) REFERENCES `device_types` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `devices_chk_1` CHECK ((`status` in (0,1)))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;