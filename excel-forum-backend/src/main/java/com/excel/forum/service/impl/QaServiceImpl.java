package com.excel.forum.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.UpdateWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.excel.forum.entity.PracticeAnswer;
import com.excel.forum.entity.PracticeRecord;
import com.excel.forum.entity.QaCaseHelp;
import com.excel.forum.entity.QaCaseHelpAnswer;
import com.excel.forum.entity.QaSolutionShare;
import com.excel.forum.entity.User;
import com.excel.forum.entity.dto.AssistantChatRequest;
import com.excel.forum.entity.dto.AssistantChatResponse;
import com.excel.forum.entity.dto.PracticeQuestionWorkbookFile;
import com.excel.forum.entity.dto.QaAiDraftRequest;
import com.excel.forum.entity.dto.QaCaseAnswerRequest;
import com.excel.forum.entity.dto.QaCaseHelpRequest;
import com.excel.forum.entity.dto.QaCaseSnapshotAnswerRequest;
import com.excel.forum.entity.dto.QaSolutionShareRequest;
import com.excel.forum.mapper.PracticeAnswerMapper;
import com.excel.forum.mapper.PracticeRecordMapper;
import com.excel.forum.mapper.QaCaseHelpAnswerMapper;
import com.excel.forum.mapper.QaCaseHelpMapper;
import com.excel.forum.mapper.QaSolutionShareMapper;
import com.excel.forum.service.AssistantService;
import com.excel.forum.service.ExcelTemplateGradingService;
import com.excel.forum.service.FileStorageService;
import com.excel.forum.service.NotificationService;
import com.excel.forum.service.QaService;
import com.excel.forum.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

@Service
@RequiredArgsConstructor
public class QaServiceImpl implements QaService {
    private static final String STATUS_OPEN = "open";
    private static final String STATUS_ANSWERED = "answered";
    private static final String STATUS_PUBLISHED = "published";
    private static final List<String> CASE_STATUSES = List.of(STATUS_OPEN, STATUS_ANSWERED, "closed");
    private static final List<String> THOUGHT_SOURCES = List.of("manual", "ai", "empty");

    private final QaSolutionShareMapper solutionShareMapper;
    private final QaCaseHelpMapper caseHelpMapper;
    private final QaCaseHelpAnswerMapper caseHelpAnswerMapper;
    private final PracticeAnswerMapper practiceAnswerMapper;
    private final PracticeRecordMapper practiceRecordMapper;
    private final UserService userService;
    private final NotificationService notificationService;
    private final AssistantService assistantService;
    private final ExcelTemplateGradingService excelTemplateGradingService;
    private final FileStorageService fileStorageService;
    private final ObjectMapper objectMapper;

    @Override
    public Map<String, Object> listSolutionShares(Long userId, Integer page, Integer size) {
        Page<QaSolutionShare> result = solutionShareMapper.selectPage(
                new Page<>(safePage(page), safeSize(size)),
                new QueryWrapper<QaSolutionShare>()
                        .eq("status", STATUS_PUBLISHED)
                        .orderByDesc("create_time")
        );
        return pagePayload(result, result.getRecords().stream().map(this::solutionListPayload).toList());
    }

    @Override
    public Map<String, Object> getSolutionShareDetail(Long userId, Long shareId) {
        QaSolutionShare share = requireSolutionShare(shareId);
        if (!STATUS_PUBLISHED.equals(share.getStatus())) {
            throw new IllegalArgumentException("分享不存在");
        }
        incrementSolutionViews(share.getId());

        PracticeAnswer answer = practiceAnswerMapper.selectById(share.getAnswerId());
        Map<String, Object> payload = solutionListPayload(share);
        payload.put("recordId", share.getRecordId());
        payload.put("answer", answer == null ? null : answerPayload(answer));
        return payload;
    }

    @Override
    public Map<String, Object> shareSolution(Long userId, QaSolutionShareRequest request) {
        PracticeAnswer answer = requireOwnedCorrectAnswer(userId, request == null ? null : request.getAnswerId());
        QaSolutionShare share = findShareByAnswerId(answer.getId());
        if (share == null) {
            share = new QaSolutionShare();
            share.setUserId(userId);
            share.setRecordId(answer.getRecordId());
            share.setAnswerId(answer.getId());
            share.setQuestionId(answer.getQuestionId());
            share.setViewCount(0);
        }
        share.setTitle(defaultText(answer.getQuestionTitle(), "解题分享"));
        share.setThoughtText(trimToNull(request == null ? null : request.getThoughtText()));
        share.setThoughtSource(resolveThoughtSource(request == null ? null : request.getThoughtSource(), share.getThoughtText()));
        share.setStatus(STATUS_PUBLISHED);

        if (share.getId() == null) {
            solutionShareMapper.insert(share);
        } else {
            solutionShareMapper.updateById(share);
        }
        return solutionListPayload(share);
    }

