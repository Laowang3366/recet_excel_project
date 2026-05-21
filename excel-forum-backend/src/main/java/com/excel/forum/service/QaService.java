package com.excel.forum.service;

import com.excel.forum.entity.dto.PracticeQuestionWorkbookFile;
import com.excel.forum.entity.dto.ExcelWorkbookSnapshot;
import com.excel.forum.entity.dto.QaAiDraftRequest;
import com.excel.forum.entity.dto.QaCaseAcceptRequest;
import com.excel.forum.entity.dto.QaCaseAnswerRequest;
import com.excel.forum.entity.dto.QaCaseFeedbackRequest;
import com.excel.forum.entity.dto.QaCaseHelpRequest;
import com.excel.forum.entity.dto.QaCaseSnapshotAnswerRequest;
import com.excel.forum.entity.dto.QaCaseVoteRequest;
import com.excel.forum.entity.dto.QaSolutionShareRequest;
import com.excel.forum.entity.dto.QaSolutionShareUpdateRequest;

import java.util.Map;

public interface QaService {
    Map<String, Object> listSolutionShares(Long userId, Integer page, Integer size);

    Map<String, Object> getSolutionShareDetail(Long userId, Long shareId);

    Map<String, Object> shareSolution(Long userId, QaSolutionShareRequest request);

    Map<String, Object> updateSolutionShare(Long userId, Long shareId, QaSolutionShareUpdateRequest request);

    Map<String, Object> deleteSolutionShare(Long userId, Long shareId);

    Map<String, Object> generateSolutionThoughtDraft(Long userId, QaAiDraftRequest request);

    Map<String, Object> listCases(Long userId, String status, Integer page, Integer size);

    Map<String, Object> getCaseDetail(Long userId, Long caseId);

    Map<String, Object> createCase(Long userId, QaCaseHelpRequest request);

    Map<String, Object> updateCase(Long userId, Long caseId, QaCaseHelpRequest request);

    Map<String, Object> closeCase(Long userId, Long caseId);

    Map<String, Object> deleteCase(Long userId, Long caseId);

    PracticeQuestionWorkbookFile buildCaseWorkbookFile(Long userId, Long caseId);

    PracticeQuestionWorkbookFile buildCaseAnswerWorkbookFile(Long userId, Long caseId, Long answerId);

    ExcelWorkbookSnapshot loadCaseTemplateSnapshot(Long userId, Long caseId);

    ExcelWorkbookSnapshot loadCaseAnswerSnapshot(Long userId, Long caseId, Long answerId);

    Map<String, Object> submitCaseAnswer(Long userId, Long caseId, QaCaseAnswerRequest request);

    Map<String, Object> submitCaseAnswerFromSnapshot(Long userId, Long caseId, QaCaseSnapshotAnswerRequest request);

    Map<String, Object> updateCaseAnswer(Long userId, Long caseId, Long answerId, QaCaseAnswerRequest request);

    Map<String, Object> updateCaseAnswerFromSnapshot(Long userId, Long caseId, Long answerId, QaCaseSnapshotAnswerRequest request);

    Map<String, Object> deleteCaseAnswer(Long userId, Long caseId, Long answerId);

    Map<String, Object> acceptCaseAnswer(Long userId, Long caseId, Long answerId, QaCaseAcceptRequest request);

    Map<String, Object> voteCaseAnswer(Long userId, Long caseId, Long answerId, QaCaseVoteRequest request);

    Map<String, Object> createCaseFeedback(Long userId, Long caseId, QaCaseFeedbackRequest request);

    Map<String, Object> listCaseAnswers(Long userId, Long caseId);

    Map<String, Object> getMyQa(Long userId, Integer page, Integer size);

    Map<String, Object> getAdminQaStats();

    Map<String, Object> adminListCases(String status, Integer page, Integer size);

    Map<String, Object> adminUpdateCase(Long caseId, QaCaseHelpRequest request);

    Map<String, Object> adminDeleteCase(Long caseId, Long deletedBy);

    Map<String, Object> adminListCaseAnswers(Long caseId, Integer page, Integer size);

    Map<String, Object> adminDeleteCaseAnswer(Long answerId, Long deletedBy);

    Map<String, Object> adminListSolutionShares(String status, Integer page, Integer size);

    Map<String, Object> adminUpdateSolutionShare(Long shareId, QaSolutionShareUpdateRequest request);

    Map<String, Object> adminDeleteSolutionShare(Long shareId);

    Map<String, Object> adminListFeedback(Long caseId, Integer page, Integer size);
}
