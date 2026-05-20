package com.excel.forum.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.UpdateWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.excel.forum.entity.FileRecycleItem;
import com.excel.forum.entity.QaCaseHelp;
import com.excel.forum.entity.QaCaseHelpAnswer;
import com.excel.forum.entity.Question;
import com.excel.forum.entity.QuestionExcelTemplate;
import com.excel.forum.entity.TemplateCenterItem;
import com.excel.forum.mapper.FileRecycleItemMapper;
import com.excel.forum.mapper.QaCaseHelpAnswerMapper;
import com.excel.forum.mapper.QaCaseHelpMapper;
import com.excel.forum.mapper.QuestionExcelTemplateMapper;
import com.excel.forum.mapper.QuestionMapper;
import com.excel.forum.mapper.TemplateCenterItemMapper;
import com.excel.forum.service.FileRecycleService;
import com.excel.forum.service.FileStorageService;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

@Service
@RequiredArgsConstructor
public class FileRecycleServiceImpl implements FileRecycleService {
    private static final int RETENTION_DAYS = 90;
    private static final String STATUS_ACTIVE = "active";
    private static final String STATUS_RESTORED = "restored";
    private static final String STATUS_PURGED = "purged";
    private static final String RESOURCE_QUESTION = "question";
    private static final String RESOURCE_TEMPLATE = "template";
    private static final String RESOURCE_QA_CASE = "qa_case";
    private static final String RESOURCE_QA_ANSWER = "qa_answer";
    private static final String DELETED_STATUS = "deleted";

    private final FileRecycleItemMapper fileRecycleItemMapper;
    private final QuestionMapper questionMapper;
    private final QuestionExcelTemplateMapper questionExcelTemplateMapper;
    private final TemplateCenterItemMapper templateCenterItemMapper;
    private final QaCaseHelpMapper qaCaseHelpMapper;
    private final QaCaseHelpAnswerMapper qaCaseHelpAnswerMapper;
    private final FileStorageService fileStorageService;
    private final ObjectMapper objectMapper;

    @Override
    @Transactional
    public FileRecycleItem recycleQuestion(Question question, QuestionExcelTemplate template, Long deletedBy) {
        if (question == null || question.getId() == null) {
            throw new IllegalArgumentException("题目不存在");
        }
        LocalDateTime now = LocalDateTime.now();
        List<RecycleFile> files = moveFiles(RESOURCE_QUESTION, question.getId(), List.of(
                new RecycleFile("questionTemplate", template == null ? null : template.getTemplateFileUrl(), null),
                new RecycleFile("idealAnswerImage", template == null ? null : template.getIdealAnswerImageUrl(), null)
        ));
        FileRecycleItem item = createRecycleItem(
                RESOURCE_QUESTION,
                question.getId(),
                question.getTitle(),
                files,
                questionSnapshot(question, template),
                deletedBy,
                now
        );

        question.setDeletedAt(now);
        question.setDeletedBy(deletedBy);
        questionMapper.updateById(question);
        if (template != null && template.getId() != null) {
            template.setDeletedAt(now);
            template.setDeletedBy(deletedBy);
            questionExcelTemplateMapper.updateById(template);
        }
        return item;
    }

    @Override
    @Transactional
    public FileRecycleItem recycleTemplate(TemplateCenterItem item, Long deletedBy) {
        if (item == null || item.getId() == null) {
            throw new IllegalArgumentException("模板不存在");
        }
        LocalDateTime now = LocalDateTime.now();
        List<RecycleFile> files = moveFiles(RESOURCE_TEMPLATE, item.getId(), List.of(
                new RecycleFile("templateFile", item.getTemplateFileUrl(), null),
                new RecycleFile("previewImage", item.getPreviewImageUrl(), null)
        ));
        FileRecycleItem recycleItem = createRecycleItem(
                RESOURCE_TEMPLATE,
                item.getId(),
                item.getTitle(),
                files,
                Map.of("enabled", Boolean.TRUE.equals(item.getEnabled())),
                deletedBy,
                now
        );
        item.setDeletedAt(now);
        item.setDeletedBy(deletedBy);
        templateCenterItemMapper.updateById(item);
        return recycleItem;
    }

