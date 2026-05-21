package com.excel.forum.security;

import com.excel.forum.entity.AdminAuditLog;
import com.excel.forum.mapper.AdminAuditLogMapper;
import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

class AdminAuditLogFilterTest {

    @Test
    void recordsMutatingAdminRequestsAfterChainCompletes() throws Exception {
        AdminAuditLogMapper mapper = mock(AdminAuditLogMapper.class);
        AdminAuditLogFilter filter = new AdminAuditLogFilter(mapper);
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/admin/questions");
        request.setQueryString("page=1");
        request.addHeader("User-Agent", "JUnit");
        request.setRemoteAddr("10.0.0.8");
        request.setAttribute("userId", 7L);
        MockHttpServletResponse response = new MockHttpServletResponse();
        response.setStatus(201);
        FilterChain chain = (req, res) -> ((MockHttpServletResponse) res).setStatus(204);

        filter.doFilter(request, response, chain);

        ArgumentCaptor<AdminAuditLog> captor = ArgumentCaptor.forClass(AdminAuditLog.class);
        verify(mapper).insert(captor.capture());
        AdminAuditLog log = captor.getValue();
        assertThat(log.getAdminUserId()).isEqualTo(7L);
        assertThat(log.getMethod()).isEqualTo("POST");
        assertThat(log.getPath()).isEqualTo("/api/admin/questions");
        assertThat(log.getQueryString()).isEqualTo("page=1");
        assertThat(log.getStatusCode()).isEqualTo(204);
        assertThat(log.getClientIp()).isEqualTo("10.0.0.8");
        assertThat(log.getUserAgent()).isEqualTo("JUnit");
        assertThat(log.getCreateTime()).isNotNull();
    }

    @Test
    void skipsReadOnlyAdminRequests() throws Exception {
        AdminAuditLogMapper mapper = mock(AdminAuditLogMapper.class);
        AdminAuditLogFilter filter = new AdminAuditLogFilter(mapper);
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/admin/questions");
        MockHttpServletResponse response = new MockHttpServletResponse();
        FilterChain chain = (req, res) -> ((MockHttpServletResponse) res).setStatus(200);

        filter.doFilter(request, response, chain);

        verify(mapper, never()).insert(any());
    }
}
