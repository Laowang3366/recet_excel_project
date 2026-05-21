# ExcelCC 做题、上传与下载风险审查报告

日期：2026-05-21  
范围：前端做题防刷、QA 求助答疑上传、题目/模板文件下载、相关后端限流与文件处理链路。  
目标：确认是否存在脚本秒刷、恶意大文件、并发下载拖垮服务或流量异常风险，并给出不破坏现有业务的修复方向。

## 结论

当前系统已经具备基础认证、部分文件类型校验、20MB multipart 限制、模板购买校验和服务端判题能力，因此不是“完全裸奔”。但在高并发和恶意调用场景下，仍存在明确风险：

1. 已登录用户可以脚本化反复提交做题接口，前端按钮状态不能作为防刷边界。
2. 积分/经验发放存在“先查后写”的并发窗口，个别唯一索引对 `NULL` 字段不生效，存在重复奖励风险。
3. QA 上传和在线编辑器快照都可能触发 Excel 解析、公式计算和内存构建，缺少工作簿结构上限，20MB 文件仍可能造成 CPU/内存压力。
4. `/uploads/**` 目前公开暴露，已知文件地址可绕过业务下载接口的权限和计数逻辑。
5. 题目文件、QA 文件和模板下载缺少统一下载限流；线上 Nginx 当前未配置 `limit_req`、`limit_conn` 或 `limit_rate`。
6. 文件读取与导出多处使用整文件内存加载，下载/导出并发高时会放大内存占用。

建议按 P0 到 P2 分三批修复：先加统一限流和幂等，再收紧文件访问与 Excel 解析边界，最后补 Nginx、监控和压测门禁。

## 已确认的现有防护

| 场景 | 已有防护 | 证据 |
| --- | --- | --- |
| 做题答案伪造 | 服务端根据题目/模板重新判题，不信任前端 `isCorrect` | `PracticeServiceImpl.submitPractice`、`evaluateAnswer`、`evaluateExcelTemplate` |
| 上传入口 | `POST /api/upload` 需要登录，校验扩展名和文件头 | `UploadController` |
| multipart 大小 | Spring multipart 配置为 20MB | `application.yml` |
| 模板购买 | 模板下载记录有唯一约束，重复购买不重复扣费 | `V42__create_template_center_tables.sql` |
| 下载路径穿越 | 模板中心本地文件解析做了 normalize 和根目录校验 | `TemplateCenterController.resolveLocalTemplateFile` |
| 登录/AI 局部限流 | `AuthController`、`AssistantController` 内有本地限流实现 | 对应 Controller 内 `guardRateLimit` |

这些防护有价值，但粒度分散，无法覆盖做题提交、QA 提交、模板下载、题目下载和 Excel 解析链路。

## 风险矩阵

| 优先级 | 风险 | 影响 | 当前状态 | 修复方向 |
| --- | --- | --- | --- | --- |
| P0 | 做题提交被脚本秒刷 | 写入大量答题记录，刷经验/积分，压垮判题计算 | 缺少提交频率限制和提交幂等 | 新增统一限流、attempt 幂等、奖励幂等 |
| P0 | 上传/快照触发大工作簿解析 | CPU/内存飙升，服务阻塞或 OOM | 仅限制 multipart 20MB，未限制工作簿结构 | 新增 `WorkbookSecurityGuard` |
| P0 | `/uploads/**` 公开文件绕过权限 | 付费模板/题目模板可被直接批量拉取 | Security 放行 `/uploads/**` | 敏感文件走受控下载，公开资源分目录 |
| P1 | 大量并发下载 | 带宽异常、内存压力、后端线程占用 | 无下载限流，Nginx 无 `limit_req` | 应用层下载令牌 + Nginx 限流 |
| P1 | 积分/经验并发重复发放 | 账户积分不一致，运营数据污染 | 先查后写，唯一索引存在 `NULL` 缺口 | 奖励幂等键 + 事务内原子更新 |
| P1 | QA 答案快照提交刷写 | 大 JSON 反复生成 Excel 文件，占用磁盘和 CPU | 无 per-case/per-user 频率限制 | QA 提交冷却、单 case 答案上限 |
| P2 | 限流逻辑重复散落 | 后续功能容易漏加限流 | Controller 私有方法重复 | 提取 `RateLimitService` |
| P2 | 缺少安全压测脚本门禁 | 上线前难以量化修复效果 | 有手动压测习惯但未纳入质量门禁 | 增加受控 k6 场景和监控指标 |

## 详细风险分析

### 1. 前端做题可被脚本化提交

前端按钮、路由和登录弹窗只能改善用户体验，不能阻止脚本直接调用接口。当前 `/api/practice/submit` 和章节闯关提交最终落到服务端 `PracticeServiceImpl.submitPractice`，服务端确实重新判题，但没有看到按用户、题目、attempt、IP 的提交频率控制。

风险表现：