    @Override
    @Transactional
    public FileRecycleItem recycleQaCase(QaCaseHelp qaCase, Long deletedBy) {
        if (qaCase == null || qaCase.getId() == null) {
            throw new IllegalArgumentException("求助不存在");
        }
        LocalDateTime now = LocalDateTime.now();
        List<RecycleFile> files = moveFiles(RESOURCE_QA_CASE, qaCase.getId(), List.of(
                new RecycleFile("qaCaseTemplate", qaCase.getTemplateFileUrl(), null)
        ));
        FileRecycleItem item = createRecycleItem(
                RESOURCE_QA_CASE,
                qaCase.getId(),
                qaCase.getTitle(),
                files,
                Map.of("status", defaultText(qaCase.getStatus(), "open")),
                deletedBy,
                now
        );
        qaCase.setStatus(DELETED_STATUS);
        qaCase.setDeletedAt(now);
        qaCase.setDeletedBy(deletedBy);
        qaCaseHelpMapper.updateById(qaCase);
        return item;
    }

    @Override
    @Transactional
    public FileRecycleItem recycleQaAnswer(QaCaseHelpAnswer answer, Long deletedBy) {
        if (answer == null || answer.getId() == null) {
            throw new IllegalArgumentException("答疑不存在");
        }
        LocalDateTime now = LocalDateTime.now();
        List<RecycleFile> files = moveFiles(RESOURCE_QA_ANSWER, answer.getId(), List.of(
                new RecycleFile("qaAnswerFile", answer.getAnswerFileUrl(), null)
        ));
        FileRecycleItem item = createRecycleItem(
                RESOURCE_QA_ANSWER,
                answer.getId(),
                "答疑模板 #" + answer.getId(),
                files,
                Map.of("status", defaultText(answer.getStatus(), "active")),
                deletedBy,
                now
        );
        answer.setStatus(DELETED_STATUS);
        answer.setDeletedAt(now);
        answer.setDeletedBy(deletedBy);
        qaCaseHelpAnswerMapper.updateById(answer);
        return item;
    }

    @Override
    public Map<String, Object> listItems(String resourceType, String keyword, Boolean expired, Integer page, Integer size) {
        int safePage = page == null || page < 1 ? 1 : page;
        int safeSize = size == null || size < 1 ? 10 : Math.min(size, 100);
        QueryWrapper<FileRecycleItem> wrapper = new QueryWrapper<>();
        wrapper.eq("status", STATUS_ACTIVE);
        if (StringUtils.hasText(resourceType) && !"all".equalsIgnoreCase(resourceType)) {
            wrapper.eq("resource_type", resourceType.trim());
        }
        if (StringUtils.hasText(keyword)) {
            String trimmed = keyword.trim();
            wrapper.and(query -> query.like("display_name", trimmed)
                    .or()
                    .like("original_file_url", trimmed));
        }
        if (expired != null) {
            if (expired) {
                wrapper.le("expires_at", LocalDateTime.now());
            } else {
                wrapper.gt("expires_at", LocalDateTime.now());
            }
        }
        wrapper.orderByDesc("deleted_at");
        Page<FileRecycleItem> result = fileRecycleItemMapper.selectPage(new Page<>(safePage, safeSize), wrapper);
        return Map.of(
                "records", result.getRecords().stream().map(this::toPayload).toList(),
                "total", result.getTotal(),
                "page", result.getCurrent(),
                "size", result.getSize()
        );
    }

    @Override
    @Transactional
    public Map<String, Object> restore(Long id) {
        FileRecycleItem item = requireActiveItem(id);
        List<RecycleFile> restoredFiles = restoreFiles(parseFiles(item.getFilesJson()));
        Map<String, String> restoredByLabel = new LinkedHashMap<>();
        for (RecycleFile file : restoredFiles) {
            restoredByLabel.put(file.label(), file.recycleFileUrl());
        }

        switch (item.getResourceType()) {
            case RESOURCE_QUESTION -> restoreQuestion(item, restoredByLabel);
            case RESOURCE_TEMPLATE -> restoreTemplate(item, restoredByLabel);
            case RESOURCE_QA_CASE -> restoreQaCase(item, restoredByLabel);
            case RESOURCE_QA_ANSWER -> restoreQaAnswer(item, restoredByLabel);
            default -> throw new IllegalArgumentException("不支持的回收站业务类型");
        }

        item.setFilesJson(toJson(restoredFiles));
        item.setStatus(STATUS_RESTORED);
        item.setRestoredAt(LocalDateTime.now());
        fileRecycleItemMapper.updateById(item);
        return Map.of("message", "已恢复", "id", item.getId());
    }

