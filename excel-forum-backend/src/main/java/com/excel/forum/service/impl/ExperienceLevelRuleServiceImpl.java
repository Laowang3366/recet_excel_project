package com.excel.forum.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.excel.forum.entity.ExperienceLevelRule;
import com.excel.forum.mapper.ExperienceLevelRuleMapper;
import com.excel.forum.service.ExperienceLevelRuleService;
import org.springframework.stereotype.Service;

import java.util.List;

import static com.excel.forum.util.QueryPageUtils.first;

@Service
public class ExperienceLevelRuleServiceImpl extends ServiceImpl<ExperienceLevelRuleMapper, ExperienceLevelRule> implements ExperienceLevelRuleService {

    @Override
    public List<ExperienceLevelRule> listOrderedRules() {
        return list(new QueryWrapper<ExperienceLevelRule>()
                .orderByAsc("sort_order")
                .orderByAsc("level")
                .orderByAsc("id"));
    }

    @Override
    public List<ExperienceLevelRule> listEnabledRules() {
        return list(new QueryWrapper<ExperienceLevelRule>()
                .eq("enabled", true)
                .orderByAsc("sort_order")
                .orderByAsc("level")
                .orderByAsc("id"));
    }

    @Override
    public ExperienceLevelRule getByLevel(Integer level) {
        if (level == null) return null;
        return first(this, new QueryWrapper<ExperienceLevelRule>()
                .eq("level", level)
                .orderByAsc("id"));
    }
}
