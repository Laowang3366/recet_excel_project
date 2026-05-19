ALTER TABLE qa_case_help
    ADD COLUMN accepted_answer_id BIGINT NULL AFTER status,
    ADD COLUMN accepted_at DATETIME NULL AFTER accepted_answer_id,
    ADD COLUMN deleted_at DATETIME NULL AFTER update_time;

ALTER TABLE qa_case_help
    ADD KEY idx_qa_case_deleted_status_time (deleted_at, status, create_time);

ALTER TABLE qa_case_help_answer
    ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'active' AFTER answer_file_url,
    ADD COLUMN up_vote_count INT NOT NULL DEFAULT 0 AFTER status,
    ADD COLUMN down_vote_count INT NOT NULL DEFAULT 0 AFTER up_vote_count,
    ADD COLUMN reward_points INT NOT NULL DEFAULT 0 AFTER down_vote_count,
    ADD COLUMN accepted_at DATETIME NULL AFTER reward_points,
    ADD COLUMN update_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER create_time,
    ADD COLUMN deleted_at DATETIME NULL AFTER update_time;

ALTER TABLE qa_case_help_answer
    ADD KEY idx_qa_answer_status_time (status, create_time),
    ADD KEY idx_qa_answer_deleted_case_time (deleted_at, case_id, create_time);

ALTER TABLE qa_solution_share
    ADD COLUMN deleted_at DATETIME NULL AFTER update_time,
    ADD KEY idx_qa_solution_deleted_status_time (deleted_at, status, create_time);

CREATE TABLE IF NOT EXISTS qa_case_help_feedback (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    case_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    reason VARCHAR(40) NOT NULL,
    detail VARCHAR(30) NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    create_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at DATETIME NULL,
    KEY idx_qa_feedback_case_time (case_id, create_time),
    KEY idx_qa_feedback_user_time (user_id, create_time),
    KEY idx_qa_feedback_status_time (status, create_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS qa_case_help_answer_vote (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    answer_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    vote_type VARCHAR(20) NOT NULL,
    create_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_qa_answer_vote_user (answer_id, user_id),
    KEY idx_qa_answer_vote_answer_type (answer_id, vote_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
