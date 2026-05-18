package com.excel.forum.controller;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.excel.forum.entity.DailyChallenge;
import com.excel.forum.entity.PracticeChapter;
import com.excel.forum.entity.PracticeLevel;
import com.excel.forum.entity.Question;
import com.excel.forum.mapper.DailyChallengeMapper;
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

import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static com.excel.forum.controller.AdminControllerSupport.defaultText;
import static com.excel.forum.controller.AdminControllerSupport.parseBoolean;
import static com.excel.forum.controller.AdminControllerSupport.parseInteger;
import static com.excel.forum.controller.AdminControllerSupport.parseLocalDate;
import static com.excel.forum.controller.AdminControllerSupport.parseLong;
import static com.excel.forum.controller.AdminControllerSupport.safeInt;

@RestController
@RequestMapping("/api/admin/practice-campaign")
@RequiredArgsConstructor
public class AdminPracticeCampaignController {
    private final PracticeLevelMapper practiceLevelMapper;
    private final PracticeChapterMapper practiceChapterMapper;
    private final DailyChallengeMapper dailyChallengeMapper;
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
    public ResponseEntity<?> updatePracticeCampaignLevel(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        PracticeLevel level = practiceLevelMapper.selectById(id);
        if (level == null) {
            return ResponseEntity.notFound().build();
        }
        String levelType = body.get("levelType") == null ? level.getLevelType() : String.valueOf(body.get("levelType")).trim();
        String difficulty = body.get("difficulty") == null ? level.getDifficulty() : String.valueOf(body.get("difficulty")).trim();
        Integer targetTimeSeconds = body.get("targetTimeSeconds") == null ? level.getTargetTimeSeconds() : parseInteger(body.get("targetTimeSeconds"));
        Integer rewardExp = body.get("rewardExp") == null ? level.getRewardExp() : parseInteger(body.get("rewardExp"));
        Integer rewardPoints = body.get("rewardPoints") == null ? level.getRewardPoints() : parseInteger(body.get("rewardPoints"));
        Integer firstPassBonus = body.get("firstPassBonus") == null ? level.getFirstPassBonus() : parseInteger(body.get("firstPassBonus"));
        Boolean enabled = body.get("enabled") == null ? level.getEnabled() : parseBoolean(body.get("enabled"), true);

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

    @GetMapping("/daily-challenge")
    public ResponseEntity<?> getPracticeCampaignDailyChallengeConfig() {
        QueryWrapper<DailyChallenge> queryWrapper = new QueryWrapper<>();
        queryWrapper.orderByDesc("challenge_date").orderByDesc("id").last("limit 1");
        DailyChallenge challenge = dailyChallengeMapper.selectOne(queryWrapper);
        if (challenge == null) {
            return ResponseEntity.ok(Map.of("record", Map.of()));
        }
        PracticeLevel level = practiceLevelMapper.selectById(challenge.getLevelId());
        PracticeChapter chapter = level == null ? null : practiceChapterMapper.selectById(level.getChapterId());
        return ResponseEntity.ok(Map.of("record", Map.of(
                "id", challenge.getId(),
                "challengeDate", challenge.getChallengeDate(),
                "levelId", challenge.getLevelId(),
                "levelTitle", level == null ? "-" : defaultText(level.getTitle(), "未命名关卡"),
                "chapterName", chapter == null ? "-" : chapter.getName(),
                "rewardExp", safeInt(challenge.getRewardExp()),
                "rewardPoints", safeInt(challenge.getRewardPoints()),
                "enabled", challenge.getEnabled() == null || challenge.getEnabled()
        )));
    }

    @PutMapping("/daily-challenge")
    public ResponseEntity<?> savePracticeCampaignDailyChallenge(@RequestBody Map<String, Object> body) {
        Long levelId = parseLong(body.get("levelId"));
        LocalDate challengeDate = parseLocalDate(body.get("challengeDate"));
        if (levelId == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "请选择每日挑战关卡"));
        }
        if (challengeDate == null) {
            challengeDate = LocalDate.now();
        }
        PracticeLevel level = practiceLevelMapper.selectById(levelId);
        if (level == null || !Boolean.TRUE.equals(level.getEnabled())) {
            return ResponseEntity.badRequest().body(Map.of("message", "所选关卡不存在或未启用"));
        }
        QueryWrapper<DailyChallenge> queryWrapper = new QueryWrapper<>();
        queryWrapper.eq("challenge_date", challengeDate).last("limit 1");
        DailyChallenge challenge = dailyChallengeMapper.selectOne(queryWrapper);
        if (challenge == null) {
            challenge = new DailyChallenge();
            challenge.setChallengeDate(challengeDate);
        }
        challenge.setLevelId(levelId);
        challenge.setRewardExp(parseInteger(body.get("rewardExp"), safeInt(level.getRewardExp())));
        challenge.setRewardPoints(parseInteger(body.get("rewardPoints"), safeInt(level.getRewardPoints())));
        challenge.setEnabled(parseBoolean(body.get("enabled"), true));
        if (challenge.getId() == null) {
            dailyChallengeMapper.insert(challenge);
        } else {
            dailyChallengeMapper.updateById(challenge);
        }
        return ResponseEntity.ok(Map.of("message", "每日挑战已更新"));
    }
}
