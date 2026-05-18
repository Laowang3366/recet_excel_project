# 代码审查清单（Code Review Checklist）

> 用途：PR / MR 合入前人工审查门禁。审查者逐项检查，任一 **阻断项（🔴）** 不通过则打回；**警告项（🟡）** 累计 ≥ 3 个打回；**建议项（🔵）** 不阻塞合入但需记录 Tech Debt。

---

## 一、安全（Security）

### 🔴 阻断项 — 任一项不通过即打回

| # | 检查项 | 通过标准 | 不通过示例 |
|---|--------|----------|------------|
| 1.1 | **SQL 注入** | 所有 SQL 使用 MyBatis-Plus LambdaQueryWrapper / 参数化 `#{}`，**严禁** `.last()` / `.setSql()` 拼接用户输入 | `wrapper.last("LIMIT " + requestParam)`、`wrapper.setSql("col = " + userInput)` |
| 1.2 | **JSON 注入** | 响应 JSON 统一使用 Spring 管理的 `ObjectMapper` 或 `@RestController` 自动序列化，**禁止** 手动拼接 JSON 字符串 | `response.getWriter().write("{\"msg\":\"" + msg + "\"}")` |
| 1.3 | **认证校验** | 需要登录的端点必须有 `@Auth` / Spring Security 规则保护，未登录不可访问 | 新增管理后台接口忘记加到 `SecurityConfig` 的 `adminApi` 规则 |
| 1.4 | **授权校验** | 管理后台接口必须校验角色（`ADMIN` / `SUPER_ADMIN`），普通用户不可越权 | `@Auth(requireAdmin = true)` 遗漏导致普通用户可调用 |
| 1.5 | **敏感数据泄露** | 日志中**不得**打印密码、Token、手机号、身份证号；API 响应不得返回密码哈希 | `log.info("user: {}, pwd: {}", username, password)` |
| 1.6 | **文件上传** | 必须校验文件类型白名单、大小上限；存储路径在 Web 根之外；禁止 `.jsp/.exe/.sh` 等可执行后缀 | 只校验了前端 `accept` 属性，后端无校验 |
| 1.7 | **权限绕过** | 用户 A 不可通过修改请求参数访问用户 B 的私有数据（订单、消息、通知等） | `getUserOrders(userId)` 从请求参数取 `userId` 而非从 JWT 取当前用户 |
| 1.8 | **密码硬编码** | 代码、配置、注释中**不得**出现任何真实密码 / Token / Secret | `jwtSecret = "my-test-key-123"` 写在 `application.yml` 中 |

### 🟡 警告项 — 累计 ≥ 3 个打回

| # | 检查项 | 通过标准 | 不通过示例 |
|---|--------|----------|------------|
| 1.9 | **CORS 配置** | 生产环境 `ALLOWED_ORIGINS` 为具体域名，不为 `*` | `allowed-origins: "*"` |
| 1.10 | **JWT 过期** | JWT 有过期时间且生产环境 ≤ 24h | `expiration: 99999999` |
| 1.11 | **依赖版本** | 未引入已知 CVE 的依赖版本；`npm audit` / `mvn dependency-check` 无 HIGH/CRITICAL | 新增了 `log4j-core:2.14.0` |

---

## 二、正确性（Correctness）

### 🔴 阻断项

| # | 检查项 | 通过标准 | 不通过示例 |
|---|--------|----------|------------|
| 2.1 | **空 catch 块** | **严禁** `catch (Exception e) {}` 空块；异常必须记录日志或重新抛出 | `catch (Exception ignored) { }` |
| 2.2 | **事务边界** | 涉及多表写操作（扣库存+生成订单、扣积分+发权益）必须在 **一个事务** 内 | 两个 `service.update()` 之间没有 `@Transactional` |
| 2.3 | **空指针防护** | 对可能为 null 的返回值（`mapper.selectOne()`、`Map.get()`、外部 API 响应）做了 null 检查 | `user.getNickname().length()` —— `user` 可能为 null |
| 2.4 | **边界条件** | 处理了空列表、空字符串、0、负数、超长输入 | 分页 `size` 未设上限，用户传 `999999` |
| 2.5 | **整数溢出** | 涉及积分/金额累加的地方使用 `BigDecimal`（金额）或 `Long`（积分） | 积分用 `Integer`，超过 21 亿会溢出 |

### 🟡 警告项

