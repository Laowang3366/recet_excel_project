ALTER TABLE `question_category`
    ADD COLUMN `front_display_name` VARCHAR(100) DEFAULT NULL COMMENT '前台章节展示名称' AFTER `group_name`,
    ADD COLUMN `icon_key` VARCHAR(32) NOT NULL DEFAULT 'folder' COMMENT '分类图标标识' AFTER `front_display_name`,
    ADD COLUMN `recommended_difficulty` VARCHAR(32) NOT NULL DEFAULT 'medium' COMMENT '推荐难度' AFTER `icon_key`;

UPDATE `question_category`
SET `front_display_name` = `name`
WHERE `front_display_name` IS NULL OR `front_display_name` = '';
