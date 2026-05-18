package com.excel.forum.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.List;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 20)
public class LegacyForumFeatureShutdownFilter extends OncePerRequestFilter {

    private static final List<String> LEGACY_PREFIXES = List.of(
            "/api/posts",
            "/api/replies",
            "/api/categories",
            "/api/favorites",
            "/api/likes",
            "/api/messages",
            "/api/chat",
            "/api/drafts",
            "/api/reports",
            "/api/admin/posts",
            "/api/admin/reports",
            "/api/admin/categories",
            "/api/admin/drafts"
    );

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {
        String path = request.getRequestURI();
        if (isLegacyForumPath(path)) {
            response.setStatus(HttpServletResponse.SC_GONE);
            response.setCharacterEncoding(StandardCharsets.UTF_8.name());
            response.setContentType("application/json;charset=UTF-8");
            response.getWriter().write("{\"message\":\"该功能已下线\"}");
            return;
        }
        filterChain.doFilter(request, response);
    }

    private boolean isLegacyForumPath(String path) {
        return LEGACY_PREFIXES.stream().anyMatch(prefix -> path.equals(prefix) || path.startsWith(prefix + "/"));
    }
}
