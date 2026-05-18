package com.excel.forum.controller;

import com.excel.forum.entity.User;
import com.excel.forum.entity.dto.AuthEmailChangeRequest;
import com.excel.forum.entity.dto.AuthPasswordChangeRequest;
import com.excel.forum.entity.dto.AuthResponse;
import com.excel.forum.entity.dto.ForgotPasswordRequest;
import com.excel.forum.entity.dto.LoginRequest;
import com.excel.forum.entity.dto.RegisterRequest;
import com.excel.forum.service.UserService;
import com.excel.forum.util.JwtUtil;
import com.excel.forum.util.PasswordPolicy;
import com.excel.forum.util.UsernamePolicy;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.web.bind.annotation.*;
import jakarta.servlet.http.HttpServletRequest;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ThreadLocalRandom;
import java.util.List;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
@Slf4j
public class AuthController {
    private static final String EMAIL_REGEX = "^[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9.-]{1,190}\\.[A-Za-z]{2,63}$";
    private static final String DUMMY_BCRYPT_HASH = "$2a$10$7EqJtq98hPqEX7fNZaFWoOHi5M1QwzKzbwQ6vurIWBLL8GMDIS9xC";
    private static final DefaultRedisScript<Long> RATE_LIMIT_SCRIPT = new DefaultRedisScript<>(
            "local current = redis.call('INCR', KEYS[1]); " +
                    "if current == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]); end; " +
                    "return current;",
            Long.class
    );
    private static final ConcurrentHashMap<String, LocalRateLimitState> LOCAL_RATE_LIMITS = new ConcurrentHashMap<>();

