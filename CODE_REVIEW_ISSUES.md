# 代码审查问题清单

更新时间：2026-05-18

## 已完成收敛

- 旧论坛前端页面、旧后台论坛入口、旧论坛活跃接口已清理或下线，旧接口统一由下线策略返回 410。
- 后台 `AdminController` 已按职责拆分，原巨型控制器不再作为活跃代码保留。
- 后台前端已从单体 `AdminConsole.tsx` 拆成 lazy 页面。
- 本轮 P1：新增 `QueryPageUtils`，将闯关、商城、每日挑战相关 `limit 1/5` 查询收敛到分页 API，避免继续使用 SQL suffix 拼接模式。
- 本轮 P2：将 `AdminConsoleShared.tsx` 从 897 行拆成 5 个小模块，当前 barrel 文件只保留 5 行导出。

## 剩余 P1

### 1. 后端 `.last("LIMIT ...")` 尚未完全清零

当前仍有 11 处 `.last(...)`，集中在较小范围内：

- `AdminPracticeReviewController`
- `PublicController`
- `ToolController`
- `AiAssistantConfigServiceImpl`
- `ExperienceLevelRuleServiceImpl`
- `ExperienceRuleServiceImpl`
- `PointsRuleOptionServiceImpl`
- `PointsRuleServiceImpl`
- `UserEntitlementServiceImpl`

建议下一轮继续迁移到 `Page` 或专用 service 方法，优先处理所有请求参数参与排序/分页的读取路径。

### 2. 空 catch 块仍需梳理

当前仍检测到 13 处 `catch (Exception ignored)`。建议按风险分两类：

- 可观测失败：上传、转换、模板、AI prompt 读取等路径至少记录 warn 日志。
- 可忽略失败：明确加短注释说明为什么允许忽略，避免后续误判。

### 3. 大型 service 仍承担多职责

- `PracticeCampaignServiceImpl` 仍同时负责目录、答题、每日挑战、进度、错题、奖励。
- `MallServiceImpl` 仍同时负责商品、兑换、权益发放、状态统计。

建议后续拆分为 facade + domain service，先从每日挑战、用户进度、权益发放这些边界清晰的职责下手。

## 剩余 P2

### 1. `Layout.tsx` 仍然偏大

全局布局仍承载导航、通知、AI 助手、账号菜单、移动导航等职责。建议继续拆为：

- `AssistantWidget`
- `NotificationDropdown`
- `AccountMenu`
- `CategorySearch`
- `MobileBottomNav`

### 2. 前端构建体积仍主要受编辑器依赖影响

本轮后台共享模块已拆分，构建结果已出现独立小 chunk：

- `AdminConsoleDialogs`
- `AdminConsoleForms`
- `AdminPointsUtils`

剩余大块主要来自 Univer/公式编辑器和多语言包，后续应按页面入口继续做懒加载与语言包裁剪。

### 3. DTO 和类型边界还可继续收紧

后台管理主要入口已经完成一批强类型化，但仍应继续减少：

- 后端 `Map<String, Object>` 请求/响应。
- 前端 API 响应的宽泛类型。
- service 内部跨层直接返回弱结构 `Map` 的场景。

## 本轮验证

- `cd excel-forum-backend; mvn test`
- `cd reace_web; npm run typecheck`
- `cd reace_web; npm run build`
