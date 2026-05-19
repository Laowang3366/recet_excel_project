package com.excel.forum.entity.dto;

import lombok.Data;

@Data
public class QaCaseHelpRequest {
    private String title;
    private String description;
    private String templateFileUrl;
    private String answerSheet;
    private String answerRange;
    private String idealAnswerSnapshotJson;
}
