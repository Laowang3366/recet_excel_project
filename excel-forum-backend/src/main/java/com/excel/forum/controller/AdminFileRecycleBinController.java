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
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "10") Integer size) {
        return ResponseEntity.ok(fileRecycleService.listItems(resourceType, keyword, expired, page, size));
    }

    @PostMapping("/{id}/restore")
    public ResponseEntity<?> restore(@PathVariable Long id) {
        return ResponseEntity.ok(fileRecycleService.restore(id));
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
}
