ALTER TABLE `ai_assistant_call_log`
    ADD COLUMN `tool_type` VARCHAR(50) NOT NULL DEFAULT 'assistant_chat' COMMENT 'assistant_chat/formula_explain' AFTER `model`;

CREATE INDEX `idx_ai_assistant_call_tool_time`
    ON `ai_assistant_call_log` (`tool_type`, `create_time`);

CREATE TABLE IF NOT EXISTS `formula_explain_record` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT NOT NULL,
    `formula` TEXT NOT NULL,
    `normalized_formula` TEXT NOT NULL,
    `formula_hash` CHAR(64) NOT NULL,
    `locale` VARCHAR(20) NOT NULL DEFAULT 'zh-CN',
    `detail_level` VARCHAR(20) NOT NULL DEFAULT 'standard',
    `workbook_context` TEXT NULL,
    `expected_result` TEXT NULL,
    `error_message_input` TEXT NULL,
    `response_json` JSON NULL,
    `summary` VARCHAR(1000) NULL,
    `model` VARCHAR(190) NULL,
    `fallback_used` TINYINT(1) NOT NULL DEFAULT 0,
    `cache_hit` TINYINT(1) NOT NULL DEFAULT 0,
    `points_cost` INT NOT NULL DEFAULT 0,
    `status` VARCHAR(20) NOT NULL DEFAULT 'success',
    `error_message` VARCHAR(500) NULL,
    `create_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `update_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_formula_explain_user_time` (`user_id`, `create_time`),
    KEY `idx_formula_explain_hash_success` (`formula_hash`, `status`, `create_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
