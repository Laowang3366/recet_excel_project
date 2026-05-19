package com.excel.forum.controller;

import com.excel.forum.entity.dto.QaCaseHelpRequest;
import com.excel.forum.entity.dto.QaSolutionShareUpdateRequest;
import com.excel.forum.service.QaService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/qa")
@RequiredArgsConstructor
public class AdminQaController {
    private final QaService qaService;

    @GetMapping("/stats")
    public ResponseEntity<?> getStats() {
        return ResponseEntity.ok(qaService.getAdminQaStats());
    }

    @GetMapping("/cases")
    public ResponseEntity<?> listCases(
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "10") Integer size) {
        return ResponseEntity.ok(qaService.adminListCases(status, page, size));
    }

    @PutMapping("/cases/{id}")
    public ResponseEntity<?> updateCase(@PathVariable Long id, @RequestBody QaCaseHelpRequest request) {
        return ResponseEntity.ok(qaService.adminUpdateCase(id, request));
    }

    @DeleteMapping("/cases/{id}")
    public ResponseEntity<?> deleteCase(@PathVariable Long id) {
        return ResponseEntity.ok(qaService.adminDeleteCase(id));
    }

    @GetMapping("/cases/{id}/answers")
    public ResponseEntity<?> listCaseAnswers(
            @PathVariable Long id,
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "10") Integer size) {
        return ResponseEntity.ok(qaService.adminListCaseAnswers(id, page, size));
    }

    @GetMapping("/answers")
    public ResponseEntity<?> listAnswers(
            @RequestParam(required = false) Long caseId,
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "10") Integer size) {
        return ResponseEntity.ok(qaService.adminListCaseAnswers(caseId, page, size));
    }

    @DeleteMapping("/answers/{id}")
    public ResponseEntity<?> deleteCaseAnswer(@PathVariable Long id) {
        return ResponseEntity.ok(qaService.adminDeleteCaseAnswer(id));
    }

    @GetMapping("/solution-shares")
    public ResponseEntity<?> listSolutionShares(
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "10") Integer size) {
        return ResponseEntity.ok(qaService.adminListSolutionShares(status, page, size));
    }

    @PutMapping("/solution-shares/{id}")
    public ResponseEntity<?> updateSolutionShare(@PathVariable Long id, @RequestBody QaSolutionShareUpdateRequest request) {
        return ResponseEntity.ok(qaService.adminUpdateSolutionShare(id, request));
    }

    @DeleteMapping("/solution-shares/{id}")
    public ResponseEntity<?> deleteSolutionShare(@PathVariable Long id) {
        return ResponseEntity.ok(qaService.adminDeleteSolutionShare(id));
    }

    @GetMapping("/feedback")
    public ResponseEntity<?> listFeedback(
            @RequestParam(required = false) Long caseId,
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "10") Integer size) {
        return ResponseEntity.ok(qaService.adminListFeedback(caseId, page, size));
    }
}
