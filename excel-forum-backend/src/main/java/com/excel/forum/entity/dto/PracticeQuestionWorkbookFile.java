package com.excel.forum.entity.dto;

public record PracticeQuestionWorkbookFile(
        String fileName,
        String contentType,
        byte[] content
) {
}
