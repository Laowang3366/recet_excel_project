package com.excel.forum.service.impl;

import com.excel.forum.config.FileStorageConfig;
import com.excel.forum.entity.dto.ExcelTemplateAnswerSnapshot;
import com.excel.forum.entity.dto.ExcelTemplateEvaluation;
import com.excel.forum.entity.dto.ExcelTemplateExpectedSnapshot;
import com.excel.forum.entity.dto.ExcelTemplateRuleConfig;
import com.excel.forum.entity.dto.ExcelWorkbookSnapshot;
import com.excel.forum.service.ExcelTemplateGradingService;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.poi.ss.formula.FormulaParseException;
import org.apache.poi.ss.formula.eval.NotImplementedException;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellType;
import org.apache.poi.ss.usermodel.DataFormatter;
import org.apache.poi.ss.usermodel.DateUtil;
import org.apache.poi.ss.usermodel.FormulaEvaluator;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.ss.usermodel.WorkbookFactory;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;

@Service
@RequiredArgsConstructor
@Slf4j
public class ExcelTemplateGradingServiceImpl implements ExcelTemplateGradingService {
    private static final double EPSILON = 0.000001d;

    private final ObjectMapper objectMapper;
    private final FileStorageConfig fileStorageConfig;

    @Override
    public ExcelWorkbookSnapshot loadWorkbookSnapshot(String fileUrl) {
        if (!StringUtils.hasText(fileUrl)) {
            throw new IllegalArgumentException("模板文件不能为空");
        }
        Path filePath = resolveLocalPath(fileUrl);
        if (!Files.exists(filePath)) {
            throw new IllegalArgumentException("模板文件不存在");
        }

        try (InputStream inputStream = Files.newInputStream(filePath);
             Workbook workbook = WorkbookFactory.create(inputStream)) {
            return toWorkbookSnapshot(workbook);
        } catch (IOException e) {
            throw new IllegalArgumentException("模板文件解析失败", e);
        }
    }

    @Override
    public ExcelTemplateRuleConfig parseRuleConfig(String gradingRuleJson) {
        if (!StringUtils.hasText(gradingRuleJson)) {
            return new ExcelTemplateRuleConfig();
        }
        try {
            ExcelTemplateRuleConfig config = objectMapper.readValue(gradingRuleJson, ExcelTemplateRuleConfig.class);
            if (config.getRequiredSheets() == null) {
                config.setRequiredSheets(new ArrayList<>());
            }
            if (config.getCellRules() == null) {
                config.setCellRules(new ArrayList<>());
            }
            if (config.getRangeRules() == null) {
                config.setRangeRules(new ArrayList<>());
            }
            if (config.getHeaderRules() == null) {
                config.setHeaderRules(new ArrayList<>());
            }
            if (config.getDynamicArrayRules() == null) {
                config.setDynamicArrayRules(new ArrayList<>());
            }
            if (config.getExpectedAnswerValues() == null) {
                config.setExpectedAnswerValues(new ArrayList<>());
            }
            if (config.getCheckFormula() == null) {
                config.setCheckFormula(false);
            }
            return config;
        } catch (JsonProcessingException e) {
            throw new IllegalArgumentException("判题规则 JSON 格式错误", e);
        }
    }

    @Override
    public String normalizeRuleJson(String gradingRuleJson) {
        return writeJson(parseRuleConfig(gradingRuleJson));
    }

    @Override
    public void validateAnswerArea(String fileUrl, String sheetName, String rangeRef) {
        ExcelWorkbookSnapshot workbook = loadWorkbookSnapshot(fileUrl);
        if (!StringUtils.hasText(sheetName)) {
            throw new IllegalArgumentException("答题工作表不能为空");
        }
        if (findSheet(workbook, sheetName) == null) {
            throw new IllegalArgumentException("答题工作表不存在");
        }
        if (parseRange(rangeRef) == null) {
            throw new IllegalArgumentException("答题区域格式不正确");
        }
    }

    @Override
    public String buildSimpleRuleJson(String answerSheet, String answerRange, Boolean checkFormula) {
        ExcelTemplateRuleConfig config = new ExcelTemplateRuleConfig();
        config.setAnswerSheet(defaultText(answerSheet));
        config.setAnswerRange(defaultText(answerRange));
        config.setCheckFormula(Boolean.TRUE.equals(checkFormula));
        config.setScore(1);
        return writeJson(config);
    }

    @Override
    public String buildRuleJson(String fileUrl, String answerSheet, String answerRange, Boolean checkFormula, String gradingRuleJson) {
        ExcelTemplateRuleConfig config = parseRuleConfig(gradingRuleJson);
        if (!hasDynamicArrayRules(config)) {
            return buildSimpleRuleJson(answerSheet, answerRange, checkFormula);
        }

        ExcelWorkbookSnapshot workbookSnapshot = loadWorkbookSnapshot(fileUrl);
        List<ExcelTemplateRuleConfig.DynamicArrayRule> normalizedRules = new ArrayList<>();
        for (int index = 0; index < config.getDynamicArrayRules().size(); index += 1) {
            ExcelTemplateRuleConfig.DynamicArrayRule sourceRule = config.getDynamicArrayRules().get(index);
            ExcelTemplateRuleConfig.DynamicArrayRule normalizedRule = normalizeDynamicArrayRule(
                    workbookSnapshot,
                    sourceRule,
                    index,
                    answerSheet
            );
            normalizedRules.add(normalizedRule);
        }

        config.setAnswerSheet(null);
        config.setAnswerRange(null);
        config.setExpectedAnswerValues(new ArrayList<>());
        config.setCheckFormula(false);
        config.setScore(0);
        config.setDynamicArrayRules(normalizedRules);
        return writeJson(config);
    }

    @Override
    public ExcelTemplateAnswerSnapshot parseAnswerSnapshot(String json) {
        if (!StringUtils.hasText(json)) {
            return new ExcelTemplateAnswerSnapshot();
        }
        try {
            ExcelTemplateAnswerSnapshot snapshot = objectMapper.readValue(json, ExcelTemplateAnswerSnapshot.class);
            if (snapshot.getValues() == null) {
                snapshot.setValues(new ArrayList<>());
            }
            if (snapshot.getFormulas() == null) {
                snapshot.setFormulas(new ArrayList<>());
            }
            snapshot.setFormulas(normalizeFormulaMatrix(snapshot.getFormulas()));
            return snapshot;
        } catch (JsonProcessingException e) {
            throw new IllegalArgumentException("标准答案快照 JSON 格式错误", e);
        }
    }

    @Override
    public String normalizeAnswerSnapshotJson(String fileUrl, String answerSheet, String answerRange, Boolean checkFormula, String answerSnapshotJson) {
        if (!StringUtils.hasText(answerSnapshotJson)) {
            throw new IllegalArgumentException("标准答案不能为空");
        }
        RangeRef range = requireRange(answerRange);
        JsonNode root;
        try {
            root = objectMapper.readTree(answerSnapshotJson);
        } catch (JsonProcessingException e) {
            throw new IllegalArgumentException("标准答案快照 JSON 格式错误", e);
        }

        ExcelTemplateAnswerSnapshot normalized;
        if (root.has("sheets")) {
            ExcelWorkbookSnapshot workbook = objectMapper.convertValue(root, ExcelWorkbookSnapshot.class);
            ExcelWorkbookSnapshot materialized = materializeSubmission(fileUrl, workbook);
            normalized = new ExcelTemplateAnswerSnapshot();
            normalized.setValues(getRangeValues(materialized, answerSheet, answerRange));
            if (Boolean.TRUE.equals(checkFormula)) {
                normalized.setFormulas(getRangeFormulas(materialized, answerSheet, answerRange));
            }
        } else {
            normalized = parseAnswerSnapshot(answerSnapshotJson);
        }
        ensureMatrixSize(normalized.getValues(), range.height(), range.width(), "标准答案");
        ensureNoBlankAnswerValues(normalized.getValues());
        if (Boolean.TRUE.equals(checkFormula)) {
            ensureFormulaMatrixSize(normalized.getFormulas(), range.height(), range.width(), "标准答案公式");
        } else {
            normalized.setFormulas(new ArrayList<>());
        }
        return writeJson(normalized);
    }

