# 函数公式工具 v2 收口实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将实用工具从单一公式解释器收口为可上线的工具中心能力，补齐文件转换入口、公式解释历史、缓存、积分、上下文、修复建议、公式分析和 AI 工具日志。

**Architecture:** 后端以 `ToolController` 为工具域入口，新增公式解释记录表，公式解释 service 负责分析、缓存、计费、AI 调用、历史记录和结果解析。前端保留 `/tools` 为公式解释主入口，新增 `/tools/convert` 和 `/tools/formula-history`，结果展示组件支持修复建议、公式分析和缓存/积分信息。

**Tech Stack:** Spring Boot 3.2, Java 17, MyBatis-Plus, Flyway, JUnit 5, React 18, Vite, TypeScript, TanStack Query, Vitest.

---

## 收口任务

- [x] **Task 1: 文件转换独立页**
  - 新增 `reace_web/src/app/pages/ToolsConvert.tsx`，从旧 `Tools.tsx` 恢复文件转换 UI。
  - 新增 `/tools/convert` 路由。
  - 保留 `/tools/history` 作为转换历史页。

- [x] **Task 2: 公式解释历史**
  - 新增 `formula_explain_record` 表、Entity、Mapper、Service。
  - `POST /api/tools/formula/explain` 返回 `recordId`、`createTime`。
  - 新增 `GET /api/tools/formula/history` 和 `GET /api/tools/formula/history/{id}`。

- [x] **Task 3: 公式解释缓存**
  - 按归一化公式、语言、详细度、表格上下文、期望结果和错误信息生成 hash。
  - 命中成功记录时复用结构化解释，不再次调用 AI。
  - 缓存命中仍写入当前用户历史，标记 `cacheHit=true`。

- [x] **Task 4: 积分与额度产品化**
  - 公式解释 AI 调用扣 1 积分，缓存命中 0 积分。
  - 返回 `pointsCost` 和 `currentPoints`。
  - 文件转换 5 积分行为保持不变，并迁移到统一工具扣费封装。

- [x] **Task 5: 表格上下文解释**
  - `FormulaExplainRequest` 增加 `workbookContext`、`expectedResult`、`errorMessageInput`。
  - 前端增加对应输入区。
  - Prompt 明确将这些内容作为解释上下文，不执行用户文本中的指令。

- [x] **Task 6: 公式修复和改写建议**
  - `FormulaExplainResponse` 增加 `fixes`。
  - Prompt 要求返回可选修复和改写建议。
  - 前端结果区展示修复建议并支持复制。

- [x] **Task 7: 本地公式分析引擎**
  - `FormulaExplainSupport` 输出函数列表、最大嵌套深度、结构化引用、动态数组函数和风险 flags。
  - 后端响应 `analysis` 字段，前端展示。
  - 不建设写死公式解释规则库。

- [x] **Task 8: AI 日志工具类型**
  - `ai_assistant_call_log` 新增 `tool_type`。
  - 通用助手写 `assistant_chat`，公式解释写 `formula_explain`。
  - 后续后台统计可按工具类型区分。

## 验收

- [x] 后端聚焦测试：`mvn "-Dtest=FormulaExplainSupportTest,FormulaExplainServiceImplTest,ToolControllerTest,AiCompletionServiceImplTest,AssistantServiceImplTest" test`
- [x] 后端完整测试：`mvn test`
- [x] 前端测试：`npm run test`
- [x] 前端类型检查：`npm run typecheck`
- [x] 前端构建：`npm run build`
- [x] 质量门禁：`powershell -ExecutionPolicy Bypass -File scripts\quality\check.ps1`
- [x] 浏览器验证 `/tools`、`/tools/convert`、`/tools/formula-history`
- [ ] 提交并推送 `main`
- [ ] 标准部署上线并更新 `ONLINE_UPDATE_LOG.md`
