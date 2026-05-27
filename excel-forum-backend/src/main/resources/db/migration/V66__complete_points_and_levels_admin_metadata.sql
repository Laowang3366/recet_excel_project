ALTER TABLE `points_rule`
    ADD COLUMN `daily_limit` INT DEFAULT NULL COMMENT '每日触发上限，NULL 表示不限制' AFTER `type`,
    ADD COLUMN `effective_at` DATETIME DEFAULT NULL COMMENT '规则生效时间' AFTER `daily_limit`,
    ADD COLUMN `expires_at` DATETIME DEFAULT NULL COMMENT '规则失效时间' AFTER `effective_at`;

ALTER TABLE `points_record`
    ADD COLUMN `business_no` VARCHAR(100) DEFAULT NULL COMMENT '手动调整关联业务单号' AFTER `biz_id`,
    ADD COLUMN `notify_user` TINYINT(1) NOT NULL DEFAULT 1 COMMENT '本次手动调整是否通知用户' AFTER `business_no`,
    ADD COLUMN `anomaly_flag` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '异常流水标记' AFTER `notify_user`;

CREATE INDEX `idx_points_record_business_no` ON `points_record` (`business_no`);

ALTER TABLE `experience_level_rule`
    ADD COLUMN `max_exp` INT DEFAULT NULL COMMENT '该等级最高经验值，NULL 表示由下一等级阈值推导' AFTER `threshold`,
    ADD COLUMN `icon_tone` VARCHAR(30) DEFAULT 'blue' COMMENT '等级徽章色调' AFTER `sort_order`,
    ADD COLUMN `benefits` TEXT DEFAULT NULL COMMENT '等级权益说明' AFTER `icon_tone`;
