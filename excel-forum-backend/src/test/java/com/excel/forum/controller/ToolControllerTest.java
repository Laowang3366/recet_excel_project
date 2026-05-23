package com.excel.forum.controller;

import com.excel.forum.entity.User;
import com.excel.forum.entity.dto.FormulaExplainResponse;
import com.excel.forum.service.DocumentConversionRecordService;
import com.excel.forum.service.DocumentConversionService;
import com.excel.forum.service.FileStorageService;
import com.excel.forum.service.FormulaExplainService;
import com.excel.forum.service.RateLimitResult;
import com.excel.forum.service.RateLimitService;
import com.excel.forum.service.ToolBillingService;
import com.excel.forum.service.UserService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.http.converter.json.MappingJackson2HttpMessageConverter;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.List;
import java.util.Map;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class ToolControllerTest {
    @Mock
    private DocumentConversionService documentConversionService;
    @Mock
    private DocumentConversionRecordService documentConversionRecordService;
    @Mock
    private UserService userService;
    @Mock
    private RateLimitService rateLimitService;
    @Mock
    private FileStorageService fileStorageService;
    @Mock
    private FormulaExplainService formulaExplainService;
    @Mock
    private ToolBillingService toolBillingService;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(new ToolController(
                        documentConversionService,
                        documentConversionRecordService,
                        userService,
                        rateLimitService,
                        fileStorageService,
                        formulaExplainService,
                        toolBillingService
                ))
                .setMessageConverters(new MappingJackson2HttpMessageConverter())
                .build();
    }

    @Test
    void explainFormulaReturnsUnauthorizedWithoutUser() throws Exception {
        mockMvc.perform(post("/api/tools/formula/explain")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"formula":"=SUM(A1:A10)"}
                                """))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value("请先登录"));

        verify(formulaExplainService, never()).explain(any(), any());
    }

    @Test
    void explainFormulaReturnsTooManyRequestsWhenLimited() throws Exception {
        when(rateLimitService.check(argThat(key -> key != null && key.equals("tools:formula:explain:10m:7")), any(Integer.class), any(), any()))
                .thenReturn(RateLimitResult.limited("公式解释过于频繁，请稍后再试", 33));

        mockMvc.perform(post("/api/tools/formula/explain")
                        .requestAttr("userId", 7L)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"formula":"=SUM(A1:A10)"}
                                """))
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.message").value("公式解释过于频繁，请稍后再试"))
                .andExpect(jsonPath("$.retryAfterSeconds").value(33));

        verify(formulaExplainService, never()).explain(any(), any());
    }

    @Test
    void explainFormulaReturnsStructuredResult() throws Exception {
        FormulaExplainResponse response = new FormulaExplainResponse();
        response.setFormula("=SUM(A1:A10)");
        response.setNormalizedFormula("SUM(A1:A10)");
        response.setSummary("这条公式对 A1 到 A10 求和。");
        response.setFunctions(List.of(new FormulaExplainResponse.FormulaFunction("SUM", "求和")));
        response.setRecordId(15L);
        response.setCacheHit(false);
        response.setPointsCost(1);
        response.setCurrentPoints(99);

        when(rateLimitService.check(any(), any(Integer.class), any(), any())).thenReturn(RateLimitResult.allow());
        when(formulaExplainService.explain(eq(7L), any())).thenReturn(response);

        mockMvc.perform(post("/api/tools/formula/explain")
                        .requestAttr("userId", 7L)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"formula":"=SUM(A1:A10)"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.formula").value("=SUM(A1:A10)"))
                .andExpect(jsonPath("$.normalizedFormula").value("SUM(A1:A10)"))
                .andExpect(jsonPath("$.summary").value("这条公式对 A1 到 A10 求和。"))
                .andExpect(jsonPath("$.functions[0].name").value("SUM"))
                .andExpect(jsonPath("$.recordId").value(15))
                .andExpect(jsonPath("$.cacheHit").value(false))
                .andExpect(jsonPath("$.pointsCost").value(1))
                .andExpect(jsonPath("$.currentPoints").value(99));
    }

    @Test
    void formulaHistoryDelegatesWithCurrentUserOnly() throws Exception {
        when(formulaExplainService.history(7L, 2, 5)).thenReturn(Map.of("records", List.of(), "total", 0));

        mockMvc.perform(get("/api/tools/formula/history")
                        .requestAttr("userId", 7L)
                        .param("page", "2")
                        .param("size", "5"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.total").value(0));

        verify(formulaExplainService).history(7L, 2, 5);
    }

    @Test
    void formulaHistoryDetailDelegatesOwnershipCheckToService() throws Exception {
        FormulaExplainResponse response = new FormulaExplainResponse();
        response.setRecordId(19L);
        response.setSummary("解释");
        response.setFormula("=SUM(A1:A10)");
        response.setNormalizedFormula("SUM(A1:A10)");
        when(formulaExplainService.detail(7L, 19L)).thenReturn(response);

        mockMvc.perform(get("/api/tools/formula/history/19")
                        .requestAttr("userId", 7L))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.recordId").value(19))
                .andExpect(jsonPath("$.summary").value("解释"));

        verify(formulaExplainService).detail(7L, 19L);
    }

    @Test
    void explainFormulaReturnsPaymentRequiredWhenPointsAreInsufficient() throws Exception {
        when(rateLimitService.check(any(), any(Integer.class), any(), any())).thenReturn(RateLimitResult.allow());
        when(formulaExplainService.explain(eq(7L), any())).thenThrow(new IllegalArgumentException("积分不足，公式解释需要 1 积分"));

        mockMvc.perform(post("/api/tools/formula/explain")
                        .requestAttr("userId", 7L)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"formula":"=SUM(A1:A10)"}
                                """))
                .andExpect(status().isPaymentRequired())
                .andExpect(jsonPath("$.message").value("积分不足，公式解释需要 1 积分"));
    }

    @Test
    void convertDocumentReturnsTooManyRequestsWhenRateLimited() throws Exception {
        User user = new User();
        user.setId(7L);
        user.setPoints(100);
        when(userService.getById(7L)).thenReturn(user);
        when(rateLimitService.check(argThat(key -> key != null && key.equals("tools:convert:user:7")), any(Integer.class), any(), any()))
                .thenReturn(RateLimitResult.limited("文档转换过于频繁，请稍后再试", 60));

        MockMultipartFile file = new MockMultipartFile("file", "demo.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", new byte[] { 1, 2, 3 });

        mockMvc.perform(multipart("/api/tools/convert")
                        .file(file)
                        .param("targetType", "pdf")
                        .requestAttr("userId", 7L))
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.message").value("文档转换过于频繁，请稍后再试"))
                .andExpect(jsonPath("$.retryAfterSeconds").value(60));

        verify(toolBillingService, never()).charge(anyLong(), any(Integer.class), any(), any());
        verify(documentConversionService, never()).convert(any(), any());
    }
}
