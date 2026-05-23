package com.excel.forum.service;

import com.excel.forum.entity.dto.FormulaExplainRequest;
import com.excel.forum.entity.dto.FormulaExplainResponse;

import java.util.Map;

public interface FormulaExplainService {
    FormulaExplainResponse explain(Long userId, FormulaExplainRequest request);

    Map<String, Object> history(Long userId, int page, int size);

    FormulaExplainResponse detail(Long userId, Long id);
}
