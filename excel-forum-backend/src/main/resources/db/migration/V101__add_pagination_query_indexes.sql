-- Composite indexes for hot pagination, dashboard and batch-update read paths.
-- Existing single-column indexes are kept for compatibility; these indexes
-- match the code paths that filter by owner/status and then sort or group.

ALTER TABLE `points_record`
    ADD KEY `idx_points_record_user_time` (`user_id`, `create_time`, `id`),
    ADD KEY `idx_points_record_task_business` (`task_key`, `business_no`);

ALTER TABLE `practice_record`
    ADD KEY `idx_practice_record_user_submit` (`user_id`, `submit_time`, `id`),
    ADD KEY `idx_practice_record_user_status_submit` (`user_id`, `status`, `submit_time`, `id`);

ALTER TABLE `user_exp_log`
    ADD KEY `idx_user_exp_log_user_time` (`user_id`, `create_time`, `id`),
    ADD KEY `idx_user_exp_log_biz_time` (`biz_type`, `create_time`, `id`);

ALTER TABLE `notification`
    ADD KEY `idx_notification_user_time` (`user_id`, `create_time`, `id`),
    ADD KEY `idx_notification_user_read_type` (`user_id`, `is_read`, `type`);

ALTER TABLE `file_recycle_item`
    ADD KEY `idx_file_recycle_status_deleted` (`status`, `deleted_at`, `id`),
    ADD KEY `idx_file_recycle_status_resource_deleted` (`status`, `resource_type`, `deleted_at`, `id`),
    ADD KEY `idx_file_recycle_status_deleted_by_time` (`status`, `deleted_by`, `deleted_at`, `id`);

ALTER TABLE `template_download_record`
    ADD KEY `idx_template_download_user_time` (`user_id`, `create_time`, `id`);

ALTER TABLE `site_notification`
    ADD KEY `idx_site_notification_pinned_time` (`pinned`, `create_time`, `id`);

ALTER TABLE `user`
    ADD KEY `idx_user_status_points` (`status`, `points`, `id`),
    ADD KEY `idx_user_status_role` (`status`, `role`, `id`),
    ADD KEY `idx_user_create_time` (`create_time`);
