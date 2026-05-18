# Excel Forum 项目 Bug 清单（第五轮审计）

> 审计日期：2026-04-08
> 审计轮次：5
> 上轮待修复：**17个**
> 本轮确认修复：**11个**
> 当前仍存在：**6个**
> **数量下降：-11个（↓64.7%）**

---

## 统计概览

| 严重程度 | 本轮数量 | 上轮数量 | 变化 |
|----------|----------|----------|------|
| 🔴 严重 | 2 | 2 | - |
| 🟠 高 | 0 | 5 | **-5** ✅ |
| 🟡 中 | 1 | 7 | **-6** ✅ |
| 🟢 低 | 3 | 3 | - |
| **合计** | **6** | **17** | **-11** |

### 按类别分布

| 问题类别 | 数量 | 占比 |
|----------|------|------|
| 安全漏洞 | 2 | 33.3% |
| 业务逻辑缺陷 | 2 | 33.3% |
| 低危/代码质量 | 2 | 33.3% |

---

## 一、当前仍存在的安全漏洞

### 🔴 严重

#### S1. 默认凭据硬编码

**文件位置**：`config/DataInitializer.java:43`

**问题描述**：
```java
admin.setPassword(passwordEncoder.encode("admin123"));
```
管理员默认密码 `admin123` 硬编码在代码中。日志已改进不再打印密码，但凭据本身仍硬编码。

**风险影响**：攻击者可使用默认凭据登录管理员账户

**修复方案**：
```java
String adminPassword = System.getenv("ADMIN_PASSWORD");
if (adminPassword == null || adminPassword.isBlank()) {
    throw new IllegalStateException("请设置 ADMIN_PASSWORD 环境变量");
}
admin.setPassword(passwordEncoder.encode(adminPassword));
```

---

#### S2. 数据库密码仍有默认值

**文件位置**：`application.yml:13`

**问题描述**：
```yaml
password: ${DB_PASSWORD:admin}
```
数据库密码默认值为 `admin`。

**修复方案**：
```yaml
password: ${DB_PASSWORD}
```

---

## 二、当前仍存在的业务逻辑缺陷

### 🟡 中优先级

#### L5. 板块关注未检查板块是否存在

**文件位置**：`CategoryFollowServiceImpl.java:36-43`

**问题描述**：
```java
public void follow(Long userId, Long categoryId) {
    if (!isFollowing(userId, categoryId)) {
        CategoryFollow cf = new CategoryFollow();
        cf.setUserId(userId);
        cf.setCategoryId(categoryId);  // 未检查 categoryId 是否存在
        save(cf);
    }
}
```
如果传入不存在的 `categoryId`，会产生无效数据。

**修复方案**：
```java
public void follow(Long userId, Long categoryId) {
    if (categoryService.getById(categoryId) == null) {
        throw new IllegalArgumentException("版块不存在");
    }
    if (!isFollowing(userId, categoryId)) {
        CategoryFollow cf = new CategoryFollow();
        cf.setUserId(userId).setCategoryId(categoryId);
        save(cf);
    }
}
```

---

#### L6. 用户关注未检查目标用户是否存在

**文件位置**：`FollowServiceImpl.java:47-57`

**问题描述**：
已添加"不能关注自己"的检查，但未检查目标用户是否存在。传入不存在用户ID会创建无效数据。

**修复方案**：
```java
public void follow(Long userId, Long followUserId) {
    if (userId != null && userId.equals(followUserId)) {
        throw new IllegalArgumentException("不能关注自己");
    }
    if (userService.getById(followUserId) == null) {
        throw new IllegalArgumentException("目标用户不存在");
    }
    if (!isFollowing(userId, followUserId)) {
        Follow follow = new Follow();
        follow.setUserId(userId).setFollowUserId(followUserId);
        save(follow);
    }
}
```

---

## 三、低危/代码质量问题

#### S12. 前端 Token 存储在 localStorage

**文件位置**：`reace_web/src/app/lib/session-store.ts`

**问题描述**：Token 存储在 localStorage 中，XSS 攻击可窃取。

**建议**：生产环境考虑使用 HttpOnly Cookie 或 sessionStorage。

---

#### S13. 异常处理信息泄露风险

**文件位置**：`GlobalExceptionHandler.java`

**问题描述**：生产环境可能通过异常堆栈泄露内部实现细节。

**建议**：仅记录异常类名，返回通用错误消息。

---

## 四、本轮已修复的问题清单（11个）

### 数据一致性修复（2个）

| ID | 问题 | 修复方式 |
|----|------|----------|
| **B6** | 审核并发重复发放奖励 | `AdminController.reviewPost()` 使用 `UpdateWrapper.eq("review_status", "pending")` 乐观锁 |
| **B5** | 删除回复计数不准确 | 改用 `postService.recalculateReplyCount()` 实时重算 |

### 业务逻辑修复（6个）

