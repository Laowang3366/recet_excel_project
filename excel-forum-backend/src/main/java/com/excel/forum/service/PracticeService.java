package com.excel.forum.service;

import com.excel.forum.entity.dto.PracticeSubmitRequest;
import com.excel.forum.entity.dto.PracticeQuestionSubmissionRequest;
import com.excel.forum.entity.dto.PracticeQuestionWorkbookFile;

import java.util.Map;

public interface PracticeService {
    Map<String, Object> getPracticeCategories();

    Map<String, Object> getPracticeQuestionList(Long questionCategoryId, Long userId);

    Map<String, Object> getPracticeQuestions(Long questionCategoryId, Integer count, Integer difficulty);

    Map<String, Object> getPracticeQuestionDetail(Long questionId);

    PracticeQuestionWorkbookFile buildPracticeQuestionWorkbookFile(Long questionId);

    Map<String, Object> getPracticeLeaderboard(Long questionCategoryId, Integer limit);

    Map<String, Object> submitPractice(Long userId, PracticeSubmitRequest request);

    Map<String, Object> submitPracticeQuestion(Long userId, PracticeQuestionSubmissionRequest request);

    Map<String, Object> getPracticeSubmissionProgress(Long userId, Integer page, Integer size);

    Map<String, Object> getPracticeHistory(Long userId, Integer page, Integer size);

    Map<String, Object> getPracticeHistoryDetail(Long userId, Long recordId);
}
