# 小试牛刀闯关模式 DTO 与枚举约定

## 1. 目标

统一前后端字段命名、状态枚举和错误码，避免联调阶段反复改字段。

---

## 2. 枚举约定

## 2.1 关卡类型

```text
normal
elite
exam
boss
daily
```

中文显示：

- `normal` -> 普通关
- `elite` -> 精英关
- `exam` -> 测验关
- `boss` -> Boss关
- `daily` -> 每日挑战

## 2.2 难度

```text
easy
medium
hard
expert
```

中文显示：

- `easy` -> 简单
- `medium` -> 普通
- `hard` -> 困难
- `expert` -> 专家

## 2.3 用户关卡状态

```text
locked
available
cleared
perfect
```

中文显示：

- `locked` -> 未解锁
- `available` -> 可挑战
- `cleared` -> 已通关
- `perfect` -> 满星通关

## 2.4 提交结果状态

```text
passed
failed
timeout
```

中文显示：

- `passed` -> 通过
- `failed` -> 失败
- `timeout` -> 超时

---

## 3. DTO 约定

## 3.1 ChapterSummaryDto

字段建议：

- `id: number`
- `worldId: number`
- `name: string`
- `description: string`
- `unlocked: boolean`
- `completed: boolean`
- `totalLevels: number`
- `clearedLevels: number`
- `totalStars: number`
- `maxStars: number`
- `requiredLevel: number`
- `unlockStar: number`

## 3.2 LevelNodeDto

字段建议：

- `id: number`
- `chapterId: number`
- `questionId: number`
- `title: string`
- `levelType: string`
- `difficulty: string`
- `status: string`
- `stars: number`
- `targetTimeSeconds: number`
- `rewardExp: number`
- `rewardPoints: number`
- `sortOrder: number`

## 3.3 CampaignOverviewDto

字段建议：

- `currentChapter: object`
- `currentLevel: object`
- `dailyChallenge: object`
- `summary: object`

## 3.4 CampaignStartResponseDto

字段建议：

- `attemptId: number`
- `startTime: string`
- `targetTimeSeconds: number`

## 3.5 CampaignSubmitResponseDto

字段建议：

- `passed: boolean`
- `resultStatus: string`
- `stars: number`
- `score: number`
- `usedSeconds: number`
- `errorCount: number`
- `gainedExp: number`
- `gainedPoints: number`
- `firstPass: boolean`
- `nextLevelId: number | null`
- `feedback: object`

## 3.6 WrongQuestionDto

字段建议：

- `questionId: number`
- `levelId: number | null`
- `title: string`
- `wrongCount: number`
- `lastWrongTime: string`
- `recommendedLevelId: number | null`

---

## 4. 错误码建议

```text
PRACTICE_LEVEL_NOT_FOUND
PRACTICE_LEVEL_LOCKED
PRACTICE_ATTEMPT_NOT_FOUND
PRACTICE_ATTEMPT_EXPIRED
PRACTICE_SUBMIT_DUPLICATED
PRACTICE_DAILY_CHALLENGE_NOT_AVAILABLE
```

---

## 5. 命名原则

- DTO 返回字段统一使用 `camelCase`
- 枚举值统一保留英文键
- 前端展示统一做中文映射
- 后台配置页显示中文，内部值保持稳定英文