    @Override
    @Transactional
    public void purge(Long id) {
        FileRecycleItem item = requireActiveItem(id);
        for (RecycleFile file : parseFiles(item.getFilesJson())) {
            if (StringUtils.hasText(file.recycleFileUrl())) {
                fileStorageService.deletePermanently(file.recycleFileUrl());
            }
        }
        purgeBusinessRecord(item);
        item.setStatus(STATUS_PURGED);
        item.setPurgedAt(LocalDateTime.now());
        fileRecycleItemMapper.deleteById(item.getId());
    }

    @Override
    @Transactional
    public int purgeBatch(List<Long> ids) {
        if (ids == null || ids.isEmpty()) {
            return 0;
        }
        int count = 0;
        for (Long id : ids.stream().filter(Objects::nonNull).distinct().toList()) {
            purge(id);
            count++;
        }
        return count;
    }

    @Override
    @Transactional
    public int purgeExpired() {
        List<FileRecycleItem> expiredItems = fileRecycleItemMapper.selectList(new QueryWrapper<FileRecycleItem>()
                .eq("status", STATUS_ACTIVE)
                .le("expires_at", LocalDateTime.now()));
        for (FileRecycleItem item : expiredItems) {
            purge(item.getId());
        }
        return expiredItems.size();
    }

    private FileRecycleItem createRecycleItem(
            String resourceType,
            Long resourceId,
            String displayName,
            List<RecycleFile> files,
            Map<String, Object> snapshot,
            Long deletedBy,
            LocalDateTime now
    ) {
        FileRecycleItem item = new FileRecycleItem();
        item.setResourceType(resourceType);
        item.setResourceId(resourceId);
        item.setDisplayName(displayName);
        item.setOriginalFileUrl(files.stream().map(RecycleFile::originalFileUrl).filter(StringUtils::hasText).findFirst().orElse(null));
        item.setRecycleFileUrl(files.stream().map(RecycleFile::recycleFileUrl).filter(StringUtils::hasText).findFirst().orElse(null));
        item.setFilesJson(toJson(files));
        item.setBusinessSnapshotJson(toJson(snapshot));
        item.setDeletedBy(deletedBy);
        item.setDeletedAt(now);
        item.setExpiresAt(now.plusDays(RETENTION_DAYS));
        item.setStatus(STATUS_ACTIVE);
        fileRecycleItemMapper.insert(item);
        return item;
    }

    private List<RecycleFile> moveFiles(String resourceType, Long resourceId, List<RecycleFile> files) {
        List<RecycleFile> result = new ArrayList<>();
        for (RecycleFile file : files) {
            if (!StringUtils.hasText(file.originalFileUrl())) {
                continue;
            }
            String recycleUrl = fileStorageService.moveToRecycle(file.originalFileUrl(), resourceType + "/" + resourceId);
            result.add(new RecycleFile(file.label(), file.originalFileUrl(), recycleUrl));
        }
        return result;
    }

    private Map<String, Object> questionSnapshot(Question question, QuestionExcelTemplate template) {
        Map<String, Object> snapshot = new LinkedHashMap<>();
        snapshot.put("enabled", Boolean.TRUE.equals(question.getEnabled()));
        if (template != null && template.getId() != null) {
            snapshot.put("templateId", template.getId());
        }
        return snapshot;
    }

