DROP TABLE IF EXISTS `planes`;

CREATE TABLE `planes` (
  `id` char(5) NOT NULL,
  `name` varchar(255) NOT NULL,
  `type` enum('Root','Dependence') NOT NULL,
  `parent_id` char(5) DEFAULT NULL,
  `image` varchar(500) DEFAULT NULL,
  `description` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_planes_type` (`type`),
  KEY `idx_planes_parent` (`parent_id`),
  CONSTRAINT `fk_planes_parent` FOREIGN KEY (`parent_id`) REFERENCES `planes` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;