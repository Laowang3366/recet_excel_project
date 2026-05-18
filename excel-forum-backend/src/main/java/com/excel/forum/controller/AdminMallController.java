package com.excel.forum.controller;

import com.excel.forum.entity.MallItem;
import com.excel.forum.entity.MallItemType;
import com.excel.forum.entity.dto.AdminMallEnabledRequest;
import com.excel.forum.entity.dto.AdminMallRedemptionStatusRequest;
import com.excel.forum.service.MallService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/admin/mall")
@RequiredArgsConstructor
public class AdminMallController {
    private final MallService mallService;

    @GetMapping("/overview")
    public ResponseEntity<?> getOverview() {
        return ResponseEntity.ok(mallService.getAdminOverview());
    }

    @GetMapping("/items")
    public ResponseEntity<?> getItems(
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "10") Integer size,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String type,
            @RequestParam(required = false) Boolean enabled,
            @RequestParam(required = false) String stockStatus) {
        return ResponseEntity.ok(mallService.getAdminItems(page, size, keyword, type, enabled, stockStatus));
    }

    @PostMapping("/items")
    public ResponseEntity<?> createItem(@RequestBody MallItem item) {
        try {
            return ResponseEntity.ok(mallService.createAdminItem(item));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @PutMapping("/items/{id}")
    public ResponseEntity<?> updateItem(@PathVariable Long id, @RequestBody MallItem item) {
        try {
            return ResponseEntity.ok(mallService.updateAdminItem(id, item));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @PutMapping("/items/{id}/enabled")
    public ResponseEntity<?> updateItemEnabled(@PathVariable Long id, @RequestBody AdminMallEnabledRequest body) {
        try {
            Boolean enabled = body == null ? null : body.getEnabled();
            return ResponseEntity.ok(mallService.updateAdminItemEnabled(id, enabled));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @DeleteMapping("/items/{id}")
    public ResponseEntity<?> deleteItem(@PathVariable Long id) {
        try {
            mallService.deleteAdminItem(id);
            return ResponseEntity.ok(Map.of("message", "商品已删除"));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        } catch (IllegalStateException e) {
            return ResponseEntity.status(409).body(Map.of("message", e.getMessage()));
        }
    }

    @GetMapping("/types")
    public ResponseEntity<?> getTypes() {
        return ResponseEntity.ok(mallService.getAdminItemTypes());
    }

    @PostMapping("/types")
    public ResponseEntity<?> createType(@RequestBody MallItemType itemType) {
        try {
            return ResponseEntity.ok(mallService.createAdminItemType(itemType));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @PutMapping("/types/{id}")
    public ResponseEntity<?> updateType(@PathVariable Long id, @RequestBody MallItemType itemType) {
        try {
            return ResponseEntity.ok(mallService.updateAdminItemType(id, itemType));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @DeleteMapping("/types/{id}")
    public ResponseEntity<?> deleteType(@PathVariable Long id) {
        try {
            mallService.deleteAdminItemType(id);
            return ResponseEntity.ok(Map.of("message", "商品类型已删除"));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        } catch (IllegalStateException e) {
            return ResponseEntity.status(409).body(Map.of("message", e.getMessage()));
        }
    }

    @GetMapping("/redemptions")
    public ResponseEntity<?> getRedemptions(
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "10") Integer size,
            @RequestParam(required = false) String username,
            @RequestParam(required = false) Long itemId,
            @RequestParam(required = false) String itemKeyword,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String dateFrom,
            @RequestParam(required = false) String dateTo) {
        return ResponseEntity.ok(mallService.getAdminRedemptions(page, size, username, itemId, itemKeyword, status, dateFrom, dateTo));
    }

    @PutMapping("/redemptions/{id}/status")
    public ResponseEntity<?> updateRedemptionStatus(
            @PathVariable Long id,
            @RequestAttribute Long userId,
            @RequestBody AdminMallRedemptionStatusRequest body) {
        try {
            return ResponseEntity.ok(mallService.updateAdminRedemptionStatus(
                    id,
                    body == null ? null : body.getStatus(),
                    body == null ? null : body.getRemark(),
                    userId
            ));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        } catch (IllegalStateException e) {
            return ResponseEntity.status(409).body(Map.of("message", e.getMessage()));
        }
    }
}
