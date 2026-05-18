package com.excel.forum.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.excel.forum.entity.PointsRuleOption;
import com.excel.forum.mapper.PointsRuleOptionMapper;
import com.excel.forum.service.PointsRuleOptionService;
import org.springframework.stereotype.Service;

import java.util.List;

import static com.excel.forum.util.QueryPageUtils.first;

@Service
public class PointsRuleOptionServiceImpl extends ServiceImpl<PointsRuleOptionMapper, PointsRuleOption> implements PointsRuleOptionService {
    @Override
    public List<PointsRuleOption> listByKind(String kind) {
        QueryWrapper<PointsRuleOption> queryWrapper = new QueryWrapper<>();
        queryWrapper.eq("kind", kind)
                .orderByAsc("sort_order")
                .orderByAsc("id");
        return list(queryWrapper);
    }

    @Override
    public PointsRuleOption getByKindAndValue(String kind, String optionValue) {
        if (kind == null || kind.isBlank() || optionValue == null || optionValue.isBlank()) {
            return null;
        }
        QueryWrapper<PointsRuleOption> queryWrapper = new QueryWrapper<>();
        queryWrapper.eq("kind", kind)
                .eq("option_value", optionValue)
                .orderByAsc("id");
        return first(this, queryWrapper);
    }
}
