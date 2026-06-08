package com.excel.forum.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.UpdateWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.excel.forum.entity.PracticeAnswer;
import com.excel.forum.entity.PracticeRecord;
import com.excel.forum.entity.PointsRecord;
import com.excel.forum.entity.QaCaseHelp;
import com.excel.forum.entity.QaCaseHelpAnswer;
import com.excel.forum.entity.QaCaseHelpAnswerVote;
import com.excel.forum.entity.QaCaseHelpFeedback;
import com.excel.forum.entity.QaSolutionShare;
import com.excel.forum.entity.User;
import com.excel.forum.entity.dto.AssistantChatRequest;
import com.excel.forum.entity.dto.AssistantChatResponse;
import com.excel.forum.entity.dto.AdminQaAssignRequest;
import com.excel.forum.entity.dto.AdminQaBatchAssignRequest;
import com.excel.forum.entity.dto.AdminQaBatchReviewRequest;
import com.excel.forum.entity.dto.AdminQaFeaturedShareRequest;
import com.excel.forum.entity.dto.AdminQaFeedbackHandleRequest;
import com.excel.forum.entity.dto.AdminQaReviewRequest;
import com.excel.forum.entity.dto.ExcelWorkbookSnapshot;
import com.excel.forum.entity.dto.PracticeQuestionWorkbookFile;
import com.excel.forum.entity.dto.QaAiDraftRequest;
import com.excel.forum.entity.dto.QaCaseAcceptRequest;
import com.excel.forum.entity.dto.QaCaseAnswerRequest;
import com.excel.forum.entity.dto.QaCaseFeedbackRequest;
import com.excel.forum.entity.dto.QaCaseHelpRequest;
import com.excel.forum.entity.dto.QaCaseSnapshotAnswerRequest;
import com.excel.forum.entity.dto.QaCaseVoteRequest;
import com.excel.forum.entity.dto.QaSolutionShareRequest;
import com.excel.forum.entity.dto.QaSolutionShareUpdateRequest;
import com.excel.forum.mapper.PracticeAnswerMapper;
import com.excel.forum.mapper.PracticeRecordMapper;
import com.excel.forum.mapper.QaCaseHelpAnswerMapper;
import com.excel.forum.mapper.QaCaseHelpAnswerVoteMapper;
import com.excel.forum.mapper.QaCaseHelpFeedbackMapper;
import com.excel.forum.mapper.QaCaseHelpMapper;
import com.excel.forum.mapper.QaSolutionShareMapper;
import com.excel.forum.mapper.UserMapper;
import com.excel.forum.service.AssistantService;
import com.excel.forum.service.ExcelTemplateGradingService;
import com.excel.forum.service.FileRecycleService;
import com.excel.forum.service.FileStorageService;
import com.excel.forum.service.NotificationService;
import com.excel.forum.service.PointsRecordService;
import com.excel.forum.service.QaService;
import com.excel.forum.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class QaServiceImpl implements QaService {
    private static final String STATUS_OPEN = "open";
    private static final String STATUS_ANSWERED = "answered";
    private static final String STATUS_ACCEPTED = "accepted";
    private static final String STATUS_ACTIVE = "active";
    private static final String STATUS_APPROVED = "approved";
    private static final String STATUS_REJECTED = "rejected";
    private static final String STATUS_CLOSED = "closed";
    private static final String STATUS_DELETED = "deleted";
    private static final String STATUS_PUBLISHED = "published";
    private static final String STATUS_UNPUBLISHED = "unpublished";
    private static final String STATUS_HANDLED = "handled";
    private static final String STATUS_IGNORED = "ignored";
    private static final String SOURCE_PRACTICE = "practice";
    private static final String SOURCE_QA_CASE = "qa_case";
    private static final List<String> CASE_STATUSES = List.of(STATUS_OPEN, STATUS_ANSWERED, STATUS_ACCEPTED, STATUS_CLOSED, STATUS_DELETED);
    private static final List<String> SHARE_STATUSES = List.of(STATUS_PUBLISHED, STATUS_UNPUBLISHED, STATUS_DELETED);
    private static final List<String> THOUGHT_SOURCES = List.of("manual", "ai", "empty");
    private static final Set<String> FEEDBACK_REASONS = Set.of("unclear_requirement", "missing_expected_answer", "bad_source_data", "too_hard", "other");
    private static final int MAX_ACTIVE_ANSWERS_PER_CASE = 50;
    private static final int MAX_BATCH_IDS = 100;

    private final QaSolutionShareMapper solutionShareMapper;
    private final QaCaseHelpMapper caseHelpMapper;
    private final QaCaseHelpAnswerMapper caseHelpAnswerMapper;
    private final QaCaseHelpAnswerVoteMapper caseHelpAnswerVoteMapper;
    private final QaCaseHelpFeedbackMapper caseHelpFeedbackMapper;
    private final PracticeAnswerMapper practiceAnswerMapper;
    private final PracticeRecordMapper practiceRecordMapper;
    private final UserMapper userMapper;
    private final UserService userService;
    private final PointsRecordService pointsRecordService;
    private final NotificationService notificationService;
    private final AssistantService assistantService;
    private final ExcelTemplateGradingService excelTemplateGradingService;
    private final FileRecycleService fileRecycleService;
    private final FileStorageService fileStorageService;
    private final ObjectMapper objectMapper;

    @Override
    public Map<String, Object> listSolutionShares(Long userId, Integer page, Integer size) {
        Page<QaSolutionShare> result = solutionShareMapper.selectPage(
                new Page<>(safePage(page), safeSize(size)),
                new QueryWrapper<QaSolutionShare>()
                        .eq("status", STATUS_PUBLISHED)
                        .isNull("deleted_at")
                        .orderByDesc("create_time")
        );
        return pagePayload(result, result.getRecords().stream().map(this::solutionListPayload).toList());
    }

    @Override
    public Map<String, Object> getSolutionShareDetail(Long userId, Long shareId) {
        QaSolutionShare share = requireSolutionShare(shareId);
        if (!STATUS_PUBLISHED.equals(share.getStatus()) || share.getDeletedAt() != null) {
            throw new IllegalArgumentException("分享不存在");
        }
        incrementSolutionViews(share.getId());

        PracticeAnswer answer = share.getAnswerId() == null ? null : practiceAnswerMapper.selectById(share.getAnswerId());
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
            share.setSourceType(SOURCE_PRACTICE);
            share.setRecordId(answer.getRecordId());
            share.setAnswerId(answer.getId());
            share.setQuestionId(answer.getQuestionId());
            share.setViewCount(0);
        }
        if (!StringUtils.hasText(share.getSourceType())) {
            share.setSourceType(SOURCE_PRACTICE);
        }
        share.setTitle(defaultText(answer.getQuestionTitle(), "解题分享"));
        share.setThoughtText(trimToNull(request == null ? null : request.getThoughtText()));
        share.setThoughtSource(resolveThoughtSource(request == null ? null : request.getThoughtSource(), share.getThoughtText()));
        share.setStatus(STATUS_PUBLISHED);
        share.setDeletedAt(null);

        if (share.getId() == null) {
            solutionShareMapper.insert(share);
        } else {
            solutionShareMapper.updateById(share);
        }
        return solutionListPayload(share);
    }

    @Override
    public Map<String, Object> updateSolutionShare(Long userId, Long shareId, QaSolutionShareUpdateRequest request) {
        QaSolutionShare share = requireOwnedSolutionShare(userId, shareId);
        if (request == null) {
            throw new IllegalArgumentException("请求参数不能为空");
        }
        String title = trimToNull(request.getTitle());
        if (title != null) {
            share.setTitle(title);
        }
        share.setThoughtText(trimToNull(request.getThoughtText()));
        share.setThoughtSource(resolveThoughtSource(request.getThoughtSource(), share.getThoughtText()));
        String status = normalizeShareStatus(request.getStatus(), STATUS_PUBLISHED);
        if (STATUS_DELETED.equals(status)) {
            share.setStatus(STATUS_DELETED);
            share.setDeletedAt(LocalDateTime.now());
        } else {
            share.setStatus(status);
            share.setDeletedAt(null);
        }
        solutionShareMapper.updateById(share);
        return solutionListPayload(share);
    }

    @Override
    public Map<String, Object> deleteSolutionShare(Long userId, Long shareId) {
        QaSolutionShare share = requireOwnedSolutionShare(userId, shareId);
        softDeleteSolutionShare(share);
        return Map.of("message", "解题分享已取消发布");
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
        wrapper.isNull("deleted_at").ne("status", STATUS_DELETED);
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
        ensureCaseVisible(qaCase);
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
    public Map<String, Object> updateCase(Long userId, Long caseId, QaCaseHelpRequest request) {
        QaCaseHelp qaCase = requireOwnedCase(userId, caseId);
        if (request == null) {
            throw new IllegalArgumentException("请求参数不能为空");
        }
        qaCase.setTitle(requireText(request.getTitle(), "求助标题不能为空"));
        qaCase.setDescription(requireText(request.getDescription(), "需求描述不能为空"));
        qaCase.setAnswerSheet(trimToNull(request.getAnswerSheet()));
        qaCase.setAnswerRange(trimToNull(request.getAnswerRange()));
        if (request.getIdealAnswerSnapshotJson() != null) {
            qaCase.setIdealAnswerSnapshotJson(trimToNull(request.getIdealAnswerSnapshotJson()));
        }
        caseHelpMapper.updateById(qaCase);
        return getCaseDetail(userId, caseId);
    }

    @Override
    public Map<String, Object> closeCase(Long userId, Long caseId) {
        QaCaseHelp qaCase = requireOwnedCase(userId, caseId);
        if (STATUS_ACCEPTED.equals(qaCase.getStatus())) {
            throw new IllegalArgumentException("已采纳的求助不能关闭");
        }
        qaCase.setStatus(STATUS_CLOSED);
        caseHelpMapper.updateById(qaCase);
        return caseListPayload(qaCase, countCaseAnswers(caseId));
    }

    @Override
    public Map<String, Object> deleteCase(Long userId, Long caseId) {
        QaCaseHelp qaCase = requireOwnedCase(userId, caseId);
        fileRecycleService.recycleQaCase(qaCase, userId);
        return Map.of("message", "求助已移入回收站");
    }

    @Override
    public PracticeQuestionWorkbookFile buildCaseWorkbookFile(Long userId, Long caseId) {
        QaCaseHelp qaCase = requireCase(caseId);
        ensureCaseVisible(qaCase);
        byte[] content = fileStorageService.load(qaCase.getTemplateFileUrl());
        String extension = qaCase.getTemplateFileUrl().toLowerCase().endsWith(".xls") ? ".xls" : ".xlsx";
        String contentType = ".xls".equals(extension)
                ? "application/vnd.ms-excel"
                : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
        return new PracticeQuestionWorkbookFile(safeFileName(qaCase.getTitle()) + extension, contentType, content);
    }

    @Override
    public PracticeQuestionWorkbookFile buildCaseAnswerWorkbookFile(Long userId, Long caseId, Long answerId) {
        QaCaseHelp qaCase = requireCase(caseId);
        ensureCaseVisible(qaCase);
        QaCaseHelpAnswer answer = requireVisibleCaseAnswer(caseId, answerId);
        byte[] content = fileStorageService.load(answer.getAnswerFileUrl());
        String extension = answer.getAnswerFileUrl() != null && answer.getAnswerFileUrl().toLowerCase().endsWith(".xls") ? ".xls" : ".xlsx";
        String contentType = ".xls".equals(extension)
                ? "application/vnd.ms-excel"
                : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
        return new PracticeQuestionWorkbookFile("qa-answer-" + answer.getId() + extension, contentType, content);
    }

    @Override
    public ExcelWorkbookSnapshot loadCaseTemplateSnapshot(Long userId, Long caseId) {
        QaCaseHelp qaCase = requireCase(caseId);
        ensureCaseVisible(qaCase);
        // 快照只按业务 ID 解析，避免前端传入任意 fileUrl 绕过权限和限流。
        String templateFileUrl = requireExcelFileUrl(qaCase.getTemplateFileUrl(), "求助模板不存在");
        return excelTemplateGradingService.loadWorkbookSnapshot(templateFileUrl);
    }

    @Override
    public ExcelWorkbookSnapshot loadCaseAnswerSnapshot(Long userId, Long caseId, Long answerId) {
        QaCaseHelp qaCase = requireCase(caseId);
        ensureCaseVisible(qaCase);
        QaCaseHelpAnswer answer = requireVisibleCaseAnswer(caseId, answerId);
        String answerFileUrl = requireExcelFileUrl(answer.getAnswerFileUrl(), "答疑模板不存在");
        return excelTemplateGradingService.loadWorkbookSnapshot(answerFileUrl);
    }

    @Override
    public Map<String, Object> submitCaseAnswer(Long userId, Long caseId, QaCaseAnswerRequest request) {
        QaCaseHelp qaCase = requireCase(caseId);
        ensureCaseCanReceiveAnswer(qaCase);
        String answerFileUrl = requireExcelFileUrl(request == null ? null : request.getAnswerFileUrl(), "请上传答疑 Excel 文件");
        ensureNewCaseAnswerAllowed(userId, caseId);
        excelTemplateGradingService.loadWorkbookSnapshot(answerFileUrl);
        return createCaseAnswer(qaCase, userId, answerFileUrl);
    }

    private Map<String, Object> createCaseAnswer(QaCaseHelp qaCase, Long userId, String answerFileUrl) {
        QaCaseHelpAnswer answer = new QaCaseHelpAnswer();
        answer.setCaseId(qaCase.getId());
        answer.setUserId(userId);
        answer.setAnswerFileUrl(answerFileUrl);
        answer.setStatus(STATUS_ACTIVE);
        answer.setUpVoteCount(0);
        answer.setDownVoteCount(0);
        answer.setRewardPoints(0);
        caseHelpAnswerMapper.insert(answer);

        if (STATUS_OPEN.equals(qaCase.getStatus())) {
            QaCaseHelp update = new QaCaseHelp();
            update.setId(qaCase.getId());
            update.setStatus(STATUS_ANSWERED);
            caseHelpMapper.updateById(update);
        }
        notifyCaseOwnerIfNeeded(qaCase, userId);
        return caseAnswerPayload(answer);
    }

    @Override
    public Map<String, Object> submitCaseAnswerFromSnapshot(Long userId, Long caseId, QaCaseSnapshotAnswerRequest request) {
        QaCaseHelp qaCase = requireCase(caseId);
        ensureCaseCanReceiveAnswer(qaCase);
        if (request == null || request.getWorkbook() == null) {
            throw new IllegalArgumentException("答疑工作簿不能为空");
        }
        ensureNewCaseAnswerAllowed(userId, caseId);
        // 在线作答最终也落为 Excel 文件，列表和下载口径与本地上传保持一致。
        byte[] workbookFile = excelTemplateGradingService.buildWorkbookFileFromSnapshot(
                qaCase.getTemplateFileUrl(),
                request.getWorkbook()
        );
        String answerFileUrl = fileStorageService.store(
                "qa-case-" + caseId + "-answer.xlsx",
                workbookFile
        );
        return createCaseAnswer(qaCase, userId, answerFileUrl);
    }

    @Override
    public Map<String, Object> updateCaseAnswer(Long userId, Long caseId, Long answerId, QaCaseAnswerRequest request) {
        QaCaseHelpAnswer answer = requireOwnedCaseAnswer(userId, answerId);
        if (!Objects.equals(answer.getCaseId(), caseId)) {
            throw new IllegalArgumentException("答疑不存在");
        }
        if (STATUS_ACCEPTED.equals(answer.getStatus())) {
            throw new IllegalArgumentException("已采纳的答疑不能修改");
        }
        String answerFileUrl = requireExcelFileUrl(request == null ? null : request.getAnswerFileUrl(), "请上传答疑 Excel 文件");
        excelTemplateGradingService.loadWorkbookSnapshot(answerFileUrl);
        answer.setAnswerFileUrl(answerFileUrl);
        answer.setStatus(STATUS_ACTIVE);
        caseHelpAnswerMapper.updateById(answer);
        return caseAnswerPayload(answer);
    }

    @Override
    public Map<String, Object> updateCaseAnswerFromSnapshot(Long userId, Long caseId, Long answerId, QaCaseSnapshotAnswerRequest request) {
        QaCaseHelpAnswer answer = requireOwnedCaseAnswer(userId, answerId);
        if (!Objects.equals(answer.getCaseId(), caseId)) {
            throw new IllegalArgumentException("答疑不存在");
        }
        if (STATUS_ACCEPTED.equals(answer.getStatus())) {
            throw new IllegalArgumentException("已采纳的答疑不能修改");
        }
        QaCaseHelp qaCase = requireCase(caseId);
        ensureCaseVisible(qaCase);
        if (request == null || request.getWorkbook() == null) {
            throw new IllegalArgumentException("答疑工作簿不能为空");
        }
        // 在线编辑覆盖已有答疑文件，但仍保存为 Excel 文件，避免把编辑器快照暴露成新的业务形态。
        byte[] workbookFile = excelTemplateGradingService.buildWorkbookFileFromSnapshot(
                qaCase.getTemplateFileUrl(),
                request.getWorkbook()
        );
        String answerFileUrl = fileStorageService.store(
                "qa-case-" + caseId + "-answer-" + answerId + ".xlsx",
                workbookFile
        );
        answer.setAnswerFileUrl(answerFileUrl);
        answer.setStatus(STATUS_ACTIVE);
        caseHelpAnswerMapper.updateById(answer);
        return caseAnswerPayload(answer);
    }

    @Override
    public Map<String, Object> deleteCaseAnswer(Long userId, Long caseId, Long answerId) {
        QaCaseHelpAnswer answer = requireOwnedCaseAnswer(userId, answerId);
        if (!Objects.equals(answer.getCaseId(), caseId)) {
            throw new IllegalArgumentException("答疑不存在");
        }
        if (STATUS_ACCEPTED.equals(answer.getStatus())) {
            throw new IllegalArgumentException("已采纳的答疑不能删除");
        }
        fileRecycleService.recycleQaAnswer(answer, userId);
        return Map.of("message", "答疑已移入回收站");
    }

    @Override
    @Transactional
    public Map<String, Object> acceptCaseAnswer(Long userId, Long caseId, Long answerId, QaCaseAcceptRequest request) {
        QaCaseHelp qaCase = requireOwnedCase(userId, caseId);
        if (STATUS_ACCEPTED.equals(qaCase.getStatus())) {
            throw new IllegalArgumentException("该求助已采纳答疑");
        }
        if (STATUS_CLOSED.equals(qaCase.getStatus())) {
            throw new IllegalArgumentException("已关闭的求助不能采纳");
        }
        QaCaseHelpAnswer answer = requireCaseAnswer(answerId);
        if (!Objects.equals(answer.getCaseId(), caseId) || isDeletedAnswer(answer) || STATUS_REJECTED.equals(answer.getStatus())) {
            throw new IllegalArgumentException("答疑不存在");
        }
        int rewardPoints = Math.max(0, request == null || request.getRewardPoints() == null ? 0 : request.getRewardPoints());
        if (rewardPoints > 0) {
            transferRewardPoints(userId, answer.getUserId(), rewardPoints, qaCase, answer);
        }

        LocalDateTime acceptedAt = LocalDateTime.now();
        answer.setStatus(STATUS_ACCEPTED);
        answer.setRewardPoints(safeInt(answer.getRewardPoints()) + rewardPoints);
        answer.setAcceptedAt(acceptedAt);
        caseHelpAnswerMapper.updateById(answer);

        qaCase.setStatus(STATUS_ACCEPTED);
        qaCase.setAcceptedAnswerId(answerId);
        qaCase.setAcceptedAt(acceptedAt);
        caseHelpMapper.updateById(qaCase);

        notificationService.createNotification(
                answer.getUserId(),
                "qa_answer_accepted",
                "你的答疑「" + defaultText(qaCase.getTitle(), "案例求助") + "」已被采纳" + (rewardPoints > 0 ? "，获得 " + rewardPoints + " 积分" : ""),
                qaCase.getId()
        );
        return caseAnswerPayload(answer);
    }

    @Override
    @Transactional
    public Map<String, Object> voteCaseAnswer(Long userId, Long caseId, Long answerId, QaCaseVoteRequest request) {
        QaCaseHelpAnswer answer = requireCaseAnswer(answerId);
        if (!Objects.equals(answer.getCaseId(), caseId) || isDeletedAnswer(answer) || STATUS_REJECTED.equals(answer.getStatus())) {
            throw new IllegalArgumentException("答疑不存在");
        }
        String voteType = normalizeVoteType(request == null ? null : request.getVoteType());
        QaCaseHelpAnswerVote existing = caseHelpAnswerVoteMapper.selectOne(new QueryWrapper<QaCaseHelpAnswerVote>()
                .eq("answer_id", answerId)
                .eq("user_id", userId));
        if (existing == null) {
            existing = new QaCaseHelpAnswerVote();
            existing.setAnswerId(answerId);
            existing.setUserId(userId);
            existing.setVoteType(voteType);
            caseHelpAnswerVoteMapper.insert(existing);
        } else {
            existing.setVoteType(voteType);
            caseHelpAnswerVoteMapper.updateById(existing);
        }
        refreshAnswerVoteCounts(answerId);
        return caseAnswerPayload(requireCaseAnswer(answerId));
    }

    @Override
    public Map<String, Object> createCaseFeedback(Long userId, Long caseId, QaCaseFeedbackRequest request) {
        QaCaseHelp qaCase = requireCase(caseId);
        ensureCaseVisible(qaCase);
        String reason = normalizeFeedbackReason(request == null ? null : request.getReason());
        String detail = trimToNull(request == null ? null : request.getDetail());
        if ("other".equals(reason) && detail == null) {
            throw new IllegalArgumentException("请选择其它时需填写说明");
        }
        if (detail != null && detail.length() > 30) {
            throw new IllegalArgumentException("反馈说明最多30字");
        }
        QaCaseHelpFeedback feedback = new QaCaseHelpFeedback();
        feedback.setCaseId(caseId);
        feedback.setUserId(userId);
        feedback.setReason(reason);
        feedback.setDetail(detail);
        feedback.setStatus(STATUS_ACTIVE);
        caseHelpFeedbackMapper.insert(feedback);
        return feedbackPayload(feedback);
    }

    @Override
    public Map<String, Object> listCaseAnswers(Long userId, Long caseId) {
        ensureCaseVisible(requireCase(caseId));
        return Map.of("answers", loadCaseAnswers(caseId));
    }

    private void ensureNewCaseAnswerAllowed(Long userId, Long caseId) {
        // Keep QA file creation bounded before Excel parsing or snapshot materialization starts.
        if (countActiveCaseAnswers(caseId, userId) > 0) {
            throw new IllegalArgumentException("你已提交过答疑，请编辑原答疑");
        }
        if (countActiveCaseAnswers(caseId, null) >= MAX_ACTIVE_ANSWERS_PER_CASE) {
            throw new IllegalArgumentException("当前求助答疑数量已达上限");
        }
    }

    private long countActiveCaseAnswers(Long caseId, Long userId) {
        QueryWrapper<QaCaseHelpAnswer> wrapper = new QueryWrapper<QaCaseHelpAnswer>()
                .eq("case_id", caseId)
                .isNull("deleted_at")
                .ne("status", STATUS_DELETED)
                .ne("status", STATUS_REJECTED);
        if (userId != null) {
            wrapper.eq("user_id", userId);
        }
        Long count = caseHelpAnswerMapper.selectCount(wrapper);
        return count == null ? 0L : count;
    }

    @Override
    public Map<String, Object> getMyQa(Long userId, Integer page, Integer size) {
        int safePage = safePage(page);
        int safeSize = safeSize(size);
        Page<QaCaseHelp> myCases = caseHelpMapper.selectPage(
                new Page<>(safePage, safeSize),
                new QueryWrapper<QaCaseHelp>().eq("user_id", userId).isNull("deleted_at").ne("status", STATUS_DELETED).orderByDesc("create_time")
        );
        Page<QaCaseHelpAnswer> myAnswers = caseHelpAnswerMapper.selectPage(
                new Page<>(safePage, safeSize),
                new QueryWrapper<QaCaseHelpAnswer>().eq("user_id", userId).isNull("deleted_at").ne("status", STATUS_DELETED).orderByDesc("create_time")
        );
        Page<QaSolutionShare> myShares = solutionShareMapper.selectPage(
                new Page<>(safePage, safeSize),
                new QueryWrapper<QaSolutionShare>().eq("user_id", userId).isNull("deleted_at").ne("status", STATUS_DELETED).orderByDesc("create_time")
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

    @Override
    public Map<String, Object> getAdminQaStats() {
        long activeCases = caseHelpMapper.selectCount(new QueryWrapper<QaCaseHelp>().isNull("deleted_at").ne("status", STATUS_DELETED));
        long acceptedCases = caseHelpMapper.selectCount(new QueryWrapper<QaCaseHelp>().isNull("deleted_at").eq("status", STATUS_ACCEPTED));
        long activeAnswers = caseHelpAnswerMapper.selectCount(new QueryWrapper<QaCaseHelpAnswer>().isNull("deleted_at").ne("status", STATUS_DELETED));
        long pendingAnswers = caseHelpAnswerMapper.selectCount(new QueryWrapper<QaCaseHelpAnswer>().isNull("deleted_at").eq("status", STATUS_ACTIVE));
        long activeShares = solutionShareMapper.selectCount(new QueryWrapper<QaSolutionShare>().isNull("deleted_at").ne("status", STATUS_DELETED));
        long featuredShares = solutionShareMapper.selectCount(new QueryWrapper<QaSolutionShare>().isNull("deleted_at").eq("status", STATUS_PUBLISHED));
        long feedbackCount = caseHelpFeedbackMapper.selectCount(new QueryWrapper<QaCaseHelpFeedback>().isNull("deleted_at"));
        long unreadFeedback = caseHelpFeedbackMapper.selectCount(new QueryWrapper<QaCaseHelpFeedback>().isNull("deleted_at").eq("status", STATUS_ACTIVE));
        long pendingCases = caseHelpMapper.selectCount(new QueryWrapper<QaCaseHelp>()
                .isNull("deleted_at")
                .ne("status", STATUS_DELETED)
                .ne("status", STATUS_ACCEPTED)
                .ne("status", STATUS_CLOSED));
        return Map.of(
                "cases", activeCases,
                "pendingCases", pendingCases,
                "answeredCases", acceptedCases,
                "answers", activeAnswers,
                "pendingAnswers", pendingAnswers,
                "solutionShares", activeShares,
                "featuredShares", featuredShares,
                "feedback", feedbackCount,
                "unreadFeedback", unreadFeedback
        );
    }

    @Override
    public Map<String, Object> adminListCases(String status, Integer page, Integer size) {
        QueryWrapper<QaCaseHelp> wrapper = new QueryWrapper<>();
        wrapper.isNull("deleted_at").ne("status", STATUS_DELETED);
        if (StringUtils.hasText(status) && !"all".equalsIgnoreCase(status)) {
            wrapper.eq("status", normalizeCaseStatus(status));
        }
        wrapper.orderByDesc("create_time");
        Page<QaCaseHelp> result = caseHelpMapper.selectPage(new Page<>(safePage(page), safeSize(size)), wrapper);
        Map<Long, Long> answerCounts = loadAnswerCounts(result.getRecords());
        return pagePayload(result, result.getRecords().stream()
                .map(item -> caseListPayload(item, answerCounts.getOrDefault(item.getId(), 0L)))
                .toList());
    }

    @Override
    public Map<String, Object> adminUpdateCase(Long caseId, QaCaseHelpRequest request) {
        QaCaseHelp qaCase = requireCaseForAdmin(caseId);
        if (request == null) {
            throw new IllegalArgumentException("请求参数不能为空");
        }
        qaCase.setTitle(requireText(request.getTitle(), "求助标题不能为空"));
        qaCase.setDescription(requireText(request.getDescription(), "需求描述不能为空"));
        qaCase.setAnswerSheet(trimToNull(request.getAnswerSheet()));
        qaCase.setAnswerRange(trimToNull(request.getAnswerRange()));
        if (request.getIdealAnswerSnapshotJson() != null) {
            qaCase.setIdealAnswerSnapshotJson(trimToNull(request.getIdealAnswerSnapshotJson()));
        }
        if (StringUtils.hasText(request.getStatus())) {
            qaCase.setStatus(normalizeCaseStatus(request.getStatus()));
            if (STATUS_DELETED.equals(qaCase.getStatus()) && qaCase.getDeletedAt() == null) {
                qaCase.setDeletedAt(LocalDateTime.now());
            }
        }
        caseHelpMapper.updateById(qaCase);
        return caseListPayload(qaCase, countCaseAnswers(caseId));
    }

    @Override
    public Map<String, Object> adminAssignCase(Long caseId, Long adminUserId, AdminQaAssignRequest request) {
        QaCaseHelp qaCase = requireCaseForAdmin(caseId);
        ensureCaseVisible(qaCase);
        Long assigneeUserId = request == null ? null : request.getAssigneeUserId();
        if (assigneeUserId == null || assigneeUserId <= 0) {
            throw new IllegalArgumentException("答疑者参数无效");
        }
        qaCase.setAssignedUserId(assigneeUserId);
        qaCase.setAssignedBy(adminUserId);
        qaCase.setAssignedAt(LocalDateTime.now());
        qaCase.setAssignmentNote(trimToNull(request.getNote()));
        caseHelpMapper.updateById(qaCase);
        return caseListPayload(qaCase, countCaseAnswers(caseId));
    }

    @Override
    @Transactional
    public Map<String, Object> adminBatchAssignCases(Long adminUserId, AdminQaBatchAssignRequest request) {
        List<Long> ids = normalizeIds(request == null ? null : request.getIds(), "求助参数不能为空");
        AdminQaAssignRequest assignRequest = new AdminQaAssignRequest();
        assignRequest.setAssigneeUserId(request == null ? null : request.getAssigneeUserId());
        assignRequest.setNote(request == null ? null : request.getNote());
        return batchResult(ids, id -> adminAssignCase(id, adminUserId, assignRequest));
    }

    @Override
    public Map<String, Object> adminDeleteCase(Long caseId, Long deletedBy) {
        fileRecycleService.recycleQaCase(requireCaseForAdmin(caseId), deletedBy);
        return Map.of("message", "求助已移入回收站");
    }

    @Override
    public Map<String, Object> adminListCaseAnswers(Long caseId, Integer page, Integer size) {
        QueryWrapper<QaCaseHelpAnswer> wrapper = new QueryWrapper<>();
        if (caseId != null && caseId > 0) {
            wrapper.eq("case_id", caseId);
        }
        wrapper.isNull("deleted_at").ne("status", STATUS_DELETED);
        wrapper.orderByDesc("create_time");
        Page<QaCaseHelpAnswer> result = caseHelpAnswerMapper.selectPage(new Page<>(safePage(page), safeSize(size)), wrapper);
        return pagePayload(result, result.getRecords().stream().map(this::caseAnswerPayload).toList());
    }

    @Override
    public Map<String, Object> adminReviewCaseAnswer(Long answerId, Long reviewerId, AdminQaReviewRequest request) {
        QaCaseHelpAnswer answer = requireCaseAnswerForAdmin(answerId);
        if (isDeletedAnswer(answer)) {
            throw new IllegalArgumentException("答疑不存在");
        }
        String action = normalizeReviewAction(request == null ? null : request.getAction());
        LocalDateTime now = LocalDateTime.now();
        if ("approve".equals(action)) {
            answer.setStatus(STATUS_APPROVED);
            answer.setPublishedAt(now);
        } else {
            answer.setStatus(STATUS_REJECTED);
            answer.setPublishedAt(null);
        }
        answer.setReviewerId(reviewerId);
        answer.setReviewNote(trimToNull(request == null ? null : request.getNote()));
        answer.setReviewedAt(now);
        caseHelpAnswerMapper.updateById(answer);
        return caseAnswerPayload(answer);
    }

    @Override
    @Transactional
    public Map<String, Object> adminBatchReviewCaseAnswers(Long reviewerId, AdminQaBatchReviewRequest request) {
        List<Long> ids = normalizeIds(request == null ? null : request.getIds(), "答疑参数不能为空");
        AdminQaReviewRequest reviewRequest = new AdminQaReviewRequest();
        reviewRequest.setAction(request == null ? null : request.getAction());
        reviewRequest.setNote(request == null ? null : request.getNote());
        return batchResult(ids, id -> adminReviewCaseAnswer(id, reviewerId, reviewRequest));
    }

    @Override
    public Map<String, Object> adminDeleteCaseAnswer(Long answerId, Long deletedBy) {
        fileRecycleService.recycleQaAnswer(requireCaseAnswerForAdmin(answerId), deletedBy);
        return Map.of("message", "答疑已移入回收站");
    }

    @Override
    public Map<String, Object> adminListSolutionShares(String status, Integer page, Integer size) {
        QueryWrapper<QaSolutionShare> wrapper = new QueryWrapper<>();
        if (StringUtils.hasText(status) && !"all".equalsIgnoreCase(status)) {
            wrapper.eq("status", normalizeShareStatus(status, STATUS_PUBLISHED));
        }
        wrapper.orderByDesc("create_time");
        Page<QaSolutionShare> result = solutionShareMapper.selectPage(new Page<>(safePage(page), safeSize(size)), wrapper);
        return pagePayload(result, result.getRecords().stream().map(this::solutionListPayload).toList());
    }

    @Override
    public Map<String, Object> adminUpdateSolutionShare(Long shareId, QaSolutionShareUpdateRequest request) {
        QaSolutionShare share = requireSolutionShareForAdmin(shareId);
        if (request == null) {
            throw new IllegalArgumentException("请求参数不能为空");
        }
        if (StringUtils.hasText(request.getTitle())) {
            share.setTitle(request.getTitle().trim());
        }
        share.setThoughtText(trimToNull(request.getThoughtText()));
        share.setThoughtSource(resolveThoughtSource(request.getThoughtSource(), share.getThoughtText()));
        share.setStatus(normalizeShareStatus(request.getStatus(), STATUS_PUBLISHED));
        if (STATUS_DELETED.equals(share.getStatus()) && share.getDeletedAt() == null) {
            share.setDeletedAt(LocalDateTime.now());
        }
        solutionShareMapper.updateById(share);
        return solutionListPayload(share);
    }

    @Override
    public Map<String, Object> adminDeleteSolutionShare(Long shareId) {
        softDeleteSolutionShare(requireSolutionShareForAdmin(shareId));
        return Map.of("message", "解题分享已下架");
    }

    @Override
    public Map<String, Object> adminCreateFeaturedShare(Long adminUserId, AdminQaFeaturedShareRequest request) {
        Long caseId = request == null ? null : request.getCaseId();
        QaCaseHelp qaCase = requireCaseForAdmin(caseId);
        ensureCaseVisible(qaCase);
        QaCaseHelpAnswer answer = null;
        if (request.getAnswerId() != null) {
            answer = requireCaseAnswerForAdmin(request.getAnswerId());
            if (!Objects.equals(answer.getCaseId(), qaCase.getId()) || isDeletedAnswer(answer) || STATUS_REJECTED.equals(answer.getStatus())) {
                throw new IllegalArgumentException("答疑不存在");
            }
        }

        QaSolutionShare share = findQaFeaturedShare(qaCase.getId(), answer == null ? null : answer.getId());
        if (share == null) {
            share = new QaSolutionShare();
            share.setUserId(answer == null ? qaCase.getUserId() : answer.getUserId());
            share.setViewCount(0);
        }
        share.setSourceType(SOURCE_QA_CASE);
        share.setRecordId(null);
        share.setAnswerId(null);
        share.setQuestionId(null);
        share.setQaCaseId(qaCase.getId());
        share.setQaAnswerId(answer == null ? null : answer.getId());
        share.setTitle(defaultText(request.getTitle(), qaCase.getTitle()));
        share.setThoughtText(defaultText(request.getThoughtText(), qaCase.getDescription()));
        share.setThoughtSource(resolveThoughtSource("manual", share.getThoughtText()));
        share.setStatus(STATUS_PUBLISHED);
        share.setDeletedAt(null);

        if (share.getId() == null) {
            solutionShareMapper.insert(share);
        } else {
            solutionShareMapper.updateById(share);
        }
        return solutionListPayload(share);
    }

    @Override
    public Map<String, Object> adminListFeedback(Long caseId, Integer page, Integer size) {
        QueryWrapper<QaCaseHelpFeedback> wrapper = new QueryWrapper<>();
        if (caseId != null && caseId > 0) {
            wrapper.eq("case_id", caseId);
        }
        wrapper.isNull("deleted_at");
        wrapper.orderByDesc("create_time");
        Page<QaCaseHelpFeedback> result = caseHelpFeedbackMapper.selectPage(new Page<>(safePage(page), safeSize(size)), wrapper);
        return pagePayload(result, result.getRecords().stream().map(this::feedbackPayload).toList());
    }

    @Override
    public Map<String, Object> adminHandleFeedback(Long feedbackId, Long adminUserId, AdminQaFeedbackHandleRequest request) {
        QaCaseHelpFeedback feedback = requireFeedbackForAdmin(feedbackId);
        String status = normalizeFeedbackHandleStatus(request == null ? null : request.getStatus());
        feedback.setStatus(status);
        feedback.setHandledBy(adminUserId);
        feedback.setHandledAt(LocalDateTime.now());
        feedback.setHandleNote(trimToNull(request == null ? null : request.getNote()));
        caseHelpFeedbackMapper.updateById(feedback);
        return feedbackPayload(feedback);
    }

    private Map<String, Object> batchResult(List<Long> ids, java.util.function.Function<Long, Map<String, Object>> action) {
        int successCount = 0;
        List<Long> failedIds = new java.util.ArrayList<>();
        for (Long id : ids) {
            try {
                action.apply(id);
                successCount++;
            } catch (RuntimeException error) {
                failedIds.add(id);
            }
        }
        return Map.of(
                "successCount", successCount,
                "failedCount", failedIds.size(),
                "failedIds", failedIds
        );
    }

    private List<Long> normalizeIds(List<Long> ids, String message) {
        if (ids == null || ids.isEmpty()) {
            throw new IllegalArgumentException(message);
        }
        List<Long> normalized = ids.stream()
                .filter(Objects::nonNull)
                .filter(id -> id > 0)
                .distinct()
                .toList();
        if (normalized.isEmpty()) {
            throw new IllegalArgumentException(message);
        }
        if (normalized.size() > MAX_BATCH_IDS) {
            throw new IllegalArgumentException("批量操作最多支持 100 条");
        }
        return normalized;
    }

    private String normalizeReviewAction(String action) {
        String normalized = action == null ? "approve" : action.trim().toLowerCase();
        if ("pass".equals(normalized) || "publish".equals(normalized)) {
            normalized = "approve";
        }
        if (!"approve".equals(normalized) && !"reject".equals(normalized)) {
            throw new IllegalArgumentException("审核动作无效");
        }
        return normalized;
    }

    private String normalizeFeedbackHandleStatus(String status) {
        String normalized = status == null ? STATUS_HANDLED : status.trim().toLowerCase();
        if (!STATUS_HANDLED.equals(normalized) && !STATUS_IGNORED.equals(normalized)) {
            throw new IllegalArgumentException("反馈处理状态无效");
        }
        return normalized;
    }

    private QaCaseHelpFeedback requireFeedbackForAdmin(Long feedbackId) {
        if (feedbackId == null || feedbackId <= 0) {
            throw new IllegalArgumentException("反馈参数无效");
        }
        QaCaseHelpFeedback feedback = caseHelpFeedbackMapper.selectById(feedbackId);
        if (feedback == null || feedback.getDeletedAt() != null) {
            throw new IllegalArgumentException("反馈不存在");
        }
        return feedback;
    }

    private QaSolutionShare findQaFeaturedShare(Long caseId, Long answerId) {
        QueryWrapper<QaSolutionShare> wrapper = new QueryWrapper<QaSolutionShare>()
                .eq("source_type", SOURCE_QA_CASE)
                .eq("qa_case_id", caseId);
        if (answerId == null) {
            wrapper.isNull("qa_answer_id");
        } else {
            wrapper.eq("qa_answer_id", answerId);
        }
        return solutionShareMapper.selectOne(wrapper);
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

    private QaCaseHelp requireOwnedCase(Long userId, Long caseId) {
        QaCaseHelp qaCase = requireCase(caseId);
        ensureCaseVisible(qaCase);
        if (!Objects.equals(qaCase.getUserId(), userId)) {
            throw new IllegalArgumentException("只能操作自己的求助");
        }
        return qaCase;
    }

    private QaCaseHelpAnswer requireOwnedCaseAnswer(Long userId, Long answerId) {
        QaCaseHelpAnswer answer = requireCaseAnswer(answerId);
        if (isDeletedAnswer(answer)) {
            throw new IllegalArgumentException("答疑不存在");
        }
        if (!Objects.equals(answer.getUserId(), userId)) {
            throw new IllegalArgumentException("只能操作自己的答疑");
        }
        return answer;
    }

    private QaSolutionShare requireOwnedSolutionShare(Long userId, Long shareId) {
        QaSolutionShare share = requireSolutionShare(shareId);
        if (share.getDeletedAt() != null || STATUS_DELETED.equals(share.getStatus())) {
            throw new IllegalArgumentException("分享不存在");
        }
        if (!Objects.equals(share.getUserId(), userId)) {
            throw new IllegalArgumentException("只能操作自己的解题分享");
        }
        return share;
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

    private QaSolutionShare requireSolutionShareForAdmin(Long shareId) {
        return requireSolutionShare(shareId);
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

    private QaCaseHelp requireCaseForAdmin(Long caseId) {
        return requireCase(caseId);
    }

    private QaCaseHelpAnswer requireCaseAnswer(Long answerId) {
        if (answerId == null || answerId <= 0) {
            throw new IllegalArgumentException("答疑参数无效");
        }
        QaCaseHelpAnswer answer = caseHelpAnswerMapper.selectById(answerId);
        if (answer == null) {
            throw new IllegalArgumentException("答疑不存在");
        }
        return answer;
    }

    private QaCaseHelpAnswer requireCaseAnswerForAdmin(Long answerId) {
        return requireCaseAnswer(answerId);
    }

    private QaCaseHelpAnswer requireVisibleCaseAnswer(Long caseId, Long answerId) {
        QaCaseHelpAnswer answer = caseHelpAnswerMapper.selectById(answerId);
        if (answer == null
                || !Objects.equals(answer.getCaseId(), caseId)
                || isDeletedAnswer(answer)
                || STATUS_REJECTED.equals(answer.getStatus())) {
            throw new IllegalArgumentException("答疑不存在");
        }
        return answer;
    }

    private void ensureCaseVisible(QaCaseHelp qaCase) {
        if (qaCase.getDeletedAt() != null || STATUS_DELETED.equals(qaCase.getStatus())) {
            throw new IllegalArgumentException("求助不存在");
        }
    }

    private void ensureCaseCanReceiveAnswer(QaCaseHelp qaCase) {
        ensureCaseVisible(qaCase);
        if (STATUS_CLOSED.equals(qaCase.getStatus())) {
            throw new IllegalArgumentException("求助已关闭");
        }
        if (STATUS_ACCEPTED.equals(qaCase.getStatus())) {
            throw new IllegalArgumentException("求助已采纳答疑");
        }
    }

    private boolean isDeletedAnswer(QaCaseHelpAnswer answer) {
        return answer == null || answer.getDeletedAt() != null || STATUS_DELETED.equals(answer.getStatus());
    }

    private void softDeleteCase(QaCaseHelp qaCase) {
        qaCase.setStatus(STATUS_DELETED);
        qaCase.setDeletedAt(LocalDateTime.now());
        caseHelpMapper.updateById(qaCase);
    }

    private void softDeleteCaseAnswer(QaCaseHelpAnswer answer) {
        answer.setStatus(STATUS_DELETED);
        answer.setDeletedAt(LocalDateTime.now());
        caseHelpAnswerMapper.updateById(answer);
    }

    private void softDeleteSolutionShare(QaSolutionShare share) {
        share.setStatus(STATUS_DELETED);
        share.setDeletedAt(LocalDateTime.now());
        solutionShareMapper.updateById(share);
    }

    private void transferRewardPoints(Long ownerId, Long answererId, int rewardPoints, QaCaseHelp qaCase, QaCaseHelpAnswer answer) {
        if (Objects.equals(ownerId, answererId)) {
            throw new IllegalArgumentException("不能悬赏给自己");
        }
        int deducted = userMapper.deductPoints(ownerId, rewardPoints);
        if (deducted <= 0) {
            throw new IllegalArgumentException("积分余额不足");
        }
        userMapper.addPoints(answererId, rewardPoints);
        savePointsRecord(ownerId, -rewardPoints, "答疑悬赏支出", "采纳「" + defaultText(qaCase.getTitle(), "案例求助") + "」答疑 #" + answer.getId());
        savePointsRecord(answererId, rewardPoints, "答疑悬赏收入", "答疑被采纳：" + defaultText(qaCase.getTitle(), "案例求助"));
    }

    private void savePointsRecord(Long userId, int change, String ruleName, String description) {
        User user = userService.getById(userId);
        PointsRecord record = new PointsRecord();
        record.setUserId(userId);
        record.setRuleName(ruleName);
        record.setChange(change);
        record.setBalance(user == null || user.getPoints() == null ? 0 : user.getPoints());
        record.setDescription(description);
        pointsRecordService.save(record);
    }

    private void refreshAnswerVoteCounts(Long answerId) {
        long up = caseHelpAnswerVoteMapper.selectCount(new QueryWrapper<QaCaseHelpAnswerVote>()
                .eq("answer_id", answerId)
                .eq("vote_type", "up"));
        long down = caseHelpAnswerVoteMapper.selectCount(new QueryWrapper<QaCaseHelpAnswerVote>()
                .eq("answer_id", answerId)
                .eq("vote_type", "down"));
        QaCaseHelpAnswer update = new QaCaseHelpAnswer();
        update.setId(answerId);
        update.setUpVoteCount((int) up);
        update.setDownVoteCount((int) down);
        caseHelpAnswerMapper.updateById(update);
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
                new QueryWrapper<QaCaseHelpAnswer>()
                        .eq("case_id", caseId)
                        .isNull("deleted_at")
                        .ne("status", STATUS_DELETED)
                        .ne("status", STATUS_REJECTED)
                        .orderByDesc("create_time")
        ).stream().map(this::caseAnswerPayload).toList();
    }

    private Map<String, Object> solutionListPayload(QaSolutionShare share) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("id", share.getId());
        payload.put("userId", share.getUserId());
        payload.put("sourceType", defaultText(share.getSourceType(), SOURCE_PRACTICE));
        payload.put("answerId", share.getAnswerId());
        payload.put("questionId", share.getQuestionId());
        payload.put("qaCaseId", share.getQaCaseId());
        payload.put("qaAnswerId", share.getQaAnswerId());
        payload.put("title", share.getTitle());
        payload.put("thoughtText", share.getThoughtText());
        payload.put("thoughtSource", share.getThoughtSource());
        payload.put("status", share.getStatus());
        payload.put("viewCount", safeInt(share.getViewCount()));
        payload.put("createTime", share.getCreateTime());
        payload.put("updateTime", share.getUpdateTime());
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
        payload.put("acceptedAnswerId", qaCase.getAcceptedAnswerId());
        payload.put("acceptedAt", qaCase.getAcceptedAt());
        payload.put("assignedUserId", qaCase.getAssignedUserId());
        payload.put("assignedBy", qaCase.getAssignedBy());
        payload.put("assignedAt", qaCase.getAssignedAt());
        payload.put("assignmentNote", qaCase.getAssignmentNote());
        payload.put("answerSheet", qaCase.getAnswerSheet());
        payload.put("answerRange", qaCase.getAnswerRange());
        payload.put("viewCount", safeInt(qaCase.getViewCount()));
        payload.put("answerCount", answerCount);
        payload.put("createTime", qaCase.getCreateTime());
        payload.put("updateTime", qaCase.getUpdateTime());
        payload.put("author", userPayload(qaCase.getUserId()));
        return payload;
    }

    private Map<String, Object> caseAnswerPayload(QaCaseHelpAnswer answer) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("id", answer.getId());
        payload.put("caseId", answer.getCaseId());
        payload.put("userId", answer.getUserId());
        payload.put("answerFileUrl", answer.getAnswerFileUrl());
        payload.put("status", answer.getStatus());
        payload.put("upVoteCount", safeInt(answer.getUpVoteCount()));
        payload.put("downVoteCount", safeInt(answer.getDownVoteCount()));
        payload.put("rewardPoints", safeInt(answer.getRewardPoints()));
        payload.put("acceptedAt", answer.getAcceptedAt());
        payload.put("reviewerId", answer.getReviewerId());
        payload.put("reviewNote", answer.getReviewNote());
        payload.put("reviewedAt", answer.getReviewedAt());
        payload.put("publishedAt", answer.getPublishedAt());
        payload.put("createTime", answer.getCreateTime());
        payload.put("updateTime", answer.getUpdateTime());
        payload.put("author", userPayload(answer.getUserId()));
        return payload;
    }

    private Map<String, Object> feedbackPayload(QaCaseHelpFeedback feedback) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("id", feedback.getId());
        payload.put("caseId", feedback.getCaseId());
        payload.put("userId", feedback.getUserId());
        payload.put("reason", feedback.getReason());
        payload.put("detail", feedback.getDetail());
        payload.put("status", feedback.getStatus());
        payload.put("handledBy", feedback.getHandledBy());
        payload.put("handledAt", feedback.getHandledAt());
        payload.put("handleNote", feedback.getHandleNote());
        payload.put("createTime", feedback.getCreateTime());
        payload.put("author", userPayload(feedback.getUserId()));
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
        Long count = caseHelpAnswerMapper.selectCount(new QueryWrapper<QaCaseHelpAnswer>()
                .eq("case_id", caseId)
                .isNull("deleted_at")
                .ne("status", STATUS_DELETED)
                .ne("status", STATUS_REJECTED));
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

    private String normalizeShareStatus(String status, String fallback) {
        String normalized = status == null ? fallback : status.trim().toLowerCase();
        if (!SHARE_STATUSES.contains(normalized)) {
            throw new IllegalArgumentException("分享状态无效");
        }
        return normalized;
    }

    private String normalizeVoteType(String voteType) {
        String normalized = voteType == null ? "" : voteType.trim().toLowerCase();
        if ("like".equals(normalized)) {
            normalized = "up";
        } else if ("dislike".equals(normalized)) {
            normalized = "down";
        }
        if (!"up".equals(normalized) && !"down".equals(normalized)) {
            throw new IllegalArgumentException("评价类型无效");
        }
        return normalized;
    }

    private String normalizeFeedbackReason(String reason) {
        String normalized = reason == null ? "" : reason.trim().toLowerCase();
        if (!FEEDBACK_REASONS.contains(normalized)) {
            throw new IllegalArgumentException("反馈原因无效");
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
