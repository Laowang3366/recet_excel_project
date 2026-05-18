package com.excel.forum.util;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;

import java.util.List;

public final class QueryPageUtils {
    private QueryPageUtils() {
    }

    public static <T> T first(BaseMapper<T> mapper, QueryWrapper<T> queryWrapper) {
        List<T> records = limit(mapper, queryWrapper, 1);
        return records.isEmpty() ? null : records.get(0);
    }

    public static <T> List<T> limit(BaseMapper<T> mapper, QueryWrapper<T> queryWrapper, long size) {
        Page<T> page = new Page<>(1, Math.max(1, size), false);
        Page<T> result = mapper.selectPage(page, queryWrapper);
        if (result == null || result.getRecords() == null) {
            return List.of();
        }
        return result.getRecords();
    }
}