    @Override
    public String buildExpectedSnapshotJson(String answerSheet, String answerRange, Boolean checkFormula, String answerSnapshotJson) {
        ExcelTemplateAnswerSnapshot answerSnapshot = parseAnswerSnapshot(answerSnapshotJson);
        ExcelTemplateExpectedSnapshot expectedSnapshot = new ExcelTemplateExpectedSnapshot();
        String answerKey = buildKey(answerSheet, answerRange);
        expectedSnapshot.getRangeValues().put(answerKey, answerSnapshot.getValues());
        if (Boolean.TRUE.equals(checkFormula)) {
            expectedSnapshot.getRangeFormulas().put(answerKey, answerSnapshot.getFormulas());
        }
        return writeJson(expectedSnapshot);
    }

    @Override
    public String buildExpectedSnapshotJson(String fileUrl, String answerSheet, String answerRange, Boolean checkFormula, String answerSnapshotJson, String gradingRuleJson) {
        return buildExpectedSnapshotJson(fileUrl, answerSheet, answerRange, checkFormula, answerSnapshotJson, gradingRuleJson, null);
    }

    @Override
    public String buildExpectedSnapshotJson(String fileUrl, String answerSheet, String answerRange, Boolean checkFormula, String answerSnapshotJson, String gradingRuleJson, String previousExpectedSnapshotJson) {
        ExcelTemplateRuleConfig ruleConfig = parseRuleConfig(gradingRuleJson);
        if (hasDynamicArrayRules(ruleConfig)) {
            return buildDynamicExpectedSnapshotJson(answerSheet, answerRange, answerSnapshotJson, ruleConfig, previousExpectedSnapshotJson);
        }
        return buildExpectedSnapshotJson(answerSheet, answerRange, checkFormula, answerSnapshotJson);
    }

    @Override
    public String buildExpectedSnapshotJson(String fileUrl, String gradingRuleJson, String expectedSnapshotJson) {
        if (StringUtils.hasText(expectedSnapshotJson)) {
            parseExpectedSnapshot(expectedSnapshotJson);
            return expectedSnapshotJson;
        }

        ExcelWorkbookSnapshot workbookSnapshot = loadWorkbookSnapshot(fileUrl);
        ExcelTemplateRuleConfig ruleConfig = parseRuleConfig(gradingRuleJson);
        ExcelTemplateExpectedSnapshot expectedSnapshot = new ExcelTemplateExpectedSnapshot();
        if (hasSimpleAnswerRule(ruleConfig)) {
            String answerKey = buildKey(ruleConfig.getAnswerSheet(), ruleConfig.getAnswerRange());
            List<List<Object>> expectedValues = ruleConfig.getExpectedAnswerValues() != null && !ruleConfig.getExpectedAnswerValues().isEmpty()
                    ? ruleConfig.getExpectedAnswerValues()
                    : getRangeValues(workbookSnapshot, ruleConfig.getAnswerSheet(), ruleConfig.getAnswerRange());
            expectedSnapshot.getRangeValues().put(answerKey, expectedValues);
            if (Boolean.TRUE.equals(ruleConfig.getCheckFormula())) {
                expectedSnapshot.getRangeFormulas().put(answerKey, getRangeFormulas(workbookSnapshot, ruleConfig.getAnswerSheet(), ruleConfig.getAnswerRange()));
            }
            return writeJson(expectedSnapshot);
        }

        expectedSnapshot.setRequiredSheets(new ArrayList<>(ruleConfig.getRequiredSheets()));
        for (ExcelTemplateRuleConfig.CellRule rule : ruleConfig.getCellRules()) {
            if (!StringUtils.hasText(rule.getSheet()) || !StringUtils.hasText(rule.getCell())) {
                continue;
            }
            String key = buildKey(rule.getSheet(), rule.getCell());
            Object value = getCellValue(workbookSnapshot, rule.getSheet(), normalizeCellRef(rule.getCell()));
            if (value != null) {
                expectedSnapshot.getCellValues().put(key, value);
            }
        }
        for (ExcelTemplateRuleConfig.RangeRule rule : ruleConfig.getRangeRules()) {
            if (!StringUtils.hasText(rule.getSheet()) || !StringUtils.hasText(rule.getRange())) {
                continue;
            }
            String key = buildKey(rule.getSheet(), rule.getRange());
            expectedSnapshot.getRangeValues().put(key, getRangeValues(workbookSnapshot, rule.getSheet(), rule.getRange()));
        }
        for (ExcelTemplateRuleConfig.HeaderRule rule : ruleConfig.getHeaderRules()) {
            if (!StringUtils.hasText(rule.getSheet()) || !StringUtils.hasText(rule.getRange())) {
                continue;
            }
            String key = buildKey(rule.getSheet(), rule.getRange());
            expectedSnapshot.getHeaderValues().put(key, getHeaderValues(workbookSnapshot, rule.getSheet(), rule.getRange()));
        }
        for (ExcelTemplateRuleConfig.DynamicArrayRule rule : ruleConfig.getDynamicArrayRules()) {
            addDynamicExpectedFromWorkbook(expectedSnapshot, workbookSnapshot, rule);
        }
        return writeJson(expectedSnapshot);
    }

    private String buildDynamicExpectedSnapshotJson(
            String answerSheet,
            String answerRange,
            String answerSnapshotJson,
            ExcelTemplateRuleConfig ruleConfig,
            String previousExpectedSnapshotJson
    ) {
        ExcelTemplateAnswerSnapshot answerSnapshot = parseAnswerSnapshot(answerSnapshotJson);
        ExcelTemplateExpectedSnapshot expectedSnapshot = new ExcelTemplateExpectedSnapshot();

        if (StringUtils.hasText(previousExpectedSnapshotJson)) {
            ExcelTemplateExpectedSnapshot previous = parseExpectedSnapshot(previousExpectedSnapshotJson);
            expectedSnapshot.setRequiredSheets(new ArrayList<>(previous.getRequiredSheets()));
            expectedSnapshot.getCellValues().putAll(previous.getCellValues());
            expectedSnapshot.getCellFormulas().putAll(previous.getCellFormulas());
            expectedSnapshot.getRangeValues().putAll(previous.getRangeValues());
            expectedSnapshot.getRangeFormulas().putAll(previous.getRangeFormulas());
            expectedSnapshot.getHeaderValues().putAll(previous.getHeaderValues());
        }

        List<ExcelTemplateRuleConfig.DynamicArrayRule> rules = ruleConfig.getDynamicArrayRules();
        if (rules == null || rules.isEmpty()) {
            return writeJson(expectedSnapshot);
        }

        RangeRef answerRangeRef = parseRange(answerRange);
        for (ExcelTemplateRuleConfig.DynamicArrayRule rule : rules) {
            addDynamicExpectedFromAnswerSnapshot(expectedSnapshot, answerSnapshot, rule, answerRangeRef);
        }
        return writeJson(expectedSnapshot);
    }

    private void addDynamicExpectedFromWorkbook(ExcelTemplateExpectedSnapshot expectedSnapshot, ExcelWorkbookSnapshot workbookSnapshot, ExcelTemplateRuleConfig.DynamicArrayRule rule) {
        if (!StringUtils.hasText(rule.getSheet()) || !StringUtils.hasText(rule.getSpillRange())) {
            return;
        }
        String spillKey = buildKey(rule.getSheet(), rule.getSpillRange());
        expectedSnapshot.getRangeValues().put(spillKey, getRangeValues(workbookSnapshot, rule.getSheet(), rule.getSpillRange()));
        expectedSnapshot.getRangeFormulas().put(spillKey, getRangeFormulas(workbookSnapshot, rule.getSheet(), rule.getSpillRange()));

        String anchorFormula = getCellFormula(workbookSnapshot, rule.getSheet(), rule.getAnchorCell());
        if (Boolean.TRUE.equals(rule.getRequireAnchorFormula()) && !hasFormula(anchorFormula)) {
            throw new IllegalArgumentException(defaultLabel(rule.getLabel(), rule.getSheet(), rule.getSpillRange()) + " 的锚点单元格未设置公式");
        }
        if (!rule.getFormulaKeywords().isEmpty() && !containsFormulaKeywords(anchorFormula, rule.getFormulaKeywords())) {
            throw new IllegalArgumentException(defaultLabel(rule.getLabel(), rule.getSheet(), rule.getSpillRange()) + " 的锚点公式未包含指定关键字");
        }
        expectedSnapshot.getCellFormulas().put(buildKey(rule.getSheet(), rule.getAnchorCell()), anchorFormula);
    }

