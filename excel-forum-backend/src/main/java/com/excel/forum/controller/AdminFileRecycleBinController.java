package com.excel.forum.controller;

import com.excel.forum.entity.dto.FileRecycleBatchRequest;
import com.excel.forum.service.FileRecycleService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin/file-recycle-bin")
@RequiredArgsConstructor
public class AdminFileRecycleBinController {
    private final FileRecycleService fileRecycleService;

    @GetMapping
    public ResponseEntity<?> list(
            @RequestParam(required = false) String resourceType,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) Boolean expired,
            @RequestParam(required = false) String fileType,
            @RequestParam(required = false) Long deletedBy,
            @RequestParam(required = false) String deletedStart,
            @RequestParam(required = false) String deletedEnd,
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "10") Integer size) {
        return ResponseEntity.ok(fileRecycleService.listItems(
                resourceType,
                keyword,
                expired,
                fileType,
                deletedBy,
                parseStart(deletedStart),
                parseEnd(deletedEnd),
                page,
                size));
    }

    @PostMapping("/{id}/restore")
    public ResponseEntity<?> restore(@PathVariable Long id) {
        return ResponseEntity.ok(fileRecycleService.restore(id));
    }

    @PostMapping("/restore-batch")
    public ResponseEntity<?> restoreBatch(@RequestBody FileRecycleBatchRequest request) {
        List<Long> ids = request == null ? List.of() : request.getIds();
        int count = fileRecycleService.restoreBatch(ids);
        return ResponseEntity.ok(Map.of("message", "已批量恢复", "count", count));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> purge(@PathVariable Long id) {
        fileRecycleService.purge(id);
        return ResponseEntity.ok(Map.of("message", "已彻底删除"));
    }

    @DeleteMapping("/batch")
    public ResponseEntity<?> purgeBatch(@RequestBody FileRecycleBatchRequest request) {
        List<Long> ids = request == null ? List.of() : request.getIds();
        int count = fileRecycleService.purgeBatch(ids);
        return ResponseEntity.ok(Map.of("message", "已彻底删除", "count", count));
    }

    @PostMapping("/purge-expired")
    public ResponseEntity<?> purgeExpired() {
        int count = fileRecycleService.purgeExpired();
        return ResponseEntity.ok(Map.of("message", "已清理过期文件", "count", count));
    }

    private LocalDateTime parseStart(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.contains("T") ? LocalDateTime.parse(value) : LocalDate.parse(value).atStartOfDay();
    }

    private LocalDateTime parseEnd(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.contains("T") ? LocalDateTime.parse(value) : LocalDate.parse(value).atTime(23, 59, 59);
    }
}
