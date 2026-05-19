package com.excel.forum.entity.dto;

import lombok.Data;

@Data
public class QaSolutionShareRequest {
    private Long answerId;
    private String thoughtText;
    private String thoughtSource;
}
