package com.excel.forum.service.impl;

import com.excel.forum.service.SecurityAbuseMonitor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.util.HexFormat;

@Service
@Slf4j
public class LoggingSecurityAbuseMonitor implements SecurityAbuseMonitor {
    private static final int FINGERPRINT_LENGTH = 16;

    @Override
    public void recordRateLimit(String key, int maxRequests, Duration window, long retryAfterSeconds) {
        log.warn(
                "security_abuse_event type=rate_limited group={} key_hash={} max={} window_seconds={} retry_after_seconds={}",
                keyGroup(key),
                fingerprint(key),
                maxRequests,
                window == null ? 0 : window.toSeconds(),
                retryAfterSeconds
        );
    }

    @Override
    public void recordWorkbookRejected(String label, String reason) {
        log.warn(
                "security_abuse_event type=workbook_rejected label={} reason={}",
                safeToken(label),
                safeToken(reason)
        );
    }

    @Override
    public void recordUploadRejected(String scene, String reason) {
        log.warn(
                "security_abuse_event type=upload_rejected scene={} reason={}",
                safeToken(scene),
                safeToken(reason)
        );
    }

    @Override
    public void recordRewardIdempotencyCollision(String idempotencyKey) {
        log.warn(
                "security_abuse_event type=reward_idempotency_collision group={} key_hash={}",
                keyGroup(idempotencyKey),
                fingerprint(idempotencyKey)
        );
    }

    private String keyGroup(String key) {
        if (key == null || key.isBlank()) {
            return "unknown";
        }
        int delimiter = key.indexOf(':');
        return safeToken(delimiter <= 0 ? key : key.substring(0, delimiter));
    }

    private String safeToken(String value) {
        if (value == null || value.isBlank()) {
            return "unknown";
        }
        return value.trim().replaceAll("[^a-zA-Z0-9_.:-]", "_");
    }

    private String fingerprint(String value) {
        if (value == null || value.isBlank()) {
            return "empty";
        }
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(value.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash).substring(0, FINGERPRINT_LENGTH);
        } catch (NoSuchAlgorithmException exception) {
            return Integer.toHexString(value.hashCode());
        }
    }
}
