# 高优先级逻辑问题

## 5. CORS 配置不一致

**位置**: `SecurityConfig.java:115-126`

**问题**: 通配符 origin + credentials 组合浏览器会拒绝

**当前代码**:
```java
configuration.setAllowedOriginPatterns(resolveAllowedOrigins()); // http://localhost:*
configuration.setAllowCredentials(true);
```

**修复**:
```java
@Bean
public CorsConfigurationSource corsConfigurationSource() {
    CorsConfiguration configuration = new CorsConfiguration();
    List<String> origins = resolveAllowedOrigins();
    boolean hasWildcard = origins.stream().anyMatch(o -> o.contains("*"));
    
    if (hasWildcard) {
        configuration.setAllowedOriginPatterns(origins);
        configuration.setAllowCredentials(false);
        log.warn("检测到通配符 origin,已禁用 credentials");
    } else {
        configuration.setAllowedOrigins(origins);
        configuration.setAllowCredentials(true);
    }
    
    configuration.setAllowedMethods(Arrays.asList("GET", "POST", "PUT", "DELETE", "OPTIONS"));
    configuration.setAllowedHeaders(Arrays.asList("*"));
    configuration.setMaxAge(3600L);
    
    UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
    source.registerCorsConfiguration("/**", configuration);
    return source;
}
```

**生产环境配置**:
```properties
ALLOWED_ORIGINS=https://forum.example.com,https://admin.forum.example.com
```

---

## 6. 定时任务性能问题

**位置**: `ScheduledTasks.java:103-118`

**问题**: 加载所有帖子到内存,大量数据库查询

**影响**: 数万帖子时���存溢出、连接池耗尽

**修复(分页批处理)**:
```java
@Scheduled(cron = "0 0 4 * * ?")
public void recalculatePostStats() {
    int pageSize = 100;
    int pageNum = 1;
    long totalProcessed = 0;
    
    while (true) {
        Page<Post> page = postService.page(
            new Page<>(pageNum, pageSize),
            new QueryWrapper<Post>().eq("status", 0));
        
        if (page.getRecords().isEmpty()) break;
        
        List<Long> postIds = page.getRecords().stream()
            .map(Post::getId)
            .collect(Collectors.toList());
        
        // 批量统计(一次查询)
        Map<Long, Long> likeCounts = likeService.list(
            new QueryWrapper<Like>()
                .select("target_id, COUNT(*) as cnt")
                .eq("target_type", "post")
                .in("target_id", postIds)
                .groupBy("target_id"))
            .stream()
            .collect(Collectors.toMap(
                Like::getTargetId,
                like -> ((Number) like).longValue()));
        
        // 类似处理 replyCounts 和 favoriteCounts
        
        // 批量更新
        List<Post> updates = page.getRecords().stream()
            .map(post -> {
                Post update = new Post();
                update.setId(post.getId());
                update.setLikeCount(likeCounts.getOrDefault(post.getId(), 0L).intValue());
                update.setReplyCount(replyCounts.getOrDefault(post.getId(), 0L).intValue());
                update.setFavoriteCount(favoriteCounts.getOrDefault(post.getId(), 0L).intValue());
                return update;
            })
            .collect(Collectors.toList());
        
        postService.updateBatchById(updates);
        totalProcessed += page.getRecords().size();
        
        if (!page.hasNext()) break;
        pageNum++;
    }
    
    log.info("帖子统计校准完成,共处理 {} 条", totalProcessed);
}
```

---

## 7. Redis 故障不安全降级

**位置**: `JwtUtil.java:102-109`

**问题**: Redis 不可用时返回 false,已登出用户仍可访问

