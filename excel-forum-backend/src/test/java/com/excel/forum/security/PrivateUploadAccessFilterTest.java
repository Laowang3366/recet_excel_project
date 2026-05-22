package com.excel.forum.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.ServletRequest;
import jakarta.servlet.ServletResponse;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import java.io.IOException;
import java.util.concurrent.atomic.AtomicBoolean;

import static org.assertj.core.api.Assertions.assertThat;

class PrivateUploadAccessFilterTest {

    @Test
    void blocksPrivateUploadDirectAccess() throws Exception {
        PrivateUploadAccessFilter filter = new PrivateUploadAccessFilter();
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/uploads/private/conversions/a.xlsx");
        MockHttpServletResponse response = new MockHttpServletResponse();
        AtomicBoolean chainCalled = new AtomicBoolean(false);

        filter.doFilter(request, response, trackingChain(chainCalled));

        assertThat(response.getStatus()).isEqualTo(404);
        assertThat(chainCalled).isFalse();
    }

    @Test
    void allowsPublicUploadDirectAccess() throws Exception {
        PrivateUploadAccessFilter filter = new PrivateUploadAccessFilter();
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/uploads/avatar.png");
        MockHttpServletResponse response = new MockHttpServletResponse();
        AtomicBoolean chainCalled = new AtomicBoolean(false);

        filter.doFilter(request, response, trackingChain(chainCalled));

        assertThat(chainCalled).isTrue();
    }

    private FilterChain trackingChain(AtomicBoolean called) {
        return new FilterChain() {
            @Override
            public void doFilter(ServletRequest request, ServletResponse response) throws IOException, ServletException {
                called.set(true);
            }
        };
    }
}