- 已登录用户可以循环请求 `/api/practice/submit`，持续生成 `practice_record` 和 `practice_answer`。
- 章节闯关 `submitCampaignLevel` 依赖前端状态控制，但服务端没有强约束“同一 attempt 只能提交一次最终结果”。
- 经验发放在每次提交后执行，若规则没有严格上限，会被重复触发。
- 积分任务和题目奖励存在并发窗口，脚本并发提交时可能绕过“先查后写”判断。

应对原则：

- 防刷边界必须在后端，不依赖前端禁用按钮。
- 每个提交场景要有业务幂等键：`userId + questionId + attemptId/recordId + rewardType`。
- 限流和幂等都要失败得足够早，避免进入 Excel 判题和写库逻辑后才拒绝。

### 2. 积分与经验发放存在并发一致性风险

`PointsRecordServiceImpl` 当前流程是读取用户积分、保存积分流水、再更新用户余额。`PointsTaskServiceImpl` 和题目奖励逻辑也有“查询是否已发放 -> 未发放则插入”的窗口。已有唯一索引包含 `task_date`，但 MySQL 唯一索引允许多个 `NULL`，对按题目一次性奖励这类 `task_date = NULL` 的记录无法形成可靠保护。

风险表现：

- 并发提交同一道题，可能插入多条奖励记录。
- 用户积分余额用读旧值再写新值的方式更新，在并发下可能丢更新或重复加。
- 经验规则如果没有每日/题目级幂等，会随着重复提交累积。

应对原则：

- 积分流水增加非空 `idempotency_key`，数据库唯一索引兜底。
- 用户积分余额改为 SQL 原子递增：`points = points + delta`。
- 经验记录按 `userId + sourceType + sourceId` 或每日维度建立唯一约束。
- 关键奖励写入用事务包裹，捕获唯一键冲突并返回已发放结果。

### 3. 上传文件存在“大文件不大、工作簿很重”的风险

上传 Controller 有 20MB 限制、扩展名和 magic bytes 校验，但 Excel 文件是压缩包格式，20MB 的 xlsx 仍可能解压出大量 XML 内容。`ExcelTemplateGradingServiceImpl.loadWorkbookSnapshot` 使用 Apache POI 打开工作簿后遍历 sheet/row/cell，当前未见 sheet 数、行数、单元格数、公式长度、共享字符串数量或解压比例上限。

QA 求助场景还存在两条高消耗路径：

- `createCase` 上传模板后会立即解析工作簿。
- `submitCaseAnswerFromSnapshot` 接收前端 workbook JSON，再生成 Excel 文件，JSON 体积和单元格数量缺少业务上限。

风险表现：

- 恶意 xlsx 可以让解析耗时显著超过普通上传。
- JSON 快照不受 multipart 20MB 限制，线上 Nginx `client_max_body_size` 为 50MB，可能更容易打满内存。
- 公式计算和动态数组计算会放大 CPU 压力。

应对原则：

- 上传成功不等于可解析，解析前必须过 `WorkbookSecurityGuard`。
- 对 Excel 文件同时限制：压缩包解压比例、最大 entry、sheet 数、行数、单元格数、公式长度、单元格文本长度。
- 对 workbook JSON 限制：请求体大小、sheet 数、单元格数、公式长度。
- 解析失败返回明确业务错误，不进入后续保存/通知流程。

### 4. 文件下载可绕过业务接口

模板中心的正式下载接口有购买记录校验；题目文件下载接口也有登录或 ticket 校验。但 `SecurityConfig` 直接放行 `/uploads/**`，`WebMvcConfig` 直接把本地上传目录映射为静态资源。只要前端 payload、后台配置或页面源中暴露了 `/uploads/xxx.xlsx`，脚本可以直接请求静态文件，绕过权限、计数、购买和限流。

风险表现：

- 付费模板、题目模板、QA 求助模板的真实文件地址一旦泄露，可被直接批量下载。
- 直接静态下载不会经过模板购买校验和下载统计。
- 无法区分正常用户下载和脚本批量拉取。

应对原则：

- 敏感 Excel 文件不要用 `/uploads/**` 公开直链。
- 上传文件按场景分区：`public` 只放头像/公开图片；`private` 放题目模板、模板中心文件、QA 文件。
- 前端不再依赖任意 `fileUrl` 调 `/api/practice/template-snapshot`，改为按业务 ID 获取受控快照。
- 需要 Nginx 直出时使用 `X-Accel-Redirect` 或一次性短期签名 URL，仍由应用层先做权限和限流。

### 5. 下载并发会放大带宽和内存压力

题目文件和 QA case 文件使用 `ByteArrayResource` 返回，文件内容先构建或读入内存；模板中心虽然使用 `FileSystemResource`，但没有下载限流。线上 Nginx 当前只看到 `client_max_body_size 50m`，未发现 `limit_req`、`limit_conn`、`limit_rate` 配置。

