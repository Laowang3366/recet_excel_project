# 小试牛刀闯关模式接口设计说明

## 1. 设计目标

接口设计要支持以下能力：

- 闯关大厅展示
- 章节地图读取
- 关卡详情读取
- 挑战开始与提交
- 进度同步
- 每日挑战
- 排行榜
- 错题重练

## 2. 接口列表

### 2.1 闯关大厅总览

`GET /api/practice/campaign/overview`

用途：

- 首页/闯关大厅加载总览数据

返回建议：

```json
{
  "currentChapter": {
    "id": 1,
    "name": "新手试炼",
    "progress": 62,
    "totalStars": 18
  },
  "currentLevel": {
    "id": 8,
    "title": "绝对引用试炼",
    "status": "available"
  },
  "dailyChallenge": {
    "id": 3,
    "title": "今日挑战：条件统计",
    "rewardExp": 40,
    "rewardPoints": 20
  },
  "summary": {
    "totalStars": 36,
    "clearedLevels": 22,
    "perfectLevels": 11,
    "currentStreak": 4
  }
}
```

### 2.2 章节列表

`GET /api/practice/campaign/chapters`

用途：

- 地图首页展示全部章节

返回字段建议：

- id
- worldId
- name
- description
- unlocked
- completed
- totalLevels
- clearedLevels
- totalStars
- maxStars
- requiredLevel
- unlockStar

### 2.3 单章节详情

`GET /api/practice/campaign/chapters/{chapterId}`

用途：

- 展示章节地图

返回字段建议：

```json
{
  "chapter": {
    "id": 1,
    "name": "新手试炼",
    "description": "完成基础函数与引用训练",
    "totalStars": 18,
    "maxStars": 27,
    "completed": false
  },
  "levels": [
    {
      "id": 101,
      "title": "求和起步",
      "levelType": "normal",
      "difficulty": "easy",
      "status": "perfect",
      "stars": 3,
      "targetTimeSeconds": 180,
      "sortOrder": 1
    }
  ]
}
```

### 2.4 关卡详情

`GET /api/practice/campaign/levels/{levelId}`

用途：

- 关卡准备页
- 答题页加载关卡元信息

返回字段建议：

- level.id
- level.title
- level.levelType
- level.difficulty
- level.targetTimeSeconds
- level.rewardExp
- level.rewardPoints
- level.firstPassBonus
- chapter.id
- chapter.name
- question.id
- question.title
- question.templateUrl
- question.answerConfig

### 2.5 开始挑战

`POST /api/practice/campaign/levels/{levelId}/start`

用途：

- 创建挑战会话
- 返回本次挑战 token

请求体建议：

```json
{
  "attemptType": "campaign"
}
```

返回字段建议：

```json
{
  "attemptId": 998,
  "startTime": "2026-04-14T20:00:00",
  "targetTimeSeconds": 180
}
```

### 2.6 提交答案

`POST /api/practice/campaign/levels/{levelId}/submit`

用途：

- 提交本关答案并计算结果

请求体建议：

```json
{
  "attemptId": 998,
  "usedSeconds": 132,
  "snapshot": {},
  "answerPayload": {}
}
```

返回字段建议：

```json
{
  "passed": true,
  "stars": 3,
  "score": 100,
  "usedSeconds": 132,
  "errorCount": 0,
  "gainedExp": 25,
  "gainedPoints": 10,
  "firstPass": true,
  "nextLevelId": 102,
  "feedback": {
    "knowledgePoints": ["绝对引用", "求和函数"],
    "summary": "本关完成良好"
  }
}
```

### 2.7 用户进度总览

`GET /api/practice/campaign/progress`

用途：

- 个人进度页
- 大厅快速读取

返回字段建议：

- totalStars
- clearedLevels
- perfectLevels
- unlockedChapters
- currentStreak
- wrongQuestionCount

### 2.8 每日挑战

`GET /api/practice/campaign/daily-challenge`

用途：

- 读取当天挑战内容

返回字段建议：

- challengeId
- levelId
- title
- rewardExp
- rewardPoints
- joined
- completed

### 2.9 排行榜

`GET /api/practice/campaign/rankings?scope=daily`

支持 scope：

- `daily`
- `weekly`
- `all`

返回字段建议：

- userId
- username
- avatar
- score
- clearedLevels
- perfectLevels
- rank

### 2.10 错题本

`GET /api/practice/campaign/wrongs`

用途：

- 查看错题记录
- 推荐重新挑战

返回字段建议：

- questionId
- levelId
- title
- wrongCount
- lastWrongTime
- recommendedLevelId

## 3. 前端状态建议

前端关卡状态建议统一为：

- `locked`
- `available`
- `cleared`
- `perfect`

这样前后端一致，页面渲染更稳定。

## 4. 错误码建议

建议统一业务错误码：

- `PRACTICE_LEVEL_LOCKED`
- `PRACTICE_LEVEL_NOT_FOUND`
- `PRACTICE_ATTEMPT_EXPIRED`
- `PRACTICE_SUBMIT_DUPLICATED`
- `PRACTICE_DAILY_CHALLENGE_NOT_AVAILABLE`

## 5. 首期优先实现接口

MVP 最先实现：

- `GET /overview`
- `GET /chapters`
- `GET /chapters/{id}`
- `GET /levels/{id}`
- `POST /levels/{id}/start`
- `POST /levels/{id}/submit`

其余接口可在第二阶段补齐。
