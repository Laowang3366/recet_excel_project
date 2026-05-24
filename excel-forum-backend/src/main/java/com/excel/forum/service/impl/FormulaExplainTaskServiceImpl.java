package com.excel.forum.service.impl;

import com.excel.forum.entity.dto.FormulaExplainRequest;
import com.excel.forum.entity.dto.FormulaExplainResponse;
import com.excel.forum.entity.dto.FormulaExplainTaskResponse;
import com.excel.forum.service.FormulaExplainService;
import com.excel.forum.service.FormulaExplainTaskService;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executor;

@Service
public class FormulaExplainTaskServiceImpl implements FormulaExplainTaskService {
    private static final Duration TASK_TTL = Duration.ofHours(2);

    private final FormulaExplainService formulaExplainService;
    private final Executor executor;
    private final Map<String, TaskState> tasks = new ConcurrentHashMap<>();

    public FormulaExplainTaskServiceImpl(
            FormulaExplainService formulaExplainService,
            @Qualifier("formulaExplainTaskExecutor") Executor executor) {
        this.formulaExplainService = formulaExplainService;
        this.executor = executor;
    }

    @Override
    public FormulaExplainTaskResponse start(Long userId, FormulaExplainRequest request) {
        if (userId == null) {
            throw new IllegalArgumentException("请先登录");
        }
        pruneExpiredTasks();
        String taskId = UUID.randomUUID().toString();
        TaskState state = new TaskState(taskId, userId, copyRequest(request));
        tasks.put(taskId, state);
        executor.execute(() -> runTask(state));
        return state.toResponse();
    }

    @Override
    public FormulaExplainTaskResponse status(Long userId, String taskId) {
        if (userId == null) {
            throw new IllegalArgumentException("请先登录");
        }
        pruneExpiredTasks();
        TaskState state = taskId == null ? null : tasks.get(taskId);
        if (state == null || !userId.equals(state.userId)) {
            throw new IllegalArgumentException("公式解释任务不存在");
        }
        return state.toResponse();
    }

    private void runTask(TaskState state) {
        try {
            FormulaExplainResponse response = formulaExplainService.explain(state.userId, state.request);
            state.complete(response);
        } catch (RuntimeException e) {
            state.fail(resolveErrorMessage(e));
        }
    }

    private void pruneExpiredTasks() {
        LocalDateTime cutoff = LocalDateTime.now().minus(TASK_TTL);
        tasks.entrySet().removeIf(entry -> entry.getValue().updateTime.isBefore(cutoff));
    }

    private String resolveErrorMessage(RuntimeException error) {
        if (error.getMessage() != null && !error.getMessage().isBlank()) {
            return error.getMessage();
        }
        return "公式解释失败，请稍后重试";
    }

    private FormulaExplainRequest copyRequest(FormulaExplainRequest request) {
        FormulaExplainRequest copy = new FormulaExplainRequest();
        if (request == null) {
            return copy;
        }
        copy.setFormula(request.getFormula());
        copy.setLocale(request.getLocale());
        copy.setDetailLevel(request.getDetailLevel());
        copy.setWorkbookContext(request.getWorkbookContext());
        copy.setExpectedResult(request.getExpectedResult());
        copy.setErrorMessageInput(request.getErrorMessageInput());
        return copy;
    }

    private static final class TaskState {
        private final String taskId;
        private final Long userId;
        private final FormulaExplainRequest request;
        private final LocalDateTime createTime;
        private volatile String status = "pending";
        private volatile FormulaExplainResponse result;
        private volatile String errorMessage;
        private volatile LocalDateTime updateTime;

        private TaskState(String taskId, Long userId, FormulaExplainRequest request) {
            this.taskId = taskId;
            this.userId = userId;
            this.request = request;
            this.createTime = LocalDateTime.now();
            this.updateTime = this.createTime;
        }

        private void complete(FormulaExplainResponse result) {
            this.result = result;
            this.status = "success";
            this.updateTime = LocalDateTime.now();
        }

        private void fail(String errorMessage) {
            this.errorMessage = errorMessage;
            this.status = "error";
            this.updateTime = LocalDateTime.now();
        }

        private FormulaExplainTaskResponse toResponse() {
            FormulaExplainTaskResponse response = new FormulaExplainTaskResponse();
            response.setTaskId(taskId);
            response.setStatus(status);
            response.setRequest(request);
            response.setResult(result);
            response.setErrorMessage(errorMessage);
            response.setCreateTime(createTime);
            response.setUpdateTime(updateTime);
            return response;
        }
    }
}
