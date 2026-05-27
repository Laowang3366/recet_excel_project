package com.excel.forum.entity.dto;

import lombok.Data;

@Data
public class AdminPointsGrantRequest {
    private String username;
    private Object points;
    private String reason;
    private String businessNo;
    private Boolean notifyUser;
}
