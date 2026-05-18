# 小试牛刀闯关模式项目实施说明

## 1. 文档目标

这份文档不是产品方案，而是研发落地说明。

目标：

- 指出当前项目里具体该改哪些文件
- 指出现有模块哪些可以复用
- 指出哪些地方需要新增而不是重写

---

## 2. 当前项目现状

### 前端现状

当前练习相关页面：

- `reace_web/src/app/pages/Practice.tsx`
- `reace_web/src/app/pages/PracticeDetail.tsx`
- `reace_web/src/app/pages/PracticeHistory.tsx`
- `reace_web/src/app/pages/PracticeRecordDetail.tsx`

可直接判断：

- 题目列表页已有
- 答题编辑页已有
- 历史记录页已有
- 结果详情页已有

因此第一阶段不需要推翻答题能力，只需要在外层套一层“闯关结构”。

### 后端现状

后端已有：

- 练习题接口
- 提交答案接口
- 历史记录能力
- 用户积分与等级能力

因此第一阶段建议：

- 复用现有练习题与答题逻辑
- 新增“章节 / 关卡 / 进度 / 挑战记录”能力

---

## 3. 前端实施建议

## 3.1 `Practice.tsx`

当前角色：

- 练习首页 / 题目列表页

建议改造为：

- 闯关大厅

需要新增内容：

- 当前进度卡
- 章节入口卡
- 每日挑战入口
- 错题重练入口
- 排行榜入口

建议保留：

- 用户练习统计
- 排行信息中可复用的数据区块

建议去掉：

- 传统题目列表作为默认主结构

---

## 3.2 `PracticeDetail.tsx`

当前角色：

- 题目答题页

建议改造为：

- 闯关答题页

需要新增：

- 关卡标题
- 所属章节
- 目标时间
- 当前挑战 attemptId
- 提交后进入闯关结算页

建议复用：

- Excel 编辑器
- 提交答案流程
- 当前题目渲染结构

---

## 3.3 `PracticeHistory.tsx`

当前角色：

- 历史记录列表

建议处理方式：

- 第一阶段继续保留
- 第二阶段增加闯关筛选

可新增筛选：

- 普通练习
- 闯关记录
- 每日挑战

---

## 3.4 `PracticeRecordDetail.tsx`

当前角色：

- 练习结果详情页

建议改造：

- 作为“历史结算详情页”继续保留
- 新增对闯关 attempt 的兼容展示

建议新增：

- 所属章节
- 所属关卡
- 获得星级
- 是否首通

---

## 3.5 新增前端页面

建议新增：

- `CampaignChapter.tsx`
  对应章节地图页
- `CampaignLevelPrepare.tsx`
  对应关卡准备页
- `CampaignResult.tsx`
  对应闯关结算页
- `CampaignWrongBook.tsx`
  对应错题重练页
- `CampaignRanking.tsx`
  对应排行榜页

---

## 4. 路由建议

建议在 `reace_web/src/app/routes.tsx` 增加：

- `/practice`
  闯关大厅
- `/practice/chapter/:id`
  章节地图
- `/practice/level/:id/prepare`
  关卡准备页
- `/practice/level/:id/play`
  闯关答题页
- `/practice/result/:attemptId`
  结算页
- `/practice/wrongs`
  错题本
- `/practice/ranking`
  排行榜

注意：

- 第一阶段可让 `/practice/question/:id` 继续存在
- 但闯关路径应逐步成为主路径

---

## 5. 后端实施建议

## 5.1 Controller 层

建议新增：

- `PracticeCampaignController.java`

建议接口归到：

- `/api/practice/campaign/**`

原因：

- 不污染现有普通练习接口
- 闯关与传统练习逻辑边界清晰

---

## 5.2 Service 层

建议新增：

- `PracticeCampaignService`
- `PracticeCampaignProgressService`
- `PracticeCampaignRankingService`

职责建议：

- `PracticeCampaignService`
  章节、关卡、挑战主流程
- `PracticeCampaignProgressService`
  用户关卡与章节进度更新
- `PracticeCampaignRankingService`
  排行统计

---

## 5.3 Entity 层

建议新增实体：

- `PracticeWorld`
- `PracticeChapter`
- `PracticeLevel`
- `UserLevelProgress`
- `UserChapterProgress`
- `PracticeAttempt`
- `DailyChallenge`
- `UserWrongQuestion`

---

## 5.4 Mapper 层

建议新增：

- `PracticeWorldMapper`
- `PracticeChapterMapper`
- `PracticeLevelMapper`
- `UserLevelProgressMapper`
- `UserChapterProgressMapper`
- `PracticeAttemptMapper`
- `DailyChallengeMapper`
- `UserWrongQuestionMapper`

---

## 6. 与现有练习系统的融合方式

### 原则

不要把现有练习系统整体推翻。

建议方式：

- 现有题目表继续保留
- 闯关关卡通过 `question_id` 关联现有题目
- 提交时复用现有判题核心
- 外层新增关卡和奖励逻辑

### 好处

- 第一阶段开发量最小
- 风险最低
- 原有练习记录不会丢

---

## 7. 首页与导航建议

如果后续首页切到闯关模式，建议：

- 主入口直接跳转 `/practice`
- 顶部导航保留：
  - 小试牛刀
  - 积分商城
  - 实用功能

论坛类入口是否恢复，后续由备案状态决定。

---

## 8. 第一阶段开发批次建议

### 批次 1：建模

- 建表
- Entity / Mapper
- Flyway 迁移

### 批次 2：只读能力

- 大厅概览接口
- 章节列表接口
- 章节详情接口
- 关卡详情接口

### 批次 3：前端页面骨架

- 闯关大厅
- 章节地图
- 准备页

### 批次 4：挑战流程

- start 接口
- submit 接口
- 结算页
- 解锁逻辑

### 批次 5：增强体验

- 错题本
- 排行榜
- 每日挑战

---

## 9. 风险点

### 9.1 判题复用风险

如果现有题目提交逻辑和闯关结算耦合太深，可能导致代码难维护。

建议：

- 将“判题”与“闯关奖励结算”拆开

### 9.2 进度一致性风险

用户重复提交、刷新、多端登录时，进度容易重复更新。

建议：

- 以 `attemptId` 做幂等控制

### 9.3 奖励重复发放风险

首次通关奖励与重复通关奖励必须分开处理。

建议：

- 在 `practice_attempt` 或 `user_level_progress` 中明确首通状态

---

## 10. 推荐当前立即开工点

如果现在直接进入开发，建议先从这里开始：

- 后端：
  - `PracticeCampaignController`
  - 新表实体与 Mapper
  - `GET /overview`
  - `GET /chapters`
- 前端：
  - `Practice.tsx` 改闯关大厅
  - 新增章节地图页
  - `PracticeDetail.tsx` 接关卡上下文