    private void addDynamicExpectedFromAnswerSnapshot(
            ExcelTemplateExpectedSnapshot expectedSnapshot,
            ExcelTemplateAnswerSnapshot answerSnapshot,
            ExcelTemplateRuleConfig.DynamicArrayRule rule,
            RangeRef answerRangeRef
    ) {
        if (!StringUtils.hasText(rule.getSheet()) || !StringUtils.hasText(rule.getSpillRange())) {
            return;
        }
        RangeRef spill = parseRange(rule.getSpillRange());
        if (spill == null) {
            return;
        }
        int sourceStartRow = answerRangeRef == null ? 0 : Math.max(0, spill.startRow - answerRangeRef.startRow);
        int sourceStartCol = answerRangeRef == null ? 0 : Math.max(0, spill.startCol - answerRangeRef.startCol);
        List<List<Object>> values = sliceObjectMatrix(answerSnapshot.getValues(), sourceStartRow, sourceStartCol, spill.height(), spill.width());
        List<List<String>> formulas = sliceFormulaMatrix(answerSnapshot.getFormulas(), sourceStartRow, sourceStartCol, spill.height(), spill.width());
        String spillKey = buildKey(rule.getSheet(), rule.getSpillRange());
        expectedSnapshot.getRangeValues().put(spillKey, values);
        expectedSnapshot.getRangeFormulas().put(spillKey, formulas);

        String anchorFormula = getFormulaAt(formulas, spill, rule.getAnchorCell());
        if (Boolean.TRUE.equals(rule.getRequireAnchorFormula()) && !hasFormula(anchorFormula)) {
            throw new IllegalArgumentException(defaultLabel(rule.getLabel(), rule.getSheet(), rule.getSpillRange()) + " 的标准答案锚点单元格未设置公式");
        }
        if (!rule.getFormulaKeywords().isEmpty() && !containsFormulaKeywords(anchorFormula, rule.getFormulaKeywords())) {
            throw new IllegalArgumentException(defaultLabel(rule.getLabel(), rule.getSheet(), rule.getSpillRange()) + " 的标准答案锚点公式未包含指定关键字");
        }
        expectedSnapshot.getCellFormulas().put(buildKey(rule.getSheet(), rule.getAnchorCell()), anchorFormula);
    }

    private List<List<Object>> sliceObjectMatrix(List<List<Object>> matrix, int startRow, int startCol, int height, int width) {
        List<List<Object>> out = new ArrayList<>();
        for (int row = 0; row < height; row += 1) {
            List<Object> sourceRow = matrix == null || startRow + row >= matrix.size() ? List.of() : matrix.get(startRow + row);
            List<Object> outRow = new ArrayList<>();
            for (int col = 0; col < width; col += 1) {
                outRow.add(sourceRow == null || startCol + col >= sourceRow.size() ? null : sourceRow.get(startCol + col));
            }
            out.add(outRow);
        }
        return out;
    }

    private List<List<String>> sliceFormulaMatrix(List<List<String>> matrix, int startRow, int startCol, int height, int width) {
        List<List<String>> out = new ArrayList<>();
        for (int row = 0; row < height; row += 1) {
            List<String> sourceRow = matrix == null || startRow + row >= matrix.size() ? List.of() : matrix.get(startRow + row);
            List<String> outRow = new ArrayList<>();
            for (int col = 0; col < width; col += 1) {
                outRow.add(sourceRow == null || startCol + col >= sourceRow.size() || sourceRow.get(startCol + col) == null ? "" : sourceRow.get(startCol + col));
            }
            out.add(outRow);
        }
        return out;
    }

    private String getFormulaAt(List<List<String>> formulas, RangeRef spill, String cellRef) {
        CellRef cell = parseCell(cellRef);
        if (cell == null || spill == null) {
            return "";
        }
        int row = cell.row() - spill.startRow;
        int col = cell.col() - spill.startCol;
        if (row < 0 || col < 0 || row >= formulas.size()) {
            return "";
        }
        List<String> formulaRow = formulas.get(row);
        return formulaRow == null || col >= formulaRow.size() || formulaRow.get(col) == null ? "" : formulaRow.get(col);
    }

    @Override
    public ExcelTemplateExpectedSnapshot parseExpectedSnapshot(String json) {
        if (!StringUtils.hasText(json)) {
            return new ExcelTemplateExpectedSnapshot();
        }
        try {
            ExcelTemplateExpectedSnapshot snapshot = objectMapper.readValue(json, ExcelTemplateExpectedSnapshot.class);
            if (snapshot.getRequiredSheets() == null) {
                snapshot.setRequiredSheets(new ArrayList<>());
            }
            if (snapshot.getCellValues() == null) {
                snapshot.setCellValues(new LinkedHashMap<>());
            }
            if (snapshot.getCellFormulas() == null) {
                snapshot.setCellFormulas(new LinkedHashMap<>());
            }
            if (snapshot.getRangeValues() == null) {
                snapshot.setRangeValues(new LinkedHashMap<>());
            }
            if (snapshot.getRangeFormulas() == null) {
                snapshot.setRangeFormulas(new LinkedHashMap<>());
            }
            if (snapshot.getHeaderValues() == null) {
                snapshot.setHeaderValues(new LinkedHashMap<>());
            }
            snapshot.setCellFormulas(normalizeFormulaMap(snapshot.getCellFormulas()));
            snapshot.setRangeFormulas(normalizeFormulaMatrixMap(snapshot.getRangeFormulas()));
            return snapshot;
        } catch (JsonProcessingException e) {
            throw new IllegalArgumentException("标准结果快照 JSON 格式错误", e);
        }
    }

    @Override
    public ExcelWorkbookSnapshot materializeSubmission(String fileUrl, ExcelWorkbookSnapshot submission) {
        if (!StringUtils.hasText(fileUrl)) {
            throw new IllegalArgumentException("模板文件不能为空");
        }
        Path filePath = resolveLocalPath(fileUrl);
        if (!Files.exists(filePath)) {
            throw new IllegalArgumentException("模板文件不存在");
        }
        ExcelWorkbookSnapshot safeSubmission = submission == null ? new ExcelWorkbookSnapshot() : submission;
        try (InputStream inputStream = Files.newInputStream(filePath);
             Workbook workbook = WorkbookFactory.create(inputStream)) {
            try {
                applySubmissionToWorkbook(workbook, safeSubmission);
                workbook.getCreationHelper().createFormulaEvaluator().evaluateAll();
                return toWorkbookSnapshot(workbook);
            } catch (FormulaParseException | NotImplementedException | IllegalArgumentException exception) {
                log.trace("Materializing workbook formulas failed, falling back to submitted snapshot", exception);
                // Apache POI does not fully support newer Excel dynamic-array functions.
                // Fall back to the client-captured workbook snapshot so grading can still
                // use submitted values/formulas instead of failing the whole request.
                return safeSubmission;
            }
        } catch (IOException e) {
            throw new IllegalArgumentException("模板文件解析失败", e);
        }
    }

    @Override
    public byte[] buildStudentWorkbookFile(String fileUrl, String answerSheet, String answerRange) {
        if (!StringUtils.hasText(fileUrl)) {
            throw new IllegalArgumentException("模板文件不能为空");
        }
        if (!StringUtils.hasText(answerSheet)) {
            throw new IllegalArgumentException("答题工作表不能为空");
        }
        RangeRef range = requireRange(answerRange);
        Path filePath = resolveLocalPath(fileUrl);
        if (!Files.exists(filePath)) {
            throw new IllegalArgumentException("模板文件不存在");
        }

        try (InputStream inputStream = Files.newInputStream(filePath);
             Workbook workbook = WorkbookFactory.create(inputStream);
             ByteArrayOutputStream outputStream = new ByteArrayOutputStream()) {
            Sheet sheet = workbook.getSheet(answerSheet);
            if (sheet == null) {
                throw new IllegalArgumentException("答题工作表不存在");
            }
            clearAnswerRange(sheet, range);
            workbook.write(outputStream);
            return outputStream.toByteArray();
        } catch (IOException e) {
            throw new IllegalArgumentException("模板文件解析失败", e);
        }
    }

