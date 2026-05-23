package com.excel.forum.service.impl;

import com.excel.forum.entity.PointsRecord;
import com.excel.forum.entity.User;
import com.excel.forum.mapper.UserMapper;
import com.excel.forum.service.PointsRecordService;
import com.excel.forum.service.ToolBillingService;
import com.excel.forum.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class ToolBillingServiceImpl implements ToolBillingService {
    private final UserMapper userMapper;
    private final UserService userService;
    private final PointsRecordService pointsRecordService;

    @Override
    public BillingResult charge(Long userId, int amount, String taskKey, String description) {
        if (userId == null) {
            throw new IllegalArgumentException("请先登录");
        }
        int deducted = userMapper.deductPoints(userId, amount);
        if (deducted == 0) {
            throw new IllegalArgumentException("积分不足，当前功能需要 " + amount + " 积分");
        }
        int balance = currentPoints(userId);
        return new BillingResult(balance);
    }

    @Override
    public void recordCharge(Long userId, int amount, String taskKey, Long bizId, String description, int balance) {
        PointsRecord record = new PointsRecord();
        record.setUserId(userId);
        record.setRuleName(description);
        record.setTaskKey(taskKey);
        record.setBizId(bizId);
        record.setChange(-amount);
        record.setBalance(balance);
        record.setDescription(description);
        pointsRecordService.save(record);
    }

    @Override
    public void refund(Long userId, int amount) {
        if (userId != null && amount > 0) {
            userMapper.addPoints(userId, amount);
        }
    }

    @Override
    public int currentPoints(Long userId) {
        User user = userId == null ? null : userService.getById(userId);
        return user == null || user.getPoints() == null ? 0 : user.getPoints();
    }
}
