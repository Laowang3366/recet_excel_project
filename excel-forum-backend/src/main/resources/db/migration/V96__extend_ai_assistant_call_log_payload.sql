ALTER TABLE `ai_assistant_call_log`
    ADD COLUMN `question_summary` VARCHAR(255) NULL AFTER `tool_type`,
    ADD COLUMN `request_preview` TEXT NULL AFTER `question_summary`,
    ADD COLUMN `response_preview` TEXT NULL AFTER `request_preview`;
