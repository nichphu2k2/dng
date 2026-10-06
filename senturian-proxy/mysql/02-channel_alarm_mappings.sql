USE `senturian`;

-- Ensure table structure exists
CREATE TABLE IF NOT EXISTS `channel_alarm_mappings` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `channel_type` VARCHAR(100) NOT NULL,
    `alarm_type` VARCHAR(100) NULL,
    `text_key` VARCHAR(100) NOT NULL,
    `note` VARCHAR(255) NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX `idx_channel_alarm` (`channel_type`, `alarm_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Clean existing records before inserting standard mapping catalogue
TRUNCATE TABLE `channel_alarm_mappings`;

-- Insert 36 Channel Type + Alarm Type combinations with matching text_key
INSERT INTO `channel_alarm_mappings` (`id`, `channel_type`, `alarm_type`, `text_key`, `note`) VALUES
(1,  'Face-human & Recon.',          NULL,                              'example_1',  'Face & Human Recognition (No Alarm Type)'),
(2,  'Structure Analysis',           NULL,                              'example_2',  'Structure Analysis (No Alarm Type)'),
(3,  'Goods',                        'Sundry Detect',                   'example_3',  'Sundry item detection'),
(4,  'Goods',                        'Goods Forget',                    'example_4',  'Forgotten items / luggage'),
(5,  'Goods',                        'Goods Guard',                     'example_5',  'Goods guard / protection'),
(6,  'Safety',                       'No Safety Cap Alarm',             'example_6',  'No safety cap alarm'),
(7,  'Safety',                       'No Uniform Alarm',                'example_7',  'No uniform alarm'),
(8,  'Safety',                       'No Safety Belt Alarm',            'example_8',  'No safety belt alarm'),
(9,  'Safety',                       'No Reflective Clothing Alarm',    'example_9',  'No reflective clothing alarm'),
(10, 'Safety',                       'Flame Alarm',                     'example_10', 'Flame detection alarm'),
(11, 'Safety',                       'Smog Alarm',                      'example_11', 'Smoke / smog alarm'),
(12, 'Safety',                       'Loose Fire Equipment Detection',  'example_12', 'Loose / misplaced fire equipment'),
(13, 'Safety',                       'Mask Detection',                  'example_13', 'Mask detection alarm'),
(14, 'Safety',                       'Liquid Leak Detection',           'example_14', 'Liquid leak detection'),
(15, 'Head Count',                   'Regional People Count',           'example_15', 'Regional people counting'),
(16, 'Head Count',                   'Enter-exit People Count',         'example_16', 'Entry / exit people counting'),
(17, 'Behavior Alert',               'Fall Detection',                  'example_17', 'Fall detection'),
(18, 'Behavior Alert',               'Smoke Detection',                 'example_18', 'Smoking detection'),
(19, 'Behavior Alert',               'Call',                            'call', 'Phone call detection'),
(20, 'Behavior Alert',               'Watch Phone',                     'watch_phone', 'Phone browsing detection'),
(21, 'Behavior Alert',               'Run',                             'example_21', 'Running / rapid movement detection'),
(22, 'Behavior Alert',               'Sleep Detection',                 'sleep', 'Sleep detection'),
(23, 'Behavior Alert',               'Person Off Duty Querying',        'example_23', 'Person off duty / absent'),
(24, 'Behavior Alert',               'Gathering',                       'example_24', 'Crowd gathering'),
(25, 'Behavior Alert',               'Fight',                           'example_25', 'Fight / brawl detection'),
(26, 'Behavior Alert',               'Overstaffed',                     'example_26', 'Overstaffed alarm'),
(27, 'Behavior Alert',               'Understaffed',                    'example_27', 'Understaffed alarm'),
(28, 'Behavior Alert',               'Weapons detection',               'example_28', 'Weapons detection'),
(29, 'Perimeter Alert',              'Park',                            'example_29', 'Illegal parking detection'),
(30, 'Perimeter Alert',              'Exit',                            'example_30', 'Restricted exit detection'),
(31, 'Perimeter Alert',              'Wander',                          'example_31', 'Loitering / wandering detection'),
(32, 'Perimeter Alert',              'Over Wall Detection',             'example_32', 'Climbing over wall detection'),
(33, 'Perimeter Alert',              'Intrusion',                       'example_33', 'Intrusion detection'),
(34, 'Perimeter Alert',              'Tripwire',                        'example_34', 'Tripwire crossing detection'),
(35, 'Perimeter Alert',              'Climbing Detection',              'example_35', 'Climbing detection'),
(36, 'Video Inspection',             'Video Occlusion',                 'example_36', 'Camera lens occlusion');
