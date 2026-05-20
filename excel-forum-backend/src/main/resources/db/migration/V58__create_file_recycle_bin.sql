CREATE TABLE IF NOT EXISTS file_recycle_item (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    resource_type VARCHAR(40) NOT NULL,
    resource_id BIGINT NOT NULL,
    display_name VARCHAR(255) NULL,
    original_file_url VARCHAR(500) NULL,
    recycle_file_url VARCHAR(500) NULL,
    files_json MEDIUMTEXT NULL,
    business_snapshot_json MEDIUMTEXT NULL,
    deleted_by BIGINT NULL,
    deleted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL,
    restored_at DATETIME NULL,
    purged_at DATETIME NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    create_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_file_recycle_status_expires (status, expires_at),
    KEY idx_file_recycle_resource (resource_type, resource_id),
    KEY idx_file_recycle_deleted_time (deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE question
    ADD COLUMN deleted_at DATETIME NULL AFTER update_time,
    ADD COLUMN deleted_by BIGINT NULL AFTER deleted_at,
    ADD KEY idx_question_deleted_type_time (deleted_at, type, create_time);

ALTER TABLE question_excel_template
    ADD COLUMN deleted_at DATETIME NULL AFTER update_time,
    ADD COLUMN deleted_by BIGINT NULL AFTER deleted_at,
    ADD KEY idx_question_excel_deleted_question (deleted_at, question_id);

ALTER TABLE template_center_item
    ADD COLUMN deleted_at DATETIME NULL AFTER update_time,
    ADD COLUMN deleted_by BIGINT NULL AFTER deleted_at,
    ADD KEY idx_template_center_deleted_enabled_sort (deleted_at, enabled, sort_order);

ALTER TABLE qa_case_help
    ADD COLUMN deleted_by BIGINT NULL AFTER deleted_at;

ALTER TABLE qa_case_help_answer
    ADD COLUMN deleted_by BIGINT NULL AFTER deleted_at;