    @Override
    public byte[] buildWorkbookFileFromSnapshot(String fileUrl, ExcelWorkbookSnapshot submission) {
        if (!StringUtils.hasText(fileUrl)) {
            throw new IllegalArgumentException("模板文件不能为空");
        }
        Path filePath = resolveLocalPath(fileUrl);
        if (!Files.exists(filePath)) {
            throw new IllegalArgumentException("模板文件不存在");
        }

        ExcelWorkbookSnapshot safeSubmission = submission == null ? new ExcelWorkbookSnapshot() : submission;
        try (InputStream inputStream = Files.newInputStream(filePath);
             Workbook workbook = WorkbookFactory.create(inputStream);
             ByteArrayOutputStream outputStream = new ByteArrayOutputStream()) {
            applySubmissionToWorkbook(workbook, safeSubmission);
            try {
                workbook.getCreationHelper().createFormulaEvaluator().evaluateAll();
            } catch (FormulaParseException | NotImplementedException | IllegalArgumentException formulaEvaluationError) {
                // 新版动态数组函数可能无法由 POI 计算，但公式本身需要保留在导出的答疑模板中。
            }
            workbook.write(outputStream);
            return outputStream.toByteArray();
        } catch (IOException e) {
            throw new IllegalArgumentException("模板文件解析失败", e);
        }
    }

    @Override
    public ExcelTemplateEvaluation grade(ExcelWorkbookSnapshot submission, String gradingRuleJson, String expectedSnapshotJson) {
        ExcelTemplateRuleConfig ruleConfig = parseRuleConfig(gradingRuleJson);
        ExcelTemplateExpectedSnapshot expectedSnapshot = parseExpectedSnapshot(expectedSnapshotJson);
        ExcelWorkbookSnapshot safeSubmission = submission == null ? new ExcelWorkbookSnapshot() : submission;

        if (hasSimpleAnswerRule(ruleConfig)) {
            return gradeSimpleAnswerRule(safeSubmission, ruleConfig, expectedSnapshot);
        }

        ExcelTemplateEvaluation evaluation = new ExcelTemplateEvaluation();
        List<Map<String, Object>> ruleResults = new ArrayList<>();
        List<String> failedLabels = new ArrayList<>();
        int totalScore = 0;
        int achievedScore = 0;

        for (String requiredSheet : new LinkedHashSet<>(ruleConfig.getRequiredSheets())) {
            boolean exists = findSheet(safeSubmission, requiredSheet) != null;
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("type", "required_sheet");
            result.put("label", StringUtils.hasText(requiredSheet) ? requiredSheet + " 工作表存在" : "工作表存在");
            result.put("target", requiredSheet);
            result.put("passed", exists);
            result.put("expected", "存在");
            result.put("actual", exists ? "存在" : "缺失");
            result.put("score", 0);
            result.put("message", exists ? "工作表存在" : "缺少必需工作表");
            ruleResults.add(result);
            if (!exists) {
                failedLabels.add(result.get("label").toString());
            }
        }

        for (ExcelTemplateRuleConfig.CellRule rule : ruleConfig.getCellRules()) {
            int ruleScore = safeScore(rule.getScore());
            totalScore += ruleScore;
            Object expectedValue = firstNonNull(rule.getExpectedValue(), expectedSnapshot.getCellValues().get(buildKey(rule.getSheet(), rule.getCell())));
            Object actualValue = getCellValue(safeSubmission, rule.getSheet(), normalizeCellRef(rule.getCell()));
            boolean passed = compareValue(expectedValue, actualValue);
            if (passed) {
                achievedScore += ruleScore;
            }
            Map<String, Object> result = buildRuleResult("cell", defaultLabel(rule.getLabel(), rule.getSheet(), rule.getCell()), buildKey(rule.getSheet(), rule.getCell()), passed, expectedValue, actualValue, ruleScore);
            ruleResults.add(result);
            if (!passed) {
                failedLabels.add(result.get("label").toString());
            }
        }

        for (ExcelTemplateRuleConfig.RangeRule rule : ruleConfig.getRangeRules()) {
            int ruleScore = safeScore(rule.getScore());
            totalScore += ruleScore;
            List<List<Object>> expectedValues = rule.getExpectedValues() != null && !rule.getExpectedValues().isEmpty()
                    ? rule.getExpectedValues()
                    : expectedSnapshot.getRangeValues().getOrDefault(buildKey(rule.getSheet(), rule.getRange()), List.of());
            List<List<Object>> actualValues = getRangeValues(safeSubmission, rule.getSheet(), rule.getRange());
            boolean passed = compareMatrix(expectedValues, actualValues);
            if (passed) {
                achievedScore += ruleScore;
            }
            Map<String, Object> result = buildRuleResult("range", defaultLabel(rule.getLabel(), rule.getSheet(), rule.getRange()), buildKey(rule.getSheet(), rule.getRange()), passed, expectedValues, actualValues, ruleScore);
            ruleResults.add(result);
            if (!passed) {
                failedLabels.add(result.get("label").toString());
            }
        }

        for (ExcelTemplateRuleConfig.HeaderRule rule : ruleConfig.getHeaderRules()) {
            int ruleScore = safeScore(rule.getScore());
            totalScore += ruleScore;
            List<String> expectedHeaders = rule.getExpectedHeaders() != null && !rule.getExpectedHeaders().isEmpty()
                    ? rule.getExpectedHeaders()
                    : expectedSnapshot.getHeaderValues().getOrDefault(buildKey(rule.getSheet(), rule.getRange()), List.of());
            List<String> actualHeaders = getHeaderValues(safeSubmission, rule.getSheet(), rule.getRange());
            boolean passed = compareHeader(expectedHeaders, actualHeaders);
            if (passed) {
                achievedScore += ruleScore;
            }
            Map<String, Object> result = buildRuleResult("header", defaultLabel(rule.getLabel(), rule.getSheet(), rule.getRange()), buildKey(rule.getSheet(), rule.getRange()), passed, expectedHeaders, actualHeaders, ruleScore);
            ruleResults.add(result);
            if (!passed) {
                failedLabels.add(result.get("label").toString());
            }
        }

        for (ExcelTemplateRuleConfig.DynamicArrayRule rule : ruleConfig.getDynamicArrayRules()) {
            int ruleScore = safeScore(rule.getScore());
            totalScore += ruleScore;
            String spillKey = buildKey(rule.getSheet(), rule.getSpillRange());
            String anchorKey = buildKey(rule.getSheet(), rule.getAnchorCell());

            List<List<Object>> expectedValues = expectedSnapshot.getRangeValues().getOrDefault(spillKey, List.of());
            List<List<Object>> actualValues = getRangeValues(safeSubmission, rule.getSheet(), rule.getSpillRange());
            List<List<String>> actualFormulas = getRangeFormulas(safeSubmission, rule.getSheet(), rule.getSpillRange());
            String expectedAnchorFormula = expectedSnapshot.getCellFormulas().get(anchorKey);
            String actualAnchorFormula = getCellFormula(safeSubmission, rule.getSheet(), rule.getAnchorCell());

            boolean valuesPassed = compareMatrix(expectedValues, actualValues);
            boolean anchorFormulaPassed = !Boolean.TRUE.equals(rule.getRequireAnchorFormula()) || hasFormula(actualAnchorFormula);
            boolean keywordsPassed = rule.getFormulaKeywords().isEmpty() || containsFormulaKeywords(actualAnchorFormula, rule.getFormulaKeywords());
            boolean spillFormulaPassed = !Boolean.TRUE.equals(rule.getRequireSpillCellsWithoutFormula())
                    || hasNoExtraFormulas(actualFormulas, rule.getSheet(), rule.getAnchorCell(), rule.getSpillRange());
            boolean passed = valuesPassed && anchorFormulaPassed && keywordsPassed && spillFormulaPassed;
            if (passed) {
                achievedScore += ruleScore;
            }

            Map<String, Object> expected = new LinkedHashMap<>();
            expected.put("values", expectedValues);
            expected.put("anchorFormula", expectedAnchorFormula);
            expected.put("formulaKeywords", rule.getFormulaKeywords());
            expected.put("spillChildFormulaEmpty", Boolean.TRUE.equals(rule.getRequireSpillCellsWithoutFormula()));

            Map<String, Object> actual = new LinkedHashMap<>();
            actual.put("values", actualValues);
            actual.put("anchorFormula", actualAnchorFormula);
            actual.put("spillFormulas", actualFormulas);

            Map<String, Object> result = buildRuleResult(
                    "dynamic_array",
                    defaultLabel(rule.getLabel(), rule.getSheet(), rule.getSpillRange()),
                    spillKey,
                    passed,
                    expected,
                    actual,
                    ruleScore
            );
            if (!passed) {
                List<String> failureReasons = new ArrayList<>();
                if (!valuesPassed) {
                    failureReasons.add("结果区域不匹配");
                }
                if (!anchorFormulaPassed) {
                    failureReasons.add("锚点缺少公式");
                }
                if (!keywordsPassed) {
                    failureReasons.add("锚点公式关键字不匹配");
                }
                if (!spillFormulaPassed) {
                    failureReasons.add("溢出子单元格存在额外公式");
                }
                result.put("message", String.join("，", failureReasons));
                failedLabels.add(result.get("label").toString());
            }
            ruleResults.add(result);
        }

        evaluation.setRuleResults(ruleResults);
        evaluation.setScore(achievedScore);
        evaluation.setTotalScore(totalScore);
        evaluation.setPassed(failedLabels.isEmpty() && achievedScore >= totalScore);
        evaluation.setFeedback(failedLabels.isEmpty() ? "模板题判题通过" : "未通过规则：" + String.join("、", failedLabels));
        evaluation.setNormalizedUserAnswer(writeJson(safeSubmission));
        evaluation.setNormalizedCorrectAnswer(writeJson(expectedSnapshot));
        return evaluation;
    }

