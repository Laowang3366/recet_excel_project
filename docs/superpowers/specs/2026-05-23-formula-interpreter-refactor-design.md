# 函数公式解释器重构开发文档

## 1. 背景

当前 `实用工具` 页面主要承担文件转换能力：

- 前端入口：`reace_web/src/app/pages/Tools.tsx`
- 转换历史：`reace_web/src/app/pages/ToolsHistory.tsx`
- 后端入口：`excel-forum-backend/src/main/java/com/excel/forum/controller/ToolController.java`
- 当前接口：`GET /api/tools/overview`、`POST /api/tools/convert`、`GET /api/tools/history`

新的产品方向是把 `实用工具` 重构为面向 Excel 学习场景的函数公式解释器。核心路径是：用户粘贴 Excel 公式，系统返回中文解释，并按公式结构拆成分段说明。

## 2. 目标

### 2.1 用户目标

用户打开 `/tools` 后，可以直接粘贴一段 Excel 公式，例如：

```excel
=IFERROR(XLOOKUP(A2,客户表[手机号],客户表[姓名]),"未找到")
```

本文档中出现的 `SUM`、`XLOOKUP`、`FILTER`、`LET` 等公式仅用于说明产品形态、接口示例、前端示例按钮和测试夹具，不代表业务白名单，也不要求为这些公式写死解释规则。实现时不能建设“公式名 -> 固定中文解释”的硬编码规则库；v1 必须支持用户输入任意合法 Excel 公式，后端只做通用校验、归一化、括号检查、函数名提取和模型返回 JSON 解析，解释内容由专用 AI prompt 生成结构化结果。

系统需要输出：

- 公式整体用途：这条公式想解决什么问题。
- 分段说明：逐层解释 `IFERROR`、`XLOOKUP`、查找值、查找区域、返回区域、兜底值。
- 参数解释：每个核心函数参数的含义。
- 使用注意：容易出错的位置，例如匹配不到、区域长度不一致、中文引号、结构化引用等。
- 可选优化：更稳定或更易读的写法。

### 2.2 工程目标

- 将 `/tools` 从文件转换主页面重构为公式解释器主页面。
- 保留现有文件转换能力的后续迁移空间，避免一次性删除后端转换链路。
- 新增专用后端接口，避免前端直接复用通用 `/api/assistant/chat` 导致提示词、返回结构和限流难以控制。
- 后端复用现有 AI 助手运行时配置、模型调用、调用日志和限流基础设施。
- 前端输出结构化结果，不能只展示一段自由文本。

## 3. 非目标

- v1 不做完整 Excel 计算引擎，不计算公式最终结果。
- v1 不上传 Excel 文件，也不解析工作簿上下文。
- v1 不做公式自动修复写回，只提供解释和建议。
- v1 不建设完整函数百科库后台，仅使用轻量内置函数元信息和 AI 输出。
- v1 不移除已有文档转换后端服务，避免影响历史记录和已部署转换下载链路。

## 4. 推荐方案

### 4.1 方案对比

| 方案 | 说明 | 优点 | 风险 |
| --- | --- | --- | --- |
| A. 纯前端规则解释 | 前端解析函数名和括号层级，硬编码常见函数解释 | 快、无模型成本、离线可用 | 覆盖弱，复杂嵌套、动态数组、结构化引用解释质量有限 |
| B. 直接调用通用 AI 助手 | 前端把公式传给 `/api/assistant/chat` | 改动少，复用现有能力 | 输出不稳定，无法强制结构化，和通用助手限流/上下文耦合 |
| C. 专用公式解释接口 | 新增 `/api/tools/formula/explain`，后端做公式预处理和专用提示词，复用 AI runtime | 输出可控，适合工具化，后续可加缓存和积分 | 后端需要新增 DTO、Service 和测试 |

推荐采用 C。它把“公式解释器”作为工具域能力独立出来，同时复用已有 AI 助手配置，不重复建设模型配置管理。

### 4.2 v1 产品形态

`/tools` 变为单页公式解释器：