风险表现：

- 大量请求题目文件会重复构建学生工作簿，消耗 CPU 与堆内存。
- 大量请求 QA 文件会触发整文件读入内存。
- 已知文件 URL 可用多连接并发拉取，造成带宽异常。

应对原则：

- 应用层对下载按 `userId/IP + businessType + fileId` 限流。
- 题目工作簿可加短 TTL 缓存，但缓存键必须绑定题目版本。
- 大文件返回优先使用流式资源或 Nginx 内部转发。
- Nginx 增加站点级和路径级限流，应用层限流负责业务精度。

### 6. 当前限流设计分散，后续维护成本高

项目已有登录和 AI 的本地限流实现，但在 Controller 中重复实现。上传限流依赖 Redis，Redis 失败时直接跳过。做题、QA、下载接口没有统一入口。这种形态会导致每新增一个功能都要手动记得加限流，容易漏。

应对原则：

- 提取统一 `RateLimitService`，封装 Redis + 本地 fallback。
- Controller 只表达业务限流策略，不自己维护计数结构。
- 限流失败要 fail closed：Redis 不可用时至少启用本地进程级保护。
- 所有限流返回统一 `429`，带清晰错误文案和可选 `Retry-After`。

## 修复开发规范

为避免把安全逻辑散落到业务代码里，修复时遵守以下结构：

1. 单一职责：
   - `RateLimitService` 只负责计数和限流判定。
   - `WorkbookSecurityGuard` 只负责文件/快照结构上限校验。
   - `FileAccessService` 只负责文件权限、签名和受控下载。
   - `RewardGrantService` 只负责积分/经验幂等发放。
2. 高内聚低耦合：
   - 做题、QA、模板中心只调用服务接口，不感知 Redis、Nginx、文件路径细节。
   - Excel 解析服务只接收已通过安全检查的文件或快照。
3. 避免过度设计：
   - 不引入复杂风控系统，先用 Redis 固定窗口/滑动窗口 + 本地 fallback。
   - 不引入消息队列作为第一轮必需项。
   - 不重构所有文件存储，只先把敏感 Excel 文件从公开直链迁移到受控接口。
4. 关键逻辑注释：
   - 幂等键生成处说明业务唯一性。
   - 工作簿上限说明是为了防止压缩炸弹和公式计算耗尽资源。
   - 下载鉴权说明不能信任前端传入的 `fileUrl`。
5. 性能优先：
   - 限流在 Controller 入口尽早执行。
   - 文件结构检查在 POI 深度解析前尽量执行。
   - 下载使用流式传输或 Nginx 内部转发，避免大文件堆内存加载。

## 建议验收标准

修复完成后至少满足：

- 未登录和未授权用户无法直接访问敏感 `/uploads/private/**` 文件。
- `/api/practice/submit` 高频请求返回 `429` 或幂等结果，不重复发放积分/经验。
- 同一闯关 attempt 重复提交不会二次写入最终结果。
- 上传超大 sheet/超多单元格/异常压缩比 xlsx 返回 400，不拖垮后端。
- QA 在线快照超过限制返回 400。
- 模板中心和题目文件下载高频请求返回 `429`。
- Nginx 对 `/api/`、`/uploads/` 有基础连接数和请求速率限制。
- 后端测试覆盖限流、幂等、文件权限、工作簿安全边界。

## 2026-05-21 修复进度

已完成：

- 后端统一限流服务和 Redis 失败本地 fallback。
- 做题提交、QA 提交、上传、模板/题目/QA 下载限流。
- 积分流水幂等键、唯一索引迁移和用户积分原子递增。
- 闯关 attempt 重复最终提交拦截。
- Excel 文件和 workbook JSON 结构上限校验。
- 新上传 Excel 进入 `/uploads/private/`，私有目录不再公开匿名访问。
- 题目详情不再返回敏感 `templateFileUrl`。
- QA case/answer 快照改为业务 ID 受控接口。
- 用户侧上传 Excel 后直接使用上传接口返回的 workbook 快照，不再调用任意 `fileUrl` 快照解析。

已验证：

- `cd excel-forum-backend; mvn test`：123 tests, 0 failures。
- `cd reace_web; npm run build`：构建通过。

待部署阶段执行：

- 线上 Nginx `client_max_body_size` 与后端 20MB 对齐。
- 对 `/api/`、下载接口和 `/uploads/` 加保守 `limit_req/limit_conn`。
- 低风险验证刷提交/刷下载返回 429。
- 标准部署后更新 `ONLINE_UPDATE_LOG.md`。

## 不建议本轮执行的事项

- 不删除历史文件和历史上传记录。
- 不重排数据库自增 ID。
- 不把 QA 做成论坛式评论/私信/审核流。
- 不把所有静态资源都改成鉴权接口，公开图片可以继续公开。
- 不用前端验证码替代后端限流。
