package com.excel.forum.service;

import com.excel.forum.entity.dto.PracticeCampaignStartRequest;
import com.excel.forum.entity.dto.PracticeCampaignSubmitRequest;

import java.util.Map;

public interface PracticeCampaignService {
    void syncCampaignCatalog();

    Map<String, Object> getCampaignOverview(Long userId);

    Map<String, Object> getCampaignChapters(Long userId);

    Map<String, Object> getCampaignChapterDetail(Long chapterId, Long userId);

    Map<String, Object> getCampaignLevelDetail(Long levelId, Long userId);

    Map<String, Object> getCampaignWrongQuestions(Long userId);

    Map<String, Object> resolveWrongQuestion(Long userId, Long wrongQuestionId);

    Map<String, Object> getCampaignRankings(String scope);

    Map<String, Object> startCampaignLevel(Long levelId, Long userId, PracticeCampaignStartRequest request);

    Map<String, Object> submitCampaignLevel(Long levelId, Long userId, PracticeCampaignSubmitRequest request);
}