| # | 检查项 | 通过标准 | 不通过示例 |
|---|--------|----------|------------|
| 2.6 | **幂等性** | 支付、扣库存、发权益接口重复调用不会重复扣减 | 前端未防抖、后端无去重，用户双击扣两次 |
| 2.7 | **并发安全** | 共享状态读写有同步机制（`synchronized` / `ReentrantLock` / 数据库乐观锁 / `@Version`） | 多个请求同时 `read-then-write` 更新同一行 |
| 2.8 | **异常传播** | 自定义业务异常（`BusinessException`）被 `GlobalExceptionHandler` 统一处理，不吞掉 | Service 层 `catch` 后返回 null，Controller 不知出错 |

---

## 三、性能（Performance）

### 🟡 警告项

| # | 检查项 | 通过标准 | 不通过示例 |
|---|--------|----------|------------|
| 3.1 | **N+1 查询** | 循环内无数据库 / Redis 查询；批量场景使用 `service.listByIds()` | `for (id : ids) { service.getById(id); }` |
| 3.2 | **全表扫描** | 新查询有对应索引；`WHERE` 条件不走索引的列需说明数据量 | 新加了 `WHERE status = ? ORDER BY create_time`，但 `status` 无索引且表有 100 万行 |
| 3.3 | **分页无上限** | 分页 `size` 有最大值限制（建议 ≤ 200） | `@RequestParam(defaultValue = "999999") Integer size` |
| 3.4 | **大对象加载** | 接口不返回不必要的字段；列表接口不加载大文本字段（`content` / `body`） | 列表接口 `SELECT *` 返回了 `TEXT` 类型的帖子正文 |
| 3.5 | **连接释放** | 数据库 / Redis / HTTP 连接在 `finally` 或 try-with-resources 中关闭 | 手动 `conn.close()` 写在 try 块，异常时泄漏 |

### 🔵 建议项 — 不阻塞合入

| # | 检查项 | 通过标准 |
|---|--------|----------|
| 3.6 | **缓存策略** | 高频读取的低变化数据（首页配置、分类列表）考虑加缓存 |
| 3.7 | **慢查询** | 新查询在预发环境 `EXPLAIN` 通过，无 `Using filesort` / `Using temporary` |

---

## 四、可维护性（Maintainability）

### 🟡 警告项

| # | 检查项 | 通过标准 | 不通过示例 |
|---|--------|----------|------------|
| 4.1 | **Controller 职责** | Controller 只做参数校验和调用 Service，**不得**直接构建 `QueryWrapper` / 调用 `Mapper` | `QueryWrapper<User> qw = new QueryWrapper<>();` 出现在 Controller |
| 4.2 | **DTO 使用** | 接口请求体和响应体使用强类型 DTO，**不得**使用 `Map<String, Object>` | `@RequestBody Map<String, Object> params` |
| 4.3 | **方法长度** | 单个方法 ≤ 80 行；超过需拆分且有注释说明 | 一个 `getPosts` 方法 200 行 |
| 4.4 | **通配符导入** | **禁止** `import java.util.*` 等通配符导入 | `import java.util.*;` |
| 4.5 | **`any` 类型（前端）** | 新增接口调用定义了 TypeScript 类型，**不得**使用 `any` 绕过 | `api.get<any>("/api/new-endpoint")` |

### 🔵 建议项

| # | 检查项 | 通过标准 |
|---|--------|----------|
| 4.6 | **重复代码** | 私有工具方法（`safeInt`、`normalizePage`）抽取到公共工具类 `CommonUtils` |
| 4.7 | **魔法数字** | 状态码、业务常量定义为 `enum` 或 `public static final` |
| 4.8 | **注释** | 复杂业务逻辑有注释解释 **WHY**（不是 WHAT） |
| 4.9 | **ObjectMapper** | 使用 Spring 管理的 `ObjectMapper` Bean，不在方法内 `new ObjectMapper()` |
| 4.10 | **前端组件拆分** | 单文件 > 500 行的新增组件需说明原因 |

---

## 五、数据库变更（Database）

### 🔴 阻断项

| # | 检查项 | 通过标准 | 不通过示例 |
|---|--------|----------|------------|
| 5.1 | **Migration 方式** | Schema 变更使用 Flyway 迁移文件（`V<version>__<desc>.sql`），**不得**手动改库 | 直接连生产库 `ALTER TABLE` |
| 5.2 | **不可逆变更** | 删表/删列操作需在迁移文件中注释说明回滚方式 | `DROP COLUMN email` 无注释 |
| 5.3 | **历史迁移不改** | **不得**修改已合入主分支的 Flyway 迁移文件 | 修改了 `V1__init.sql` 的 `checksum` |

