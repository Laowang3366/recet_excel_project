package com.excel.forum.security;

import com.excel.forum.entity.AdminAuditLog;
import com.excel.forum.mapper.AdminAuditLogMapper;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.LocalDateTime;
import java.util.Set;

@Slf4j
@Component
@Order(Ordered.LOWEST_PRECEDENCE)
@RequiredArgsConstructor
public class AdminAuditLogFilter extends OncePerRequestFilter {
    private static final Set<String> MUTATING_METHODS = Set.of("POST", "PUT", "PATCH", "DELETE");

    private final AdminAuditLogMapper adminAuditLogMapper;

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getRequestURI();
        return path == null
                || !path.startsWith("/api/admin/")
                || !MUTATING_METHODS.contains(request.getMethod());
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        try {
            filterChain.doFilter(request, response);
        } finally {
            recordAuditLog(request, response);
        }
    }

    private void recordAuditLog(HttpServletRequest request, HttpServletResponse response) {
        try {
            AdminAuditLog auditLog = new AdminAuditLog();
            auditLog.setAdminUserId(resolveUserId(request.getAttribute("userId")));
            auditLog.setMethod(request.getMethod());
            auditLog.setPath(request.getRequestURI());
            auditLog.setQueryString(trimToLength(request.getQueryString(), 1000));
            auditLog.setStatusCode(response.getStatus());
            auditLog.setClientIp(resolveClientIp(request));
            auditLog.setUserAgent(trimToLength(request.getHeader("User-Agent"), 500));
            auditLog.setCreateTime(LocalDateTime.now());
            adminAuditLogMapper.insert(auditLog);
        } catch (Exception ex) {
            // 审计失败不能阻断后台业务请求，但必须保留日志方便排查审计链路问题。
            log.warn("Failed to persist admin audit log: method={}, path={}", request.getMethod(), request.getRequestURI(), ex);
        }
    }

    private Long resolveUserId(Object value) {
        if (value instanceof Number number) {
            return number.longValue();
        }
        if (value instanceof String text && !text.isBlank()) {
            try {
                return Long.parseLong(text);
            } catch (NumberFormatException ignored) {
                return null;
            }
        }
        return null;
    }

    private String resolveClientIp(HttpServletRequest request) {
        String forwardedFor = request.getHeader("X-Forwarded-For");
        if (forwardedFor != null && !forwardedFor.isBlank()) {
            return trimToLength(forwardedFor.split(",")[0].trim(), 64);
        }
        return trimToLength(request.getRemoteAddr(), 64);
    }

    private String trimToLength(String value, int maxLength) {
        if (value == null || value.length() <= maxLength) {
            return value;
        }
        return value.substring(0, maxLength);
    }
}
