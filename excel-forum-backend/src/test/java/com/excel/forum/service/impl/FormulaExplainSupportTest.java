package com.excel.forum.service.impl;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.assertThrows;

class FormulaExplainSupportTest {
    @Test
    void normalizeFormulaKeepsOriginalAndRemovesLeadingEquals() {
        FormulaExplainSupport.Analysis analysis = FormulaExplainSupport.analyze(" =SUM(A1:A10) ");

        assertEquals("=SUM(A1:A10)", analysis.formula());
        assertEquals("SUM(A1:A10)", analysis.normalizedFormula());
    }

    @Test
    void rejectsBlankFormula() {
        IllegalArgumentException error = assertThrows(IllegalArgumentException.class,
                () -> FormulaExplainSupport.analyze("   "));

        assertEquals("请输入需要解释的 Excel 公式", error.getMessage());
    }

    @Test
    void rejectsOverlongFormula() {
        String formula = "=" + "A".repeat(2001);

        IllegalArgumentException error = assertThrows(IllegalArgumentException.class,
                () -> FormulaExplainSupport.analyze(formula));

        assertEquals("公式长度不能超过 2000 个字符", error.getMessage());
    }

    @Test
    void rejectsUnbalancedParenthesesOutsideStringLiterals() {
        IllegalArgumentException error = assertThrows(IllegalArgumentException.class,
                () -> FormulaExplainSupport.analyze("=IF(A1>0,SUM(B:B)"));

        assertEquals("公式括号不完整，请检查后再解释", error.getMessage());
    }

    @Test
    void ignoresParenthesesInsideStringLiterals() {
        FormulaExplainSupport.Analysis analysis = FormulaExplainSupport.analyze("=IF(A1=\"SUM(\",1,0)");

        assertEquals(List.of("IF"), analysis.functions());
    }

    @Test
    void extractsFunctionNamesInOriginalOrder() {
        FormulaExplainSupport.Analysis analysis = FormulaExplainSupport.analyze(
                "=IFERROR(XLOOKUP(A2,客户表[手机号],客户表[姓名]),\"未找到\")");

        assertEquals(List.of("IFERROR", "XLOOKUP"), analysis.functions());
    }

    @Test
    void deterministicAnalysisCapturesFormulaShapeWithoutBusinessExplanation() {
        FormulaExplainSupport.Analysis analysis = FormulaExplainSupport.analyze(
                "=FILTER(客户表[姓名],客户表[金额]>100)");

        assertEquals(1, analysis.parenthesesDepth());
        assertEquals(1, analysis.nestingDepth());
        assertTrue(analysis.structuredReference());
        assertTrue(analysis.dynamicArrayFunction());
        assertTrue(analysis.riskFlags().contains("structured_reference"));
        assertTrue(analysis.riskFlags().contains("dynamic_array"));
    }

    @Test
    void deterministicAnalysisFlagsDeepNestingAndVolatileFunctions() {
        FormulaExplainSupport.Analysis analysis = FormulaExplainSupport.analyze(
                "=IF(A1>0,IF(B1>0,IF(C1>0,NOW(),0),0),0)");

        assertEquals(4, analysis.parenthesesDepth());
        assertEquals(4, analysis.nestingDepth());
        assertFalse(analysis.structuredReference());
        assertFalse(analysis.dynamicArrayFunction());
        assertTrue(analysis.riskFlags().contains("deep_nesting"));
        assertTrue(analysis.riskFlags().contains("volatile_function"));
    }

    @Test
    void extractsJsonObjectFromModelText() {
        String json = FormulaExplainSupport.extractJsonObject("说明：\n{\"summary\":\"ok\"}\n结束");

        assertEquals("{\"summary\":\"ok\"}", json);
    }
}
