package com.excel.forum.entity.dto;

import lombok.Data;

@Data
public class AdminPracticeDailyChallengeRequest {
    private Object levelId;
    private Object challengeDate;
    private Object rewardExp;
    private Object rewardPoints;
    private Object enabled;
}