    @Override
    public Map<String, Object> buildRuleSummary(String gradingRuleJson) {
        ExcelTemplateRuleConfig config = parseRuleConfig(gradingRuleJson);
        Map<String, Object> summary = new LinkedHashMap<>();
        if (hasSimpleAnswerRule(config)) {
            int totalScore = safeScore(config.getScore());
            summary.put("mode", "simple_answer");
            summary.put("answerSheet", config.getAnswerSheet());
            summary.put("answerRange", config.getAnswerRange());
            summary.put("checkFormula", Boolean.TRUE.equals(config.getCheckFormula()));
            summary.put("requiredSheetCount", 0);
            summary.put("cellRuleCount", 0);
            summary.put("rangeRuleCount", 1);
            summary.put("headerRuleCount", 0);
            summary.put("dynamicArrayRuleCount", 0);
            summary.put("totalScore", totalScore);
            return summary;
        }
        summary.put("mode", hasDynamicArrayRules(config) ? "dynamic_array" : "rule_engine");
        summary.put("requiredSheetCount", config.getRequiredSheets().size());
        summary.put("cellRuleCount", config.getCellRules().size());
        summary.put("rangeRuleCount", config.getRangeRules().size());
        summary.put("headerRuleCount", config.getHeaderRules().size());
        summary.put("dynamicArrayRuleCount", config.getDynamicArrayRules().size());
        summary.put("totalScore",
                config.getCellRules().stream().map(ExcelTemplateRuleConfig.CellRule::getScore).filter(Objects::nonNull).mapToInt(Integer::intValue).sum()
                        + config.getRangeRules().stream().map(ExcelTemplateRuleConfig.RangeRule::getScore).filter(Objects::nonNull).mapToInt(Integer::intValue).sum()
                        + config.getHeaderRules().stream().map(ExcelTemplateRuleConfig.HeaderRule::getScore).filter(Objects::nonNull).mapToInt(Integer::intValue).sum()
                        + config.getDynamicArrayRules().stream().map(ExcelTemplateRuleConfig.DynamicArrayRule::getScore).filter(Objects::nonNull).mapToInt(Integer::intValue).sum());
        return summary;
    }

    private ExcelTemplateEvaluation gradeSimpleAnswerRule(ExcelWorkbookSnapshot submission, ExcelTemplateRuleConfig ruleConfig, ExcelTemplateExpectedSnapshot expectedSnapshot) {
        ExcelTemplateEvaluation evaluation = new ExcelTemplateEvaluation();
        List<Map<String, Object>> ruleResults = new ArrayList<>();
        List<String> failedLabels = new ArrayList<>();
        String answerKey = buildKey(ruleConfig.getAnswerSheet(), ruleConfig.getAnswerRange());
        int maxScore = safeScore(ruleConfig.getScore());
        int achievedScore = 0;

        List<List<Object>> expectedValues = ruleConfig.getExpectedAnswerValues() != null && !ruleConfig.getExpectedAnswerValues().isEmpty()
                ? ruleConfig.getExpectedAnswerValues()
                : expectedSnapshot.getRangeValues().getOrDefault(answerKey, List.of());
        List<List<Object>> actualValues = getRangeValues(submission, ruleConfig.getAnswerSheet(), ruleConfig.getAnswerRange());
        boolean answerPassed = compareMatrix(expectedValues, actualValues);
        if (answerPassed) {
            achievedScore += maxScore;
        } else {
            failedLabels.add("答案区域");
        }
        ruleResults.add(buildRuleResult(
                "answer_range",
                defaultLabel("答案区域校验", ruleConfig.getAnswerSheet(), ruleConfig.getAnswerRange()),
                answerKey,
                answerPassed,
                expectedValues,
                actualValues,
                maxScore
        ));

        if (Boolean.TRUE.equals(ruleConfig.getCheckFormula())) {
            List<List<String>> expectedFormulas = expectedSnapshot.getRangeFormulas().getOrDefault(answerKey, List.of());
            List<List<String>> actualFormulas = getRangeFormulas(submission, ruleConfig.getAnswerSheet(), ruleConfig.getAnswerRange());
            boolean formulaPassed = compareFormulaMatrix(expectedFormulas, actualFormulas);
            ruleResults.add(buildRuleResult(
                    "formula_range",
                    defaultLabel("函数公式校验", ruleConfig.getAnswerSheet(), ruleConfig.getAnswerRange()),
                    answerKey,
                    formulaPassed,
                    expectedFormulas,
                    actualFormulas,
                    0
            ));
            if (!formulaPassed) {
                failedLabels.add("函数公式");
            }
        }

        evaluation.setRuleResults(ruleResults);
        evaluation.setScore(achievedScore);
        evaluation.setTotalScore(maxScore);
        evaluation.setPassed(failedLabels.isEmpty());
        evaluation.setFeedback(failedLabels.isEmpty() ? "模板题判题通过" : "未通过规则：" + String.join("、", failedLabels));
        evaluation.setNormalizedUserAnswer(writeJson(submission));
        evaluation.setNormalizedCorrectAnswer(writeJson(expectedSnapshot));
        return evaluation;
    }

    private ExcelWorkbookSnapshot toWorkbookSnapshot(Workbook workbook) {
        FormulaEvaluator evaluator = workbook.getCreationHelper().createFormulaEvaluator();
        DataFormatter formatter = new DataFormatter(Locale.SIMPLIFIED_CHINESE);
        ExcelWorkbookSnapshot snapshot = new ExcelWorkbookSnapshot();

        for (int sheetIndex = 0; sheetIndex < workbook.getNumberOfSheets(); sheetIndex += 1) {
            Sheet sheet = workbook.getSheetAt(sheetIndex);
            ExcelWorkbookSnapshot.SheetSnapshot sheetSnapshot = new ExcelWorkbookSnapshot.SheetSnapshot();
            sheetSnapshot.setName(sheet.getSheetName());
            sheetSnapshot.setRowCount(Math.max(sheet.getLastRowNum() + 1, 1));
            sheetSnapshot.setColumnCount(Math.max(resolveColumnCount(sheet), 1));
            for (Row row : sheet) {
                for (Cell cell : row) {
                    if (cell == null || cell.getCellType() == CellType.BLANK) {
                        continue;
                    }
                    ExcelWorkbookSnapshot.CellSnapshot cellSnapshot = new ExcelWorkbookSnapshot.CellSnapshot();
                    if (cell.getCellType() == CellType.FORMULA) {
                        cellSnapshot.setFormula(normalizeFormulaForSnapshot(cell.getCellFormula()));
                        cellSnapshot.setValue(readEvaluatedCellValue(cell, evaluator));
                    } else {
                        cellSnapshot.setValue(readPlainCellValue(cell));
                    }
                    try {
                        cellSnapshot.setDisplay(formatter.formatCellValue(cell, evaluator));
                    } catch (FormulaParseException | NotImplementedException | IllegalArgumentException exception) {
                        log.trace("Display formatting failed at {}", cell.getAddress(), exception);
                        cellSnapshot.setDisplay(cellSnapshot.getValue() == null ? "" : String.valueOf(cellSnapshot.getValue()));
                    }
                    applyNumberFormat(cellSnapshot, cell);
                    sheetSnapshot.getCells().put(cell.getAddress().formatAsString(), cellSnapshot);
                }
            }
            snapshot.getSheets().add(sheetSnapshot);
        }
        return snapshot;
    }

