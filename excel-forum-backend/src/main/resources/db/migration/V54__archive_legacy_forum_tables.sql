CREATE TABLE IF NOT EXISTS `legacy_table_archive` (
    `table_name` VARCHAR(128) NOT NULL,
    `feature_area` VARCHAR(64) NOT NULL,
    `archive_status` VARCHAR(32) NOT NULL,
    `archive_reason` VARCHAR(255) NOT NULL,
    `retention_policy` VARCHAR(255) NOT NULL,
    `archived_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `notes` VARCHAR(500) DEFAULT NULL,
    PRIMARY KEY (`table_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Legacy data archive registry. Does not delete or move historical data.';

INSERT INTO `legacy_table_archive`
    (`table_name`, `feature_area`, `archive_status`, `archive_reason`, `retention_policy`, `notes`)
VALUES
    ('category', 'legacy_forum', 'archived', 'Forum navigation was retired after ExcelCC moved to practice and tutorial workflows.', 'retain_until_manual_export_and_verified_backup', 'Old forum board categories. Current question/tutorial categories use separate tables.'),
    ('category_follow', 'legacy_forum', 'archived', 'Forum follow feature was retired.', 'retain_until_manual_export_and_verified_backup', 'Old board follow relations.'),
    ('post', 'legacy_forum', 'archived', 'Forum posting was retired and API routes now return 410 Gone.', 'retain_until_manual_export_and_verified_backup', 'Historical forum posts retained for audit and backup only.'),
    ('reply', 'legacy_forum', 'archived', 'Forum replies were retired with forum posting.', 'retain_until_manual_export_and_verified_backup', 'Historical reply data retained for audit and backup only.'),
    ('like', 'legacy_forum', 'archived', 'Forum like feature was retired.', 'retain_until_manual_export_and_verified_backup', 'Historical post/reply like data.'),
    ('favorite', 'legacy_forum', 'archived', 'Forum favorite feature was retired.', 'retain_until_manual_export_and_verified_backup', 'Historical post favorite data.'),
    ('report', 'legacy_forum', 'archived', 'Forum report moderation was retired.', 'retain_until_manual_export_and_verified_backup', 'Historical abuse-report records.'),
    ('message', 'legacy_forum', 'archived', 'Forum private messaging was retired.', 'retain_until_manual_export_and_verified_backup', 'Historical private messages.'),
    ('chat_message', 'legacy_forum', 'archived', 'Forum chat room was retired.', 'retain_until_manual_export_and_verified_backup', 'Historical public chat messages.'),
    ('attachment', 'legacy_forum', 'archived', 'Forum post attachment feature was retired.', 'retain_until_manual_export_and_verified_backup', 'Historical forum post attachments.'),
    ('follow', 'legacy_forum', 'archived', 'Forum user follow feature was retired.', 'retain_until_manual_export_and_verified_backup', 'Historical user follow relations.'),
    ('post_draft', 'legacy_forum', 'archived', 'Forum post drafts were retired.', 'retain_until_manual_export_and_verified_backup', 'Historical draft data.'),
    ('post_view', 'legacy_forum', 'archived', 'Forum post view tracking was retired.', 'retain_until_manual_export_and_verified_backup', 'Historical post view data.'),
    ('post_share', 'legacy_forum', 'archived', 'Forum post share tracking was retired.', 'retain_until_manual_export_and_verified_backup', 'Historical post share data.'),
    ('post_edit_history', 'legacy_forum', 'archived', 'Forum post editing was retired.', 'retain_until_manual_export_and_verified_backup', 'Historical post edit audit data.')
ON DUPLICATE KEY UPDATE
    `feature_area` = VALUES(`feature_area`),
    `archive_status` = VALUES(`archive_status`),
    `archive_reason` = VALUES(`archive_reason`),
    `retention_policy` = VALUES(`retention_policy`),
    `notes` = VALUES(`notes`);
