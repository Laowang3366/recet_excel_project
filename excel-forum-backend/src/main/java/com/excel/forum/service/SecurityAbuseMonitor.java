package com.excel.forum.service;

import java.time.Duration;

public interface SecurityAbuseMonitor {
    void recordRateLimit(String key, int maxRequests, Duration window, long retryAfterSeconds);

    void recordWorkbookRejected(String label, String reason);

    void recordUploadRejected(String scene, String reason);

    void recordRewardIdempotencyCollision(String idempotencyKey);

    static SecurityAbuseMonitor noop() {
        return NoopSecurityAbuseMonitor.INSTANCE;
    }

    final class NoopSecurityAbuseMonitor implements SecurityAbuseMonitor {
        private static final NoopSecurityAbuseMonitor INSTANCE = new NoopSecurityAbuseMonitor();

        private NoopSecurityAbuseMonitor() {
        }

        @Override
        public void recordRateLimit(String key, int maxRequests, Duration window, long retryAfterSeconds) {
        }

        @Override
        public void recordWorkbookRejected(String label, String reason) {
        }

        @Override
        public void recordUploadRejected(String scene, String reason) {
        }

        @Override
        public void recordRewardIdempotencyCollision(String idempotencyKey) {
        }
    }
}
