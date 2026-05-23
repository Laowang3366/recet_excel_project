package com.excel.forum.service;

public interface ToolBillingService {
    BillingResult charge(Long userId, int amount, String taskKey, String description);

    void recordCharge(Long userId, int amount, String taskKey, Long bizId, String description, int balance);

    void refund(Long userId, int amount);

    int currentPoints(Long userId);

    record BillingResult(int currentPoints) {
    }
}
