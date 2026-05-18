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
import java.util.regex.Pattern;

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
            "/api/admin/replies",
            "/api/admin/reports",
            "/api/admin/categories",
            "/api/admin/drafts"
    );

    private static final List<String> LEGACY_USER_PREFIXES = List.of(
            "/api/users/recent",
            "/api/users/online",
            "/api/users/search",
            "/api/users/heartbeat",
            "/api/users/center/activity",
            "/api/users/center/posts",
            "/api/users/category-follows"
    );

    private static final Pattern LEGACY_USER_CHILD_PATH = Pattern.compile(
            "^/api/users/\\d+/(center-overview|posts|replies|favorites|following|followers|follow|is-following|view-history)(/.*)?$"
    );

    private static final Pattern LEGACY_PUBLIC_USER_PROFILE_PATH = Pattern.compile("^/api/users/\\d+$");

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {
        String path = request.getRequestURI();
        if (isLegacyForumPath(request.getMethod(), path)) {
            response.setStatus(HttpServletResponse.SC_GONE);
            response.setCharacterEncoding(StandardCharsets.UTF_8.name());
            response.setContentType("application/json;charset=UTF-8");
            response.getWriter().write("{\"message\":\"该功能已下线\"}");
            return;
        }
        filterChain.doFilter(request, response);
    }

    private boolean isLegacyForumPath(String method, String path) {
        return LEGACY_PREFIXES.stream().anyMatch(prefix -> path.equals(prefix) || path.startsWith(prefix + "/"))
                || LEGACY_USER_PREFIXES.stream().anyMatch(prefix -> path.equals(prefix) || path.startsWith(prefix + "/"))
                || LEGACY_USER_CHILD_PATH.matcher(path).matches()
                || ("GET".equalsIgnoreCase(method) && LEGACY_PUBLIC_USER_PROFILE_PATH.matcher(path).matches());
    }
}
