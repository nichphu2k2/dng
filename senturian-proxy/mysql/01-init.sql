-- Database initialization for senturian-proxy
CREATE DATABASE IF NOT EXISTS `senturian` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `senturian`;

-- Table: rules
CREATE TABLE IF NOT EXISTS `rules` (
    `id` VARCHAR(64) PRIMARY KEY,
    `name` VARCHAR(255) NOT NULL,
    `camera_id` VARCHAR(255) NOT NULL,
    `channel_type` VARCHAR(100) NOT NULL,
    `alarm_type` VARCHAR(100) NULL,
    `text_key` VARCHAR(100) NULL,
    `face_groups` VARCHAR(255) NULL,
    `device_id` VARCHAR(100) NULL,
    `stream_id` INT DEFAULT 1,
    `enable_source` TINYINT(1) DEFAULT 1,
    `source` VARCHAR(100) DEFAULT 'Senturian_AI',
    `enable_caption` TINYINT(1) DEFAULT 1,
    `caption` VARCHAR(255) NULL,
    `enable_description` TINYINT(1) DEFAULT 0,
    `description` TEXT NULL,
    `enabled` TINYINT(1) DEFAULT 1,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX `idx_text_key` (`text_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: settings
CREATE TABLE IF NOT EXISTS `settings` (
    `key_name` VARCHAR(100) PRIMARY KEY,
    `key_value` TEXT NULL,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: channel_alarm_mappings
CREATE TABLE IF NOT EXISTS `channel_alarm_mappings` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `channel_type` VARCHAR(100) NOT NULL,
    `alarm_type` VARCHAR(100) NULL,
    `text_key` VARCHAR(100) NOT NULL,
    `note` VARCHAR(255) NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