**���复(熔断器)**:
```java
private final AtomicInteger redisFailureCount = new AtomicInteger(0);
private final AtomicLong lastRedisCheck = new AtomicLong(0);
private static final int CIRCUIT_BREAKER_THRESHOLD = 3;
private static final long CIRCUIT_BREAKER_TIMEOUT = 60000; // 1分钟

private boolean isBlacklisted(String token) {
    // 熔断器检查
    if (isCircuitBreakerOpen()) {
        log.error("Redis 熔断器开启,拒绝所有请求");
        throw new ServiceUnavailableException("认证服务暂时不可用");
    }
    
    try {
        Boolean exists = redisTemplate.hasKey(buildBlacklistKey(token));
        redisFailureCount.set(0); // 成功则重置计数
        return Boolean.TRUE.equals(exists);
    } catch (RedisConnectionFailureException e) {
        int failures = redisFailureCount.incrementAndGet();
        log.error("Redis 连接失败 ({}/{}): {}", 
            failures, CIRCUIT_BREAKER_THRESHOLD, e.getMessage());
        
        if (failures >= CIRCUIT_BREAKER_THRESHOLD) {
            lastRedisCheck.set(System.currentTimeMillis());
            log.error("Redis 故障次数���到阈值,开启熔断器");
        }
        
        // Fail-closed: Redis 不可用时拒绝访问
        throw new ServiceUnavailableException("认证服务暂时不可用");
    }
}

private boolean isCircuitBreakerOpen() {
    if (redisFailureCount.get() < CIRCUIT_BREAKER_THRESHOLD) {
        return false;
    }
    
    long elapsed = System.currentTimeMillis() - lastRedisCheck.get();
    if (elapsed > CIRCUIT_BREAKER_TIMEOUT) {
        log.info("熔断器超时,尝试恢复");
        redisFailureCount.set(0);
        return false;
    }
    
    return true;
}
```

**全局异常处理**:
```java
@ExceptionHandler(ServiceUnavailableException.class)
public ResponseEntity<?> handleServiceUnavailable(ServiceUnavailableException e) {
    return ResponseEntity.status(503)
        .body(Map.of("message", "服务暂时不可用,请稍后重���"));
}
```

---

## 8. 前端错误处理不一致

**位置**: `api.ts:64-72`

**问题**: 管理路径静默失��,难以调试

**当前代码**:
```typescript
if (!silent && !path.startsWith("/api/admin/")) {
    toast.error(message);
}
```

**修复**:
```typescript
if (!response.ok) {
    if (response.status === 401) {
        clearStoredSession();
    }
    
    const message = normalizeErrorMessage(data, `请求失败(${response.status})`);
    
    // 记录所有��误
    console.error(`[API Error] ${method} ${path}:`, {
        status: response.status,
        message,
        data
    });
    
    // 管理路径也显示 toast,但使用不同样式
    if (!silent) {
        if (path.startsWith("/api/admin/")) {
            toast.error(message, { duration: 2000 }); // 更短的持续时间
        } else {
            toast.error(message);
        }
    }
    
    throw new ApiError(message, response.status, data);
}
```

---

## 9. 用户名验证不足

**位置**: `AuthController.java:87-96`

**问题**: 仅检查长度,未验证字符集和保留名

**��险**: 注册 `"admin "` 冒充管理员

**修复**:
```java
private static final Pattern USERNAME_PATTERN = Pattern.compile("^[a-zA-Z0-9_-]+$");
private static final Set<String> RESERVED_USERNAMES = Set.of(
    "admin", "administrator", "root", "system", "moderator",
    "support", "help", "official", "staff", "team"
);

@PostMapping("/register")
public ResponseEntity<?> register(@RequestBody RegisterRequest request) {
    String username = request.getUsername() != null ? request.getUsername().trim() : null;
    
    if (username == null || username.isEmpty()) {
        return ResponseEntity.badRequest().body("用户名不能为空");
    }
    
    if (username.length() < 3 || username.length() > 20) {
        return ResponseEntity.badRequest().body("用户名长度必须在 3-20 个字符之间");
    }
    
    if (!USERNAME_PATTERN.matcher(username).matches()) {
        return ResponseEntity.badRequest().body("用户名只能包含字母、数字、下划线和连字符");
    }
    
    if (RESERVED_USERNAMES.contains(username.toLowerCase())) {
        return ResponseEntity.badRequest().body("该用户名为保留名称,无法注册");
    }
    
    // 其余注册逻辑...
}
```

---

## 10. XSS 风险

**位置**: `AuthController.java:234-279` (邮箱修改)

**问题**: 邮箱未消毒,前端渲染时可能 XSS

**修复**:

### 后端(额外验证)
```java
private boolean isSafeEmail(String email) {
    // 除了格式验证,还要检查危险字符
    return email.matches(EMAIL_REGEX) && 
           !email.contains("<") && 
           !email.contains(">") && 
           !email.contains("\"");
}
```

### 前端(确保转义)
```typescript
// 在 React 组件中,默认已转义,但确保不使用 dangerouslySetInnerHTML
function UserProfile({ user }: { user: User }) {
    return (
        <div>
            {/* ✅ 安全: React 自动转义 */}
            <p>邮箱: {user.email}</p>
            
            {/* ❌ 危险: 避免使用 */}
            {/* <p dangerouslySetInnerHTML={{ __html: user.email }} /> */}
        </div>
    );
}
```