    @Override
    public Map<String, Object> generateSolutionThoughtDraft(Long userId, QaAiDraftRequest request) {
        PracticeAnswer answer = requireOwnedCorrectAnswer(userId, request == null ? null : request.getAnswerId());

        AssistantChatRequest chatRequest = new AssistantChatRequest();
        // AI 只生成用户可编辑的草稿，不直接写入分享表，避免不可控发布。
        chatRequest.setMessage("""
                请基于以下 Excel 练习结果生成一段简洁的中文解题思路，强调关键公式、步骤和容易出错点。
                题目：%s
                用户答案：%s
                标准答案：%s
                判题明细：%s
                题目解析：%s
                """.formatted(
                defaultText(answer.getQuestionTitle(), "Excel 题目"),
                defaultText(answer.getUserAnswer(), "无"),
                defaultText(answer.getCorrectAnswer(), "无"),
                defaultText(answer.getGradingDetail(), "无"),
                defaultText(answer.getQuestionExplanation(), "无")
        ));
        chatRequest.setPracticeQuestionId(answer.getQuestionId());
        AssistantChatResponse response = assistantService.chat(userId, chatRequest);
        return Map.of("thoughtText", defaultText(response == null ? null : response.getAnswer(), ""));
    }

    @Override
    public Map<String, Object> listCases(Long userId, String status, Integer page, Integer size) {
        QueryWrapper<QaCaseHelp> wrapper = new QueryWrapper<>();
        if (StringUtils.hasText(status) && !"all".equalsIgnoreCase(status)) {
            String normalizedStatus = normalizeCaseStatus(status);
            wrapper.eq("status", normalizedStatus);
        }
        wrapper.orderByDesc("create_time");

        Page<QaCaseHelp> result = caseHelpMapper.selectPage(new Page<>(safePage(page), safeSize(size)), wrapper);
        Map<Long, Long> answerCounts = loadAnswerCounts(result.getRecords());
        return pagePayload(result, result.getRecords().stream()
                .map(item -> caseListPayload(item, answerCounts.getOrDefault(item.getId(), 0L)))
                .toList());
    }

    @Override
    public Map<String, Object> getCaseDetail(Long userId, Long caseId) {
        QaCaseHelp qaCase = requireCase(caseId);
        incrementCaseViews(qaCase.getId());
        Map<String, Object> payload = caseListPayload(qaCase, countCaseAnswers(qaCase.getId()));
        payload.put("description", qaCase.getDescription());
        payload.put("templateFileUrl", qaCase.getTemplateFileUrl());
        payload.put("answerSheet", qaCase.getAnswerSheet());
        payload.put("answerRange", qaCase.getAnswerRange());
        payload.put("idealAnswerSnapshot", parseJson(qaCase.getIdealAnswerSnapshotJson()));
        payload.put("answers", loadCaseAnswers(qaCase.getId()));
        return payload;
    }

    @Override
    public Map<String, Object> createCase(Long userId, QaCaseHelpRequest request) {
        if (request == null) {
            throw new IllegalArgumentException("请求参数不能为空");
        }
        String title = requireText(request.getTitle(), "求助标题不能为空");
        String description = requireText(request.getDescription(), "需求描述不能为空");
        String templateFileUrl = requireExcelFileUrl(request.getTemplateFileUrl(), "请上传 Excel 模板");
        excelTemplateGradingService.loadWorkbookSnapshot(templateFileUrl);

        QaCaseHelp qaCase = new QaCaseHelp();
        qaCase.setUserId(userId);
        qaCase.setTitle(title);
        qaCase.setDescription(description);
        qaCase.setTemplateFileUrl(templateFileUrl);
        qaCase.setAnswerSheet(trimToNull(request.getAnswerSheet()));
        qaCase.setAnswerRange(trimToNull(request.getAnswerRange()));
        qaCase.setIdealAnswerSnapshotJson(trimToNull(request.getIdealAnswerSnapshotJson()));
        qaCase.setStatus(STATUS_OPEN);
        qaCase.setViewCount(0);
        caseHelpMapper.insert(qaCase);
        return caseListPayload(qaCase, 0L);
    }

