package com.excel.forum.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;

@Component
public class PrivateUploadAccessFilter extends OncePerRequestFilter {
    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        if (isBlockedUploadPath(request.getRequestURI())) {
            response.sendError(HttpServletResponse.SC_NOT_FOUND);
            return;
        }
        filterChain.doFilter(request, response);
    }

    private boolean isBlockedUploadPath(String requestUri) {
        String normalized = requestUri == null ? "" : requestUri;
        for (int i = 0; i < 3; i++) {
            normalized = normalized.replace('\\', '/');
            if (normalized.startsWith("/uploads/private/") || normalized.startsWith("/uploads/.trash/")) {
                return true;
            }
            String decoded = decodePath(normalized);
            if (decoded.equals(normalized)) {
                return false;
            }
            normalized = decoded;
        }
        normalized = normalized.replace('\\', '/');
        return normalized.startsWith("/uploads/private/") || normalized.startsWith("/uploads/.trash/");
    }

    private String decodePath(String path) {
        try {
            return URLDecoder.decode(path, StandardCharsets.UTF_8);
        } catch (IllegalArgumentException exception) {
            return path;
        }
    }
}
