CREATE TABLE IF NOT EXISTS qa_solution_share (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    record_id BIGINT NOT NULL,
    answer_id BIGINT NOT NULL,
    question_id BIGINT NULL,
    title VARCHAR(255) NOT NULL,
    thought_text TEXT NULL,
    thought_source VARCHAR(20) NOT NULL DEFAULT 'empty',
    status VARCHAR(20) NOT NULL DEFAULT 'published',
    view_count INT NOT NULL DEFAULT 0,
    create_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_qa_solution_answer (answer_id),
    KEY idx_qa_solution_status_time (status, create_time),
    KEY idx_qa_solution_user_time (user_id, create_time),
    KEY idx_qa_solution_question_time (question_id, create_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS qa_case_help (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    template_file_url VARCHAR(500) NOT NULL,
    answer_sheet VARCHAR(120) NULL,
    answer_range VARCHAR(80) NULL,
    ideal_answer_snapshot_json MEDIUMTEXT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'open',
    view_count INT NOT NULL DEFAULT 0,
    create_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_qa_case_status_time (status, create_time),
    KEY idx_qa_case_user_time (user_id, create_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS qa_case_help_answer (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    case_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    answer_file_url VARCHAR(500) NOT NULL,
    create_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_qa_answer_case_time (case_id, create_time),
    KEY idx_qa_answer_user_time (user_id, create_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