    @Override
    public PracticeQuestionWorkbookFile buildCaseWorkbookFile(Long userId, Long caseId) {
        QaCaseHelp qaCase = requireCase(caseId);
        byte[] content = fileStorageService.load(qaCase.getTemplateFileUrl());
        String extension = qaCase.getTemplateFileUrl().toLowerCase().endsWith(".xls") ? ".xls" : ".xlsx";
        String contentType = ".xls".equals(extension)
                ? "application/vnd.ms-excel"
                : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
        return new PracticeQuestionWorkbookFile(safeFileName(qaCase.getTitle()) + extension, contentType, content);
    }

    @Override
    public Map<String, Object> submitCaseAnswer(Long userId, Long caseId, QaCaseAnswerRequest request) {
        QaCaseHelp qaCase = requireCase(caseId);
        String answerFileUrl = requireExcelFileUrl(request == null ? null : request.getAnswerFileUrl(), "请上传答疑 Excel 文件");

        QaCaseHelpAnswer answer = new QaCaseHelpAnswer();
        answer.setCaseId(caseId);
        answer.setUserId(userId);
        answer.setAnswerFileUrl(answerFileUrl);
        caseHelpAnswerMapper.insert(answer);

        if (!STATUS_ANSWERED.equals(qaCase.getStatus())) {
            QaCaseHelp update = new QaCaseHelp();
            update.setId(caseId);
            update.setStatus(STATUS_ANSWERED);
            caseHelpMapper.updateById(update);
        }
        notifyCaseOwnerIfNeeded(qaCase, userId);
        return caseAnswerPayload(answer);
    }

    @Override
    public Map<String, Object> submitCaseAnswerFromSnapshot(Long userId, Long caseId, QaCaseSnapshotAnswerRequest request) {
        QaCaseHelp qaCase = requireCase(caseId);
        if (request == null || request.getWorkbook() == null) {
            throw new IllegalArgumentException("答疑工作簿不能为空");
        }
        // 在线作答最终也落为 Excel 文件，列表和下载口径与本地上传保持一致。
        byte[] workbookFile = excelTemplateGradingService.buildWorkbookFileFromSnapshot(
                qaCase.getTemplateFileUrl(),
                request.getWorkbook()
        );
        String answerFileUrl = fileStorageService.store(
                "qa-case-" + caseId + "-answer.xlsx",
                workbookFile
        );
        QaCaseAnswerRequest answerRequest = new QaCaseAnswerRequest();
        answerRequest.setAnswerFileUrl(answerFileUrl);
        return submitCaseAnswer(userId, caseId, answerRequest);
    }

    @Override
    public Map<String, Object> listCaseAnswers(Long userId, Long caseId) {
        requireCase(caseId);
        return Map.of("answers", loadCaseAnswers(caseId));
    }

    @Override
    public Map<String, Object> getMyQa(Long userId, Integer page, Integer size) {
        int safePage = safePage(page);
        int safeSize = safeSize(size);
        Page<QaCaseHelp> myCases = caseHelpMapper.selectPage(
                new Page<>(safePage, safeSize),
                new QueryWrapper<QaCaseHelp>().eq("user_id", userId).orderByDesc("create_time")
        );
        Page<QaCaseHelpAnswer> myAnswers = caseHelpAnswerMapper.selectPage(
                new Page<>(safePage, safeSize),
                new QueryWrapper<QaCaseHelpAnswer>().eq("user_id", userId).orderByDesc("create_time")
        );
        Page<QaSolutionShare> myShares = solutionShareMapper.selectPage(
                new Page<>(safePage, safeSize),
                new QueryWrapper<QaSolutionShare>().eq("user_id", userId).orderByDesc("create_time")
        );
        Map<Long, Long> myCaseAnswerCounts = loadAnswerCounts(myCases.getRecords());
        return Map.of(
                "cases", pagePayload(myCases, myCases.getRecords().stream()
                        .map(item -> caseListPayload(item, myCaseAnswerCounts.getOrDefault(item.getId(), 0L)))
                        .toList()),
                "answers", pagePayload(myAnswers, myAnswers.getRecords().stream().map(this::caseAnswerPayload).toList()),
                "shares", pagePayload(myShares, myShares.getRecords().stream().map(this::solutionListPayload).toList())
        );
    }

    private PracticeAnswer requireOwnedCorrectAnswer(Long userId, Long answerId) {
        if (answerId == null || answerId <= 0) {
            throw new IllegalArgumentException("答案参数无效");
        }
        PracticeAnswer answer = practiceAnswerMapper.selectById(answerId);
        if (answer == null) {
            throw new IllegalArgumentException("答案不存在");
        }
        PracticeRecord record = practiceRecordMapper.selectById(answer.getRecordId());
        if (record == null || !Objects.equals(record.getUserId(), userId)) {
            throw new IllegalArgumentException("只能分享自己的答案");
        }
        if (!Boolean.TRUE.equals(answer.getIsCorrect())) {
            throw new IllegalArgumentException("仅支持分享已通过的答案");
        }
        return answer;
    }

