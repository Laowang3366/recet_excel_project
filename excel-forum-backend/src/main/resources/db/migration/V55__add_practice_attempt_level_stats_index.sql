ALTER TABLE `practice_attempt`
    ADD KEY `idx_practice_attempt_level_status_user` (`level_id`, `result_status`, `user_id`);
