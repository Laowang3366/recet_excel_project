package com.excel.forum.service.impl;

import com.excel.forum.entity.dto.FormulaExplainRequest;
import com.excel.forum.entity.dto.FormulaExplainResponse;
import com.excel.forum.mapper.FormulaExplainRecordMapper;
import com.excel.forum.service.AiAssistantCallLogService;
import com.excel.forum.service.AiCompletionService;
import com.excel.forum.service.ToolBillingService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class FormulaExplainServiceImplTest {
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void firstExplainChargesOnePointAndStoresRecord() {
        AiAssistantCallLogService callLogService = mock(AiAssistantCallLogService.class);
        FormulaExplainRecordMapper recordMapper = mock(FormulaExplainRecordMapper.class);
        ToolBillingService billingService = mock(ToolBillingService.class);
        when(billingService.charge(7L, 1, "formula_explain", "公式解释扣除 1 积分"))
                .thenReturn(new ToolBillingService.BillingResult(99));
        FormulaExplainServiceImpl service = new FormulaExplainServiceImpl(request ->
                new AiCompletionService.Result("""
                        {
                          "summary": "这条公式按手机号查找姓名。",
                          "segments": [{"text": "XLOOKUP(A2,客户表[手机号],客户表[姓名])", "title": "查找姓名", "explanation": "按 A2 在手机号列查找并返回姓名。"}],
                          "functions": [{"name": "XLOOKUP", "purpose": "查找并返回匹配结果"}],
                          "warnings": ["查找列和返回列长度必须一致。"],
                          "suggestions": ["可以使用 XLOOKUP 的 if_not_found 参数。"],
                          "fixes": ["补充 if_not_found。"]
                        }
                        """, "gpt-test", false, 3L), callLogService, recordMapper, billingService, objectMapper);

        FormulaExplainRequest request = new FormulaExplainRequest();
        request.setFormula("=XLOOKUP(A2,客户表[手机号],客户表[姓名])");

        FormulaExplainResponse response = service.explain(7L, request);

        assertEquals("=XLOOKUP(A2,客户表[手机号],客户表[姓名])", response.getFormula());
        assertEquals("XLOOKUP(A2,客户表[手机号],客户表[姓名])", response.getNormalizedFormula());
        assertEquals("这条公式按手机号查找姓名。", response.getSummary());
        assertEquals("XLOOKUP", response.getFunctions().get(0).getName());
        assertEquals("gpt-test", response.getModel());
        assertEquals(1, response.getPointsCost());
        assertEquals(99, response.getCurrentPoints());
        assertFalse(response.isCacheHit());
        assertTrue(response.getFixes().contains("补充 if_not_found。"));
        assertTrue(response.getAnalysis().getFunctions().contains("XLOOKUP"));
        verify(recordMapper).insert(argThat(record -> record.getUserId().equals(7L)
                && "success".equals(record.getStatus())
                && !record.getCacheHit()
                && record.getPointsCost() == 1));
        verify(callLogService).record(eq(7L), eq(3L), eq("gpt-test"), eq("formula_explain"), eq(true), eq(false), anyLong(), eq(null));
        verify(billingService).charge(7L, 1, "formula_explain", "公式解释扣除 1 积分");
    }

    @Test
    void explainRejectsAnonymousUser() {
        FormulaExplainServiceImpl service = new FormulaExplainServiceImpl(request ->
                new AiCompletionService.Result("{}", "gpt-test", false, 3L),
                mock(AiAssistantCallLogService.class),
                mock(FormulaExplainRecordMapper.class),
                mock(ToolBillingService.class),
                objectMapper);
        FormulaExplainRequest request = new FormulaExplainRequest();
        request.setFormula("=SUM(A1:A10)");

        IllegalArgumentException error = assertThrows(IllegalArgumentException.class,
                () -> service.explain(null, request));

        assertEquals("请先登录", error.getMessage());
    }

    @Test
    void explainConvertsInvalidModelJsonToControlledError() {
        AiAssistantCallLogService callLogService = mock(AiAssistantCallLogService.class);
        ToolBillingService billingService = mock(ToolBillingService.class);
        when(billingService.charge(7L, 1, "formula_explain", "公式解释扣除 1 积分"))
                .thenReturn(new ToolBillingService.BillingResult(99));
        FormulaExplainServiceImpl service = new FormulaExplainServiceImpl(request ->
                new AiCompletionService.Result("not-json", "gpt-test", false, 3L),
                callLogService,
                mock(FormulaExplainRecordMapper.class),
                billingService,
                objectMapper);
        FormulaExplainRequest request = new FormulaExplainRequest();
        request.setFormula("=SUM(A1:A10)");

        IllegalStateException error = assertThrows(IllegalStateException.class,
                () -> service.explain(7L, request));

        assertEquals("公式解释结果解析失败，请稍后重试", error.getMessage());
        verify(callLogService).record(eq(7L), eq(3L), eq("gpt-test"), eq("formula_explain"), eq(false), eq(false), anyLong(), eq("公式解释结果解析失败，请稍后重试"));
    }

    @Test
    void cacheHitDoesNotCallAiOrChargeAndStillCreatesUserRecord() {
        AiCompletionService aiCompletionService = mock(AiCompletionService.class);
        AiAssistantCallLogService callLogService = mock(AiAssistantCallLogService.class);
        FormulaExplainRecordMapper recordMapper = mock(FormulaExplainRecordMapper.class);
        ToolBillingService billingService = mock(ToolBillingService.class);
        com.excel.forum.entity.FormulaExplainRecord cached = new com.excel.forum.entity.FormulaExplainRecord();
        cached.setResponseJson("""
                {"summary":"缓存解释","segments":[],"functions":[{"name":"SUM","purpose":"求和"}],"warnings":[],"suggestions":[],"fixes":[],"analysis":{"functions":["SUM"]}}
                """);
        cached.setSummary("缓存解释");
        cached.setModel("gpt-cache");
        cached.setFallbackUsed(false);
        when(recordMapper.selectSuccessfulCache(any(), any(), any(), any(), any(), any(), any()))
                .thenReturn(cached);
        when(billingService.currentPoints(8L)).thenReturn(42);
        FormulaExplainServiceImpl service = new FormulaExplainServiceImpl(aiCompletionService, callLogService, recordMapper, billingService, objectMapper);

        FormulaExplainRequest request = new FormulaExplainRequest();
        request.setFormula("=SUM(A1:A10)");

        FormulaExplainResponse response = service.explain(8L, request);

        assertTrue(response.isCacheHit());
        assertEquals(0, response.getPointsCost());
        assertEquals(42, response.getCurrentPoints());
        assertEquals("缓存解释", response.getSummary());
        verify(aiCompletionService, never()).complete(any());
        verify(billingService, never()).charge(anyLong(), any(Integer.class), any(), any());
        verify(recordMapper).insert(argThat(record -> record.getUserId().equals(8L)
                && record.getCacheHit()
                && record.getPointsCost() == 0
                && "success".equals(record.getStatus())));
    }

    @Test
    void workbookContextParticipatesInHash() {
        FormulaExplainServiceImpl service = new FormulaExplainServiceImpl(
                mock(AiCompletionService.class),
                mock(AiAssistantCallLogService.class),
                mock(FormulaExplainRecordMapper.class),
                mock(ToolBillingService.class),
                objectMapper);
        FormulaExplainRequest first = new FormulaExplainRequest();
        first.setFormula("=SUM(A1:A10)");
        first.setWorkbookContext("A列是销售额");
        FormulaExplainRequest second = new FormulaExplainRequest();
        second.setFormula("=SUM(A1:A10)");
        second.setWorkbookContext("A列是成本");

        assertFalse(service.cacheKeyForTest(first).equals(service.cacheKeyForTest(second)));
    }
}