    private QaSolutionShare findShareByAnswerId(Long answerId) {
        return solutionShareMapper.selectOne(new QueryWrapper<QaSolutionShare>().eq("answer_id", answerId));
    }

    private QaSolutionShare requireSolutionShare(Long shareId) {
        if (shareId == null || shareId <= 0) {
            throw new IllegalArgumentException("分享参数无效");
        }
        QaSolutionShare share = solutionShareMapper.selectById(shareId);
        if (share == null) {
            throw new IllegalArgumentException("分享不存在");
        }
        return share;
    }

    private QaCaseHelp requireCase(Long caseId) {
        if (caseId == null || caseId <= 0) {
            throw new IllegalArgumentException("求助参数无效");
        }
        QaCaseHelp qaCase = caseHelpMapper.selectById(caseId);
        if (qaCase == null) {
            throw new IllegalArgumentException("求助不存在");
        }
        return qaCase;
    }

    private void notifyCaseOwnerIfNeeded(QaCaseHelp qaCase, Long answererId) {
        if (Objects.equals(qaCase.getUserId(), answererId)) {
            return;
        }
        User answerer = userService.getById(answererId);
        String username = answerer == null ? "其他用户" : defaultText(answerer.getUsername(), "其他用户");
        // 答疑通知只发给求助发起人，relatedId 固定为 caseId，前端据此跳转求助详情。
        notificationService.createNotification(
                qaCase.getUserId(),
                "qa_case_answered",
                username + " 提交了「" + defaultText(qaCase.getTitle(), "案例求助") + "」的答疑模板",
                qaCase.getId()
        );
    }

    private List<Map<String, Object>> loadCaseAnswers(Long caseId) {
        return caseHelpAnswerMapper.selectList(
                new QueryWrapper<QaCaseHelpAnswer>().eq("case_id", caseId).orderByDesc("create_time")
        ).stream().map(this::caseAnswerPayload).toList();
    }

