package com.excel.forum.controller;

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
import com.excel.forum.service.QaService;
import com.excel.forum.service.RateLimitResult;
import com.excel.forum.service.RateLimitService;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Map;

@RestController
@RequestMapping("/api/qa")
@RequiredArgsConstructor
public class QaController {
    private final QaService qaService;
    private final RateLimitService rateLimitService;

    @GetMapping("/solution-shares")
    public ResponseEntity<?> listSolutionShares(
            @RequestAttribute Long userId,
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "10") Integer size) {
        return ResponseEntity.ok(qaService.listSolutionShares(userId, page, size));
    }

    @GetMapping("/solution-shares/{id}")
    public ResponseEntity<?> getSolutionShareDetail(@RequestAttribute Long userId, @PathVariable Long id) {
        return ResponseEntity.ok(qaService.getSolutionShareDetail(userId, id));
    }

    @PostMapping("/solution-shares")
    public ResponseEntity<?> shareSolution(
            @RequestAttribute Long userId,
            @RequestBody QaSolutionShareRequest request) {
        return ResponseEntity.ok(qaService.shareSolution(userId, request));
    }

    @PutMapping("/solution-shares/{id}")
    public ResponseEntity<?> updateSolutionShare(
            @RequestAttribute Long userId,
            @PathVariable Long id,
            @RequestBody QaSolutionShareUpdateRequest request) {
        return ResponseEntity.ok(qaService.updateSolutionShare(userId, id, request));
    }

    @DeleteMapping("/solution-shares/{id}")
    public ResponseEntity<?> deleteSolutionShare(@RequestAttribute Long userId, @PathVariable Long id) {
        return ResponseEntity.ok(qaService.deleteSolutionShare(userId, id));
    }

    @PostMapping("/solution-shares/ai-draft")
    public ResponseEntity<?> generateSolutionThoughtDraft(
            @RequestAttribute Long userId,
            @RequestBody QaAiDraftRequest request) {
        return ResponseEntity.ok(qaService.generateSolutionThoughtDraft(userId, request));
    }

    @GetMapping("/cases")
    public ResponseEntity<?> listCases(
            @RequestAttribute Long userId,
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "10") Integer size) {
        return ResponseEntity.ok(qaService.listCases(userId, status, page, size));
    }

    @PostMapping("/cases")
    public ResponseEntity<?> createCase(
            @RequestAttribute Long userId,
            @RequestBody QaCaseHelpRequest request) {
        ResponseEntity<?> limited = toLimitResponse(rateLimitService.check(
                "qa:case-create:user:" + userId,
                10,
                Duration.ofMinutes(1),
                "求助提交过于频繁，请稍后再试"
        ));
        if (limited != null) {
            return limited;
        }
        return ResponseEntity.ok(qaService.createCase(userId, request));
    }

    @PutMapping("/cases/{id}")
    public ResponseEntity<?> updateCase(
            @RequestAttribute Long userId,
            @PathVariable Long id,
            @RequestBody QaCaseHelpRequest request) {
        return ResponseEntity.ok(qaService.updateCase(userId, id, request));
    }

    @PostMapping("/cases/{id}/close")
    public ResponseEntity<?> closeCase(@RequestAttribute Long userId, @PathVariable Long id) {
        return ResponseEntity.ok(qaService.closeCase(userId, id));
    }

    @DeleteMapping("/cases/{id}")
    public ResponseEntity<?> deleteCase(@RequestAttribute Long userId, @PathVariable Long id) {
        return ResponseEntity.ok(qaService.deleteCase(userId, id));
    }

    @GetMapping("/cases/{id}")
    public ResponseEntity<?> getCaseDetail(@RequestAttribute Long userId, @PathVariable Long id) {
        return ResponseEntity.ok(qaService.getCaseDetail(userId, id));
    }

    @GetMapping("/cases/{id}/file")
    public ResponseEntity<?> downloadCaseFile(@RequestAttribute Long userId, @PathVariable Long id) {
        ResponseEntity<?> limited = toLimitResponse(rateLimitService.check(
                "download:qa-case:user:" + userId + ":case:" + id,
                30,
                Duration.ofMinutes(1),
                "文件下载过于频繁，请稍后再试"
        ));
        if (limited != null) {
            return limited;
        }
        PracticeQuestionWorkbookFile workbookFile = qaService.buildCaseWorkbookFile(userId, id);
        ByteArrayResource resource = new ByteArrayResource(workbookFile.content());
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(workbookFile.contentType()))
                .contentLength(workbookFile.content().length)
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment()
                        .filename(workbookFile.fileName(), StandardCharsets.UTF_8)
                        .build()
                        .toString())
                .body(resource);
    }

    @GetMapping("/cases/{id}/template-snapshot")
    public ResponseEntity<?> getCaseTemplateSnapshot(@RequestAttribute Long userId, @PathVariable Long id) {
        ResponseEntity<?> limited = toLimitResponse(rateLimitService.check(
                "qa:case-template-snapshot:user:" + userId + ":case:" + id,
                30,
                Duration.ofMinutes(1),
                "模板预览过于频繁，请稍后再试"
        ));
        if (limited != null) {
            return limited;
        }
        try {
            return ResponseEntity.ok(qaService.loadCaseTemplateSnapshot(userId, id));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @GetMapping("/cases/{caseId}/answers/{answerId}/file")
    public ResponseEntity<?> downloadCaseAnswerFile(
            @RequestAttribute Long userId,
            @PathVariable Long caseId,
            @PathVariable Long answerId) {
        ResponseEntity<?> limited = toLimitResponse(rateLimitService.check(
                "download:qa-answer:user:" + userId + ":answer:" + answerId,
                30,
                Duration.ofMinutes(1),
                "文件下载过于频繁，请稍后再试"
        ));
        if (limited != null) {
            return limited;
        }
        PracticeQuestionWorkbookFile workbookFile = qaService.buildCaseAnswerWorkbookFile(userId, caseId, answerId);
        ByteArrayResource resource = new ByteArrayResource(workbookFile.content());
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(workbookFile.contentType()))
                .contentLength(workbookFile.content().length)
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment()
                        .filename(workbookFile.fileName(), StandardCharsets.UTF_8)
                        .build()
                        .toString())
                .body(resource);
    }

    @GetMapping("/cases/{caseId}/answers/{answerId}/template-snapshot")
    public ResponseEntity<?> getCaseAnswerTemplateSnapshot(
            @RequestAttribute Long userId,
            @PathVariable Long caseId,
            @PathVariable Long answerId) {
        ResponseEntity<?> limited = toLimitResponse(rateLimitService.check(
                "qa:answer-template-snapshot:user:" + userId + ":answer:" + answerId,
                30,
                Duration.ofMinutes(1),
                "模板预览过于频繁，请稍后再试"
        ));
        if (limited != null) {
            return limited;
        }
        try {
            return ResponseEntity.ok(qaService.loadCaseAnswerSnapshot(userId, caseId, answerId));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @PostMapping("/cases/{id}/answers")
    public ResponseEntity<?> submitCaseAnswer(
            @RequestAttribute Long userId,
            @PathVariable Long id,
            @RequestBody QaCaseAnswerRequest request) {
        ResponseEntity<?> limited = toLimitResponse(rateLimitService.check(
                "qa:answer:user:" + userId + ":case:" + id,
                10,
                Duration.ofMinutes(1),
                "答疑提交过于频繁，请稍后再试"
        ));
        if (limited != null) {
            return limited;
        }
        return ResponseEntity.ok(qaService.submitCaseAnswer(userId, id, request));
    }

    @PutMapping("/cases/{caseId}/answers/{answerId}")
    public ResponseEntity<?> updateCaseAnswer(
            @RequestAttribute Long userId,
            @PathVariable Long caseId,
            @PathVariable Long answerId,
            @RequestBody QaCaseAnswerRequest request) {
        ResponseEntity<?> limited = toLimitResponse(rateLimitService.check(
                "qa:answer-update:user:" + userId + ":case:" + caseId,
                10,
                Duration.ofMinutes(1),
                "答疑提交过于频繁，请稍后再试"
        ));
        if (limited != null) {
            return limited;
        }
        return ResponseEntity.ok(qaService.updateCaseAnswer(userId, caseId, answerId, request));
    }

    @DeleteMapping("/cases/{caseId}/answers/{answerId}")
    public ResponseEntity<?> deleteCaseAnswer(
            @RequestAttribute Long userId,
            @PathVariable Long caseId,
            @PathVariable Long answerId) {
        return ResponseEntity.ok(qaService.deleteCaseAnswer(userId, caseId, answerId));
    }

    @PostMapping("/cases/{caseId}/answers/{answerId}/accept")
    public ResponseEntity<?> acceptCaseAnswer(
            @RequestAttribute Long userId,
            @PathVariable Long caseId,
            @PathVariable Long answerId,
            @RequestBody(required = false) QaCaseAcceptRequest request) {
        return ResponseEntity.ok(qaService.acceptCaseAnswer(userId, caseId, answerId, request));
    }

    @PostMapping("/cases/{caseId}/answers/{answerId}/vote")
    public ResponseEntity<?> voteCaseAnswer(
            @RequestAttribute Long userId,
            @PathVariable Long caseId,
            @PathVariable Long answerId,
            @RequestBody QaCaseVoteRequest request) {
        return ResponseEntity.ok(qaService.voteCaseAnswer(userId, caseId, answerId, request));
    }

    @PostMapping("/cases/{id}/feedback")
    public ResponseEntity<?> createCaseFeedback(
            @RequestAttribute Long userId,
            @PathVariable Long id,
            @RequestBody QaCaseFeedbackRequest request) {
        return ResponseEntity.ok(qaService.createCaseFeedback(userId, id, request));
    }

    @PostMapping("/cases/{id}/answers/from-snapshot")
    public ResponseEntity<?> submitCaseAnswerFromSnapshot(
            @RequestAttribute Long userId,
            @PathVariable Long id,
            @RequestBody QaCaseSnapshotAnswerRequest request) {
        ResponseEntity<?> limited = toLimitResponse(rateLimitService.check(
                "qa:answer-snapshot:user:" + userId + ":case:" + id,
                10,
                Duration.ofMinutes(1),
                "答疑提交过于频繁，请稍后再试"
        ));
        if (limited != null) {
            return limited;
        }
        return ResponseEntity.ok(qaService.submitCaseAnswerFromSnapshot(userId, id, request));
    }

    @PutMapping("/cases/{caseId}/answers/{answerId}/from-snapshot")
    public ResponseEntity<?> updateCaseAnswerFromSnapshot(
            @RequestAttribute Long userId,
            @PathVariable Long caseId,
            @PathVariable Long answerId,
            @RequestBody QaCaseSnapshotAnswerRequest request) {
        ResponseEntity<?> limited = toLimitResponse(rateLimitService.check(
                "qa:answer-snapshot-update:user:" + userId + ":case:" + caseId,
                10,
                Duration.ofMinutes(1),
                "答疑提交过于频繁，请稍后再试"
        ));
        if (limited != null) {
            return limited;
        }
        return ResponseEntity.ok(qaService.updateCaseAnswerFromSnapshot(userId, caseId, answerId, request));
    }

    @GetMapping("/cases/{id}/answers")
    public ResponseEntity<?> listCaseAnswers(@RequestAttribute Long userId, @PathVariable Long id) {
        return ResponseEntity.ok(qaService.listCaseAnswers(userId, id));
    }

    @GetMapping("/my")
    public ResponseEntity<?> getMyQa(
            @RequestAttribute Long userId,
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "10") Integer size) {
        return ResponseEntity.ok(qaService.getMyQa(userId, page, size));
    }

    private ResponseEntity<?> toLimitResponse(RateLimitResult result) {
        if (result == null || result.allowed()) {
            return null;
        }
        return ResponseEntity.status(429).body(Map.of(
                "message", result.message(),
                "retryAfterSeconds", result.retryAfterSeconds()
        ));
    }
}