    private final UserService userService;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;
    private final StringRedisTemplate redisTemplate;

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody LoginRequest request) {
        ResponseEntity<?> rateLimitResponse = guardRateLimit("auth:login:" + normalizeRateLimitKey(request.getUsername()), 10, 60, "登录过于频繁，请稍后再试");
        if (rateLimitResponse != null) {
            return rateLimitResponse;
        }
        String loginId = request.getUsername() == null ? "" : request.getUsername().trim();
        String password = request.getPassword() == null ? "" : request.getPassword();

        User userByUsername = userService.findByUsername(loginId);
        User userByEmail = userService.findByEmail(loginId);
        User user = userByUsername != null ? userByUsername : userByEmail;

        String passwordHash = user != null && user.getPassword() != null ? user.getPassword() : DUMMY_BCRYPT_HASH;
        boolean passwordMatched = passwordEncoder.matches(password, passwordHash);
        if (user == null || !passwordMatched) {
            applyLoginFailureDelay();
            return ResponseEntity.badRequest().body("用户名或密码错误");
        }

        if (user.getStatus() == 1) {
            return ResponseEntity.badRequest().body("账户已被锁定，请联系管理员");
        }

        userService.setOnline(user.getId());

        String token = jwtUtil.generateToken(user.getId(), user.getUsername(), user.getRole(), user.getTokenVersion());
        AuthResponse.UserDTO userDTO = new AuthResponse.UserDTO(
                user.getId(),
                user.getUsername(),
                user.getEmail(),
                user.getAvatar(),
                user.getRole(),
                user.getLevel(),
                user.getPoints(),
                user.getExp(),
                user.getBio(),
                user.getExpertise(),
                user.getGender(),
                user.getJobTitle(),
                user.getLocation(),
                user.getWebsite(),
                user.getCoverImage(),
                user.getNotificationEmailEnabled() == null || user.getNotificationEmailEnabled(),
                user.getNotificationPushEnabled() == null || user.getNotificationPushEnabled(),
                user.getThemePreference()
        );

        return ResponseEntity.ok(new AuthResponse(token, userDTO));
    }

    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody RegisterRequest request) {
        ResponseEntity<?> rateLimitResponse = guardRateLimit("auth:register:" + normalizeRateLimitKey(request.getUsername()), 5, 300, "注册过于频繁，请稍后再试");
        if (rateLimitResponse != null) {
            return rateLimitResponse;
        }
        String username = UsernamePolicy.normalize(request.getUsername());
        String email = normalizeEmail(request.getEmail());
        String password = request.getPassword();

        if (username == null || username.isEmpty()) {
            return ResponseEntity.badRequest().body("用户名不能为空");
        }
        if (!UsernamePolicy.isValid(username)) {
            return ResponseEntity.badRequest().body("用户名仅支持 2-30 位中文、字母、数字、下划线和中划线");
        }
        if (UsernamePolicy.isReserved(username)) {
            return ResponseEntity.badRequest().body("该用户名不可使用");
        }
        if (email == null || email.isEmpty()) {
            return ResponseEntity.badRequest().body("邮箱不能为空");
        }
        if (!email.matches(EMAIL_REGEX)) {
            return ResponseEntity.badRequest().body("邮箱格式不正确");
        }
        if (!isStrongPassword(password)) {
            return ResponseEntity.badRequest().body("密码必须至少8位，且只能包含字母和数字");
        }

        if (userService.findByUsername(username) != null) {
            return ResponseEntity.badRequest().body("用户名已存在");
        }

        if (userService.findByEmail(email) != null) {
            return ResponseEntity.badRequest().body("邮箱已被注册");
        }

        User user = new User();
        user.setUsername(username);
        user.setEmail(email);
        user.setPassword(passwordEncoder.encode(password));
        user.setTokenVersion(0);
        user.setLevel(1);
        user.setPoints(0);
        user.setExp(0);
        user.setStatus(0);
        user.setRole("user");

        userService.save(user);

        return ResponseEntity.ok("注册成功");
    }

    @PostMapping("/forgot-password")
    public ResponseEntity<?> forgotPassword(@RequestBody ForgotPasswordRequest body) {
        String username = UsernamePolicy.normalize(body == null ? null : body.getUsername());
        String email = normalizeEmail(body == null ? null : body.getEmail());
        String newPassword = body == null ? null : body.getNewPassword();

        ResponseEntity<?> rateLimitResponse = guardRateLimit("auth:forgot:" + normalizeRateLimitKey(username + ":" + email), 5, 300, "重置密码过于频繁，请稍后再试");
        if (rateLimitResponse != null) {
            return rateLimitResponse;
        }
        if (username == null || username.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("message", "请输入用户名"));
        }
        if (email == null || email.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("message", "请输入注册邮箱"));
        }
        if (!email.matches(EMAIL_REGEX)) {
            return ResponseEntity.badRequest().body(Map.of("message", "邮箱格式不正确"));
        }
        if (!isStrongPassword(newPassword)) {
            return ResponseEntity.badRequest().body(Map.of("message", "新密码必须至少8位，且只能包含字母和数字"));
        }

        User user = userService.findByUsername(username);
        String passwordHash = user != null && user.getPassword() != null ? user.getPassword() : DUMMY_BCRYPT_HASH;
        passwordEncoder.matches(newPassword == null ? "" : newPassword, passwordHash);
        if (user == null || user.getEmail() == null || !user.getEmail().equalsIgnoreCase(email)) {
            applyLoginFailureDelay();
            return ResponseEntity.badRequest().body(Map.of("message", "用户名与邮箱不匹配"));
        }

        user.setPassword(passwordEncoder.encode(newPassword));
        user.setTokenVersion(nextTokenVersion(user.getTokenVersion()));
        userService.updateById(user);

        return ResponseEntity.ok(Map.of("message", "密码已重置，请使用新密码登录"));
    }

    @GetMapping("/current")
    public ResponseEntity<?> getCurrentUser(HttpServletRequest request) {
        Long userId = (Long) request.getAttribute("userId");
        if (userId == null) {
            return ResponseEntity.status(401).body(Map.of("message", "未登录"));
        }
        User user = userService.getById(userId);
        if (user == null) {
            return ResponseEntity.notFound().build();
        }

        AuthResponse.UserDTO userDTO = new AuthResponse.UserDTO(
                user.getId(),
                user.getUsername(),
                user.getEmail(),
                user.getAvatar(),
                user.getRole(),
                user.getLevel(),
                user.getPoints(),
                user.getExp(),
                user.getBio(),
                user.getExpertise(),
                user.getGender(),
                user.getJobTitle(),
                user.getLocation(),
                user.getWebsite(),
                user.getCoverImage(),
                user.getNotificationEmailEnabled() == null || user.getNotificationEmailEnabled(),
                user.getNotificationPushEnabled() == null || user.getNotificationPushEnabled(),
                user.getThemePreference()
        );

        return ResponseEntity.ok(userDTO);
    }

    @PostMapping("/logout")
    public ResponseEntity<?> logout(@RequestAttribute Long userId, HttpServletRequest request) {
        String token = extractBearerToken(request);
        if (token != null) {
            jwtUtil.invalidateToken(token);
        }
        userService.setOffline(userId);
        return ResponseEntity.ok("登出成功");
    }

    @PutMapping("/password")
    public ResponseEntity<?> changePassword(
            @RequestAttribute Long userId,
            HttpServletRequest request,
            @RequestBody AuthPasswordChangeRequest body) {
        
        String oldPassword = body == null ? null : body.getOldPassword();
        String newPassword = body == null ? null : body.getNewPassword();
        
        if (oldPassword == null || oldPassword.isBlank()) {
            return ResponseEntity.badRequest().body(java.util.Map.of("message", "请输入当前密码"));
        }
        if (!isStrongPassword(newPassword)) {
            return ResponseEntity.badRequest().body(java.util.Map.of("message", "新密码必须至少8位，且只能包含字母和数字"));
        }
        
        User user = userService.getById(userId);
        if (user == null) {
            return ResponseEntity.status(404).body(java.util.Map.of("message", "用户不存在"));
        }
        
        if (!passwordEncoder.matches(oldPassword, user.getPassword())) {
            return ResponseEntity.badRequest().body(java.util.Map.of("message", "当前密码错误"));
        }
        
        user.setPassword(passwordEncoder.encode(newPassword));
        user.setTokenVersion(nextTokenVersion(user.getTokenVersion()));
        userService.updateById(user);
        String token = extractBearerToken(request);
        if (token != null) {
            jwtUtil.invalidateToken(token);
        }
        
        return ResponseEntity.ok(java.util.Map.of("message", "密码修改成功"));
    }

    @PutMapping("/email")
    public ResponseEntity<?> changeEmail(
            @RequestAttribute Long userId,
            @RequestBody AuthEmailChangeRequest body) {
        
        String newEmail = normalizeEmail(body == null ? null : body.getNewEmail());
        String password = body == null ? null : body.getPassword();
        
        if (newEmail == null || newEmail.isBlank()) {
            return ResponseEntity.badRequest().body(java.util.Map.of("message", "请输入新邮箱"));
        }
        if (!newEmail.matches("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$")) {
            return ResponseEntity.badRequest().body(java.util.Map.of("message", "邮箱格式不正确"));
        }
        if (password == null || password.isBlank()) {
            return ResponseEntity.badRequest().body(java.util.Map.of("message", "请输入密码确认身份"));
        }
        
        User user = userService.getById(userId);
        if (user == null) {
            return ResponseEntity.status(404).body(java.util.Map.of("message", "用户不存在"));
        }
        
        if (!passwordEncoder.matches(password, user.getPassword())) {
            return ResponseEntity.badRequest().body(java.util.Map.of("message", "密码错误"));
        }
        
        User existingUser = userService.findByEmail(newEmail);
        if (existingUser != null && !existingUser.getId().equals(userId)) {
            return ResponseEntity.badRequest().body(java.util.Map.of("message", "该邮箱已被其他用户使用"));
        }
        
        user.setEmail(newEmail);
        userService.updateById(user);
        
        return ResponseEntity.ok(java.util.Map.of("message", "邮箱修改成功"));
    }

    private boolean isStrongPassword(String password) {
        return PasswordPolicy.isStrongPassword(password);
    }

    private void applyLoginFailureDelay() {
        try {
            Thread.sleep(ThreadLocalRandom.current().nextLong(180, 320));
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
        }
    }

    private String extractBearerToken(HttpServletRequest request) {
        String authHeader = request.getHeader("Authorization");
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            return authHeader.substring(7);
        }
        return null;
    }

    private ResponseEntity<?> guardRateLimit(String key, int maxRequests, int ttlSeconds, String limitedMessage) {
        try {
            Long count = redisTemplate.execute(RATE_LIMIT_SCRIPT, List.of(key), String.valueOf(ttlSeconds));
            if (count != null && count > maxRequests) {
                return ResponseEntity.status(429).body(Map.of("message", limitedMessage));
            }
            return null;
        } catch (Exception exception) {
            log.debug("Redis rate limit unavailable, falling back to local limiter for key {}", key, exception);
            long now = System.currentTimeMillis();
            LocalRateLimitState state = LOCAL_RATE_LIMITS.compute(key, (currentKey, currentState) -> {
                if (currentState == null || currentState.expireAtMillis <= now) {
                    return new LocalRateLimitState(1, now + ttlSeconds * 1000L);
                }
                currentState.count += 1;
                return currentState;
            });
            cleanupExpiredLocalRateLimits(now);
            if (state != null && state.count > maxRequests) {
                return ResponseEntity.status(429).body(Map.of("message", limitedMessage));
            }
            return null;
        }
    }

    private String normalizeRateLimitKey(String value) {
        if (value == null || value.isBlank()) {
            return "anonymous";
        }
        return value.trim().toLowerCase();
    }

    private String normalizeEmail(String value) {
        return value == null ? null : value.trim().toLowerCase();
    }

    private int nextTokenVersion(Integer tokenVersion) {
        return tokenVersion == null ? 1 : tokenVersion + 1;
    }

    private void cleanupExpiredLocalRateLimits(long now) {
        LOCAL_RATE_LIMITS.entrySet().removeIf(entry -> entry.getValue().expireAtMillis <= now);
    }

    private static final class LocalRateLimitState {
        private int count;
        private final long expireAtMillis;

        private LocalRateLimitState(int count, long expireAtMillis) {
            this.count = count;
            this.expireAtMillis = expireAtMillis;
        }
    }
}
