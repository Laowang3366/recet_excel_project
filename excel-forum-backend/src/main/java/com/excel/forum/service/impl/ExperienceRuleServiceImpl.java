package com.excel.forum.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.excel.forum.entity.ExperienceRule;
import com.excel.forum.mapper.ExperienceRuleMapper;
import com.excel.forum.service.ExperienceRuleService;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.concurrent.ThreadLocalRandom;

import static com.excel.forum.util.QueryPageUtils.first;

@Service
public class ExperienceRuleServiceImpl extends ServiceImpl<ExperienceRuleMapper, ExperienceRule> implements ExperienceRuleService {

    @Override
    public List<ExperienceRule> listOrderedRules() {
        return list(new QueryWrapper<ExperienceRule>().orderByAsc("id"));
    }

    @Override
    public ExperienceRule getByRuleKey(String ruleKey) {
        return first(this, new QueryWrapper<ExperienceRule>()
                .eq("rule_key", ruleKey)
                .orderByAsc("id"));
    }

    @Override
    public int resolveFixedExp(String ruleKey, int defaultValue) {
        ExperienceRule rule = getByRuleKey(ruleKey);
        if (rule == null) {
            return hasConfiguredRules() ? 0 : defaultValue;
        }
        if (Boolean.FALSE.equals(rule.getEnabled())) {
            return 0;
        }
        int min = safeInt(rule.getMinExp(), defaultValue);
        int max = safeInt(rule.getMaxExp(), min);
        if (max < min) {
            max = min;
        }
        return min == max ? min : max;
    }

    @Override
    public int resolveRandomExp(String ruleKey, int defaultMin, int defaultMax) {
        ExperienceRule rule = getByRuleKey(ruleKey);
        int min = defaultMin;
        int max = defaultMax;
        if (rule == null) {
            if (hasConfiguredRules()) {
                return 0;
            }
        } else if (!Boolean.FALSE.equals(rule.getEnabled())) {
            min = safeInt(rule.getMinExp(), defaultMin);
            max = safeInt(rule.getMaxExp(), defaultMax);
        } else {
            return 0;
        }
        if (min < 0) {
            min = 0;
        }
        if (max < min) {
            max = min;
        }
        return ThreadLocalRandom.current().nextInt(min, max + 1);
    }

    private int safeInt(Integer value, int fallback) {
        return value == null ? fallback : value;
    }

    private boolean hasConfiguredRules() {
        return count() > 0;
    }
}
