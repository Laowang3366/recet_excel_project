package com.excel.forum.entity.dto;

import lombok.Data;

@Data
public class QaSolutionShareUpdateRequest {
    private String title;
    private String thoughtText;
    private String thoughtSource;
    private String status;
}
