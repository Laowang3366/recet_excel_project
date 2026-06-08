package com.excel.forum.config;

import org.junit.jupiter.api.Test;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.assertj.core.api.Assertions.assertThat;

class DatabaseIndexMigrationTest {

    @Test
    void paginationIndexMigrationCoversHotReadPaths() throws Exception {
        Path migration = Path.of("src/main/resources/db/migration/V101__add_pagination_query_indexes.sql");

        assertThat(migration).exists();
        String sql = Files.readString(migration);

        assertThat(sql).contains(
                "ADD KEY `idx_points_record_user_time` (`user_id`, `create_time`, `id`)",
                "ADD KEY `idx_points_record_task_business` (`task_key`, `business_no`)",
                "ADD KEY `idx_practice_record_user_submit` (`user_id`, `submit_time`, `id`)",
                "ADD KEY `idx_practice_record_user_status_submit` (`user_id`, `status`, `submit_time`, `id`)",
                "ADD KEY `idx_user_exp_log_user_time` (`user_id`, `create_time`, `id`)",
                "ADD KEY `idx_user_exp_log_biz_time` (`biz_type`, `create_time`, `id`)",
                "ADD KEY `idx_notification_user_time` (`user_id`, `create_time`, `id`)",
                "ADD KEY `idx_notification_user_read_type` (`user_id`, `is_read`, `type`)",
                "ADD KEY `idx_file_recycle_status_deleted` (`status`, `deleted_at`, `id`)",
                "ADD KEY `idx_file_recycle_status_resource_deleted` (`status`, `resource_type`, `deleted_at`, `id`)",
                "ADD KEY `idx_file_recycle_status_deleted_by_time` (`status`, `deleted_by`, `deleted_at`, `id`)",
                "ADD KEY `idx_template_download_user_time` (`user_id`, `create_time`, `id`)",
                "ADD KEY `idx_site_notification_pinned_time` (`pinned`, `create_time`, `id`)",
                "ADD KEY `idx_user_status_points` (`status`, `points`, `id`)",
                "ADD KEY `idx_user_status_role` (`status`, `role`, `id`)",
                "ADD KEY `idx_user_create_time` (`create_time`)"
        );
    }
}
