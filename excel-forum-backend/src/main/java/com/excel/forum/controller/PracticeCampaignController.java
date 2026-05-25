package com.excel.forum.controller;

import com.excel.forum.entity.dto.PracticeCampaignStartRequest;
import com.excel.forum.entity.dto.PracticeCampaignSubmitRequest;
import com.excel.forum.service.PracticeCampaignService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/practice/campaign")
@RequiredArgsConstructor
public class PracticeCampaignController {
    private final PracticeCampaignService practiceCampaignService;

    @GetMapping("/overview")
    public ResponseEntity<?> getOverview(@RequestAttribute(value = "userId", required = false) Long userId) {
        try {
            return ResponseEntity.ok(practiceCampaignService.getCampaignOverview(userId));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @GetMapping("/chapters")
    public ResponseEntity<?> getChapters(@RequestAttribute(value = "userId", required = false) Long userId) {
        try {
            return ResponseEntity.ok(practiceCampaignService.getCampaignChapters(userId));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @GetMapping("/chapters/{chapterId}")
    public ResponseEntity<?> getChapterDetail(
            @PathVariable Long chapterId,
            @RequestAttribute(value = "userId", required = false) Long userId) {
        try {
            return ResponseEntity.ok(practiceCampaignService.getCampaignChapterDetail(chapterId, userId));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @GetMapping("/levels/{levelId}")
    public ResponseEntity<?> getLevelDetail(
            @PathVariable Long levelId,
            @RequestAttribute(value = "userId", required = false) Long userId) {
        try {
            return ResponseEntity.ok(practiceCampaignService.getCampaignLevelDetail(levelId, userId));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @GetMapping("/wrongs")
    public ResponseEntity<?> getWrongQuestions(@RequestAttribute(value = "userId", required = false) Long userId) {
        try {
            return ResponseEntity.ok(practiceCampaignService.getCampaignWrongQuestions(userId));
        } catch (IllegalArgumentException e) {
            if (isLoginRequired(e)) {
                return ResponseEntity.status(401).body(Map.of("message", "未登录"));
            }
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        } catch (IllegalStateException e) {
            if (isLoginRequired(e)) {
                return ResponseEntity.status(401).body(Map.of("message", "未登录"));
            }
            return ResponseEntity.status(403).body(Map.of("message", e.getMessage()));
        }
    }

    @PutMapping("/wrongs/{wrongQuestionId}/resolve")
    public ResponseEntity<?> resolveWrongQuestion(
            @RequestAttribute Long userId,
            @PathVariable Long wrongQuestionId) {
        try {
            return ResponseEntity.ok(practiceCampaignService.resolveWrongQuestion(userId, wrongQuestionId));
        } catch (IllegalArgumentException e) {
            if (isLoginRequired(e)) {
                return ResponseEntity.status(401).body(Map.of("message", "未登录"));
            }
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        } catch (IllegalStateException e) {
            if (isLoginRequired(e)) {
                return ResponseEntity.status(401).body(Map.of("message", "未登录"));
            }
            return ResponseEntity.status(403).body(Map.of("message", e.getMessage()));
        }
    }

    @GetMapping("/rankings")
    public ResponseEntity<?> getRankings(@org.springframework.web.bind.annotation.RequestParam(defaultValue = "all") String scope) {
        try {
            return ResponseEntity.ok(practiceCampaignService.getCampaignRankings(scope));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @PostMapping("/levels/{levelId}/start")
    public ResponseEntity<?> startLevel(
            @PathVariable Long levelId,
            @RequestAttribute Long userId,
            @RequestBody(required = false) PracticeCampaignStartRequest request) {
        try {
            return ResponseEntity.ok(practiceCampaignService.startCampaignLevel(levelId, userId, request));
        } catch (IllegalArgumentException e) {
            if (isLoginRequired(e)) {
                return ResponseEntity.status(401).body(Map.of("message", "未登录"));
            }
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        } catch (IllegalStateException e) {
            if (isLoginRequired(e)) {
                return ResponseEntity.status(401).body(Map.of("message", "未登录"));
            }
            return ResponseEntity.status(403).body(Map.of("message", e.getMessage()));
        }
    }

    @PostMapping("/levels/{levelId}/submit")
    public ResponseEntity<?> submitLevel(
            @PathVariable Long levelId,
            @RequestAttribute Long userId,
            @RequestBody PracticeCampaignSubmitRequest request) {
        try {
            return ResponseEntity.ok(practiceCampaignService.submitCampaignLevel(levelId, userId, request));
        } catch (IllegalArgumentException e) {
            if (isLoginRequired(e)) {
                return ResponseEntity.status(401).body(Map.of("message", "未登录"));
            }
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        } catch (IllegalStateException e) {
            if (isLoginRequired(e)) {
                return ResponseEntity.status(401).body(Map.of("message", "未登录"));
            }
            return ResponseEntity.status(403).body(Map.of("message", e.getMessage()));
        }
    }

    private boolean isLoginRequired(RuntimeException e) {
        String message = e.getMessage();
        return "未登录".equals(message) || "请先登录".equals(message);
    }
}
