package com.excel.forum.entity.dto;

import lombok.Data;

@Data
public class AdminPointsGrantRequest {
    private String username;
    private Object points;
    private String reason;
}
