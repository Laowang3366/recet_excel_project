package com.excel.forum.entity.dto;

import lombok.Data;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Data
public class ExcelWorkbookSnapshot {
    private List<SheetSnapshot> sheets = new ArrayList<>();

    @Data
    public static class SheetSnapshot {
        private String name;
        private Integer rowCount;
        private Integer columnCount;
        private Map<String, CellSnapshot> cells = new LinkedHashMap<>();
    }

    @Data
    public static class CellSnapshot {
        private Object value;
        private String formula;
        private String display;
        private String numberFormat;
    }
}
