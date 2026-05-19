package com.excel.forum.service;

import com.excel.forum.entity.dto.PracticeQuestionWorkbookFile;
import com.excel.forum.entity.dto.QaAiDraftRequest;
import com.excel.forum.entity.dto.QaCaseAnswerRequest;
import com.excel.forum.entity.dto.QaCaseHelpRequest;
import com.excel.forum.entity.dto.QaCaseSnapshotAnswerRequest;
import com.excel.forum.entity.dto.QaSolutionShareRequest;

import java.util.Map;

public interface QaService {
    Map<String, Object> listSolutionShares(Long userId, Integer page, Integer size);

    Map<String, Object> getSolutionShareDetail(Long userId, Long shareId);

    Map<String, Object> shareSolution(Long userId, QaSolutionShareRequest request);

    Map<String, Object> generateSolutionThoughtDraft(Long userId, QaAiDraftRequest request);

    Map<String, Object> listCases(Long userId, String status, Integer page, Integer size);

    Map<String, Object> getCaseDetail(Long userId, Long caseId);

    Map<String, Object> createCase(Long userId, QaCaseHelpRequest request);

    PracticeQuestionWorkbookFile buildCaseWorkbookFile(Long userId, Long caseId);

    Map<String, Object> submitCaseAnswer(Long userId, Long caseId, QaCaseAnswerRequest request);

    Map<String, Object> submitCaseAnswerFromSnapshot(Long userId, Long caseId, QaCaseSnapshotAnswerRequest request);

    Map<String, Object> listCaseAnswers(Long userId, Long caseId);

    Map<String, Object> getMyQa(Long userId, Integer page, Integer size);
}