    private void applyNumberFormat(ExcelWorkbookSnapshot.CellSnapshot cellSnapshot, Cell cell) {
        if (!canHaveDateNumberFormat(cell)) {
            return;
        }
        try {
            if (DateUtil.isCellDateFormatted(cell)) {
                cellSnapshot.setNumberFormat("yyyy-mm-dd");
            }
        } catch (IllegalArgumentException | IllegalStateException exception) {
            log.trace("Date number format detection failed at {}", cell.getAddress(), exception);
        }
    }

    private boolean canHaveDateNumberFormat(Cell cell) {
        if (cell == null) {
            return false;
        }
        if (cell.getCellType() == CellType.NUMERIC) {
            return true;
        }
        if (cell.getCellType() != CellType.FORMULA) {
            return false;
        }
        try {
            return cell.getCachedFormulaResultType() == CellType.NUMERIC;
        } catch (IllegalArgumentException | IllegalStateException exception) {
            log.trace("Formula cached result type detection failed at {}", cell.getAddress(), exception);
            return false;
        }
    }

    private void applySubmissionToWorkbook(Workbook workbook, ExcelWorkbookSnapshot submission) {
        if (submission == null || submission.getSheets() == null) {
            return;
        }
        for (ExcelWorkbookSnapshot.SheetSnapshot sheetSnapshot : submission.getSheets()) {
            if (sheetSnapshot == null || !StringUtils.hasText(sheetSnapshot.getName()) || sheetSnapshot.getCells() == null) {
                continue;
            }
            Sheet sheet = workbook.getSheet(sheetSnapshot.getName());
            if (sheet == null) {
                continue;
            }
            for (Map.Entry<String, ExcelWorkbookSnapshot.CellSnapshot> entry : sheetSnapshot.getCells().entrySet()) {
                CellRef ref = parseCell(entry.getKey());
                if (ref == null) {
                    continue;
                }
                Row row = sheet.getRow(ref.row() - 1);
                if (row == null) {
                    row = sheet.createRow(ref.row() - 1);
                }
                Cell cell = row.getCell(ref.col() - 1);
                if (cell == null) {
                    cell = row.createCell(ref.col() - 1);
                }
                applyCellSnapshot(cell, entry.getValue());
            }
        }
    }

    private void clearAnswerRange(Sheet sheet, RangeRef range) {
        for (int rowIndex = range.startRow(); rowIndex <= range.endRow(); rowIndex += 1) {
            Row row = sheet.getRow(rowIndex - 1);
            if (row == null) {
                continue;
            }
            for (int colIndex = range.startCol(); colIndex <= range.endCol(); colIndex += 1) {
                Cell cell = row.getCell(colIndex - 1);
                if (cell != null) {
                    row.removeCell(cell);
                }
            }
        }
    }

    private void applyCellSnapshot(Cell cell, ExcelWorkbookSnapshot.CellSnapshot snapshot) {
        if (snapshot == null) {
            cell.setBlank();
            return;
        }
        if (StringUtils.hasText(snapshot.getFormula())) {
            cell.setCellFormula(normalizeFormulaForPoi(snapshot.getFormula()));
            setFormulaCachedValue(cell, snapshot.getValue());
            return;
        }
        Object value = snapshot.getValue();
        if (value == null || normalizeText(value).isEmpty()) {
            cell.setBlank();
            return;
        }
        if (value instanceof Boolean booleanValue) {
            cell.setCellValue(booleanValue);
            return;
        }
        if (value instanceof Number number) {
            cell.setCellValue(number.doubleValue());
            return;
        }
        String text = String.valueOf(value);
        if ("true".equalsIgnoreCase(text) || "false".equalsIgnoreCase(text)) {
            cell.setCellValue(Boolean.parseBoolean(text));
            return;
        }
        Double numeric = toDouble(text);
        if (numeric != null && !text.startsWith("0") && !text.startsWith("+")) {
            cell.setCellValue(numeric);
            return;
        }
        cell.setCellValue(text);
    }

    private void setFormulaCachedValue(Cell cell, Object value) {
        if (value == null || normalizeText(value).isEmpty()) {
            return;
        }
        if (value instanceof Boolean booleanValue) {
            cell.setCellValue(booleanValue);
            return;
        }
        if (value instanceof Number number) {
            cell.setCellValue(number.doubleValue());
            return;
        }
        String text = String.valueOf(value);
        if ("true".equalsIgnoreCase(text) || "false".equalsIgnoreCase(text)) {
            cell.setCellValue(Boolean.parseBoolean(text));
            return;
        }
        Double numeric = toDouble(text);
        if (numeric != null && !text.startsWith("0") && !text.startsWith("+")) {
            cell.setCellValue(numeric);
            return;
        }
        cell.setCellValue(text);
    }

    private String normalizeFormulaForPoi(String formula) {
        String normalized = formula == null ? "" : formula.trim();
        if (normalized.startsWith("=")) {
            normalized = normalized.substring(1);
        }
        return stripExcelCompatibilityPrefixes(normalized).trim();
    }

    private String normalizeFormulaForSnapshot(String formula) {
        return normalizeFormulaForPoi(formula);
    }

    private List<List<String>> normalizeFormulaMatrix(List<List<String>> formulas) {
        if (formulas == null) {
            return new ArrayList<>();
        }
        List<List<String>> normalized = new ArrayList<>();
        for (List<String> row : formulas) {
            List<String> normalizedRow = new ArrayList<>();
            if (row != null) {
                for (String formula : row) {
                    normalizedRow.add(normalizeFormulaForSnapshot(formula));
                }
            }
            normalized.add(normalizedRow);
        }
        return normalized;
    }

    private Map<String, String> normalizeFormulaMap(Map<String, String> formulas) {
        Map<String, String> normalized = new LinkedHashMap<>();
        if (formulas == null) {
            return normalized;
        }
        formulas.forEach((key, formula) -> normalized.put(key, normalizeFormulaForSnapshot(formula)));
        return normalized;
    }

    private Map<String, List<List<String>>> normalizeFormulaMatrixMap(Map<String, List<List<String>>> formulas) {
        Map<String, List<List<String>>> normalized = new LinkedHashMap<>();
        if (formulas == null) {
            return normalized;
        }
        formulas.forEach((key, matrix) -> normalized.put(key, normalizeFormulaMatrix(matrix)));
        return normalized;
    }

    private String stripExcelCompatibilityPrefixes(String formula) {
        if (!StringUtils.hasText(formula)) {
            return "";
        }
        StringBuilder result = new StringBuilder();
        int cursor = 0;
        int literalStart = -1;
        for (int index = 0; index < formula.length(); index += 1) {
            if (formula.charAt(index) != '"') {
                continue;
            }
            if (literalStart >= 0 && index + 1 < formula.length() && formula.charAt(index + 1) == '"') {
                index += 1;
                continue;
            }
            if (literalStart < 0) {
                result.append(replaceExcelCompatibilityPrefixes(formula.substring(cursor, index)));
                literalStart = index;
            } else {
                result.append(formula, literalStart, index + 1);
                cursor = index + 1;
                literalStart = -1;
            }
        }
        if (literalStart >= 0) {
            result.append(formula.substring(literalStart));
        } else if (cursor < formula.length()) {
            result.append(replaceExcelCompatibilityPrefixes(formula.substring(cursor)));
        }
        return result.toString();
    }

    private String replaceExcelCompatibilityPrefixes(String formula) {
        return formula
                .replaceAll("(?i)_xlfn\\.", "")
                .replaceAll("(?i)_xlpm\\.", "");
    }

    private Path resolveLocalPath(String fileUrl) {
        String prefix = fileStorageConfig.getLocal().getUrlPrefix();
        if (!StringUtils.hasText(prefix) || !fileUrl.startsWith(prefix + "/")) {
            throw new IllegalArgumentException("当前仅支持解析本地上传模板文件");
        }
        String fileName = fileUrl.substring(prefix.length() + 1);
        return Paths.get(fileStorageConfig.getLocal().getPath()).resolve(fileName);
    }

    private int resolveColumnCount(Sheet sheet) {
        int max = 0;
        for (Row row : sheet) {
            if (row != null) {
                max = Math.max(max, row.getLastCellNum());
            }
        }
        return max;
    }

    private Object readPlainCellValue(Cell cell) {
        return switch (cell.getCellType()) {
            case STRING -> cell.getStringCellValue();
            case BOOLEAN -> cell.getBooleanCellValue();
            case NUMERIC -> normalizeNumber(cell.getNumericCellValue());
            case BLANK -> "";
            default -> cell.toString();
        };
    }

