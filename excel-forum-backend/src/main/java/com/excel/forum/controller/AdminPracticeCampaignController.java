package com.excel.forum.controller;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.excel.forum.entity.PracticeChapter;
import com.excel.forum.entity.PracticeLevel;
import com.excel.forum.entity.Question;
import com.excel.forum.entity.dto.AdminPracticeCampaignLevelRequest;
import com.excel.forum.mapper.PracticeChapterMapper;
import com.excel.forum.mapper.PracticeLevelMapper;
import com.excel.forum.service.PracticeCampaignService;
import com.excel.forum.service.QuestionService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static com.excel.forum.controller.AdminControllerSupport.defaultText;
import static com.excel.forum.controller.AdminControllerSupport.parseBoolean;
import static com.excel.forum.controller.AdminControllerSupport.parseInteger;
import static com.excel.forum.controller.AdminControllerSupport.safeInt;

@RestController
@RequestMapping("/api/admin/practice-campaign")
@RequiredArgsConstructor
public class AdminPracticeCampaignController {
    private final PracticeLevelMapper practiceLevelMapper;
    private final PracticeChapterMapper practiceChapterMapper;
    private final QuestionService questionService;
    private final PracticeCampaignService practiceCampaignService;

    @GetMapping("/levels")
    public ResponseEntity<?> getPracticeCampaignLevels() {
        practiceCampaignService.syncCampaignCatalog();
        QueryWrapper<PracticeLevel> levelQuery = new QueryWrapper<>();
        levelQuery.eq("enabled", true).orderByAsc("chapter_id").orderByAsc("sort_order").orderByAsc("id");
        List<Map<String, Object>> records = practiceLevelMapper.selectList(levelQuery).stream().map(level -> {
            PracticeChapter chapter = practiceChapterMapper.selectById(level.getChapterId());
            Question question = questionService.getById(level.getQuestionId());
            Map<String, Object> item = new HashMap<>();
            item.put("id", level.getId());
            item.put("title", defaultText(level.getTitle(), question == null ? "未命名关卡" : question.getTitle()));
            item.put("chapterId", level.getChapterId());
            item.put("chapterName", chapter == null ? "-" : chapter.getName());
            item.put("questionId", level.getQuestionId());
            item.put("questionTitle", question == null ? "-" : question.getTitle());
            item.put("difficulty", defaultText(level.getDifficulty(), "easy"));
            item.put("levelType", defaultText(level.getLevelType(), "normal"));
            item.put("targetTimeSeconds", safeInt(level.getTargetTimeSeconds()));
            item.put("rewardExp", safeInt(level.getRewardExp()));
            item.put("rewardPoints", safeInt(level.getRewardPoints()));
            item.put("firstPassBonus", safeInt(level.getFirstPassBonus()));
            item.put("enabled", level.getEnabled() == null || level.getEnabled());
            return item;
        }).toList();
        return ResponseEntity.ok(Map.of("records", records));
    }

    @PutMapping("/levels/{id}")
    public ResponseEntity<?> updatePracticeCampaignLevel(@PathVariable Long id, @RequestBody AdminPracticeCampaignLevelRequest body) {
        PracticeLevel level = practiceLevelMapper.selectById(id);
        if (level == null) {
            return ResponseEntity.notFound().build();
        }
        String levelType = body == null || body.getLevelType() == null ? level.getLevelType() : body.getLevelType().trim();
        String difficulty = body == null || body.getDifficulty() == null ? level.getDifficulty() : body.getDifficulty().trim();
        Integer targetTimeSeconds = body == null || body.getTargetTimeSeconds() == null ? level.getTargetTimeSeconds() : parseInteger(body.getTargetTimeSeconds());
        Integer rewardExp = body == null || body.getRewardExp() == null ? level.getRewardExp() : parseInteger(body.getRewardExp());
        Integer rewardPoints = body == null || body.getRewardPoints() == null ? level.getRewardPoints() : parseInteger(body.getRewardPoints());
        Integer firstPassBonus = body == null || body.getFirstPassBonus() == null ? level.getFirstPassBonus() : parseInteger(body.getFirstPassBonus());
        Boolean enabled = body == null || body.getEnabled() == null ? level.getEnabled() : parseBoolean(body.getEnabled(), true);

        level.setLevelType(defaultText(levelType, "normal"));
        level.setDifficulty(defaultText(difficulty, "easy"));
        level.setTargetTimeSeconds(targetTimeSeconds == null ? 300 : Math.max(30, targetTimeSeconds));
        level.setRewardExp(rewardExp == null ? 10 : Math.max(0, rewardExp));
        level.setRewardPoints(rewardPoints == null ? 5 : Math.max(0, rewardPoints));
        level.setFirstPassBonus(firstPassBonus == null ? 0 : Math.max(0, firstPassBonus));
        level.setEnabled(enabled);
        practiceLevelMapper.updateById(level);
        return ResponseEntity.ok(Map.of("message", "关卡配置已更新"));
    }

}
