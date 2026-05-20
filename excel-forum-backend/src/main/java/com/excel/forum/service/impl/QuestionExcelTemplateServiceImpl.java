package com.excel.forum.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.excel.forum.entity.QuestionExcelTemplate;
import com.excel.forum.mapper.QuestionExcelTemplateMapper;
import com.excel.forum.service.QuestionExcelTemplateService;
import org.springframework.stereotype.Service;

import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

@Service
public class QuestionExcelTemplateServiceImpl extends ServiceImpl<QuestionExcelTemplateMapper, QuestionExcelTemplate> implements QuestionExcelTemplateService {
    @Override
    public QuestionExcelTemplate getByQuestionId(Long questionId) {
        if (questionId == null) {
            return null;
        }
        return getOne(new QueryWrapper<QuestionExcelTemplate>().eq("question_id", questionId).isNull("deleted_at"), false);
    }

    @Override
    public Map<Long, QuestionExcelTemplate> mapByQuestionIds(List<Long> questionIds) {
        if (questionIds == null || questionIds.isEmpty()) {
            return Collections.emptyMap();
        }
        return list(new QueryWrapper<QuestionExcelTemplate>().in("question_id", questionIds).isNull("deleted_at")).stream()
                .filter(item -> item.getQuestionId() != null)
                .collect(Collectors.toMap(QuestionExcelTemplate::getQuestionId, item -> item, (left, right) -> Objects.requireNonNullElse(right, left)));
    }

    @Override
    public void removeByQuestionId(Long questionId) {
        if (questionId == null) {
            return;
        }
        remove(new QueryWrapper<QuestionExcelTemplate>().eq("question_id", questionId));
    }
}