    private Object readEvaluatedCellValue(Cell cell, FormulaEvaluator evaluator) {
        try {
            return switch (evaluator.evaluateFormulaCell(cell)) {
                case STRING -> cell.getRichStringCellValue().getString();
                case BOOLEAN -> cell.getBooleanCellValue();
                case NUMERIC -> normalizeNumber(cell.getNumericCellValue());
                case BLANK -> "";
                default -> cell.toString();
            };
        } catch (FormulaParseException | NotImplementedException | IllegalArgumentException exception) {
            log.trace("Formula evaluation failed, falling back to cached value at {}", cell.getAddress(), exception);
            return readCachedFormulaCellValue(cell);
        }
    }

    private Object readCachedFormulaCellValue(Cell cell) {
        try {
            return switch (cell.getCachedFormulaResultType()) {
                case STRING -> cell.getRichStringCellValue().getString();
                case BOOLEAN -> cell.getBooleanCellValue();
                case NUMERIC -> normalizeNumber(cell.getNumericCellValue());
                case BLANK -> "";
                default -> cell.toString();
            };
        } catch (Exception exception) {
            log.trace("Cached formula value read failed at {}", cell.getAddress(), exception);
            return cell.toString();
        }
    }

    private Object normalizeNumber(double value) {
        BigDecimal decimal = BigDecimal.valueOf(value).stripTrailingZeros();
        if (decimal.scale() <= 0) {
            try {
                return decimal.longValueExact();
            } catch (ArithmeticException exception) {
                return decimal.doubleValue();
            }
        }
        return decimal.doubleValue();
    }

    private ExcelWorkbookSnapshot.SheetSnapshot findSheet(ExcelWorkbookSnapshot workbookSnapshot, String sheetName) {
        if (workbookSnapshot == null || workbookSnapshot.getSheets() == null) {
            return null;
        }
        return workbookSnapshot.getSheets().stream()
                .filter(sheet -> Objects.equals(sheet.getName(), sheetName))
                .findFirst()
                .orElse(null);
    }

    private Object getCellValue(ExcelWorkbookSnapshot workbookSnapshot, String sheetName, String cellRef) {
        ExcelWorkbookSnapshot.SheetSnapshot sheet = findSheet(workbookSnapshot, sheetName);
        if (sheet == null || sheet.getCells() == null) {
            return null;
        }
        ExcelWorkbookSnapshot.CellSnapshot cell = sheet.getCells().get(cellRef);
        return cell == null ? null : cell.getValue();
    }

    private List<List<Object>> getRangeValues(ExcelWorkbookSnapshot workbookSnapshot, String sheetName, String rangeRef) {
        RangeRef range = parseRange(rangeRef);
        if (range == null) {
            return List.of();
        }
        List<List<Object>> values = new ArrayList<>();
        for (int row = range.startRow; row <= range.endRow; row += 1) {
            List<Object> rowValues = new ArrayList<>();
            for (int col = range.startCol; col <= range.endCol; col += 1) {
                rowValues.add(getCellValue(workbookSnapshot, sheetName, toCellRef(row, col)));
            }
            values.add(rowValues);
        }
        return values;
    }

    private List<List<String>> getRangeFormulas(ExcelWorkbookSnapshot workbookSnapshot, String sheetName, String rangeRef) {
        RangeRef range = parseRange(rangeRef);
        if (range == null) {
            return List.of();
        }
        List<List<String>> formulas = new ArrayList<>();
        ExcelWorkbookSnapshot.SheetSnapshot sheet = findSheet(workbookSnapshot, sheetName);
        for (int row = range.startRow; row <= range.endRow; row += 1) {
            List<String> rowFormulas = new ArrayList<>();
            for (int col = range.startCol; col <= range.endCol; col += 1) {
                String cellRef = toCellRef(row, col);
                String formula = "";
                if (sheet != null && sheet.getCells() != null) {
                    ExcelWorkbookSnapshot.CellSnapshot cell = sheet.getCells().get(cellRef);
                    if (cell != null && StringUtils.hasText(cell.getFormula())) {
                        formula = normalizeFormulaForSnapshot(cell.getFormula());
                    }
                }
                rowFormulas.add(formula);
            }
            formulas.add(rowFormulas);
        }
        return formulas;
    }

    private String getCellFormula(ExcelWorkbookSnapshot workbookSnapshot, String sheetName, String cellRef) {
        ExcelWorkbookSnapshot.SheetSnapshot sheet = findSheet(workbookSnapshot, sheetName);
        if (sheet == null || sheet.getCells() == null) {
            return "";
        }
        ExcelWorkbookSnapshot.CellSnapshot cell = sheet.getCells().get(normalizeCellRef(cellRef));
        return cell == null || !StringUtils.hasText(cell.getFormula()) ? "" : normalizeFormulaForSnapshot(cell.getFormula());
    }

    private List<String> getHeaderValues(ExcelWorkbookSnapshot workbookSnapshot, String sheetName, String rangeRef) {
        return getRangeValues(workbookSnapshot, sheetName, rangeRef).stream()
                .findFirst()
                .orElse(List.of())
                .stream()
                .map(this::stringifyValue)
                .toList();
    }

    private void ensureMatrixSize(List<List<Object>> values, int expectedRows, int expectedCols, String label) {
        if (values.size() != expectedRows) {
            throw new IllegalArgumentException(label + "行数与答题区域不匹配");
        }
        for (List<Object> row : values) {
            if (row.size() != expectedCols) {
                throw new IllegalArgumentException(label + "列数与答题区域不匹配");
            }
        }
    }

    private void ensureFormulaMatrixSize(List<List<String>> values, int expectedRows, int expectedCols, String label) {
        if (values.size() != expectedRows) {
            throw new IllegalArgumentException(label + "行数与答题区域不匹配");
        }
        for (List<String> row : values) {
            if (row.size() != expectedCols) {
                throw new IllegalArgumentException(label + "列数与答题区域不匹配");
            }
        }
    }

    private void ensureNoBlankAnswerValues(List<List<Object>> values) {
        for (List<Object> row : values) {
            for (Object value : row) {
                if (!StringUtils.hasText(normalizeText(value))) {
                    throw new IllegalArgumentException("标准答案存在空白单元格，请补全答题区域内的值");
                }
            }
        }
    }

    private boolean compareMatrix(List<List<Object>> expected, List<List<Object>> actual) {
        if (expected.size() != actual.size()) {
            return false;
        }
        for (int row = 0; row < expected.size(); row += 1) {
            List<Object> expectedRow = expected.get(row);
            List<Object> actualRow = actual.get(row);
            if (expectedRow.size() != actualRow.size()) {
                return false;
            }
            for (int col = 0; col < expectedRow.size(); col += 1) {
                if (!compareValue(expectedRow.get(col), actualRow.get(col))) {
                    return false;
                }
            }
        }
        return true;
    }

    private boolean compareHeader(List<String> expected, List<String> actual) {
        if (expected.size() != actual.size()) {
            return false;
        }
        for (int index = 0; index < expected.size(); index += 1) {
            if (!normalizeText(expected.get(index)).equals(normalizeText(actual.get(index)))) {
                return false;
            }
        }
        return true;
    }

    private boolean compareFormulaMatrix(List<List<String>> expected, List<List<String>> actual) {
        if (expected.size() != actual.size()) {
            return false;
        }
        for (int row = 0; row < expected.size(); row += 1) {
            List<String> expectedRow = expected.get(row);
            List<String> actualRow = actual.get(row);
            if (expectedRow.size() != actualRow.size()) {
                return false;
            }
            for (int col = 0; col < expectedRow.size(); col += 1) {
                if (hasFormula(expectedRow.get(col)) != hasFormula(actualRow.get(col))) {
                    return false;
                }
            }
        }
        return true;
    }

    private boolean containsFormulaKeywords(String formula, List<String> keywords) {
        String normalizedFormula = normalizeFormula(formula);
        if (!StringUtils.hasText(normalizedFormula)) {
            return false;
        }
        for (String keyword : keywords) {
            String normalizedKeyword = normalizeFormula(keyword);
            if (!StringUtils.hasText(normalizedKeyword)) {
                continue;
            }
            if (!normalizedFormula.contains(normalizedKeyword)) {
                return false;
            }
        }
        return true;
    }

