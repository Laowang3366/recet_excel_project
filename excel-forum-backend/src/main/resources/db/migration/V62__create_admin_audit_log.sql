CREATE TABLE IF NOT EXISTS admin_audit_log (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    admin_user_id BIGINT NULL,
    method VARCHAR(16) NOT NULL,
    path VARCHAR(500) NOT NULL,
    query_string VARCHAR(1000) NULL,
    status_code INT NULL,
    client_ip VARCHAR(64) NULL,
    user_agent VARCHAR(500) NULL,
    create_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_admin_audit_log_user_time (admin_user_id, create_time),
    INDEX idx_admin_audit_log_path_time (path, create_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
