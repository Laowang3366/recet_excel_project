package com.excel.forum.service;

import com.excel.forum.entity.dto.FormulaExplainRequest;
import com.excel.forum.entity.dto.FormulaExplainTaskResponse;

public interface FormulaExplainTaskService {
    FormulaExplainTaskResponse start(Long userId, FormulaExplainRequest request);

    FormulaExplainTaskResponse status(Long userId, String taskId);
}
