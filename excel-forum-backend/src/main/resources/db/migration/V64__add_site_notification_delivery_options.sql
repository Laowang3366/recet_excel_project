ALTER TABLE `site_notification`
    ADD COLUMN `scheduled_time` DATETIME DEFAULT NULL COMMENT 'scheduled send time',
    ADD COLUMN `pinned` TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'pinned in notification list',
    ADD COLUMN `pinned_until` DATETIME DEFAULT NULL COMMENT 'pinned until time',
    ADD COLUMN `target_user_ids` TEXT DEFAULT NULL COMMENT 'comma separated target user ids';

CREATE INDEX `idx_site_notification_schedule` ON `site_notification` (`status`, `scheduled_time`);
CREATE INDEX `idx_site_notification_pinned` ON `site_notification` (`pinned`, `pinned_until`);