    private List<RecycleFile> restoreFiles(List<RecycleFile> files) {
        List<RecycleFile> result = new ArrayList<>();
        for (RecycleFile file : files) {
            String restoredUrl = file.recycleFileUrl();
            if (StringUtils.hasText(file.recycleFileUrl())) {
                restoredUrl = fileStorageService.restoreFromRecycle(file.recycleFileUrl(), file.originalFileUrl());
            }
            // 恢复后用 recycleFileUrl 字段承载最终业务文件 URL，避免额外结构。
            result.add(new RecycleFile(file.label(), file.originalFileUrl(), restoredUrl));
        }
        return result;
    }

    private void restoreQuestion(FileRecycleItem item, Map<String, String> restoredFiles) {
        Question question = questionMapper.selectById(item.getResourceId());
        if (question == null) {
            throw new IllegalArgumentException("题目记录不存在");
        }
        question.setDeletedAt(null);
        question.setDeletedBy(null);
        questionMapper.updateById(question);
        questionMapper.update(null, new UpdateWrapper<Question>()
                .set("deleted_at", null)
                .set("deleted_by", null)
                .eq("id", question.getId()));

        QuestionExcelTemplate template = findQuestionTemplate(item);
        if (template != null) {
            template.setDeletedAt(null);
            template.setDeletedBy(null);
            String restoredFile = restoredFiles.get("questionTemplate");
            if (StringUtils.hasText(restoredFile)) {
                template.setTemplateFileUrl(restoredFile);
            }
            String restoredReferenceImage = restoredFiles.get("idealAnswerImage");
            if (StringUtils.hasText(restoredReferenceImage)) {
                template.setIdealAnswerImageUrl(restoredReferenceImage);
            }
            questionExcelTemplateMapper.updateById(template);
            questionExcelTemplateMapper.update(null, new UpdateWrapper<QuestionExcelTemplate>()
                    .set("deleted_at", null)
                    .set("deleted_by", null)
                    .eq("id", template.getId()));
        }
    }

    private void restoreTemplate(FileRecycleItem item, Map<String, String> restoredFiles) {
        TemplateCenterItem template = templateCenterItemMapper.selectById(item.getResourceId());
        if (template == null) {
            throw new IllegalArgumentException("模板记录不存在");
        }
        template.setDeletedAt(null);
        template.setDeletedBy(null);
        if (StringUtils.hasText(restoredFiles.get("templateFile"))) {
            template.setTemplateFileUrl(restoredFiles.get("templateFile"));
        }
        if (StringUtils.hasText(restoredFiles.get("previewImage"))) {
            template.setPreviewImageUrl(restoredFiles.get("previewImage"));
        }
        templateCenterItemMapper.updateById(template);
        templateCenterItemMapper.update(null, new UpdateWrapper<TemplateCenterItem>()
                .set("deleted_at", null)
                .set("deleted_by", null)
                .eq("id", template.getId()));
    }

    private void restoreQaCase(FileRecycleItem item, Map<String, String> restoredFiles) {
        QaCaseHelp qaCase = qaCaseHelpMapper.selectById(item.getResourceId());
        if (qaCase == null) {
            throw new IllegalArgumentException("求助记录不存在");
        }
        qaCase.setStatus(defaultText((String) parseSnapshot(item).get("status"), "open"));
        qaCase.setDeletedAt(null);
        qaCase.setDeletedBy(null);
        if (StringUtils.hasText(restoredFiles.get("qaCaseTemplate"))) {
            qaCase.setTemplateFileUrl(restoredFiles.get("qaCaseTemplate"));
        }
        qaCaseHelpMapper.updateById(qaCase);
        qaCaseHelpMapper.update(null, new UpdateWrapper<QaCaseHelp>()
                .set("deleted_at", null)
                .set("deleted_by", null)
                .eq("id", qaCase.getId()));
    }

    private void restoreQaAnswer(FileRecycleItem item, Map<String, String> restoredFiles) {
        QaCaseHelpAnswer answer = qaCaseHelpAnswerMapper.selectById(item.getResourceId());
        if (answer == null) {
            throw new IllegalArgumentException("答疑记录不存在");
        }
        answer.setStatus(defaultText((String) parseSnapshot(item).get("status"), "active"));
        answer.setDeletedAt(null);
        answer.setDeletedBy(null);
        if (StringUtils.hasText(restoredFiles.get("qaAnswerFile"))) {
            answer.setAnswerFileUrl(restoredFiles.get("qaAnswerFile"));
        }
        qaCaseHelpAnswerMapper.updateById(answer);
        qaCaseHelpAnswerMapper.update(null, new UpdateWrapper<QaCaseHelpAnswer>()
                .set("deleted_at", null)
                .set("deleted_by", null)
                .eq("id", answer.getId()));
    }

