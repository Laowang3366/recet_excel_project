ALTER TABLE `user`
    ADD COLUMN `force_change_password` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否要求下次登录修改密码' AFTER `token_version`,
    ADD COLUMN `phone` VARCHAR(32) DEFAULT NULL COMMENT '管理员维护的手机号' AFTER `email`,
    ADD COLUMN `source_channel` VARCHAR(64) DEFAULT NULL COMMENT '用户来源渠道' AFTER `role`,
    ADD COLUMN `last_login_time` DATETIME DEFAULT NULL COMMENT '最近登录时间' AFTER `last_active_time`;

CREATE INDEX `idx_user_phone` ON `user` (`phone`);
CREATE INDEX `idx_user_last_login_time` ON `user` (`last_login_time`);