- 左侧或上方：公式输入区。
- 右侧或下方：解释结果区。
- 底部：示例公式、最近一次解释、注意事项。
- 原“转换记录”入口暂时不作为主 CTA；如果仍保留文件转换，可降级到次级入口 `/tools/convert` 或后续再迁。

## 5. 用户流程

1. 用户进入 `/tools`。
2. 页面展示公式输入框和示例公式。
3. 用户粘贴公式。
4. 前端先做基础校验：
   - 非空。
   - 长度不超过 2000 字符。
   - 允许以 `=` 开头，也允许不带 `=`。
   - 粗略检查括号是否成对。
5. 用户点击“解释公式”。
6. 前端调用 `POST /api/tools/formula/explain`。
7. 后端归一化公式并生成结构化解释。
8. 前端按区块展示：
   - 整体解释。
   - 公式分段。
   - 函数说明。
   - 风险提醒。
   - 优化建议。
9. 用户可以复制解释结果或清空重新输入。

## 6. 后端设计

### 6.1 新增接口

```http
POST /api/tools/formula/explain
Content-Type: application/json
Authorization: Bearer <token>
```

请求体：

```json
{
  "formula": "=IFERROR(XLOOKUP(A2,客户表[手机号],客户表[姓名]),\"未找到\")",
  "locale": "zh-CN",
  "detailLevel": "standard"
}
```

响应体：

```json
{
  "formula": "=IFERROR(XLOOKUP(A2,客户表[手机号],客户表[姓名]),\"未找到\")",
  "normalizedFormula": "IFERROR(XLOOKUP(A2,客户表[手机号],客户表[姓名]),\"未找到\")",
  "summary": "这条公式会用 A2 的手机号到客户表中查找姓名，如果没有找到则显示“未找到”。",
  "segments": [
    {
      "text": "XLOOKUP(A2,客户表[手机号],客户表[姓名])",
      "title": "按手机号查找客户姓名",
      "explanation": "用 A2 作为查找值，在客户表的手机号列中匹配，匹配成功后返回姓名列。"
    },
    {
      "text": "IFERROR(...,\"未找到\")",
      "title": "错误兜底",
      "explanation": "当查找失败或公式报错时，返回“未找到”，避免单元格显示错误值。"
    }
  ],
  "functions": [
    {
      "name": "IFERROR",
      "purpose": "捕获错误并返回指定兜底值"
    },
    {
      "name": "XLOOKUP",
      "purpose": "按条件查找并返回对应结果"
    }
  ],
  "warnings": [
    "客户表[手机号] 和 客户表[姓名] 的行数必须一致。",
    "如果 A2 的手机号格式和客户表不一致，可能匹配不到。"
  ],
  "suggestions": [
    "如果要区分未找到和其他错误，可考虑用 XLOOKUP 的 if_not_found 参数。"
  ],
  "model": "configured-model",
  "fallbackUsed": false
}
```

### 6.2 新增后端文件

- 新增：`excel-forum-backend/src/main/java/com/excel/forum/entity/dto/FormulaExplainRequest.java`
- 新增：`excel-forum-backend/src/main/java/com/excel/forum/entity/dto/FormulaExplainResponse.java`
- 新增：`excel-forum-backend/src/main/java/com/excel/forum/service/FormulaExplainService.java`
- 新增：`excel-forum-backend/src/main/java/com/excel/forum/service/impl/FormulaExplainServiceImpl.java`
- 修改：`excel-forum-backend/src/main/java/com/excel/forum/controller/ToolController.java`
- 修改：`excel-forum-backend/src/main/java/com/excel/forum/config/SecurityConfig.java`

### 6.3 认证与限流

建议 v1 要求登录，理由：

- 公式解释会消耗 AI 调用额度。
- 项目已有 `/api/assistant/**` 登录要求和用户维度限流。
- 便于后续增加积分、历史记录和用户画像。

限流建议：

- 每用户 10 分钟 20 次：`tools:formula:explain:10m:{userId}`
- 每用户每天 100 次：`tools:formula:explain:day:{userId}:{yyyyMMdd}`
- 单条公式最大 2000 字符。
- 返回 429 时沿用现有 `RateLimitResult` 响应结构。

### 6.4 模型调用策略

