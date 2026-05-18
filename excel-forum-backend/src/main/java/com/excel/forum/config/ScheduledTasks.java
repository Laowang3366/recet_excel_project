package com.excel.forum.config;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.excel.forum.entity.AdminLog;
import com.excel.forum.entity.Notification;
import com.excel.forum.mapper.AdminLogMapper;
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
    private final AdminLogMapper adminLogMapper;

    @Scheduled(cron = "0 30 3 * * ?")
    public void cleanOldNotifications() {
        QueryWrapper<Notification> queryWrapper = new QueryWrapper<>();
        queryWrapper.lt("create_time", LocalDateTime.now().minusDays(90));
        if (notificationService.remove(queryWrapper)) {
            log.info("已清理超过 90 天的通知记录");
        }
    }

    @Scheduled(cron = "0 0 5 * * ?")
    public void cleanOldAdminLogs() {
        QueryWrapper<AdminLog> adminLogQuery = new QueryWrapper<>();
        adminLogQuery.lt("create_time", LocalDateTime.now().minusDays(180));
        int removedAdminLogs = adminLogMapper.delete(adminLogQuery);
        if (removedAdminLogs > 0) {
            log.info("已清理 {} 条超过 180 天的管理员操作日志", removedAdminLogs);
        }
    }
}
