CREATE TABLE IF NOT EXISTS `password_reset_token` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `user_id` BIGINT NOT NULL,
  `token_hash` CHAR(64) NOT NULL,
  `request_ip` VARCHAR(128) NULL,
  `expires_at` DATETIME NOT NULL,
  `used_at` DATETIME NULL,
  `create_time` DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_password_reset_token_hash` (`token_hash`),
  KEY `idx_password_reset_user_status` (`user_id`, `used_at`, `expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
