package com.excel.forum.service.impl;

import com.excel.forum.config.WorkbookSecurityProperties;
import com.excel.forum.entity.dto.ExcelWorkbookSnapshot;
import com.excel.forum.service.SecurityAbuseMonitor;
import com.excel.forum.service.WorkbookSecurityGuard;
import lombok.RequiredArgsConstructor;
import org.apache.poi.openxml4j.util.ZipSecureFile;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellType;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.springframework.stereotype.Service;

import java.util.Locale;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class WorkbookSecurityGuardImpl implements WorkbookSecurityGuard {
    private final WorkbookSecurityProperties properties;
    private final SecurityAbuseMonitor securityAbuseMonitor;

    @Override
    public void applyZipBombProtection() {
        ZipSecureFile.setMinInflateRatio(properties.getMinInflateRatio());
    }

    @Override
    public void assertWorkbookSafe(Workbook workbook, String label) {
        if (workbook == null) {
            return;
        }
        String source = safeLabel(label);
        String monitorLabel = safeMonitorLabel(label);
        if (workbook.getNumberOfSheets() > properties.getMaxSheets()) {
            throw rejected(source, monitorLabel, "工作表数量超过限制");
        }

        int cellCount = 0;
        for (int sheetIndex = 0; sheetIndex < workbook.getNumberOfSheets(); sheetIndex += 1) {
            Sheet sheet = workbook.getSheetAt(sheetIndex);
            for (Row row : sheet) {
                for (Cell cell : row) {
                    if (cell == null || cell.getCellType() == CellType.BLANK) {
                        continue;
                    }
                    cellCount += 1;
                    if (cellCount > properties.getMaxWorkbookCells()) {
                        throw rejected(source, monitorLabel, "单元格数量超过限制");
                    }
                    if (cell.getCellType() == CellType.FORMULA) {
                        String formula = cell.getCellFormula();
                        assertTextLength(formula, properties.getMaxFormulaLength(), source, monitorLabel, "公式过长");
                        assertFormulaSafe(formula, source, monitorLabel);
                    } else if (cell.getCellType() == CellType.STRING) {
                        assertTextLength(cell.getStringCellValue(), properties.getMaxTextLength(), source, monitorLabel, "文本过长");
                    }
                }
            }
        }
    }

    @Override
    public void assertSnapshotSafe(ExcelWorkbookSnapshot snapshot, String label) {
        if (snapshot == null || snapshot.getSheets() == null) {
            return;
        }
        String source = safeLabel(label);
        String monitorLabel = safeMonitorLabel(label);
        if (snapshot.getSheets().size() > properties.getMaxSheets()) {
            throw rejected(source, monitorLabel, "工作表数量超过限制");
        }

        int cellCount = 0;
        for (ExcelWorkbookSnapshot.SheetSnapshot sheet : snapshot.getSheets()) {
            if (sheet == null || sheet.getCells() == null) {
                continue;
            }
            for (Map.Entry<String, ExcelWorkbookSnapshot.CellSnapshot> entry : sheet.getCells().entrySet()) {
                cellCount += 1;
                if (cellCount > properties.getMaxSnapshotCells()) {
                    throw rejected(source, monitorLabel, "单元格数量超过限制");
                }
                ExcelWorkbookSnapshot.CellSnapshot cell = entry.getValue();
                if (cell == null) {
                    continue;
                }
                assertTextLength(cell.getFormula(), properties.getMaxFormulaLength(), source, monitorLabel, "公式过长");
                assertFormulaSafe(cell.getFormula(), source, monitorLabel);
                assertTextLength(cell.getDisplay(), properties.getMaxTextLength(), source, monitorLabel, "显示文本过长");
                if (cell.getValue() instanceof String text) {
                    assertTextLength(text, properties.getMaxTextLength(), source, monitorLabel, "文本过长");
                }
            }
        }
    }

    private void assertTextLength(String value, int maxLength, String source, String monitorLabel, String reason) {
        if (value != null && value.length() > maxLength) {
            throw rejected(source, monitorLabel, reason);
        }
    }

    private void assertFormulaSafe(String formula, String source, String monitorLabel) {
        if (!properties.isBlockDangerousFormulas() || formula == null || formula.isBlank()) {
            return;
        }
        String normalized = formula.trim();
        if (normalized.startsWith("=")) {
            normalized = normalized.substring(1);
        }
        String upper = normalized.toUpperCase(Locale.ROOT);
        // 用户提交的 workbook 会被其他用户下载打开，这里只拦会触发外部资源、DDE 或宏类调用的公式。
        if (upper.contains("HYPERLINK(")
                || upper.contains("WEBSERVICE(")
                || upper.contains("IMPORTXML(")
                || upper.contains("IMPORTDATA(")
                || upper.contains("IMPORTRANGE(")
                || upper.contains("IMAGE(")
                || upper.contains("CALL(")
                || upper.contains("REGISTER.ID(")
                || upper.contains("HTTP://")
                || upper.contains("HTTPS://")
                || upper.contains("FTP://")
                || upper.contains("FILE://")
                || containsExternalWorkbookReference(upper)
                || upper.contains("|")) {
            throw rejected(source, monitorLabel, "包含外部链接或危险公式");
        }
    }

    private boolean containsExternalWorkbookReference(String upperFormula) {
        int start = upperFormula.indexOf('[');
        while (start >= 0) {
            int end = upperFormula.indexOf(']', start + 1);
            if (end > start) {
                String reference = upperFormula.substring(start + 1, end);
                if (reference.contains(".XLS")
                        || reference.contains(".CSV")
                        || reference.contains("HTTP")
                        || reference.contains("\\")
                        || reference.contains("/")) {
                    return true;
                }
            }
            start = upperFormula.indexOf('[', start + 1);
        }
        return false;
    }

    private IllegalArgumentException rejected(String source, String monitorLabel, String reason) {
        securityAbuseMonitor.recordWorkbookRejected(monitorLabel, reason);
        return new IllegalArgumentException(source + reason);
    }

    private String safeLabel(String label) {
        return label == null || label.isBlank() ? "" : label.trim() + "：";
    }

    private String safeMonitorLabel(String label) {
        return label == null || label.isBlank() ? "unknown" : label.trim();
    }
}
