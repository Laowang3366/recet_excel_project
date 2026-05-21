package com.excel.forum.service.impl;

import com.excel.forum.config.WorkbookSecurityProperties;
import com.excel.forum.entity.dto.ExcelWorkbookSnapshot;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThatThrownBy;

class WorkbookSecurityGuardImplTest {

    @Test
    void rejectsWorkbookWithTooManySheets() {
        WorkbookSecurityProperties properties = new WorkbookSecurityProperties();
        properties.setMaxSheets(1);
        WorkbookSecurityGuardImpl guard = new WorkbookSecurityGuardImpl(properties);

        try (Workbook workbook = new XSSFWorkbook()) {
            workbook.createSheet("Sheet1");
            workbook.createSheet("Sheet2");

            assertThatThrownBy(() -> guard.assertWorkbookSafe(workbook, "测试模板"))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("工作表数量");
        } catch (Exception exception) {
            throw new AssertionError(exception);
        }
    }

    @Test
    void rejectsSnapshotWithTooManyCells() {
        WorkbookSecurityProperties properties = new WorkbookSecurityProperties();
        properties.setMaxSnapshotCells(1);
        WorkbookSecurityGuardImpl guard = new WorkbookSecurityGuardImpl(properties);
        ExcelWorkbookSnapshot snapshot = new ExcelWorkbookSnapshot();
        ExcelWorkbookSnapshot.SheetSnapshot sheet = new ExcelWorkbookSnapshot.SheetSnapshot();
        sheet.setName("Sheet1");
        sheet.getCells().put("A1", new ExcelWorkbookSnapshot.CellSnapshot());
        sheet.getCells().put("A2", new ExcelWorkbookSnapshot.CellSnapshot());
        snapshot.getSheets().add(sheet);

        assertThatThrownBy(() -> guard.assertSnapshotSafe(snapshot, "提交工作簿"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("单元格数量");
    }

    @Test
    void rejectsSnapshotWithOverlongFormula() {
        WorkbookSecurityProperties properties = new WorkbookSecurityProperties();
        properties.setMaxFormulaLength(4);
        WorkbookSecurityGuardImpl guard = new WorkbookSecurityGuardImpl(properties);
        ExcelWorkbookSnapshot snapshot = new ExcelWorkbookSnapshot();
        ExcelWorkbookSnapshot.SheetSnapshot sheet = new ExcelWorkbookSnapshot.SheetSnapshot();
        sheet.setName("Sheet1");
        ExcelWorkbookSnapshot.CellSnapshot cell = new ExcelWorkbookSnapshot.CellSnapshot();
        cell.setFormula("SUM(A1:A10)");
        sheet.getCells().put("A1", cell);
        snapshot.getSheets().add(sheet);

        assertThatThrownBy(() -> guard.assertSnapshotSafe(snapshot, "提交工作簿"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("公式过长");
    }
}
