package com.excel.forum.service;

public record RateLimitResult(boolean allowed, String message, long retryAfterSeconds) {
    public static RateLimitResult allow() {
        return new RateLimitResult(true, "", 0);
    }

    public static RateLimitResult limited(String message, long retryAfterSeconds) {
        return new RateLimitResult(false, message, Math.max(1, retryAfterSeconds));
    }
}