    private void purgeBusinessRecord(FileRecycleItem item) {
        switch (item.getResourceType()) {
            case RESOURCE_QUESTION -> {
                questionExcelTemplateMapper.delete(new QueryWrapper<QuestionExcelTemplate>().eq("question_id", item.getResourceId()));
                questionMapper.deleteById(item.getResourceId());
            }
            case RESOURCE_TEMPLATE -> templateCenterItemMapper.deleteById(item.getResourceId());
            case RESOURCE_QA_CASE -> {
                qaCaseHelpAnswerMapper.delete(new QueryWrapper<QaCaseHelpAnswer>().eq("case_id", item.getResourceId()));
                qaCaseHelpMapper.deleteById(item.getResourceId());
            }
            case RESOURCE_QA_ANSWER -> qaCaseHelpAnswerMapper.deleteById(item.getResourceId());
            default -> throw new IllegalArgumentException("不支持的回收站业务类型");
        }
    }

    private QuestionExcelTemplate findQuestionTemplate(FileRecycleItem item) {
        Map<String, Object> snapshot = parseSnapshot(item);
        Object templateId = snapshot.get("templateId");
        if (templateId instanceof Number number) {
            QuestionExcelTemplate template = questionExcelTemplateMapper.selectById(number.longValue());
            if (template != null) {
                return template;
            }
        }
        return questionExcelTemplateMapper.selectList(new QueryWrapper<QuestionExcelTemplate>()
                        .eq("question_id", item.getResourceId()))
                .stream()
                .findFirst()
                .orElse(null);
    }

    private FileRecycleItem requireActiveItem(Long id) {
        if (id == null || id <= 0) {
            throw new IllegalArgumentException("回收站记录无效");
        }
        FileRecycleItem item = fileRecycleItemMapper.selectById(id);
        if (item == null || !STATUS_ACTIVE.equals(item.getStatus())) {
            throw new IllegalArgumentException("回收站记录不存在");
        }
        return item;
    }

    private Map<String, Object> toPayload(FileRecycleItem item) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("id", item.getId());
        payload.put("resourceType", item.getResourceType());
        payload.put("resourceId", item.getResourceId());
        payload.put("displayName", item.getDisplayName());
        payload.put("originalFileUrl", item.getOriginalFileUrl());
        payload.put("recycleFileUrl", item.getRecycleFileUrl());
        payload.put("fileCount", parseFiles(item.getFilesJson()).size());
        payload.put("deletedBy", item.getDeletedBy());
        payload.put("deletedAt", item.getDeletedAt());
        payload.put("expiresAt", item.getExpiresAt());
        payload.put("expired", item.getExpiresAt() != null && !item.getExpiresAt().isAfter(LocalDateTime.now()));
        payload.put("status", item.getStatus());
        return payload;
    }

    private Map<String, Object> parseSnapshot(FileRecycleItem item) {
        if (!StringUtils.hasText(item.getBusinessSnapshotJson())) {
            return Map.of();
        }
        try {
            return objectMapper.readValue(item.getBusinessSnapshotJson(), new TypeReference<Map<String, Object>>() {});
        } catch (Exception parseError) {
            return Map.of();
        }
    }

    private List<RecycleFile> parseFiles(String json) {
        if (!StringUtils.hasText(json)) {
            return List.of();
        }
        try {
            return objectMapper.readValue(json, new TypeReference<List<RecycleFile>>() {});
        } catch (Exception parseError) {
            return List.of();
        }
    }

    private String toJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("回收站元数据保存失败", e);
        }
    }

    private String defaultText(String value, String fallback) {
        return StringUtils.hasText(value) ? value : fallback;
    }

    private record RecycleFile(String label, String originalFileUrl, String recycleFileUrl) {
    }
}
