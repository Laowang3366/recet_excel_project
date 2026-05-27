ALTER TABLE qa_case_help
    ADD COLUMN assigned_user_id BIGINT NULL AFTER accepted_at,
    ADD COLUMN assigned_by BIGINT NULL AFTER assigned_user_id,
    ADD COLUMN assigned_at DATETIME NULL AFTER assigned_by,
    ADD COLUMN assignment_note VARCHAR(500) NULL AFTER assigned_at;

ALTER TABLE qa_case_help
    ADD KEY idx_qa_case_assigned_status_time (assigned_user_id, status, create_time);

ALTER TABLE qa_case_help_answer
    ADD COLUMN reviewer_id BIGINT NULL AFTER accepted_at,
    ADD COLUMN review_note VARCHAR(500) NULL AFTER reviewer_id,
    ADD COLUMN reviewed_at DATETIME NULL AFTER review_note,
    ADD COLUMN published_at DATETIME NULL AFTER reviewed_at;

ALTER TABLE qa_case_help_answer
    ADD KEY idx_qa_answer_review_status_time (status, reviewed_at, create_time);

ALTER TABLE qa_case_help_feedback
    ADD COLUMN handled_by BIGINT NULL AFTER status,
    ADD COLUMN handled_at DATETIME NULL AFTER handled_by,
    ADD COLUMN handle_note VARCHAR(500) NULL AFTER handled_at;

ALTER TABLE qa_case_help_feedback
    ADD KEY idx_qa_feedback_handled_status_time (handled_by, status, create_time);

ALTER TABLE qa_solution_share
    MODIFY COLUMN record_id BIGINT NULL,
    MODIFY COLUMN answer_id BIGINT NULL,
    ADD COLUMN source_type VARCHAR(20) NOT NULL DEFAULT 'practice' AFTER user_id,
    ADD COLUMN qa_case_id BIGINT NULL AFTER question_id,
    ADD COLUMN qa_answer_id BIGINT NULL AFTER qa_case_id;

ALTER TABLE qa_solution_share
    ADD UNIQUE KEY uk_qa_solution_qa_case (qa_case_id),
    ADD UNIQUE KEY uk_qa_solution_qa_answer (qa_answer_id),
    ADD KEY idx_qa_solution_source_time (source_type, create_time);
