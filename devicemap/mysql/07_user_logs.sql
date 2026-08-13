DROP TABLE IF EXISTS `user_logs`;

CREATE TABLE `user_logs` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint unsigned DEFAULT NULL,
  `username` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `email` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `full_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `role` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `user_status` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `session_id` bigint unsigned DEFAULT NULL,
  `session_token` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ip_address` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `user_agent` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `action` enum('CREATE_USER','UPDATE_USER','DELETE_USER','LOGIN','LOGOUT','CHANGE_PASSWORD') COLLATE utf8mb4_unicode_ci NOT NULL,
  `action_by` bigint unsigned DEFAULT NULL,
  `description` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user_logs_user_id` (`user_id`),
  KEY `idx_user_logs_session_id` (`session_id`),
  KEY `idx_user_logs_action` (`action`),
  KEY `idx_user_logs_created_at` (`created_at`)
) ENGINE=InnoDB AUTO_INCREMENT=63 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;