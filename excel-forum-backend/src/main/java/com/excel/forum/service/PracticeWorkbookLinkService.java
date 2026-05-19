package com.excel.forum.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;

@Service
public class PracticeWorkbookLinkService {
    private static final Duration TICKET_TTL = Duration.ofMinutes(10);
    private static final String SIGNATURE_ALGORITHM = "HmacSHA256";
    private static final String DEV_FALLBACK_SECRET = "excelcc-practice-workbook-link";

    private final String secret;

    public PracticeWorkbookLinkService(@Value("${jwt.secret:}") String secret) {
        this.secret = StringUtils.hasText(secret) ? secret : DEV_FALLBACK_SECRET;
    }

    public String createTicket(Long questionId, Long userId) {
        if (questionId == null || userId == null) {
            throw new IllegalArgumentException("题目参数无效");
        }
        long expiresAt = Instant.now().plus(TICKET_TTL).getEpochSecond();
        String payload = questionId + "." + userId + "." + expiresAt;
        return payload + "." + sign(payload);
    }

    public boolean isValid(Long questionId, String ticket) {
        if (questionId == null || !StringUtils.hasText(ticket)) {
            return false;
        }
        String[] parts = ticket.split("\\.");
        if (parts.length != 4) {
            return false;
        }
        if (!String.valueOf(questionId).equals(parts[0])) {
            return false;
        }
        long expiresAt;
        try {
            expiresAt = Long.parseLong(parts[2]);
        } catch (NumberFormatException exception) {
            return false;
        }
        if (Instant.now().getEpochSecond() > expiresAt) {
            return false;
        }
        String payload = parts[0] + "." + parts[1] + "." + parts[2];
        return constantTimeEquals(sign(payload), parts[3]);
    }

    private String sign(String payload) {
        try {
            Mac mac = Mac.getInstance(SIGNATURE_ALGORITHM);
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), SIGNATURE_ALGORITHM));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(mac.doFinal(payload.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception exception) {
            throw new IllegalStateException("题目文件访问票据生成失败", exception);
        }
    }

    private boolean constantTimeEquals(String left, String right) {
        if (left == null || right == null) {
            return false;
        }
        byte[] leftBytes = left.getBytes(StandardCharsets.UTF_8);
        byte[] rightBytes = right.getBytes(StandardCharsets.UTF_8);
        if (leftBytes.length != rightBytes.length) {
            return false;
        }
        int result = 0;
        for (int index = 0; index < leftBytes.length; index += 1) {
            result |= leftBytes[index] ^ rightBytes[index];
        }
        return result == 0;
    }
}
