package com.excel.forum.service;

import java.time.Duration;

public interface RateLimitService {
    RateLimitResult check(String key, int maxRequests, Duration window, String limitedMessage);
}
