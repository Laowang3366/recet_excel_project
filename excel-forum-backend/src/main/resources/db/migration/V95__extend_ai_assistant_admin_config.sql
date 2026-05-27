ALTER TABLE `ai_assistant_config`
    ADD COLUMN `backup_model` VARCHAR(190) NULL AFTER `model`,
    ADD COLUMN `max_retries` INT NOT NULL DEFAULT 0 AFTER `backup_model`;