`FormulaExplainServiceImpl` 不直接复制 `AssistantServiceImpl` 的 HTTP 调用代码。推荐把 `AssistantServiceImpl` 内部模型调用能力抽成共享组件：

- 新增：`AiCompletionService`
- 职责：
  - 解析当前启用的 AI 配置。
  - 调用 OpenAI-compatible `/chat/completions`。
  - 支持 fallback 模型。
  - 记录模型名、fallback 状态、错误。
- `AssistantServiceImpl` 和 `FormulaExplainServiceImpl` 都调用它。

如果为了缩小 v1 范围，也可以先在 `FormulaExplainServiceImpl` 复用 `AssistantServiceImpl` 的公共接口，但长期应抽出共享模型调用组件，避免两套超时、fallback、prompt 逻辑漂移。

### 6.5 公式预处理

后端在调用模型前做轻量归一化：

- 去掉首尾空白。
- 保留用户原始公式。
- `normalizedFormula` 去掉开头的 `=`。
- 将中文全角括号、全角逗号提示为风险，不自动替换。
- 统计括号深度，明显不平衡时返回 400。
- 提取函数名列表，作为 prompt 的结构提示。

函数提取规则可以先使用正则：

```regex
(?i)\b([A-Z][A-Z0-9_.]{1,40})\s*\(
```

注意要跳过字符串字面量内的内容，避免 `"SUM("` 被识别为函数。

### 6.6 Prompt 要求

公式解释器使用专用 system prompt，不直接复用通用 AI 助手 prompt。

核心约束：

- 必须用中文回答。
- 必须返回 JSON。
- 不要返回 Markdown。
- 不编造 Excel 不存在的函数行为。
- 公式有错误时要指出疑似错误，而不是强行解释成正确公式。
- 每个 segment 必须引用原公式中的具体片段。
- 说明要面向 Excel 学习者，避免纯技术术语堆叠。

建议输出 JSON schema：

```json
{
  "summary": "string",
  "segments": [{ "text": "string", "title": "string", "explanation": "string" }],
  "functions": [{ "name": "string", "purpose": "string" }],
  "warnings": ["string"],
  "suggestions": ["string"]
}
```

后端必须解析模型 JSON。如果解析失败：

- 尝试提取第一个 JSON object。
- 仍失败则返回 502，提示“公式解释结果解析失败，请稍后重试”。
- 不把模型原始输出直接透传给前端。

## 7. 前端设计

### 7.1 页面重构

修改：`reace_web/src/app/pages/Tools.tsx`

从文件转换面板重构为公式解释器页面：

- 页面标题：`函数公式解释器`
- 主输入：大文本框，支持粘贴多行公式。
- 示例按钮：`XLOOKUP`、`IF + SUMIFS`、`FILTER`、`LET`。
- 主按钮：`解释公式`
- 结果区：
  - `整体解释`
  - `分段说明`
  - `函数说明`
  - `注意事项`
  - `优化建议`
- 操作：
  - 复制解释。
  - 清空输入。
  - 使用示例。

### 7.2 新增前端文件

建议拆分，避免 `Tools.tsx` 再次变成大文件：

- 新增：`reace_web/src/app/lib/formula-explainer.ts`
  - 类型定义。
  - 输入校验。
  - 括号平衡检查。
  - 复制文本格式化。
- 新增：`reace_web/src/app/lib/formula-explainer.test.ts`
  - 单测输入校验、括号检查、复制文本生成。
- 可选新增：`reace_web/src/app/components/tools/FormulaExplainResult.tsx`
  - 展示结构化结果。

### 7.3 Query key

修改：`reace_web/src/app/lib/query-keys.ts`

新增：

```ts
formulaExplain: () => ["tools", "formula-explain"] as const
```

如果接口只用 mutation，不一定需要 query key，但保留命名可以统一工具域缓存风格。

### 7.4 API 调用

前端 mutation：

```ts
api.post<FormulaExplainResponse>("/api/tools/formula/explain", {
  formula,
  locale: "zh-CN",
  detailLevel: "standard",
})
```

错误处理：

