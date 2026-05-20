package com.excel.forum.config;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.excel.forum.entity.Notification;
import com.excel.forum.service.FileRecycleService;
import com.excel.forum.service.NotificationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;

@Slf4j
@Component
@EnableScheduling
@RequiredArgsConstructor
public class ScheduledTasks {
    private final NotificationService notificationService;
    private final FileRecycleService fileRecycleService;

    @Scheduled(cron = "0 30 3 * * ?")
    public void cleanOldNotifications() {
        QueryWrapper<Notification> queryWrapper = new QueryWrapper<>();
        queryWrapper.lt("create_time", LocalDateTime.now().minusDays(90));
        if (notificationService.remove(queryWrapper)) {
            log.info("已清理超过 90 天的通知记录");
        }
    }

    @Scheduled(cron = "0 10 4 * * ?")
    public void cleanExpiredRecycleFiles() {
        int purged = fileRecycleService.purgeExpired();
        if (purged > 0) {
            log.info("已彻底清理 {} 条过期回收站文件", purged);
        }
    }
}
