package com.excel.forum.entity.dto;

import lombok.Data;

@Data
public class AdminPracticeCampaignLevelRequest {
    private String levelType;
    private String difficulty;
    private Object targetTimeSeconds;
    private Object rewardExp;
    private Object rewardPoints;
    private Object firstPassBonus;
    private Object enabled;
}
