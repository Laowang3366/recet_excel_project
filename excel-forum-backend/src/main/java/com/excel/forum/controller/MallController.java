package com.excel.forum.controller;

import com.excel.forum.entity.dto.MallRedeemRequest;
import com.excel.forum.service.MallService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/mall")
@RequiredArgsConstructor
public class MallController {

    private final MallService mallService;

    @GetMapping("/items")
    public ResponseEntity<?> getItems(
            @RequestParam(required = false) String type,
            @RequestAttribute(value = "userId", required = false) Long userId) {
        return ResponseEntity.ok(mallService.getItems(type, userId));
    }

    @GetMapping("/types")
    public ResponseEntity<?> getTypes() {
        return ResponseEntity.ok(mallService.getItemTypes());
    }

    @GetMapping("/overview")
    public ResponseEntity<?> getOverview(@RequestAttribute Long userId) {
        try {
            return ResponseEntity.ok(mallService.getOverview(userId));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(404).body(Map.of("message", e.getMessage()));
        }
    }

    @PostMapping("/redeem")
    public ResponseEntity<?> redeem(@RequestAttribute Long userId, @RequestBody MallRedeemRequest body) {
        if (body == null || body.getItemId() == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "商品ID不能为空"));
        }
        try {
            return ResponseEntity.ok(mallService.redeem(userId, body.getItemId()));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        } catch (IllegalStateException e) {
            return ResponseEntity.status(409).body(Map.of("message", e.getMessage()));
        }
    }

    @GetMapping("/redemptions")
    public ResponseEntity<?> getRedemptions(
            @RequestAttribute Long userId,
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "10") Integer size) {
        return ResponseEntity.ok(mallService.getRedemptions(userId, page, size));
    }
}
