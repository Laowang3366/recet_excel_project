package com.excel.forum.service;

import com.excel.forum.entity.FileRecycleItem;
import com.excel.forum.entity.QaCaseHelp;
import com.excel.forum.entity.QaCaseHelpAnswer;
import com.excel.forum.entity.Question;
import com.excel.forum.entity.QuestionExcelTemplate;
import com.excel.forum.entity.TemplateCenterItem;

import java.util.List;
import java.util.Map;

public interface FileRecycleService {
    FileRecycleItem recycleQuestion(Question question, QuestionExcelTemplate template, Long deletedBy);

    FileRecycleItem recycleTemplate(TemplateCenterItem item, Long deletedBy);

    FileRecycleItem recycleQaCase(QaCaseHelp qaCase, Long deletedBy);

    FileRecycleItem recycleQaAnswer(QaCaseHelpAnswer answer, Long deletedBy);

    Map<String, Object> listItems(String resourceType, String keyword, Boolean expired, Integer page, Integer size);

    Map<String, Object> restore(Long id);

    void purge(Long id);

    int purgeBatch(List<Long> ids);

    int purgeExpired();
}
