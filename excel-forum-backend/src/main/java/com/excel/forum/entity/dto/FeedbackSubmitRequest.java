package com.excel.forum.entity.dto;

import lombok.Data;

@Data
public class FeedbackSubmitRequest {
    private String type;
    private String content;
}
