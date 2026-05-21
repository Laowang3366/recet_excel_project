package com.excel.forum.service.impl;

import com.excel.forum.config.FileStorageConfig;
import com.excel.forum.config.WorkbookSecurityProperties;
import com.excel.forum.entity.dto.ExcelTemplateAnswerSnapshot;
import com.excel.forum.entity.dto.ExcelTemplateEvaluation;
import com.excel.forum.entity.dto.ExcelWorkbookSnapshot;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.ss.usermodel.WorkbookFactory;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.test.util.ReflectionTestUtils;

import java.io.ByteArrayInputStream;
import java.io.OutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ExcelTemplateGradingServiceImplTest {

    private final ExcelTemplateGradingServiceImpl service =
            new ExcelTemplateGradingServiceImpl(new ObjectMapper(), new FileStorageConfig(), defaultGuard());

    @TempDir
    Path tempDir;

    @Test
    void gradeSimpleAnswerRuleAllowsDifferentFormulaTextWhenFormulaExists() {
        ExcelTemplateEvaluation evaluation = service.grade(
                buildSubmission(10, "AVERAGE(A1:A3)"),
                "{\"answerSheet\":\"Sheet1\",\"answerRange\":\"B2\",\"checkFormula\":true,\"score\":1}",
                "{\"rangeValues\":{\"Sheet1!B2\":[[10]]},\"rangeFormulas\":{\"Sheet1!B2\":[[\"SUM(A1:A3)\"]]}}"
        );

        assertThat(evaluation.isPassed()).isTrue();
        assertThat(evaluation.getScore()).isEqualTo(1);
        assertThat(evaluation.getRuleResults())
                .extracting(item -> item.get("passed"))
                .containsExactly(true, true);
    }

    @Test
    void gradeSimpleAnswerRuleFailsWhenExpectedFormulaIsMissing() {
        ExcelTemplateEvaluation evaluation = service.grade(
                buildSubmission(10, null),
                "{\"answerSheet\":\"Sheet1\",\"answerRange\":\"B2\",\"checkFormula\":true,\"score\":1}",
                "{\"rangeValues\":{\"Sheet1!B2\":[[10]]},\"rangeFormulas\":{\"Sheet1!B2\":[[\"SUM(A1:A3)\"]]}}"
        );

        assertThat(evaluation.isPassed()).isFalse();
        assertThat(evaluation.getScore()).isEqualTo(1);
        assertThat(evaluation.getFeedback()).contains("函数公式");
        assertThat(evaluation.getRuleResults())
                .extracting(item -> item.get("passed"))
                .containsExactly(true, false);
    }


    @Test
    void buildExpectedSnapshotForDynamicArrayUsesAnswerSnapshotInsteadOfTemplateCells() {
        String gradingRule = "{\"dynamicArrayRules\":[{\"sheet\":\"练习\",\"anchorCell\":\"J2\",\"spillRange\":\"J2:K3\",\"score\":1,\"label\":\"动态数组\",\"requireAnchorFormula\":true,\"formulaKeywords\":[\"FILTER\"]}]}";
        String answerSnapshot = "{\"values\":[[\"A\",1],[\"B\",2]],\"formulas\":[[\"FILTER(A1:B9,A1:A9<>\\\"\\\")\",null],[null,null]]}";

        String expectedJson = service.buildExpectedSnapshotJson("/uploads/mock.xlsx", "练习", "J2:K3", true, answerSnapshot, gradingRule);

        assertThat(expectedJson).contains("练习!J2:K3");
        assertThat(expectedJson).contains("FILTER(A1:B9,A1:A9<>");
        assertThat(expectedJson).contains("\"A\"");
        assertThat(expectedJson).contains("\"B\"");
    }

    @Test
    void gradeDynamicArrayAcceptsCapturedValuesAndAnchorFormulaWithoutPoiEvaluation() {
        String gradingRule = "{\"dynamicArrayRules\":[{\"sheet\":\"Sheet1\",\"anchorCell\":\"B2\",\"spillRange\":\"B2:C3\",\"score\":1,\"requireAnchorFormula\":true,\"requireSpillCellsWithoutFormula\":true,\"formulaKeywords\":[\"FILTER\"]}]}";
        String expectedSnapshot = "{\"cellFormulas\":{\"Sheet1!B2\":\"FILTER(A1:B9,A1:A9<>\\\"\\\")\"},\"rangeValues\":{\"Sheet1!B2:C3\":[[\"A\",1],[\"B\",2]]},\"rangeFormulas\":{\"Sheet1!B2:C3\":[[\"FILTER(A1:B9,A1:A9<>\\\"\\\")\",\"\"],[\"\",\"\"]]}}";

        ExcelWorkbookSnapshot workbook = new ExcelWorkbookSnapshot();
        ExcelWorkbookSnapshot.SheetSnapshot sheet = new ExcelWorkbookSnapshot.SheetSnapshot();
        sheet.setName("Sheet1");
        workbook.getSheets().add(sheet);
        putCell(sheet, "B2", "A", "FILTER(A1:B9,A1:A9<>\"\")");
        putCell(sheet, "C2", 1, null);
        putCell(sheet, "B3", "B", null);
        putCell(sheet, "C3", 2, null);

        ExcelTemplateEvaluation evaluation = service.grade(workbook, gradingRule, expectedSnapshot);

        assertThat(evaluation.isPassed()).isTrue();
        assertThat(evaluation.getScore()).isEqualTo(1);
    }

    @Test
    void parseAnswerSnapshotNormalizesExcelCompatibilityFormulaPrefixes() {
        ExcelTemplateAnswerSnapshot snapshot = service.parseAnswerSnapshot(
                "{\"values\":[[46113]],\"formulas\":[[\"_xlfn.LET(_xlpm.m,K6,_xlpm.r,L6,_xlws.FILTER(A1:A9,A1:A9<>\\\"\\\"),_xlpm.m)\"]]}"
        );

        assertThat(snapshot.getFormulas()).isEqualTo(List.of(List.of("LET(m,K6,r,L6,FILTER(A1:A9,A1:A9<>\"\"),m)")));
    }

    @Test
    void parseAnswerSnapshotPreservesDateDisplayMetadata() {
        ExcelTemplateAnswerSnapshot snapshot = service.parseAnswerSnapshot(
                "{\"values\":[[46115],[46122]],\"formulas\":[[\"\"],[\"\"]],\"displays\":[[\"2026-04-03\"],[\"2026-04-10\"]],\"numberFormats\":[[\"yyyy-mm-dd\"],[\"yyyy-mm-dd\"]]}"
        );

        assertThat(snapshot.getValues()).isEqualTo(List.of(List.of(46115), List.of(46122)));
        assertThat(snapshot.getDisplays()).isEqualTo(List.of(List.of("2026-04-03"), List.of("2026-04-10")));
        assertThat(snapshot.getNumberFormats()).isEqualTo(List.of(List.of("yyyy-mm-dd"), List.of("yyyy-mm-dd")));
    }

    @Test
    void workbookSnapshotKeepsDateNumberFormatWithNumericValue() throws Exception {
        try (Workbook workbook = new XSSFWorkbook()) {
            Sheet sheet = workbook.createSheet("Sheet1");
            CellStyle dateStyle = workbook.createCellStyle();
            dateStyle.setDataFormat(workbook.getCreationHelper().createDataFormat().getFormat("yyyy-mm-dd"));
            org.apache.poi.ss.usermodel.Cell cell = sheet.createRow(0).createCell(0);
            cell.setCellValue(LocalDate.of(2026, 3, 2));
            cell.setCellStyle(dateStyle);

            ExcelWorkbookSnapshot snapshot = ReflectionTestUtils.invokeMethod(service, "toWorkbookSnapshot", workbook);
            ExcelWorkbookSnapshot.CellSnapshot output = snapshot.getSheets().get(0).getCells().get("A1");

            assertThat(output.getValue()).isInstanceOf(Number.class);
            assertThat(output.getDisplay()).contains("2026");
            assertThat(output.getNumberFormat()).isEqualTo("yyyy-mm-dd");
        }
    }

    @Test
    void workbookSnapshotDoesNotTreatDateStyledTextAsNumericDate() throws Exception {
        try (Workbook workbook = new XSSFWorkbook()) {
            Sheet sheet = workbook.createSheet("Sheet1");
            CellStyle dateStyle = workbook.createCellStyle();
            dateStyle.setDataFormat(workbook.getCreationHelper().createDataFormat().getFormat("yyyy-mm-dd"));
            org.apache.poi.ss.usermodel.Cell cell = sheet.createRow(0).createCell(0);
            cell.setCellValue("销售员");
            cell.setCellStyle(dateStyle);

            ExcelWorkbookSnapshot snapshot = ReflectionTestUtils.invokeMethod(service, "toWorkbookSnapshot", workbook);
            ExcelWorkbookSnapshot.CellSnapshot output = snapshot.getSheets().get(0).getCells().get("A1");

            assertThat(output.getValue()).isEqualTo("销售员");
            assertThat(output.getDisplay()).isEqualTo("销售员");
            assertThat(output.getNumberFormat()).isNull();
        }
    }

    @Test
    void buildStudentWorkbookFileClearsConfiguredAnswerRangeBeforeDownload() throws Exception {
        FileStorageConfig config = new FileStorageConfig();
        config.getLocal().setPath(tempDir.toString());
        ExcelTemplateGradingServiceImpl localService = new ExcelTemplateGradingServiceImpl(new ObjectMapper(), config, defaultGuard());
        Path workbookPath = tempDir.resolve("practice.xlsx");
        try (Workbook workbook = new XSSFWorkbook();
             OutputStream outputStream = Files.newOutputStream(workbookPath)) {
            Sheet sheet = workbook.createSheet("Sheet1");
            sheet.createRow(0).createCell(0).setCellValue("题目数据");
            sheet.createRow(1).createCell(1).setCellFormula("SUM(A1:A3)");
            sheet.getRow(1).createCell(2).setCellValue(100);
            sheet.createRow(2).createCell(1).setCellValue("答案");
            workbook.write(outputStream);
        }

        byte[] fileBytes = localService.buildStudentWorkbookFile("/uploads/practice.xlsx", "Sheet1", "B2:C3");

        try (Workbook downloaded = WorkbookFactory.create(new ByteArrayInputStream(fileBytes))) {
            Sheet sheet = downloaded.getSheet("Sheet1");
            assertThat(sheet.getRow(0).getCell(0).getStringCellValue()).isEqualTo("题目数据");
            assertThat(sheet.getRow(1).getCell(1)).satisfies(cell -> assertThat(cell).isNull());
            assertThat(sheet.getRow(1).getCell(2)).satisfies(cell -> assertThat(cell).isNull());
            assertThat(sheet.getRow(2).getCell(1)).satisfies(cell -> assertThat(cell).isNull());
        }
    }

    @Test
    void loadWorkbookSnapshotRejectsPathTraversalOutsideUploadRoot() throws Exception {
        Path uploadRoot = Files.createDirectories(tempDir.resolve("uploads"));
        Path outsideWorkbook = tempDir.resolve("outside.xlsx");
        writeTinyWorkbook(outsideWorkbook);

        FileStorageConfig config = new FileStorageConfig();
        config.getLocal().setPath(uploadRoot.toString());
        ExcelTemplateGradingServiceImpl localService = new ExcelTemplateGradingServiceImpl(new ObjectMapper(), config, defaultGuard());

        assertThatThrownBy(() -> localService.loadWorkbookSnapshot("/uploads/../outside.xlsx"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("模板文件路径无效");
    }

    @Test
    void loadWorkbookSnapshotAcceptsFilesInsideUploadRoot() throws Exception {
        Path uploadRoot = Files.createDirectories(tempDir.resolve("uploads"));
        Path workbookPath = uploadRoot.resolve("practice.xlsx");
        writeTinyWorkbook(workbookPath);

        FileStorageConfig config = new FileStorageConfig();
        config.getLocal().setPath(uploadRoot.toString());
        ExcelTemplateGradingServiceImpl localService = new ExcelTemplateGradingServiceImpl(new ObjectMapper(), config, defaultGuard());

        ExcelWorkbookSnapshot snapshot = localService.loadWorkbookSnapshot("/uploads/practice.xlsx");

        assertThat(snapshot.getSheets()).singleElement().satisfies(sheet -> assertThat(sheet.getName()).isEqualTo("Sheet1"));
    }

    private void putCell(ExcelWorkbookSnapshot.SheetSnapshot sheet, String ref, Object value, String formula) {
        ExcelWorkbookSnapshot.CellSnapshot cell = new ExcelWorkbookSnapshot.CellSnapshot();
        cell.setValue(value);
        cell.setFormula(formula);
        sheet.getCells().put(ref, cell);
    }

    private ExcelWorkbookSnapshot buildSubmission(Object value, String formula) {
        ExcelWorkbookSnapshot.CellSnapshot cell = new ExcelWorkbookSnapshot.CellSnapshot();
        cell.setValue(value);
        cell.setFormula(formula);

        ExcelWorkbookSnapshot.SheetSnapshot sheet = new ExcelWorkbookSnapshot.SheetSnapshot();
        sheet.setName("Sheet1");
        sheet.setRowCount(2);
        sheet.setColumnCount(2);
        sheet.getCells().put("B2", cell);

        ExcelWorkbookSnapshot workbook = new ExcelWorkbookSnapshot();
        workbook.getSheets().add(sheet);
        return workbook;
    }

    private static WorkbookSecurityGuardImpl defaultGuard() {
        return new WorkbookSecurityGuardImpl(new WorkbookSecurityProperties());
    }

    private void writeTinyWorkbook(Path target) throws Exception {
        try (Workbook workbook = new XSSFWorkbook();
             OutputStream outputStream = Files.newOutputStream(target)) {
            Sheet sheet = workbook.createSheet("Sheet1");
            sheet.createRow(0).createCell(0).setCellValue("ok");
            workbook.write(outputStream);
        }
    }
}