### 🟡 警告项

| # | 检查项 | 通过标准 | 不通过示例 |
|---|--------|----------|------------|
| 5.4 | **新字段默认值** | 新增 `NOT NULL` 列必须有 `DEFAULT` 值 | `ALTER TABLE t ADD col INT NOT NULL` |
| 5.5 | **大表变更** | > 100 万行的表加索引 / 改列需在低峰期操作或使用在线 DDL | 业务高峰直接对大表 `ALTER` |
| 5.6 | **索引命名** | 索引名遵循 `idx_<table>_<column>` 规范 | 索引名为 `index1`、`aaa` |

---

## 六、前端专项（Frontend）

### 🟡 警告项

| # | 检查项 | 通过标准 | 不通过示例 |
|---|--------|----------|------------|
| 6.1 | **构建通过** | `npm run build` 零错误零警告（仅允许既有审计警告） | 构建报 TS 类型错误 |
| 6.2 | **新页面路由** | 新页面在 `site-navigation.test.ts` 中有对应测试断言 | 加了 `/new-page` 路由但测试未更新 |
| 6.3 | **静默错误** | 使用 `{ silent: true }` 的 API 调用必须有对应的 `onError` 处理 | `api.get(url, { silent: true })` 后无 catch/onError |
| 6.4 | **XSS 防护** | 用户输入渲染到 DOM 前经过 React 默认转义（不用 `dangerouslySetInnerHTML`），或使用 DOMPurify | `dangerouslySetInnerHTML={{ __html: userInput }}` 未消毒 |

### 🔵 建议项

| # | 检查项 | 通过标准 |
|---|--------|----------|
| 6.5 | **响应式** | 新页面在 375px（手机）/ 768px（平板）/ 1440px（桌面）三种宽度下布局正常 |
| 6.6 | **加载状态** | 异步请求有 loading 态和 error 态 UI |
| 6.7 | **空状态** | 列表为空时显示空状态提示，不显示空白页 |

---

## 七、测试（Testing）

### 🔴 阻断项

| # | 检查项 | 通过标准 | 不通过示例 |
|---|--------|----------|------------|
| 7.1 | **回归通过** | `mvn test` 全部通过，无新增失败 | 改了 Service 逻辑，已有测试报错未修复 |

### 🟡 警告项

| # | 检查项 | 通过标准 | 不通过示例 |
|---|--------|----------|------------|
| 7.2 | **新增测试** | 新增 Controller 端点有对应的 MockMvc 测试；新增 Service 方法有单元测试 | 加了 3 个新 API，0 个测试 |
| 7.3 | **边界测试** | 测试覆盖了空参数、异常参数的 400 响应 | 只测了正常路径 |

### 🔵 建议项

| # | 检查项 | 通过标准 |
|---|--------|----------|
| 7.4 | **测试命名** | 测试方法名描述场景，如 `shouldReturn400WhenUsernameIsBlank` |

---

## 审查结论判定

| 结果 | 条件 |
|------|------|
| ✅ **通过 (Approve)** | 零个 🔴 阻断项，🟡 警告项 < 3 个 |
| ⚠️ **有条件通过 (Approve with comments)** | 零个 🔴 阻断项，🟡 警告项 ≥ 3 个 —— 审查者列出警告项，由作者确认后合入，或创建 Tech Debt Issue |
| ❌ **打回 (Request Changes)** | 任意一个 🔴 阻断项不通过，或审查者判断警告项需立即修复 |

---

## 审查流程

1. **作者自查**：提交 PR 前逐项自查，🔴 项必须全部通过，🟡 项尽量修复
2. **审查者逐项检查**：按安全 → 正确性 → 性能 → 可维护性 → DB → 前端 → 测试顺序
3. **记录结论**：在 PR 评论中粘贴结论（`✅ / ⚠️ / ❌`），列出不通过项及对应编号
4. **修复验证**：作者修复后，审查者仅复查不通过项，不重新全量审查

---

> **关联文档**：[发布检查清单](./release-checklist.md)（发布前检查）、[代码审查问题台账](./code-review-issues.md)（已知问题台账）、[安全注意事项](../../SECURITY.md)。
