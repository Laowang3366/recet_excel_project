# 严重安全问题

## 1. JWT 密钥配置漏洞

**位置**: `JwtUtil.java:19-36`

**问题**: 未强制最小密钥长度(需要 ≥32 字节)

**风险**: 弱密钥可被暴力破解,攻击者伪造 token

**修复**:
```java
@PostConstruct
public void validateSecret() {
    if (secret == null || secret.isBlank()) {
        throw new IllegalStateException("必须配置 JWT_SECRET");
    }
    byte[] keyBytes = secret.getBytes(StandardCharsets.UTF_8);
    if (keyBytes.length < 32) {
        throw new IllegalStateException(
            String.format("JWT_SECRET 长度不足: 当前 %d 字节,至少需要 32 字节", keyBytes.length));
    }
}
```

**生成安全密钥**:
```bash
openssl rand -base64 48
```

---

## 2. 限流竞态条件

**位置**: `AuthController.java:301-311`

**问题**: increment 和 expire 非原子操作,���程崩溃导致永久封禁

**修复(Lua 脚本)**:
```java
private RedisScript<Long> rateLimitScript;

@PostConstruct
public void initRateLimitScript() {
    String script = 
        "local current = redis.call('incr', KEYS[1])\n" +
        "if current == 1 then\n" +
        "  redis.call('expire', KEYS[1], ARGV[1])\n" +
        "end\n" +
        "return current";
    rateLimitScript = RedisScript.of(script, Long.class);
}

private boolean isRateLimited(String key, int maxRequests, int ttlSeconds) {
    try {
        Long count = redisTemplate.execute(
            rateLimitScript,
            Collections.singletonList(key),
            String.valueOf(ttlSeconds));
        return count != null && count > maxRequests;
    } catch (Exception e) {
        log.error("限流失败: {}", e.getMessage());
        return false;
    }
}
```

---

## 3. 登录时序攻击

**位置**: `AuthController.java:42-49`

**问题**: bcrypt 仅在用户存在时执行,泄���用户名

**修复**:
```java
private static final String DUMMY_HASH = 
    "$2a$10$dummyHashToPreventTimingAttack1234567890123456789012";

@PostMapping("/login")
public ResponseEntity<?> login(@RequestBody LoginRequest request) {
    User user = userService.findByUsername(request.getUsername());
    if (user == null) {
        user = userService.findByEmail(request.getUsername());
    }
    
    // 始终执行密码比较
    String hash = (user != null) ? user.getPassword() : DUMMY_HASH;
    boolean matches = passwordEncoder.matches(request.getPassword(), hash);
    
    constantTimeDelay();
    
    if (user == null || !matches) {
        return ResponseEntity.badRequest().body("用户名或密码错误");
    }
    // ...
}
```

---

## 4. 密码修改后 Token 未失效

**位置**: `AuthController.java:188-229`

**问题**: 改密后�� token 仍有效

**修复步骤**:

### 4.1 数据库迁移
```sql
ALTER TABLE user ADD COLUMN token_version INT DEFAULT 0 NOT NULL;
```

### 4.2 实体类
```java
@TableField("token_version")
private Integer tokenVersion = 0;
```

### 4.3 生成 Token 时包含版本
```java
public String generateToken(Long userId, String username, String role, Integer tokenVersion) {
    return Jwts.builder()
        .subject(userId.toString())
        .claim("username", username)
        .claim("role", role)
        .claim("tokenVersion", tokenVersion)
        .issuedAt(new Date())
        .expiration(new Date(System.currentTimeMillis() + expiration))
        .signWith(getSigningKey())
        .compact();
}
```

### 4.4 验证时检查版本
```java
public boolean validateToken(String token) {
    try {
        if (isBlacklisted(token)) return false;
        
        Claims claims = parseToken(token);
        Long userId = Long.parseLong(claims.getSubject());
        Integer tokenVersion = claims.get("tokenVersion", Integer.class);
        
        User user = userService.getById(userId);
        if (user == null || !tokenVersion.equals(user.getTokenVersion())) {
            return false;
        }
        return true;
    } catch (Exception e) {
        return false;
    }
}
```

### 4.5 改密时递增版本
```java
@PostMapping("/change-password")
public ResponseEntity<?> changePassword(@RequestBody ChangePasswordRequest request, 
                                       HttpServletRequest httpRequest) {
    Long userId = (Long) httpRequest.getAttribute("userId");
    User user = userService.getById(userId);
    
    // 验证旧密码...
    
    user.setPassword(passwordEncoder.encode(newPassword));
    user.setTokenVersion(user.getTokenVersion() + 1);
    userService.updateById(user);
    
    return ResponseEntity.ok(Map.of("message", "密码已修改,所有设备需重新登录"));
}
```
