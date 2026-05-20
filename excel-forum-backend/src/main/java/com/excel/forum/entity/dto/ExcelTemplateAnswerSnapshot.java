package com.excel.forum.entity.dto;

import lombok.Data;

import java.util.ArrayList;
import java.util.List;

@Data
public class ExcelTemplateAnswerSnapshot {
    private List<List<Object>> values = new ArrayList<>();
    private List<List<String>> formulas = new ArrayList<>();
    private List<List<String>> displays = new ArrayList<>();
    private List<List<String>> numberFormats = new ArrayList<>();
}