    private boolean hasNoExtraFormulas(List<List<String>> formulas, String sheetName, String anchorCell, String spillRange) {
        RangeRef range = parseRange(spillRange);
        CellRef anchor = parseCell(anchorCell);
        if (range == null || anchor == null) {
            return true;
        }
        for (int row = 0; row < formulas.size(); row += 1) {
            List<String> formulaRow = formulas.get(row);
            for (int col = 0; col < formulaRow.size(); col += 1) {
                int currentRow = range.startRow + row;
                int currentCol = range.startCol + col;
                if (currentRow == anchor.row() && currentCol == anchor.col()) {
                    continue;
                }
                if (hasFormula(formulaRow.get(col))) {
                    return false;
                }
            }
        }
        return true;
    }

    private boolean compareValue(Object expected, Object actual) {
        if (expected == null || "".equals(expected)) {
            return actual == null || normalizeText(actual).isEmpty();
        }
        if (actual == null || "".equals(actual)) {
            return normalizeText(expected).isEmpty();
        }
        if (expected instanceof Number || actual instanceof Number) {
            Double expectedNumber = toDouble(expected);
            Double actualNumber = toDouble(actual);
            if (expectedNumber != null && actualNumber != null) {
                return Math.abs(expectedNumber - actualNumber) <= EPSILON;
            }
        }
        return normalizeText(expected).equals(normalizeText(actual));
    }

    private Double toDouble(Object value) {
        if (value instanceof Number number) {
            return number.doubleValue();
        }
        try {
            return Double.parseDouble(String.valueOf(value).trim());
        } catch (NumberFormatException exception) {
            return null;
        }
    }

    private String normalizeText(Object value) {
        return value == null ? "" : String.valueOf(value).trim();
    }

    private String stringifyValue(Object value) {
        return value == null ? "" : String.valueOf(value).trim();
    }

    private boolean hasSimpleAnswerRule(ExcelTemplateRuleConfig config) {
        return config != null
                && !hasDynamicArrayRules(config)
                && StringUtils.hasText(config.getAnswerSheet())
                && StringUtils.hasText(config.getAnswerRange());
    }

    private boolean hasDynamicArrayRules(ExcelTemplateRuleConfig config) {
        return config != null && config.getDynamicArrayRules() != null && !config.getDynamicArrayRules().isEmpty();
    }

    private int safeScore(Integer score) {
        return score == null || score < 0 ? 0 : score;
    }

    private String defaultLabel(String label, String sheet, String target) {
        if (StringUtils.hasText(label)) {
            return label.trim();
        }
        return buildKey(sheet, target);
    }

    private Map<String, Object> buildRuleResult(String type, String label, String target, boolean passed, Object expected, Object actual, int score) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("type", type);
        result.put("label", label);
        result.put("target", target);
        result.put("passed", passed);
        result.put("expected", expected);
        result.put("actual", actual);
        result.put("score", passed ? score : 0);
        result.put("maxScore", score);
        result.put("message", passed ? "校验通过" : "实际结果与预期不一致");
        return result;
    }

    private String writeJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("JSON 序列化失败", e);
        }
    }

    private Object firstNonNull(Object first, Object second) {
        return first != null ? first : second;
    }

    private String buildKey(String sheet, String target) {
        return defaultText(sheet) + "!" + defaultText(target);
    }

    private String defaultText(String value) {
        return value == null ? "" : value.trim();
    }

    private String normalizeCellRef(String ref) {
        return ref == null ? "" : ref.trim().toUpperCase(Locale.ROOT);
    }

    private String normalizeFormula(String formula) {
        if (!StringUtils.hasText(formula)) {
            return "";
        }
        String normalized = normalizeFormulaForSnapshot(formula);
        return normalized.replace(" ", "").toUpperCase(Locale.ROOT);
    }

    private ExcelTemplateRuleConfig.DynamicArrayRule normalizeDynamicArrayRule(
            ExcelWorkbookSnapshot workbookSnapshot,
            ExcelTemplateRuleConfig.DynamicArrayRule sourceRule,
            int index,
            String fallbackSheet
    ) {
        ExcelTemplateRuleConfig.DynamicArrayRule target = new ExcelTemplateRuleConfig.DynamicArrayRule();
        String sheetName = StringUtils.hasText(sourceRule.getSheet()) ? sourceRule.getSheet().trim() : defaultText(fallbackSheet);
        String anchorCell = normalizeCellRef(sourceRule.getAnchorCell());
        String spillRange = defaultText(sourceRule.getSpillRange()).toUpperCase(Locale.ROOT);

        if (!StringUtils.hasText(sheetName)) {
            throw new IllegalArgumentException("动态数组规则 #" + (index + 1) + " 未选择工作表");
        }
        if (findSheet(workbookSnapshot, sheetName) == null) {
            throw new IllegalArgumentException("动态数组规则 #" + (index + 1) + " 的工作表不存在");
        }
        CellRef anchor = parseCell(anchorCell);
        RangeRef spill = parseRange(spillRange);
        if (anchor == null) {
            throw new IllegalArgumentException("动态数组规则 #" + (index + 1) + " 的锚点单元格格式不正确");
        }
        if (spill == null) {
            throw new IllegalArgumentException("动态数组规则 #" + (index + 1) + " 的溢出区域格式不正确");
        }
        if (anchor.row() < spill.startRow || anchor.row() > spill.endRow || anchor.col() < spill.startCol || anchor.col() > spill.endCol) {
            throw new IllegalArgumentException("动态数组规则 #" + (index + 1) + " 的锚点单元格必须位于溢出区域内");
        }

        List<String> formulaKeywords = sourceRule.getFormulaKeywords() == null
                ? new ArrayList<>()
                : sourceRule.getFormulaKeywords().stream()
                .map(this::defaultText)
                .filter(StringUtils::hasText)
                .distinct()
                .toList();

        target.setSheet(sheetName);
        target.setAnchorCell(anchorCell);
        target.setSpillRange(spillRange);
        target.setScore(safeScore(sourceRule.getScore()) > 0 ? sourceRule.getScore() : 1);
        target.setLabel(defaultText(sourceRule.getLabel()));
        target.setRequireAnchorFormula(!Boolean.FALSE.equals(sourceRule.getRequireAnchorFormula()));
        target.setRequireSpillCellsWithoutFormula(!Boolean.FALSE.equals(sourceRule.getRequireSpillCellsWithoutFormula()));
        target.setFormulaKeywords(new ArrayList<>(formulaKeywords));
        return target;
    }

    private boolean hasFormula(String formula) {
        return !normalizeFormula(formula).isEmpty();
    }

    private RangeRef requireRange(String rangeRef) {
        RangeRef range = parseRange(rangeRef);
        if (range == null) {
            throw new IllegalArgumentException("答题区域格式不正确");
        }
        return range;
    }

    private RangeRef parseRange(String rangeRef) {
        if (!StringUtils.hasText(rangeRef)) {
            return null;
        }
        String[] parts = rangeRef.trim().toUpperCase(Locale.ROOT).split(":");
        CellRef start = parseCell(parts[0]);
        CellRef end = parseCell(parts.length > 1 ? parts[1] : parts[0]);
        if (start == null || end == null) {
            return null;
        }
        return new RangeRef(
                Math.min(start.row(), end.row()),
                Math.min(start.col(), end.col()),
                Math.max(start.row(), end.row()),
                Math.max(start.col(), end.col())
        );
    }

    private CellRef parseCell(String ref) {
        if (!StringUtils.hasText(ref)) {
            return null;
        }
        String normalized = ref.trim().toUpperCase(Locale.ROOT).replace("$", "");
        int split = 0;
        while (split < normalized.length() && Character.isLetter(normalized.charAt(split))) {
            split += 1;
        }
        if (split == 0 || split >= normalized.length()) {
            return null;
        }
        String colPart = normalized.substring(0, split);
        String rowPart = normalized.substring(split);
        int col = 0;
        for (char ch : colPart.toCharArray()) {
            col = col * 26 + (ch - 'A' + 1);
        }
        try {
            int row = Integer.parseInt(rowPart);
            return new CellRef(row, col);
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private String toCellRef(int row, int col) {
        StringBuilder column = new StringBuilder();
        int current = col;
        while (current > 0) {
            int remainder = (current - 1) % 26;
            column.insert(0, (char) ('A' + remainder));
            current = (current - 1) / 26;
        }
        return column + String.valueOf(row);
    }

    private record CellRef(int row, int col) {}

    private record RangeRef(int startRow, int startCol, int endRow, int endCol) {
        private int width() {
            return endCol - startCol + 1;
        }

        private int height() {
            return endRow - startRow + 1;
        }
    }
}
