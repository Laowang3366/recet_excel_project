package com.excel.forum.controller;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.excel.forum.entity.Question;
import com.excel.forum.entity.QuestionCategory;
import com.excel.forum.entity.QuestionExcelTemplate;
import com.excel.forum.entity.dto.AdminQuestionRequest;
import com.excel.forum.entity.dto.ExcelTemplateEvaluation;
import com.excel.forum.entity.dto.ExcelTemplateExpectedSnapshot;
import com.excel.forum.entity.dto.ExcelWorkbookSnapshot;
import com.excel.forum.service.ExcelTemplateGradingService;
import com.excel.forum.service.FileRecycleService;
import com.excel.forum.service.PracticeCampaignService;
import com.excel.forum.service.QuestionCategoryService;
import com.excel.forum.service.QuestionExcelTemplateService;
import com.excel.forum.service.QuestionService;
import com.excel.forum.util.QuestionDifficultyCatalog;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

@RestController
@RequestMapping("/api/admin/questions")
@RequiredArgsConstructor
public class AdminQuestionController {
    private final QuestionService questionService;
    private final QuestionCategoryService questionCategoryService;
    private final QuestionExcelTemplateService questionExcelTemplateService;
    private final ExcelTemplateGradingService excelTemplateGradingService;
    private final PracticeCampaignService practiceCampaignService;
    private final FileRecycleService fileRecycleService;

