package com.excel.forum.entity.dto;

import lombok.Data;

import java.util.List;

@Data
public class NotificationBatchDeleteRequest {
    private List<Object> ids;
}
