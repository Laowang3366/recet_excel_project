package com.excel.forum.controller;

import com.excel.forum.entity.Question;
import com.excel.forum.entity.QuestionCategory;
import com.excel.forum.entity.QuestionExcelTemplate;
import com.excel.forum.entity.dto.AdminQuestionRequest;
import com.excel.forum.service.ExcelTemplateGradingService;
import com.excel.forum.service.FileRecycleService;
import com.excel.forum.service.PracticeCampaignService;
import com.excel.forum.service.QuestionCategoryService;
import com.excel.forum.service.QuestionExcelTemplateService;
import com.excel.forum.service.QuestionService;
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

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

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
            target.setDifficulty(request.getDifficulty());
        }
        if (request.getPoints() != null || target.getId() == null) {
            target.setPoints(request.getPoints());
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
}