    @GetMapping
    public ResponseEntity<?> getQuestions(
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "10") Integer size,
            @RequestParam(required = false) String type,
            @RequestParam(required = false) Long questionCategoryId,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) Boolean enabled,
            @RequestParam(required = false) Integer difficulty) {
        String effectiveType = StringUtils.hasText(type) ? type : "excel_template";
        Map<String, Object> response = new HashMap<>(questionService.getQuestionsPage(
                page,
                size,
                effectiveType,
                questionCategoryId,
                keyword,
                enabled,
                difficulty
        ));
        @SuppressWarnings("unchecked")
        List<Question> records = (List<Question>) response.getOrDefault("questions", List.of());
        Map<Long, QuestionExcelTemplate> templateMap = questionExcelTemplateService.mapByQuestionIds(
                records.stream()
                        .filter(item -> "excel_template".equals(item.getType()))
                        .map(Question::getId)
                        .toList()
        );
        response.put("questions", records.stream().map(question -> buildAdminQuestionResponse(question, templateMap.get(question.getId()))).toList());
        return ResponseEntity.ok(response);
    }

    @GetMapping("/template-snapshot")
    public ResponseEntity<?> getQuestionTemplateSnapshot(@RequestParam String fileUrl) {
        if (!StringUtils.hasText(fileUrl)) {
            return ResponseEntity.badRequest().body(Map.of("message", "模板文件不能为空"));
        }
        return ResponseEntity.ok(excelTemplateGradingService.loadWorkbookSnapshot(fileUrl));
    }

    @GetMapping("/template-snapshot-checks")
    public ResponseEntity<?> getTemplateSnapshotChecks() {
        List<Map<String, Object>> records = buildTemplateAuditRecords();
        long passed = records.stream().filter(item -> "passed".equals(item.get("status"))).count();
        long warning = records.stream().filter(item -> "warning".equals(item.get("status"))).count();
        long failed = records.stream().filter(item -> "failed".equals(item.get("status"))).count();
        return ResponseEntity.ok(Map.of(
                "records", records,
                "total", records.size(),
                "passed", passed,
                "warning", warning,
                "failed", failed
        ));
    }

    @GetMapping("/exceptions")
    public ResponseEntity<?> getQuestionExceptions() {
        List<Map<String, Object>> exceptionRecords = new ArrayList<>();
        for (Map<String, Object> auditRecord : buildTemplateAuditRecords()) {
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> findings = (List<Map<String, Object>>) auditRecord.getOrDefault("findings", List.of());
            for (Map<String, Object> finding : findings) {
                Map<String, Object> record = new LinkedHashMap<>();
                record.put("questionId", auditRecord.get("questionId"));
                record.put("title", auditRecord.get("title"));
                record.put("answerSheet", auditRecord.get("answerSheet"));
                record.put("answerRange", auditRecord.get("answerRange"));
                record.put("severity", finding.get("severity"));
                record.put("code", finding.get("code"));
                record.put("message", finding.get("message"));
                exceptionRecords.add(record);
            }
        }
        long critical = exceptionRecords.stream().filter(item -> "critical".equals(item.get("severity"))).count();
        long warning = exceptionRecords.stream().filter(item -> "warning".equals(item.get("severity"))).count();
        return ResponseEntity.ok(Map.of(
                "records", exceptionRecords,
                "total", exceptionRecords.size(),
                "critical", critical,
                "warning", warning
        ));
    }

    @PostMapping("/batch-import")
    public ResponseEntity<?> batchImportQuestions(@RequestBody Map<String, List<AdminQuestionRequest>> request) {
        List<AdminQuestionRequest> records = request == null ? List.of() : Objects.requireNonNullElse(request.get("records"), List.of());
        if (records.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("message", "导入题目不能为空"));
        }

        List<Map<String, Object>> createdRecords = new ArrayList<>();
        List<Map<String, Object>> errors = new ArrayList<>();
        for (int index = 0; index < records.size(); index++) {
            AdminQuestionRequest item = records.get(index);
            ResponseEntity<?> rowError = validateBatchImportRecord(item);
            if (rowError != null) {
                errors.add(buildBatchImportError(index, rowError));
                continue;
            }

            try {
                item.setType("excel_template");
                Question question = buildQuestionEntity(item, new Question());
                questionService.save(question);
                QuestionExcelTemplate template = buildQuestionExcelTemplate(question.getId(), item, new QuestionExcelTemplate());
                questionExcelTemplateService.save(template);
                createdRecords.add(buildAdminQuestionResponse(question, template));
            } catch (RuntimeException e) {
                errors.add(buildBatchImportError(index, e.getMessage()));
            }
        }
        if (!createdRecords.isEmpty()) {
            practiceCampaignService.syncCampaignCatalog();
        }

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("total", records.size());
        response.put("created", createdRecords.size());
        response.put("failed", errors.size());
        response.put("records", createdRecords);
        response.put("errors", errors);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/publish-tests")
    public ResponseEntity<?> runPublishTests(@RequestBody(required = false) Map<String, List<Long>> request) {
        List<Question> questions = resolvePublishTestQuestions(request == null ? List.of() : request.getOrDefault("questionIds", List.of()));
        long startedAt = System.nanoTime();
        List<Map<String, Object>> records = questions.stream().map(this::buildPublishTestRecord).toList();
        long durationMs = (System.nanoTime() - startedAt) / 1_000_000;
        long passed = records.stream().filter(item -> Boolean.TRUE.equals(item.get("passed"))).count();
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("records", records);
        response.put("total", records.size());
        response.put("passed", passed);
        response.put("failed", records.size() - passed);
        response.put("durationMs", durationMs);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/{id}/publish-test")
    public ResponseEntity<?> runPublishTest(@PathVariable Long id) {
        Question question = questionService.getById(id);
        if (question == null || question.getDeletedAt() != null || !"excel_template".equals(question.getType())) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(buildPublishTestRecord(question));
    }

    @PostMapping
    public ResponseEntity<?> createQuestion(@RequestBody AdminQuestionRequest request) {
        if (request.getTitle() == null || request.getTitle().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("message", "题目内容不能为空"));
        }

        request.setType("excel_template");
        ResponseEntity<?> validationError = validateExcelTemplateRequest(request);
        if (validationError != null) {
            return validationError;
        }

        Question question = buildQuestionEntity(request, new Question());
        questionService.save(question);
        QuestionExcelTemplate template = buildQuestionExcelTemplate(question.getId(), request, new QuestionExcelTemplate());
        questionExcelTemplateService.save(template);
        practiceCampaignService.syncCampaignCatalog();
        return ResponseEntity.ok(buildAdminQuestionResponse(question, template));
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> updateQuestion(@PathVariable Long id, @RequestBody AdminQuestionRequest request) {
        Question existing = questionService.getById(id);
        if (existing == null || existing.getDeletedAt() != null) {
            return ResponseEntity.notFound().build();
        }
        QuestionExcelTemplate existingTemplate = questionExcelTemplateService.getByQuestionId(id);
        request.setType("excel_template");
        if (!StringUtils.hasText(request.getTemplateFileUrl()) && existingTemplate != null) {
            request.setTemplateFileUrl(existingTemplate.getTemplateFileUrl());
        }
        if (request.getIdealAnswerImageUrl() == null && existingTemplate != null) {
            request.setIdealAnswerImageUrl(existingTemplate.getIdealAnswerImageUrl());
        }
        if (!StringUtils.hasText(request.getAnswerSheet()) && existingTemplate != null) {
            request.setAnswerSheet(existingTemplate.getAnswerSheet());
        }
        if (!StringUtils.hasText(request.getAnswerRange()) && existingTemplate != null) {
            request.setAnswerRange(existingTemplate.getAnswerRange());
        }
        if (!StringUtils.hasText(request.getAnswerSnapshotJson()) && existingTemplate != null) {
            request.setAnswerSnapshotJson(existingTemplate.getAnswerSnapshotJson());
        }
        if (request.getCheckFormula() == null && existingTemplate != null) {
            request.setCheckFormula(existingTemplate.getCheckFormula());
        }
        if (request.getSheetCountLimit() == null && existingTemplate != null) {
            request.setSheetCountLimit(existingTemplate.getSheetCountLimit());
        }
        if (request.getVersion() == null && existingTemplate != null) {
            request.setVersion(existingTemplate.getVersion());
        }
        ResponseEntity<?> validationError = validateExcelTemplateRequest(request);
        if (validationError != null) {
            return validationError;
        }

        Question updatedQuestion = buildQuestionEntity(request, existing);
        updatedQuestion.setId(id);
        questionService.updateById(updatedQuestion);

        QuestionExcelTemplate template = buildQuestionExcelTemplate(
                id,
                request,
                Objects.requireNonNullElseGet(existingTemplate, QuestionExcelTemplate::new)
        );
        questionExcelTemplateService.saveOrUpdate(template);
        practiceCampaignService.syncCampaignCatalog();
        return ResponseEntity.ok(buildAdminQuestionResponse(updatedQuestion, template));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteQuestion(
            @RequestAttribute(value = "userId", required = false) Long adminUserId,
            @PathVariable Long id) {
        Question question = questionService.getById(id);
        if (question == null || question.getDeletedAt() != null) {
            return ResponseEntity.notFound().build();
        }
        QuestionExcelTemplate template = questionExcelTemplateService.getByQuestionId(id);
        fileRecycleService.recycleQuestion(question, template, adminUserId);
        practiceCampaignService.syncCampaignCatalog();
        return ResponseEntity.ok(Map.of("message", "题目已移入回收站"));
    }

    private ResponseEntity<?> validateBatchImportRecord(AdminQuestionRequest request) {
        if (request == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "题目数据不能为空"));
        }
        if (!StringUtils.hasText(request.getTitle())) {
            return ResponseEntity.badRequest().body(Map.of("message", "题目内容不能为空"));
        }
        request.setType("excel_template");
        return validateExcelTemplateRequest(request);
    }

    private Map<String, Object> buildBatchImportError(int index, ResponseEntity<?> validationError) {
        return buildBatchImportError(index, extractResponseMessage(validationError));
    }

    private Map<String, Object> buildBatchImportError(int index, String message) {
        Map<String, Object> error = new LinkedHashMap<>();
        error.put("index", index);
        error.put("message", StringUtils.hasText(message) ? message : "导入失败");
        return error;
    }

    private String extractResponseMessage(ResponseEntity<?> response) {
        Object body = response.getBody();
        if (body instanceof Map<?, ?> map && map.get("message") != null) {
            return String.valueOf(map.get("message"));
        }
        return "导入失败";
    }

    private List<Map<String, Object>> buildTemplateAuditRecords() {
        List<Question> questions = listQuestionBankQuestions();
        List<Long> questionIds = questions.stream().map(Question::getId).filter(Objects::nonNull).toList();
        Map<Long, QuestionExcelTemplate> templateMap = questionIds.isEmpty()
                ? Map.of()
                : questionExcelTemplateService.mapByQuestionIds(questionIds);
        return questions.stream()
                .map(question -> buildTemplateAuditRecord(question, templateMap.get(question.getId())))
                .toList();
    }

    private List<Question> listQuestionBankQuestions() {
        QueryWrapper<Question> wrapper = new QueryWrapper<>();
        wrapper.eq("type", "excel_template")
                .isNull("deleted_at")
                .orderByDesc("create_time");
        return questionService.list(wrapper);
    }

    private Map<String, Object> buildTemplateAuditRecord(Question question, QuestionExcelTemplate template) {
        List<Map<String, Object>> findings = new ArrayList<>();
        Map<String, Object> ruleSummary = Map.of();

        if (!Boolean.TRUE.equals(question.getEnabled())) {
            addAuditFinding(findings, "disabled_question", "warning", "题目未启用，发布前不会对学员可见");
        }
        if (template == null) {
            addAuditFinding(findings, "missing_template", "critical", "缺少 Excel 模板配置");
        } else {
            if (!StringUtils.hasText(template.getTemplateFileUrl())) {
                addAuditFinding(findings, "missing_template_file", "critical", "模板文件不能为空");
            } else {
                try {
                    excelTemplateGradingService.loadWorkbookSnapshot(template.getTemplateFileUrl());
                } catch (RuntimeException e) {
                    addAuditFinding(findings, "template_file_unreadable", "critical", safeMessage(e, "模板文件无法读取"));
                }
            }
            if (!StringUtils.hasText(template.getAnswerSheet())) {
                addAuditFinding(findings, "missing_answer_sheet", "critical", "答题工作表不能为空");
            }
            if (!StringUtils.hasText(template.getAnswerRange())) {
                addAuditFinding(findings, "missing_answer_range", "critical", "答题区域不能为空");
            }
            if (!StringUtils.hasText(template.getExpectedSnapshotJson())) {
                addAuditFinding(findings, "missing_expected_snapshot", "critical", "缺少标准答案快照");
            } else {
                try {
                    excelTemplateGradingService.parseExpectedSnapshot(template.getExpectedSnapshotJson());
                } catch (RuntimeException e) {
                    addAuditFinding(findings, "invalid_expected_snapshot", "critical", safeMessage(e, "标准答案快照无法解析"));
                }
            }
            if (!StringUtils.hasText(template.getGradingRuleJson())) {
                addAuditFinding(findings, "missing_grading_rule", "critical", "缺少判题规则");
            } else {
                try {
                    ruleSummary = excelTemplateGradingService.buildRuleSummary(template.getGradingRuleJson());
                    Object totalScore = ruleSummary.get("totalScore");
                    if (totalScore instanceof Number number && number.intValue() <= 0) {
                        addAuditFinding(findings, "empty_scored_rule", "warning", "判题规则没有可计分项");
                    }
                } catch (RuntimeException e) {
                    addAuditFinding(findings, "invalid_grading_rule", "critical", safeMessage(e, "判题规则无法解析"));
                }
            }
        }

        Map<String, Object> record = new LinkedHashMap<>();
        record.put("questionId", question.getId());
        record.put("title", question.getTitle());
        record.put("enabled", question.getEnabled());
        record.put("templateFileUrl", template == null ? null : template.getTemplateFileUrl());
        record.put("answerSheet", template == null ? null : template.getAnswerSheet());
        record.put("answerRange", template == null ? null : template.getAnswerRange());
        record.put("status", resolveAuditStatus(findings));
        record.put("code", findings.isEmpty() ? null : findings.get(0).get("code"));
        record.put("messages", findings.stream().map(item -> item.get("message")).toList());
        record.put("findings", findings);
        record.put("ruleSummary", ruleSummary);
        return record;
    }

    private void addAuditFinding(List<Map<String, Object>> findings, String code, String severity, String message) {
        Map<String, Object> finding = new LinkedHashMap<>();
        finding.put("code", code);
        finding.put("severity", severity);
        finding.put("message", message);
        findings.add(finding);
    }

    private String resolveAuditStatus(List<Map<String, Object>> findings) {
        boolean hasCritical = findings.stream().anyMatch(item -> "critical".equals(item.get("severity")));
        if (hasCritical) {
            return "failed";
        }
        return findings.isEmpty() ? "passed" : "warning";
    }

    private String safeMessage(RuntimeException e, String fallback) {
        return StringUtils.hasText(e.getMessage()) ? e.getMessage() : fallback;
    }

    private List<Question> resolvePublishTestQuestions(List<Long> requestedQuestionIds) {
        QueryWrapper<Question> wrapper = new QueryWrapper<>();
        wrapper.eq("type", "excel_template")
                .isNull("deleted_at");
        if (requestedQuestionIds == null || requestedQuestionIds.isEmpty()) {
            wrapper.eq("enabled", true);
        } else {
            wrapper.in("id", requestedQuestionIds);
        }
        wrapper.orderByDesc("create_time");
        return questionService.list(wrapper);
    }

    private Map<String, Object> buildPublishTestRecord(Question question) {
        long startedAt = System.nanoTime();
        Map<String, Object> record = new LinkedHashMap<>();
        record.put("questionId", question.getId());
        record.put("title", question.getTitle());
        QuestionExcelTemplate template = questionExcelTemplateService.getByQuestionId(question.getId());
        if (template == null) {
            return buildFailedPublishTestRecord(record, startedAt, "缺少 Excel 模板配置");
        }
        if (!StringUtils.hasText(template.getExpectedSnapshotJson())) {
            return buildFailedPublishTestRecord(record, startedAt, "缺少标准答案快照");
        }
        if (!StringUtils.hasText(template.getGradingRuleJson())) {
            return buildFailedPublishTestRecord(record, startedAt, "缺少判题规则");
        }

        try {
            ExcelTemplateExpectedSnapshot expectedSnapshot = excelTemplateGradingService.parseExpectedSnapshot(template.getExpectedSnapshotJson());
            ExcelWorkbookSnapshot syntheticSubmission = buildWorkbookSnapshotFromExpectedSnapshot(expectedSnapshot);
            ExcelTemplateEvaluation evaluation = excelTemplateGradingService.grade(
                    syntheticSubmission,
                    template.getGradingRuleJson(),
                    template.getExpectedSnapshotJson()
            );
            record.put("passed", evaluation.isPassed());
            record.put("score", evaluation.getScore());
            record.put("totalScore", evaluation.getTotalScore());
            record.put("feedback", evaluation.getFeedback());
            record.put("ruleResults", evaluation.getRuleResults());
            record.put("durationMs", (System.nanoTime() - startedAt) / 1_000_000);
            return record;
        } catch (RuntimeException e) {
            return buildFailedPublishTestRecord(record, startedAt, safeMessage(e, "发布前测试执行失败"));
        }
    }

    private Map<String, Object> buildFailedPublishTestRecord(Map<String, Object> record, long startedAt, String feedback) {
        record.put("passed", false);
        record.put("score", 0);
        record.put("totalScore", 0);
        record.put("feedback", feedback);
        record.put("ruleResults", List.of());
        record.put("durationMs", (System.nanoTime() - startedAt) / 1_000_000);
        return record;
    }

    private ExcelWorkbookSnapshot buildWorkbookSnapshotFromExpectedSnapshot(ExcelTemplateExpectedSnapshot expectedSnapshot) {
        Map<String, ExcelWorkbookSnapshot.SheetSnapshot> sheets = new LinkedHashMap<>();
        Set<String> requiredSheets = new LinkedHashSet<>(Objects.requireNonNullElse(expectedSnapshot.getRequiredSheets(), List.of()));
        requiredSheets.forEach(sheetName -> getOrCreateSheet(sheets, sheetName));
        Objects.requireNonNullElse(expectedSnapshot.getCellValues(), Map.<String, Object>of())
                .forEach((key, value) -> putExpectedCell(sheets, key, value, null, requiredSheets));
        Objects.requireNonNullElse(expectedSnapshot.getCellFormulas(), Map.<String, String>of())
                .forEach((key, formula) -> putExpectedCell(sheets, key, null, formula, requiredSheets));
        Objects.requireNonNullElse(expectedSnapshot.getRangeValues(), Map.<String, List<List<Object>>>of())
                .forEach((key, matrix) -> putExpectedMatrix(sheets, key, matrix, null, requiredSheets));
        Objects.requireNonNullElse(expectedSnapshot.getRangeFormulas(), Map.<String, List<List<String>>>of())
                .forEach((key, matrix) -> putExpectedMatrix(sheets, key, null, matrix, requiredSheets));
        Objects.requireNonNullElse(expectedSnapshot.getHeaderValues(), Map.<String, List<String>>of())
                .forEach((key, headers) -> putExpectedHeaders(sheets, key, headers, requiredSheets));

        ExcelWorkbookSnapshot snapshot = new ExcelWorkbookSnapshot();
        snapshot.setSheets(new ArrayList<>(sheets.values()));
        return snapshot;
    }

    private void putExpectedCell(
            Map<String, ExcelWorkbookSnapshot.SheetSnapshot> sheets,
            String key,
            Object value,
            String formula,
            Set<String> fallbackSheets) {
        SheetCellReference reference = parseSheetCellReference(key, fallbackSheets);
        CellPosition position = parseCellPosition(reference.cellRef());
        ExcelWorkbookSnapshot.SheetSnapshot sheet = getOrCreateSheet(sheets, reference.sheetName());
        putCell(sheet, position.row(), position.column(), value, formula);
    }

    private void putExpectedMatrix(
            Map<String, ExcelWorkbookSnapshot.SheetSnapshot> sheets,
            String key,
            List<List<Object>> values,
            List<List<String>> formulas,
            Set<String> fallbackSheets) {
        SheetRangeReference reference = parseSheetRangeReference(key, fallbackSheets);
        CellPosition start = parseCellPosition(reference.startCellRef());
        ExcelWorkbookSnapshot.SheetSnapshot sheet = getOrCreateSheet(sheets, reference.sheetName());
        int rowCount = values != null ? values.size() : formulas.size();
        for (int rowOffset = 0; rowOffset < rowCount; rowOffset++) {
            int columnCount = values != null ? values.get(rowOffset).size() : formulas.get(rowOffset).size();
            for (int columnOffset = 0; columnOffset < columnCount; columnOffset++) {
                Object value = values == null ? null : values.get(rowOffset).get(columnOffset);
                String formula = formulas == null ? null : formulas.get(rowOffset).get(columnOffset);
                putCell(sheet, start.row() + rowOffset, start.column() + columnOffset, value, formula);
            }
        }
    }

    private void putExpectedHeaders(
            Map<String, ExcelWorkbookSnapshot.SheetSnapshot> sheets,
            String key,
            List<String> headers,
            Set<String> fallbackSheets) {
        SheetRangeReference reference = parseSheetRangeReference(key, fallbackSheets);
        CellPosition start = parseCellPosition(reference.startCellRef());
        ExcelWorkbookSnapshot.SheetSnapshot sheet = getOrCreateSheet(sheets, reference.sheetName());
        for (int index = 0; index < headers.size(); index++) {
            putCell(sheet, start.row(), start.column() + index, headers.get(index), null);
        }
    }

    private ExcelWorkbookSnapshot.SheetSnapshot getOrCreateSheet(Map<String, ExcelWorkbookSnapshot.SheetSnapshot> sheets, String sheetName) {
        String effectiveName = StringUtils.hasText(sheetName) ? sheetName : "Sheet1";
        return sheets.computeIfAbsent(effectiveName, name -> {
            ExcelWorkbookSnapshot.SheetSnapshot sheet = new ExcelWorkbookSnapshot.SheetSnapshot();
            sheet.setName(name);
            sheet.setRowCount(0);
            sheet.setColumnCount(0);
            return sheet;
        });
    }

    private void putCell(ExcelWorkbookSnapshot.SheetSnapshot sheet, int row, int column, Object value, String formula) {
        String cellRef = toCellRef(row, column);
        ExcelWorkbookSnapshot.CellSnapshot cell = sheet.getCells().computeIfAbsent(cellRef, ignored -> new ExcelWorkbookSnapshot.CellSnapshot());
        if (value != null) {
            cell.setValue(value);
            cell.setDisplay(String.valueOf(value));
        }
        if (StringUtils.hasText(formula)) {
            cell.setFormula(formula);
        }
        sheet.setRowCount(Math.max(sheet.getRowCount() == null ? 0 : sheet.getRowCount(), row));
        sheet.setColumnCount(Math.max(sheet.getColumnCount() == null ? 0 : sheet.getColumnCount(), column));
    }

    private SheetCellReference parseSheetCellReference(String key, Set<String> fallbackSheets) {
        String[] parts = splitSheetReference(key, fallbackSheets);
        return new SheetCellReference(parts[0], parts[1]);
    }

    private SheetRangeReference parseSheetRangeReference(String key, Set<String> fallbackSheets) {
        String[] parts = splitSheetReference(key, fallbackSheets);
        String[] rangeParts = parts[1].split(":", 2);
        String startCell = rangeParts[0];
        String endCell = rangeParts.length > 1 ? rangeParts[1] : startCell;
        return new SheetRangeReference(parts[0], startCell, endCell);
    }

    private String[] splitSheetReference(String key, Set<String> fallbackSheets) {
        String effectiveKey = key == null ? "" : key.trim();
        int separator = effectiveKey.indexOf('!');
        if (separator >= 0) {
            return new String[]{effectiveKey.substring(0, separator), effectiveKey.substring(separator + 1)};
        }
        String fallbackSheet = fallbackSheets.stream().findFirst().orElse("Sheet1");
        return new String[]{fallbackSheet, effectiveKey};
    }

    private CellPosition parseCellPosition(String cellRef) {
        String normalized = cellRef == null ? "A1" : cellRef.replace("$", "").trim().toUpperCase();
        int index = 0;
        int column = 0;
        while (index < normalized.length() && Character.isLetter(normalized.charAt(index))) {
            column = column * 26 + (normalized.charAt(index) - 'A' + 1);
            index++;
        }
        int row = 1;
        if (index < normalized.length()) {
            try {
                row = Math.max(1, Integer.parseInt(normalized.substring(index).replaceAll("[^0-9]", "")));
            } catch (NumberFormatException ignored) {
                row = 1;
            }
        }
        return new CellPosition(row, Math.max(1, column));
    }

    private String toCellRef(int row, int column) {
        int remaining = column;
        StringBuilder letters = new StringBuilder();
        while (remaining > 0) {
            remaining--;
            letters.insert(0, (char) ('A' + (remaining % 26)));
            remaining /= 26;
        }
        return letters.append(row).toString();
    }

    private record SheetCellReference(String sheetName, String cellRef) {
    }

    private record SheetRangeReference(String sheetName, String startCellRef, String endCellRef) {
    }

    private record CellPosition(int row, int column) {
    }

    private ResponseEntity<?> validateExcelTemplateRequest(AdminQuestionRequest request) {
        if (!StringUtils.hasText(request.getTemplateFileUrl())) {
            return ResponseEntity.badRequest().body(Map.of("message", "Excel 模板文件不能为空"));
        }
        try {
            excelTemplateGradingService.validateAnswerArea(request.getTemplateFileUrl(), request.getAnswerSheet(), request.getAnswerRange());
            String normalizedAnswerSnapshot = excelTemplateGradingService.normalizeAnswerSnapshotJson(
                    request.getTemplateFileUrl(),
                    request.getAnswerSheet(),
                    request.getAnswerRange(),
                    request.getCheckFormula(),
                    request.getAnswerSnapshotJson()
            );
            request.setAnswerSnapshotJson(normalizedAnswerSnapshot);
            request.setGradingRuleJson(excelTemplateGradingService.buildRuleJson(
                    request.getTemplateFileUrl(),
                    request.getAnswerSheet(),
                    request.getAnswerRange(),
                    request.getCheckFormula(),
                    request.getGradingRuleJson()
            ));
            request.setExpectedSnapshotJson(excelTemplateGradingService.buildExpectedSnapshotJson(
                    request.getTemplateFileUrl(),
                    request.getAnswerSheet(),
                    request.getAnswerRange(),
                    request.getCheckFormula(),
                    normalizedAnswerSnapshot,
                    request.getGradingRuleJson(),
                    request.getExpectedSnapshotJson()
            ));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
        return null;
    }

    private Question buildQuestionEntity(AdminQuestionRequest request, Question target) {
        if (request.getTitle() != null) {
            target.setTitle(request.getTitle());
        }
        if (request.getType() != null) {
            target.setType(request.getType());
        }
        if (request.getCategoryId() != null || target.getId() == null) {
            target.setCategoryId(request.getCategoryId());
        }
        if (request.getQuestionCategoryId() != null || target.getId() == null) {
            target.setQuestionCategoryId(request.getQuestionCategoryId());
        }
        if (request.getDifficulty() != null || target.getId() == null) {
            int difficulty = QuestionDifficultyCatalog.normalizeDifficulty(request.getDifficulty());
            target.setDifficulty(difficulty);
            target.setPoints(QuestionDifficultyCatalog.resolvePoints(difficulty));
        } else if (target.getDifficulty() != null) {
            target.setPoints(QuestionDifficultyCatalog.resolvePoints(target.getDifficulty()));
        }
        if (request.getExplanation() != null || target.getId() == null) {
            target.setExplanation(request.getExplanation());
        }
        if (request.getEnabled() != null || target.getId() == null) {
            target.setEnabled(request.getEnabled() == null || request.getEnabled());
        }
        target.setOptions(null);
        target.setAnswer("");
        return target;
    }

    private QuestionExcelTemplate buildQuestionExcelTemplate(Long questionId, AdminQuestionRequest request, QuestionExcelTemplate target) {
        target.setQuestionId(questionId);
        target.setTemplateFileUrl(request.getTemplateFileUrl());
        target.setIdealAnswerImageUrl(normalizeOptionalText(request.getIdealAnswerImageUrl()));
        target.setAnswerSheet(request.getAnswerSheet());
        target.setAnswerRange(request.getAnswerRange());
        target.setAnswerSnapshotJson(request.getAnswerSnapshotJson());
        target.setCheckFormula(Boolean.TRUE.equals(request.getCheckFormula()));
        target.setGradingRuleJson(excelTemplateGradingService.normalizeRuleJson(request.getGradingRuleJson()));
        target.setExpectedSnapshotJson(request.getExpectedSnapshotJson());
        target.setSheetCountLimit(request.getSheetCountLimit() == null || request.getSheetCountLimit() < 1 ? 5 : request.getSheetCountLimit());
        target.setVersion(request.getVersion() == null || request.getVersion() < 1 ? 1 : request.getVersion());
        return target;
    }

    private Map<String, Object> buildAdminQuestionResponse(Question question, QuestionExcelTemplate template) {
        Map<String, Object> response = new HashMap<>();
        QuestionCategory questionCategory = question.getQuestionCategoryId() == null
                ? null
                : questionCategoryService.getById(question.getQuestionCategoryId());
        response.put("id", question.getId());
        response.put("title", question.getTitle());
        response.put("type", question.getType());
        response.put("categoryId", question.getCategoryId());
        response.put("questionCategoryId", question.getQuestionCategoryId());
        response.put("questionCategoryName", questionCategory == null ? null : questionCategory.getName());
        response.put("options", question.getOptions());
        response.put("answer", question.getAnswer());
        response.put("difficulty", question.getDifficulty());
        response.put("points", question.getPoints());
        response.put("explanation", question.getExplanation());
        response.put("enabled", question.getEnabled());
        response.put("createTime", question.getCreateTime());
        response.put("updateTime", question.getUpdateTime());
        if (template != null) {
            response.put("templateFileUrl", template.getTemplateFileUrl());
            response.put("idealAnswerImageUrl", template.getIdealAnswerImageUrl());
            response.put("answerSheet", template.getAnswerSheet());
            response.put("answerRange", template.getAnswerRange());
            response.put("answerSnapshotJson", template.getAnswerSnapshotJson());
            response.put("checkFormula", template.getCheckFormula());
            response.put("gradingRuleJson", template.getGradingRuleJson());
            response.put("expectedSnapshotJson", template.getExpectedSnapshotJson());
            response.put("sheetCountLimit", template.getSheetCountLimit());
            response.put("version", template.getVersion());
            response.put("gradingRuleSummary", excelTemplateGradingService.buildRuleSummary(template.getGradingRuleJson()));
        }
        return response;
    }

    private String normalizeOptionalText(String value) {
        if (!StringUtils.hasText(value)) {
            return null;
        }
        return value.trim();
    }
}