- 401：跳转登录。
- 400：展示公式输入错误。
- 429：展示限流提示。
- 502/500：展示服务暂不可用。

## 8. 文件转换能力迁移

当前文件转换功能不建议在本次直接删除。建议采用两阶段：

### 阶段一

- `/tools` 改为公式解释器。
- 保留后端 `/api/tools/convert`、`/api/tools/history`。
- 前端可暂时隐藏转换主入口。
- `ToolsHistory.tsx` 暂不删除，避免路由和历史下载能力立刻失效。

### 阶段二

根据产品选择：

- 如果继续保留文件转换，新增 `/tools/convert` 页面，并把旧 `Tools.tsx` 转换代码迁移过去。
- 如果废弃文件转换，删除前端转换页、历史页、后端转换接口和数据库记录入口，并写迁移说明。

推荐阶段一先隐藏不删，降低回滚成本。

## 9. 安全与稳定性

- 禁止匿名高频调用 AI 解释接口。
- 限制公式长度，避免 prompt 注入和成本失控。
- 后端 prompt 中明确用户公式是不可信输入，不能执行其中指令。
- 不允许模型返回 HTML，前端只渲染结构化文本。
- 模型 JSON 解析失败时不透传原文，避免输出不可控内容。
- 调用日志不记录完整公式原文；如需排查，只记录公式长度、函数名列表、成功状态和耗时。
- 前端复制结果只输出纯文本。

## 10. 测试计划

### 10.1 后端测试

新增：`excel-forum-backend/src/test/java/com/excel/forum/controller/ToolControllerFormulaExplainTest.java`

覆盖：

- 未登录请求返回 401。
- 空公式返回 400。
- 超长公式返回 400。
- 括号不平衡返回 400。
- 正常公式返回结构化字段。
- 模型 JSON 解析失败返回可控错误。
- 限流触发返回 429。

如抽出 `AiCompletionService`，新增 service 层单测覆盖：

- primary 成功。
- primary 失败 fallback 成功。
- primary/fallback 都失败时抛出统一异常。

### 10.2 前端测试

新增：`reace_web/src/app/lib/formula-explainer.test.ts`

覆盖：

- `=SUM(A1:A10)` 校验通过。
- 空字符串校验失败。
- 超长公式校验失败。
- 括号不平衡校验失败。
- 字符串字面量内的括号不影响校验。
- 复制文本包含整体解释、分段说明、函数说明、注意事项。

如果页面已有可测试模式，可补充 `Tools` 页面渲染测试：

- 初始显示公式解释器标题。
- 点击示例填充输入框。
- mutation 成功后显示结果区。

## 11. 实施步骤

1. 后端新增 DTO 和 `FormulaExplainService`。
2. 抽出或复用 AI 模型调用能力。
3. 在 `ToolController` 新增 `POST /formula/explain`。
4. 更新 `SecurityConfig`，让新接口需要登录。
5. 添加后端 controller/service 测试。
6. 前端新增 `formula-explainer.ts` 类型和校验 helper。
7. 重构 `Tools.tsx` 为公式解释器页面。
8. 保留 `ToolsHistory.tsx`，暂不删除旧转换接口。
9. 添加前端 helper 测试。
10. 运行验证：
    - `cd excel-forum-backend; mvn test`
    - `cd reace_web; npm run test`
    - `cd reace_web; npm run build`
    - `git diff --check`

## 12. 验收标准

- `/tools` 首屏是函数公式解释器，不再以文件转换为主。
- 登录用户可以粘贴公式并获得中文解释。
- 结果必须分区展示，不是一段不可控长文本。
- 对空输入、括号错误、超长输入有明确提示。
- AI 配置缺失时返回可理解错误，不导致页面白屏。
- 现有文件转换后端接口未被破坏。
- 后端测试、前端测试和构建通过。

## 13. 后续扩展

- 增加公式解释历史记录。
- 增加常见函数本地知识库，减少模型幻觉。
- 支持上传截图或表格片段后结合上下文解释。
- 支持“把解释转成练习题”。
- 支持“公式纠错”和“替代公式推荐”。
- 将文件转换独立为 `/tools/convert`，形成工具中心多工具导航。