| ID | 问题 | 修复方式 |
|----|------|----------|
| **L7** | 私信消息无分页 | `MessageService.getMessages()` 新增 `page/size` 参数 + `safeSize = Math.min(size, 100)` |
| **L8** | 登录状态不同步 | `session.tsx:84` 登录后调用 `await refreshUser()` |
| **L9** | 排行榜只统计完成题数 | `PracticeServiceImpl` 排序增加 `accuracy` 和 `totalScore` 维度 |
| **L10** | 帖子列表 N+1 查询 | 搜索接口改用 `DtoConverter.convertPosts()` 批量转换 |
| **L11** | 详情页实时统计 reply_count | 已优化为批量查询 |

### 性能问题修复（3个）

| ID | 问题 | 修复方式 |
|----|------|----------|
| **P4** | 浏览表无限增长 | `ScheduledTasks.cleanOldPostViews()` 清理30天前数据 |
| **P5** | 通知表无限增长 | `ScheduledTasks.cleanOldNotifications()` 清理90天前数据 |
| **P6-P8** | 分享/日志/编辑历史无限增长 | `ScheduledTasks.cleanOldOperationHistory()` 清理180天前数据 |
| **统计校准** | 帖子统计字段不准 | `ScheduledTasks.recalculatePostStats()` 每日凌晨4点校准 |

---

## 五、五轮审计完整趋势

| 轮次 | 发现数 | 待修复 | 累计修复率 |
|------|--------|--------|-----------|
| 第一轮 | 33 | 33 | 0% |
| 第二轮 | +11 | 44 | — |
| 第三轮 | +10 | 54 | — |
| 第四轮 | — | 17 | 68.5% |
| **第五轮** | **—** | **6** | **88.9%** |

### 从第一轮到第五轮的变化

```
54个 (100%) ━━━━━━━━━━━━━━━━━━━━━━━ 第一轮
43个 (79.6%) ━━━━━━━━━━━━━━━━┓ 第四轮
17个 (31.5%) ━━━━━┓         ┃ 第四轮
 6个 (11.1%) ━┓         ┃         ┃ 第五轮 ★
           ┃         ┃         ┃
      48个已修复 (88.9%)
```

---

## 六、修复优先级建议

### P0 — 立即修复 — 2项

| ID | 问题 | 影响 |
|----|------|------|
| **S1** | 默认凭据硬编码 | 安全 |
| **S2** | DB密码默认值 | 安全 |

### P1 — 尽快修复 — 2项

| ID | 问题 | 影响 |
|----|------|------|
| **L5** | 板块关注未校验存在性 | 数据完整性 |
| **L6** | 用户关注未校验存在性 | 数据完整性 |

### P2 — 后续优化 — 2项

| ID | 类型 |
|----|------|
| **S12/S13** | 低危安全/代码质量 |

---

## 七、TOP 3 最关键待修复问题

| 排名 | 问题ID | 问题 | 建议 |
|------|--------|------|------|
| 1 | **S1** | 默认凭据硬编码 `admin123` | **立即修复** |
| 2 | **S2** | DB密码默认值 `admin` | **立即修复** |
| 3 | **L5/L6** | 关注操作未校验目标存在性 | 尽快修复 |

---

## 附录：项目质量提升总结

### 已建立的安全机制

| 机制 | 状态 | 文件 |
|------|------|------|
| CORS 白名单控制 | ✅ | SecurityConfig.java |
| WebSocket 认证拦截器 | ✅ | WebSocketConfig.java |
| JWT Token 黑名单失效 | ✅ | AuthController.logout() |
| 密码强度策略统一 | ✅ | PasswordPolicy |
| 全局频率限制(登录/注册) | ✅ | AuthController |
| 安全响应头(CSP/HSTS/XFO) | ✅ | SecurityConfig |
| 文件上传魔数校验 | ✅ | UploadController |
| HTML内容消毒 | ✅ | HtmlSanitizer |
| 通知频率限制+去重 | ✅ | NotificationServiceImpl |

### 已建立的数据一致性机制

| 机制 | 状态 | 文件 |
|------|------|------|
| 点赞实时同步计数 | ✅ | LikeController.syncPostLikeCount() |
| 收藏实时同步计数 | ✅ | FavoriteController.syncFavoriteCount() |
| 积分原子扣减 | ✅ | MallServiceImpl.deductPoints() |
| 审核乐观锁 | ✅ | AdminController.reviewPost() |
| 回复删除后重算 | ✅ | AdminController.deleteReply() |
| 积分任务唯一约束 | ✅ | V17迁移 uk_points_record_task_reward |
| 浏览量唯一约束 | ✅ | V18迁移 uk_post_view_post_viewer |
| 分享记录唯一约束 | ✅ | V18迁移 post_share 表 |

### 已建立的运维保障机制

| 机制 | 状态 | 文件 |
|------|------|------|
| 定时清理浏览记录(30天) | ✅ | ScheduledTasks |
| 定时清理通知(90天) | ✅ | ScheduledTasks |
| 定时清理操作历史(180天) | ✅ | ScheduledTasks |
| 定时校准帖子统计数据 | ✅ | ScheduledTasks |
| 定时清理过期草稿 | ✅ | ScheduledTasks |
| 不活跃用户状态清理 | ✅ | ScheduledTasks |

---

> 文档生成时间：2026-04-08
> 待修复问题总数：**6个**（从54个降至6个）
> 总修复率：**88.9%**
