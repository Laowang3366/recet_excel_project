package com.excel.forum.service;

import com.baomidou.mybatisplus.extension.service.IService;
import com.excel.forum.entity.Question;
import java.util.Map;

public interface QuestionService extends IService<Question> {
    Map<String, Object> getQuestionsPage(
            int page,
            int size,
            String type,
            Long questionCategoryId,
            String keyword,
            Boolean enabled,
            Integer difficulty
    );
}