    private Map<String, Object> solutionListPayload(QaSolutionShare share) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("id", share.getId());
        payload.put("userId", share.getUserId());
        payload.put("answerId", share.getAnswerId());
        payload.put("questionId", share.getQuestionId());
        payload.put("title", share.getTitle());
        payload.put("thoughtText", share.getThoughtText());
        payload.put("thoughtSource", share.getThoughtSource());
        payload.put("viewCount", safeInt(share.getViewCount()));
        payload.put("createTime", share.getCreateTime());
        payload.put("author", userPayload(share.getUserId()));
        return payload;
    }

    private Map<String, Object> caseListPayload(QaCaseHelp qaCase, long answerCount) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("id", qaCase.getId());
        payload.put("userId", qaCase.getUserId());
        payload.put("title", qaCase.getTitle());
        payload.put("description", qaCase.getDescription());
        payload.put("status", qaCase.getStatus());
        payload.put("answerSheet", qaCase.getAnswerSheet());
        payload.put("answerRange", qaCase.getAnswerRange());
        payload.put("viewCount", safeInt(qaCase.getViewCount()));
        payload.put("answerCount", answerCount);
        payload.put("createTime", qaCase.getCreateTime());
        payload.put("author", userPayload(qaCase.getUserId()));
        return payload;
    }

    private Map<String, Object> caseAnswerPayload(QaCaseHelpAnswer answer) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("id", answer.getId());
        payload.put("caseId", answer.getCaseId());
        payload.put("userId", answer.getUserId());
        payload.put("answerFileUrl", answer.getAnswerFileUrl());
        payload.put("createTime", answer.getCreateTime());
        payload.put("author", userPayload(answer.getUserId()));
        return payload;
    }

    private Map<Long, Long> loadAnswerCounts(List<QaCaseHelp> cases) {
        List<Long> caseIds = cases.stream()
                .map(QaCaseHelp::getId)
                .filter(Objects::nonNull)
                .distinct()
                .toList();
        if (caseIds.isEmpty()) {
            return Map.of();
        }
        Map<Long, Long> counts = new HashMap<>();
        for (Map<String, Object> row : caseHelpAnswerMapper.countByCaseIds(caseIds)) {
            Long caseId = toLong(row.get("caseId"));
            Long answerCount = toLong(row.get("answerCount"));
            if (caseId != null) {
                counts.put(caseId, answerCount == null ? 0L : answerCount);
            }
        }
        return counts;
    }

    private Long toLong(Object value) {
        if (value instanceof Number number) {
            return number.longValue();
        }
        if (value instanceof String text && StringUtils.hasText(text)) {
            try {
                return Long.parseLong(text.trim());
            } catch (NumberFormatException parseError) {
                return null;
            }
        }
        return null;
    }

    private long countCaseAnswers(Long caseId) {
        if (caseId == null) {
            return 0;
        }
        Long count = caseHelpAnswerMapper.selectCount(new QueryWrapper<QaCaseHelpAnswer>().eq("case_id", caseId));
        return count == null ? 0 : count;
    }

    private Map<String, Object> answerPayload(PracticeAnswer answer) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("id", answer.getId());
        payload.put("questionId", answer.getQuestionId());
        payload.put("questionType", answer.getQuestionType());
        payload.put("questionTitle", answer.getQuestionTitle());
        payload.put("questionExplanation", answer.getQuestionExplanation());
        payload.put("userAnswer", parseJsonOrText(answer.getUserAnswer()));
        payload.put("correctAnswer", parseJsonOrText(answer.getCorrectAnswer()));
        payload.put("gradingDetail", parseJson(answer.getGradingDetail()));
        payload.put("isCorrect", Boolean.TRUE.equals(answer.getIsCorrect()));
        payload.put("score", safeInt(answer.getScore()));
        return payload;
    }

    private Map<String, Object> userPayload(Long userId) {
        User user = userId == null ? null : userService.getById(userId);
        if (user == null) {
            return Map.of("id", userId);
        }
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("id", user.getId());
        payload.put("username", user.getUsername());
        payload.put("avatar", user.getAvatar());
        return payload;
    }

    private Map<String, Object> pagePayload(Page<?> page, List<Map<String, Object>> records) {
        return Map.of(
                "records", records,
                "total", page.getTotal(),
                "page", page.getCurrent(),
                "size", page.getSize()
        );
    }

    private void incrementSolutionViews(Long shareId) {
        solutionShareMapper.update(null, new UpdateWrapper<QaSolutionShare>()
                .setSql("view_count = COALESCE(view_count, 0) + 1")
                .eq("id", shareId));
    }

    private void incrementCaseViews(Long caseId) {
        caseHelpMapper.update(null, new UpdateWrapper<QaCaseHelp>()
                .setSql("view_count = COALESCE(view_count, 0) + 1")
                .eq("id", caseId));
    }

    private Object parseJsonOrText(String text) {
        Object parsed = parseJson(text);
        return parsed == null ? text : parsed;
    }

    private Object parseJson(String text) {
        if (!StringUtils.hasText(text)) {
            return null;
        }
        try {
            return objectMapper.readValue(text, Object.class);
        } catch (JsonProcessingException parseError) {
            return null;
        }
    }

    private String resolveThoughtSource(String source, String thoughtText) {
        if (!StringUtils.hasText(thoughtText)) {
            return "empty";
        }
        String normalized = source == null ? "manual" : source.trim().toLowerCase();
        return THOUGHT_SOURCES.contains(normalized) ? normalized : "manual";
    }

    private String normalizeCaseStatus(String status) {
        String normalized = status == null ? STATUS_OPEN : status.trim().toLowerCase();
        if (!CASE_STATUSES.contains(normalized)) {
            throw new IllegalArgumentException("求助状态无效");
        }
        return normalized;
    }

    private String requireExcelFileUrl(String value, String message) {
        String fileUrl = requireText(value, message);
        String lower = fileUrl.toLowerCase();
        if (!lower.endsWith(".xlsx") && !lower.endsWith(".xls")) {
            throw new IllegalArgumentException("仅支持 Excel 文件");
        }
        return fileUrl;
    }

    private String requireText(String value, String message) {
        String text = trimToNull(value);
        if (text == null) {
            throw new IllegalArgumentException(message);
        }
        return text;
    }

    private String trimToNull(String value) {
        if (!StringUtils.hasText(value)) {
            return null;
        }
        return value.trim();
    }

    private String defaultText(String value, String fallback) {
        return StringUtils.hasText(value) ? value.trim() : fallback;
    }

    private int safePage(Integer page) {
        return page == null || page < 1 ? 1 : page;
    }

    private int safeSize(Integer size) {
        if (size == null || size < 1) {
            return 10;
        }
        return Math.min(size, 50);
    }

    private int safeInt(Integer value) {
        return value == null ? 0 : value;
    }

    private String safeFileName(String title) {
        String base = defaultText(title, "excelcc-case-help");
        return base.replaceAll("[\\\\/:*?\"<>|\\r\\n]+", "_");
    }
}
