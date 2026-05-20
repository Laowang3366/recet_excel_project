package com.excel.forum.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.excel.forum.entity.Question;
import com.excel.forum.mapper.QuestionMapper;
import com.excel.forum.service.QuestionService;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.HashMap;
import java.util.Map;

@Service
public class QuestionServiceImpl extends ServiceImpl<QuestionMapper, Question> implements QuestionService {
    
    @Override
    public Map<String, Object> getQuestionsPage(
            int page,
            int size,
            String type,
            Long questionCategoryId,
            String keyword,
            Boolean enabled,
            Integer difficulty
    ) {
        int safePage = Math.max(page, 1);
        int safeSize = Math.min(Math.max(size, 1), 100);
        Page<Question> pageParam = new Page<>(safePage, safeSize);
        QueryWrapper<Question> queryWrapper = new QueryWrapper<>();
        
        if (StringUtils.hasText(type)) {
            queryWrapper.eq("type", type);
        }
        if (questionCategoryId != null) {
            queryWrapper.eq("question_category_id", questionCategoryId);
        }
        if (StringUtils.hasText(keyword)) {
            String trimmedKeyword = keyword.trim();
            queryWrapper.and(wrapper -> {
                wrapper.like("title", trimmedKeyword);
                try {
                    wrapper.or().eq("id", Long.parseLong(trimmedKeyword));
                } catch (NumberFormatException parseError) {
                    // Non-numeric keywords only search title; this avoids fuzzy scans on numeric IDs.
                }
            });
        }
        if (enabled != null) {
            queryWrapper.eq("enabled", enabled);
        }
        if (difficulty != null) {
            queryWrapper.eq("difficulty", difficulty);
        }
        
        queryWrapper.orderByDesc("create_time");
        Page<Question> result = page(pageParam, queryWrapper);
        
        Map<String, Object> response = new HashMap<>();
        response.put("questions", result.getRecords());
        response.put("total", result.getTotal());
        return response;
    }
}
