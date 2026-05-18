package com.excel.forum.controller;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.excel.forum.entity.DailyChallenge;
import com.excel.forum.entity.PracticeChapter;
import com.excel.forum.entity.PracticeLevel;
import com.excel.forum.entity.Question;
import com.excel.forum.entity.dto.AdminPracticeCampaignLevelRequest;
import com.excel.forum.entity.dto.AdminPracticeDailyChallengeRequest;
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
import static com.excel.forum.util.QueryPageUtils.first;

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

    @GetMapping("/daily-challenge")
    public ResponseEntity<?> getPracticeCampaignDailyChallengeConfig() {
        QueryWrapper<DailyChallenge> queryWrapper = new QueryWrapper<>();
        queryWrapper.orderByDesc("challenge_date").orderByDesc("id");
        DailyChallenge challenge = first(dailyChallengeMapper, queryWrapper);
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
    public ResponseEntity<?> savePracticeCampaignDailyChallenge(@RequestBody AdminPracticeDailyChallengeRequest body) {
        Long levelId = parseLong(body == null ? null : body.getLevelId());
        LocalDate challengeDate = parseLocalDate(body == null ? null : body.getChallengeDate());
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
        queryWrapper.eq("challenge_date", challengeDate).orderByDesc("id");
        DailyChallenge challenge = first(dailyChallengeMapper, queryWrapper);
        if (challenge == null) {
            challenge = new DailyChallenge();
            challenge.setChallengeDate(challengeDate);
        }
        challenge.setLevelId(levelId);
        challenge.setRewardExp(parseInteger(body == null ? null : body.getRewardExp(), safeInt(level.getRewardExp())));
        challenge.setRewardPoints(parseInteger(body == null ? null : body.getRewardPoints(), safeInt(level.getRewardPoints())));
        challenge.setEnabled(parseBoolean(body == null ? null : body.getEnabled(), true));
        if (challenge.getId() == null) {
            dailyChallengeMapper.insert(challenge);
        } else {
            dailyChallengeMapper.updateById(challenge);
        }
        return ResponseEntity.ok(Map.of("message", "每日挑战已更新"));
    }
}
