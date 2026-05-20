package com.excel.forum.entity.dto;

import lombok.Data;

import java.util.List;

@Data
public class FileRecycleBatchRequest {
    private List<Long> ids;
}
