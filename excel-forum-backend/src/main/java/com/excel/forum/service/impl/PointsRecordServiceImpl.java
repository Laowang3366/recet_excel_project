package com.excel.forum.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.excel.forum.entity.PointsRecord;
import com.excel.forum.entity.User;
import com.excel.forum.mapper.PointsRecordMapper;
import com.excel.forum.mapper.UserMapper;
import com.excel.forum.service.PointsRecordService;
import com.excel.forum.service.SecurityAbuseMonitor;
import com.excel.forum.service.UserService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class PointsRecordServiceImpl extends ServiceImpl<PointsRecordMapper, PointsRecord> implements PointsRecordService {
    
    private final UserService userService;
    private final UserMapper userMapper;
    private final SecurityAbuseMonitor securityAbuseMonitor;

    @Override
    @Transactional
    public void addPointsRecord(Long userId, String ruleName, Integer change, String description) {
        User user = userService.getById(userId);
        if (user == null) return;
        int changeValue = change == null ? 0 : change;
        int newBalance = (user.getPoints() != null ? user.getPoints() : 0) + changeValue;
        
        PointsRecord record = new PointsRecord();
        record.setUserId(userId);
        record.setRuleName(ruleName);
        record.setChange(changeValue);
        record.setBalance(newBalance);
        record.setDescription(description);
        save(record);
        if (changeValue != 0 && userMapper.addPoints(userId, changeValue) == 0) {
            throw new IllegalStateException("用户积分更新失败");
        }
    }

    @Override
    @Transactional
    public boolean addTaskPointsRecord(Long userId, Long ruleId, String ruleName, String taskKey, Long bizId, LocalDate taskDate, Integer change, String description) {
        User user = userService.getById(userId);
        if (user == null) return false;

        int changeValue = change == null ? 0 : change;
        int newBalance = (user.getPoints() != null ? user.getPoints() : 0) + changeValue;

        PointsRecord record = new PointsRecord();
        record.setUserId(userId);
        record.setRuleId(ruleId);
        record.setRuleName(ruleName);
        record.setTaskKey(taskKey);
        record.setBizId(bizId);
        record.setTaskDate(taskDate);
        record.setIdempotencyKey(buildIdempotencyKey(userId, taskKey, bizId, taskDate));
        record.setChange(changeValue);
        record.setBalance(newBalance);
        record.setDescription(description);
        try {
            baseMapper.insert(record);
        } catch (DuplicateKeyException exception) {
            securityAbuseMonitor.recordRewardIdempotencyCollision(record.getIdempotencyKey());
            log.debug("Duplicate points reward skipped: key={}", record.getIdempotencyKey(), exception);
            return false;
        }

        if (changeValue != 0 && userMapper.addPoints(userId, changeValue) == 0) {
            throw new IllegalStateException("用户积分更新失败");
        }
        return true;
    }

    private String buildIdempotencyKey(Long userId, String taskKey, Long bizId, LocalDate taskDate) {
        String safeTaskKey = taskKey == null || taskKey.isBlank() ? "manual" : taskKey.trim();
        String safeBizId = bizId == null ? "none" : String.valueOf(bizId);
        String safeDate = taskDate == null ? "none" : taskDate.format(DateTimeFormatter.BASIC_ISO_DATE);
        return "points:" + userId + ":" + safeTaskKey + ":" + safeBizId + ":" + safeDate;
    }

    @Override
    public Map<String, Object> getRecordsPage(int page, int size, String username) {
        Page<PointsRecord> pageParam = new Page<>(page, size);
        QueryWrapper<PointsRecord> queryWrapper = new QueryWrapper<>();
        
        if (username != null && !username.isEmpty()) {
            User user = userService.findByUsername(username);
            if (user != null) {
                queryWrapper.eq("user_id", user.getId());
            }
        }
        
        queryWrapper.orderByDesc("create_time");
        Page<PointsRecord> result = page(pageParam, queryWrapper);
        
        List<Map<String, Object>> records = result.getRecords().stream().map(record -> {
            Map<String, Object> map = new HashMap<>();
            map.put("id", record.getId());
            map.put("ruleName", record.getRuleName());
            map.put("taskKey", record.getTaskKey());
            map.put("ruleId", record.getRuleId());
            map.put("bizId", record.getBizId());
            map.put("taskDate", record.getTaskDate());
            map.put("change", record.getChange());
            map.put("balance", record.getBalance());
            map.put("description", record.getDescription());
            map.put("createTime", record.getCreateTime());
            
            User user = userService.getById(record.getUserId());
            if (user != null) {
                Map<String, Object> userMap = new HashMap<>();
                userMap.put("id", user.getId());
                userMap.put("username", user.getUsername());
                userMap.put("avatar", user.getAvatar());
                map.put("user", userMap);
            }
            return map;
        }).toList();
        
        Map<String, Object> response = new HashMap<>();
        response.put("records", records);
        response.put("total", result.getTotal());
        return response;
    }

    @Override
    public Map<String, Object> getUserRecordsPage(Long userId, int page, int size) {
        Page<PointsRecord> pageParam = new Page<>(page, size);
        QueryWrapper<PointsRecord> queryWrapper = new QueryWrapper<>();
        queryWrapper.eq("user_id", userId).orderByDesc("create_time");

        Page<PointsRecord> result = page(pageParam, queryWrapper);

        List<Map<String, Object>> records = result.getRecords().stream().map(record -> {
            Map<String, Object> map = new HashMap<>();
            map.put("id", record.getId());
            map.put("ruleName", record.getRuleName());
            map.put("taskKey", record.getTaskKey());
            map.put("ruleId", record.getRuleId());
            map.put("bizId", record.getBizId());
            map.put("taskDate", record.getTaskDate());
            map.put("change", record.getChange());
            map.put("balance", record.getBalance());
            map.put("description", record.getDescription());
            map.put("createTime", record.getCreateTime());
            return map;
        }).toList();

        Map<String, Object> response = new HashMap<>();
        response.put("records", records);
        response.put("total", result.getTotal());
        response.put("current", result.getCurrent());
        response.put("size", result.getSize());
        response.put("pages", result.getPages());
        return response;
    }
}
