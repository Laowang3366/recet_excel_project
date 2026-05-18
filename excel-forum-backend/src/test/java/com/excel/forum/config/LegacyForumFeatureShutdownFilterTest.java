package com.excel.forum.config;

import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

class LegacyForumFeatureShutdownFilterTest {

    private final LegacyForumFeatureShutdownFilter filter = new LegacyForumFeatureShutdownFilter();

    @Test
    void returnsGoneForLegacyForumEndpoints() throws Exception {
        assertGone("GET", "/api/posts");
        assertGone("GET", "/api/posts/search");
        assertGone("GET", "/api/categories");
        assertGone("POST", "/api/chat/send");
        assertGone("GET", "/api/messages/conversations");
        assertGone("POST", "/api/admin/posts/1/review");
        assertGone("GET", "/api/admin/reports");
        assertGone("GET", "/api/admin/categories");
        assertGone("GET", "/api/admin/drafts");
        assertGone("GET", "/api/admin/replies");
        assertGone("GET", "/api/users/recent");
        assertGone("GET", "/api/users/online");
        assertGone("GET", "/api/users/search");
        assertGone("GET", "/api/users/7");
        assertGone("GET", "/api/users/7/center-overview");
        assertGone("GET", "/api/users/7/posts");
        assertGone("GET", "/api/users/7/replies");
        assertGone("GET", "/api/users/7/favorites");
        assertGone("GET", "/api/users/7/following");
        assertGone("GET", "/api/users/7/followers");
        assertGone("POST", "/api/users/7/follow");
        assertGone("DELETE", "/api/users/7/follow");
        assertGone("GET", "/api/users/7/is-following");
        assertGone("GET", "/api/users/7/view-history");
        assertGone("GET", "/api/users/center/activity");
        assertGone("GET", "/api/users/center/posts");
        assertGone("GET", "/api/users/category-follows");
        assertGone("POST", "/api/users/category-follows/3");
        assertGone("DELETE", "/api/users/category-follows/3");
        assertGone("GET", "/api/users/category-follows/3/status");
    }

    @Test
    void allowsCurrentProductEndpoints() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/practice/campaign/chapters");
        MockHttpServletResponse response = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);

        filter.doFilter(request, response, chain);

        assertThat(response.getStatus()).isEqualTo(HttpStatus.OK.value());
        verify(chain).doFilter(request, response);

        assertAllowed("GET", "/api/users/center/overview");
        assertAllowed("PUT", "/api/users/7");
        assertAllowed("GET", "/api/users/privacy");
        assertAllowed("PUT", "/api/users/privacy");
        assertAllowed("GET", "/api/users/me/props");
        assertAllowed("POST", "/api/users/me/props/5/use");
        assertAllowed("POST", "/api/users/me/props/5/unequip");
    }

    private void assertGone(String method, String uri) throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest(method, uri);
        MockHttpServletResponse response = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);

        filter.doFilter(request, response, chain);

        assertThat(response.getStatus()).isEqualTo(HttpStatus.GONE.value());
        assertThat(response.getContentType()).isEqualTo("application/json;charset=UTF-8");
        assertThat(response.getContentAsString()).contains("该功能已下线");
        verify(chain, never()).doFilter(request, response);
    }

    private void assertAllowed(String method, String uri) throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest(method, uri);
        MockHttpServletResponse response = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);

        filter.doFilter(request, response, chain);

        assertThat(response.getStatus()).isEqualTo(HttpStatus.OK.value());
        verify(chain).doFilter(request, response);
    }
}
