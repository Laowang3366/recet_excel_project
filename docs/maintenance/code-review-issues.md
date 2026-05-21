# 代码审查问题清单

更新时间：2026-05-18

## 已完成收敛

- 早期社区前端页面、后台入口、Controller、Service、Mapper、Entity 和兼容拦截器已从活动源码移除。
- 后台 `AdminController` 已按职责拆分，原巨型控制器不再作为活跃代码保留。
- 后台前端已从单体 `AdminConsole.tsx` 拆成 lazy 页面。
- 本轮 P1：新增 `QueryPageUtils`，将闯关、商城、每日挑战相关 `limit 1/5` 查询收敛到分页 API，避免继续使用 SQL suffix 拼接模式。
- 本轮 P2：将 `AdminConsoleShared.tsx` 从 897 行拆成 5 个小模块，当前 barrel 文件只保留 5 行导出。
- 2026-05-18 P1 收口：后端主代码 `.last(...)` 已清零，`catch (... ignored)` 已清零。
- 2026-05-18 P1 收口：`PracticeCampaignServiceImpl` 拆出 `PracticeCampaignCatalogSyncService` 和 `PracticeCampaignRewardService`，`MallServiceImpl` 拆出 `MallResponseAssembler`。
- 2026-05-18 P2 收口：`Layout.tsx` 从 1016 行收敛到 532 行，签到、道具、反馈、弹窗通知和导航图标构造已拆出独立 layout 模块。
- 2026-05-18 P2 收口：Univer 编辑器依赖按渲染核心、文字数据、UI、公式、Sheets 分块，生产构建不再出现大 chunk 警告。
- 2026-05-18 P2 收口：活跃 Controller 的 `@RequestBody Map` 已清零，管理、商城、反馈、账号、隐私、闯关配置等入口改用 DTO。
- 2026-05-18 质量门禁收口：前端 `vitest` 已纳入脚本和 CI，`scripts/quality/check.ps1` 覆盖前端审计/类型/单测/构建与后端源码门禁/编译/测试。
- 2026-05-18 历史数据归档：新增 `legacy_table_archive` 归档登记迁移，历史社区表只做归档标记，不删除历史数据。

## 剩余 P1

无。当前 P1 清单已执行完：

- `.last(...)`：0 处。
- `catch (... ignored)`：0 处。
- `PracticeCampaignServiceImpl`：拆分后 717 行，目录同步与奖励职责已移出。
- `MallServiceImpl`：拆分后 625 行，商城响应组装职责已移出。

## 剩余 P2

无。当前 P2 清单已执行完：

- `Layout.tsx` 主壳只保留路由壳、导航协调和通知下拉查询，签到/道具/反馈/弹窗通知已拆出。
- Univer 相关 chunk 已拆为 `univer-render-text-data`、`univer-render-core`、`univer-ui`、`univer-sheets`、`univer-engine-formula`，构建无大 chunk 警告。
- 活跃 Controller 请求体不再直接使用 `@RequestBody Map`，保留的 `Map` 主要用于响应组装、动态 Excel 数据和兼容性 DTO 内部字段记录。

## 剩余质量与归档

无。当前质量门禁和历史社区数据库表归档已补齐：

- 本地统一入口：`powershell -ExecutionPolicy Bypass -File scripts/quality/check.ps1`
- CI 前端门禁：依赖审计、类型检查、Vitest、生产构建。
- CI 后端门禁：编译、测试。
- 历史社区数据策略：保留历史表，新增 `legacy_table_archive` 登记表，不执行 drop/rename。

## 本轮验证

- `cd excel-forum-backend; mvn test`
- `cd excel-forum-backend; mvn -q -DskipTests compile`
- `cd reace_web; npm audit --audit-level=moderate`
- `cd reace_web; npm run test`
- `cd reace_web; npm run typecheck`
- `cd reace_web; npm run build`
- `powershell -ExecutionPolicy Bypass -File scripts/quality/check.ps1`
- `Get-ChildItem ... | Select-String -Pattern '\.last\('`：0 处
- `Get-ChildItem ... | Select-String -Pattern 'catch \([^)]* ignored\)'`：0 处
- `Get-ChildItem excel-forum-backend\src\main\java\com\excel\forum\controller -Filter *.java | Select-String -Pattern '@RequestBody (java\.util\.)?Map'`：0 处
