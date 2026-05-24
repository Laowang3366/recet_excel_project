package com.excel.forum.service.impl;

import com.excel.forum.entity.dto.FormulaExplainRequest;
import com.excel.forum.entity.dto.FormulaExplainResponse;
import com.excel.forum.entity.dto.FormulaExplainTaskResponse;
import com.excel.forum.service.FormulaExplainService;
import org.junit.jupiter.api.Test;

import java.util.ArrayDeque;
import java.util.Queue;
import java.util.concurrent.Executor;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class FormulaExplainTaskServiceImplTest {
    @Test
    void startKeepsFormulaExplanationRunningUntilPolledAfterCompletion() {
        FormulaExplainService formulaExplainService = mock(FormulaExplainService.class);
        ManualExecutor executor = new ManualExecutor();
        FormulaExplainTaskServiceImpl service = new FormulaExplainTaskServiceImpl(formulaExplainService, executor);
        FormulaExplainRequest request = new FormulaExplainRequest();
        request.setFormula("=SUM(A1:A10)");
        FormulaExplainResponse response = new FormulaExplainResponse();
        response.setFormula("=SUM(A1:A10)");
        response.setNormalizedFormula("SUM(A1:A10)");
        response.setSummary("求和。");
        when(formulaExplainService.explain(eq(7L), any())).thenReturn(response);

        FormulaExplainTaskResponse started = service.start(7L, request);

        assertNotNull(started.getTaskId());
        assertEquals("pending", started.getStatus());
        assertEquals("=SUM(A1:A10)", started.getRequest().getFormula());
        assertEquals("pending", service.status(7L, started.getTaskId()).getStatus());

        executor.runNext();

        FormulaExplainTaskResponse completed = service.status(7L, started.getTaskId());
        assertEquals("success", completed.getStatus());
        assertEquals("求和。", completed.getResult().getSummary());
        assertEquals("=SUM(A1:A10)", completed.getRequest().getFormula());
    }

    @Test
    void statusDoesNotExposeAnotherUsersFormulaTask() {
        FormulaExplainTaskServiceImpl service = new FormulaExplainTaskServiceImpl(mock(FormulaExplainService.class), new ManualExecutor());
        FormulaExplainRequest request = new FormulaExplainRequest();
        request.setFormula("=SUM(A1:A10)");
        FormulaExplainTaskResponse started = service.start(7L, request);

        IllegalArgumentException error = assertThrows(IllegalArgumentException.class,
                () -> service.status(8L, started.getTaskId()));

        assertEquals("公式解释任务不存在", error.getMessage());
    }

    @Test
    void failedFormulaExplanationIsKeptAsTaskErrorForLaterPolling() {
        FormulaExplainService formulaExplainService = mock(FormulaExplainService.class);
        ManualExecutor executor = new ManualExecutor();
        FormulaExplainTaskServiceImpl service = new FormulaExplainTaskServiceImpl(formulaExplainService, executor);
        FormulaExplainRequest request = new FormulaExplainRequest();
        request.setFormula("=SUM(");
        when(formulaExplainService.explain(eq(7L), any())).thenThrow(new IllegalArgumentException("公式括号不完整，请检查后再解释"));

        FormulaExplainTaskResponse started = service.start(7L, request);
        executor.runNext();

        FormulaExplainTaskResponse failed = service.status(7L, started.getTaskId());
        assertEquals("error", failed.getStatus());
        assertEquals("公式括号不完整，请检查后再解释", failed.getErrorMessage());
    }

    private static final class ManualExecutor implements Executor {
        private final Queue<Runnable> tasks = new ArrayDeque<>();

        @Override
        public void execute(Runnable command) {
            tasks.add(command);
        }

        void runNext() {
            tasks.remove().run();
        }
    }
}
