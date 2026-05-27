ALTER TABLE template_center_item
    ADD COLUMN usage_guide TEXT NULL AFTER template_description,
    ADD COLUMN tags_json TEXT NULL AFTER functions_used,
    ADD COLUMN file_name VARCHAR(255) NULL AFTER template_file_url,
    ADD COLUMN file_size BIGINT NULL AFTER file_name,
    ADD COLUMN file_version VARCHAR(40) NULL AFTER file_size,
    ADD COLUMN last_uploaded_at DATETIME NULL AFTER file_version,
    ADD KEY idx_template_center_status_filters (deleted_at, enabled, industry_category, difficulty_level, sort_order);
