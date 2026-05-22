package com.excel.forum.service.impl;

import com.excel.forum.config.WorkbookSecurityProperties;
import com.excel.forum.entity.dto.ExcelWorkbookSnapshot;
import com.excel.forum.service.SecurityAbuseMonitor;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

class WorkbookSecurityGuardImplTest {

    @Test
    void rejectsWorkbookWithTooManySheets() {
        WorkbookSecurityProperties properties = new WorkbookSecurityProperties();
        properties.setMaxSheets(1);
        SecurityAbuseMonitor monitor = mock(SecurityAbuseMonitor.class);
        WorkbookSecurityGuardImpl guard = new WorkbookSecurityGuardImpl(properties, monitor);

        try (Workbook workbook = new XSSFWorkbook()) {
            workbook.createSheet("Sheet1");
            workbook.createSheet("Sheet2");

            assertThatThrownBy(() -> guard.assertWorkbookSafe(workbook, "测试模板"))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("工作表数量");
            verify(monitor).recordWorkbookRejected("测试模板", "工作表数量超过限制");
        } catch (Exception exception) {
            throw new AssertionError(exception);
        }
    }

    @Test
    void rejectsSnapshotWithTooManyCells() {
        WorkbookSecurityProperties properties = new WorkbookSecurityProperties();
        properties.setMaxSnapshotCells(1);
        SecurityAbuseMonitor monitor = mock(SecurityAbuseMonitor.class);
        WorkbookSecurityGuardImpl guard = new WorkbookSecurityGuardImpl(properties, monitor);
        ExcelWorkbookSnapshot snapshot = new ExcelWorkbookSnapshot();
        ExcelWorkbookSnapshot.SheetSnapshot sheet = new ExcelWorkbookSnapshot.SheetSnapshot();
        sheet.setName("Sheet1");
        sheet.getCells().put("A1", new ExcelWorkbookSnapshot.CellSnapshot());
        sheet.getCells().put("A2", new ExcelWorkbookSnapshot.CellSnapshot());
        snapshot.getSheets().add(sheet);

        assertThatThrownBy(() -> guard.assertSnapshotSafe(snapshot, "提交工作簿"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("单元格数量");
        verify(monitor).recordWorkbookRejected("提交工作簿", "单元格数量超过限制");
    }

    @Test
    void rejectsSnapshotWithOverlongFormula() {
        WorkbookSecurityProperties properties = new WorkbookSecurityProperties();
        properties.setMaxFormulaLength(4);
        SecurityAbuseMonitor monitor = mock(SecurityAbuseMonitor.class);
        WorkbookSecurityGuardImpl guard = new WorkbookSecurityGuardImpl(properties, monitor);
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
        verify(monitor).recordWorkbookRejected("提交工作簿", "公式过长");
    }

    @Test
    void rejectsWorkbookFormulaWithExternalLink() {
        WorkbookSecurityProperties properties = new WorkbookSecurityProperties();
        SecurityAbuseMonitor monitor = mock(SecurityAbuseMonitor.class);
        WorkbookSecurityGuardImpl guard = new WorkbookSecurityGuardImpl(properties, monitor);

        try (Workbook workbook = new XSSFWorkbook()) {
            Sheet sheet = workbook.createSheet("Sheet1");
            Row row = sheet.createRow(0);
            row.createCell(0).setCellFormula("HYPERLINK(\"https://evil.example\",\"open\")");

            assertThatThrownBy(() -> guard.assertWorkbookSafe(workbook, "上传文件"))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("危险公式");
            verify(monitor).recordWorkbookRejected("上传文件", "包含外部链接或危险公式");
        } catch (Exception exception) {
            throw new AssertionError(exception);
        }
    }

    @Test
    void rejectsSnapshotFormulaWithExternalReference() {
        WorkbookSecurityProperties properties = new WorkbookSecurityProperties();
        SecurityAbuseMonitor monitor = mock(SecurityAbuseMonitor.class);
        WorkbookSecurityGuardImpl guard = new WorkbookSecurityGuardImpl(properties, monitor);
        ExcelWorkbookSnapshot snapshot = new ExcelWorkbookSnapshot();
        ExcelWorkbookSnapshot.SheetSnapshot sheet = new ExcelWorkbookSnapshot.SheetSnapshot();
        sheet.setName("Sheet1");
        ExcelWorkbookSnapshot.CellSnapshot cell = new ExcelWorkbookSnapshot.CellSnapshot();
        cell.setFormula("WEBSERVICE(\"https://evil.example/data\")");
        sheet.getCells().put("A1", cell);
        snapshot.getSheets().add(sheet);

        assertThatThrownBy(() -> guard.assertSnapshotSafe(snapshot, "提交工作簿"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("危险公式");
        verify(monitor).recordWorkbookRejected("提交工作簿", "包含外部链接或危险公式");
    }

    @Test
    void allowsStructuredTableReferences() {
        WorkbookSecurityProperties properties = new WorkbookSecurityProperties();
        SecurityAbuseMonitor monitor = mock(SecurityAbuseMonitor.class);
        WorkbookSecurityGuardImpl guard = new WorkbookSecurityGuardImpl(properties, monitor);
        ExcelWorkbookSnapshot snapshot = new ExcelWorkbookSnapshot();
        ExcelWorkbookSnapshot.SheetSnapshot sheet = new ExcelWorkbookSnapshot.SheetSnapshot();
        sheet.setName("Sheet1");
        ExcelWorkbookSnapshot.CellSnapshot cell = new ExcelWorkbookSnapshot.CellSnapshot();
        cell.setFormula("SUM(Table1[Sales])");
        sheet.getCells().put("A1", cell);
        snapshot.getSheets().add(sheet);

        assertThatCode(() -> guard.assertSnapshotSafe(snapshot, "提交工作簿"))
                .doesNotThrowAnyException();
    }
}
