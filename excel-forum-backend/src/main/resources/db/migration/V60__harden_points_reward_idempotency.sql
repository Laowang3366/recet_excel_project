ALTER TABLE `points_record`
    ADD COLUMN `idempotency_key` VARCHAR(191) NULL AFTER `task_date`;

UPDATE `points_record`
SET `idempotency_key` = CONCAT('points:legacy-manual:', `id`)
WHERE `task_key` IS NULL OR `task_key` = '';

UPDATE `points_record` pr
JOIN (
    SELECT
        `id`,
        ROW_NUMBER() OVER (
            PARTITION BY `user_id`, `task_key`, COALESCE(`biz_id`, -1), COALESCE(`task_date`, DATE '1000-01-01')
            ORDER BY `id`
        ) AS rn
    FROM `points_record`
    WHERE `task_key` IS NOT NULL AND `task_key` <> ''
) ranked ON ranked.`id` = pr.`id`
SET pr.`idempotency_key` = CASE
    WHEN ranked.rn = 1 THEN CONCAT(
        'points:',
        pr.`user_id`,
        ':',
        pr.`task_key`,
        ':',
        COALESCE(CAST(pr.`biz_id` AS CHAR), 'none'),
        ':',
        COALESCE(DATE_FORMAT(pr.`task_date`, '%Y%m%d'), 'none')
    )
    ELSE CONCAT('points:legacy-duplicate:', pr.`id`)
END
WHERE pr.`task_key` IS NOT NULL AND pr.`task_key` <> '';

CREATE UNIQUE INDEX `uk_points_record_idempotency_key`
    ON `points_record` (`idempotency_key`);
