package com.excel.forum.controller;

import com.excel.forum.entity.User;
import com.excel.forum.entity.dto.AuthEmailChangeRequest;
import com.excel.forum.entity.dto.AuthPasswordChangeRequest;
import com.excel.forum.entity.dto.AuthResponse;
import com.excel.forum.entity.dto.ForgotPasswordRequest;
import com.excel.forum.entity.dto.LoginRequest;
import com.excel.forum.entity.dto.RegisterRequest;
import com.excel.forum.entity.dto.ResetPasswordRequest;
import com.excel.forum.service.PasswordResetTokenService;
import com.excel.forum.service.RateLimitResult;
import com.excel.forum.service.RateLimitService;
import com.excel.forum.service.UserService;
import com.excel.forum.util.JwtUtil;
import com.excel.forum.util.PasswordPolicy;
import com.excel.forum.util.UsernamePolicy;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;
import jakarta.servlet.http.HttpServletRequest;

import java.time.Duration;
import java.util.Map;
import java.util.concurrent.ThreadLocalRandom;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {
    private static final String EMAIL_REGEX = "^[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9.-]{1,190}\\.[A-Za-z]{2,63}$";
    private static final String DUMMY_BCRYPT_HASH = "$2a$10$7EqJtq98hPqEX7fNZaFWoOHi5M1QwzKzbwQ6vurIWBLL8GMDIS9xC";

    private final UserService userService;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;
    private final RateLimitService rateLimitService;
    private final PasswordResetTokenService passwordResetTokenService;

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody LoginRequest request, HttpServletRequest servletRequest) {
        String loginId = request == null || request.getUsername() == null ? "" : request.getUsername().trim();
        String password = request == null || request.getPassword() == null ? "" : request.getPassword();
        String clientIp = resolveClientIp(servletRequest);
        ResponseEntity<?> rateLimitResponse = toLimitResponse(rateLimitService.check(
                "auth:login:id-ip:" + normalizeRateLimitKey(loginId) + ":" + clientIp,
                8,
                Duration.ofSeconds(60),
                "登录过于频繁，请稍后再试"
        ));
        if (rateLimitResponse != null) {
            return rateLimitResponse;
        }
        rateLimitResponse = toLimitResponse(rateLimitService.check(
                "auth:login:ip:" + clientIp,
                60,
                Duration.ofMinutes(5),
                "登录过于频繁，请稍后再试"
        ));
        if (rateLimitResponse != null) {
            return rateLimitResponse;
        }

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
        AuthResponse.UserDTO userDTO = toUserDTO(user);

        return ResponseEntity.ok(new AuthResponse(token, userDTO));
    }

    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody RegisterRequest request, HttpServletRequest servletRequest) {
        String username = UsernamePolicy.normalize(request == null ? null : request.getUsername());
        String email = normalizeEmail(request == null ? null : request.getEmail());
        String password = request == null ? null : request.getPassword();
        String clientIp = resolveClientIp(servletRequest);

        ResponseEntity<?> rateLimitResponse = toLimitResponse(rateLimitService.check(
                "auth:register:ip:" + clientIp,
                10,
                Duration.ofHours(1),
                "注册过于频繁，请稍后再试"
        ));
        if (rateLimitResponse != null) {
            return rateLimitResponse;
        }
        rateLimitResponse = toLimitResponse(rateLimitService.check(
                "auth:register:id-ip:" + normalizeRateLimitKey(username) + ":" + clientIp,
                3,
                Duration.ofMinutes(10),
                "注册过于频繁，请稍后再试"
        ));
        if (rateLimitResponse != null) {
            return rateLimitResponse;
        }

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
            return ResponseEntity.badRequest().body(PasswordPolicy.MESSAGE);
        }

        if (userService.findByUsername(username) != null || userService.findByEmail(email) != null) {
            return ResponseEntity.badRequest().body("注册信息不可用，请更换后重试");
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
        user.setSourceChannel("自助注册");
        user.setForceChangePassword(false);

        userService.save(user);

        return ResponseEntity.ok("注册成功");
    }

    @PostMapping("/forgot-password")
    public ResponseEntity<?> forgotPassword(@RequestBody ForgotPasswordRequest body, HttpServletRequest servletRequest) {
        String username = UsernamePolicy.normalize(body == null ? null : body.getUsername());
        String email = normalizeEmail(body == null ? null : body.getEmail());
        String clientIp = resolveClientIp(servletRequest);

        ResponseEntity<?> rateLimitResponse = toLimitResponse(rateLimitService.check(
                "auth:forgot:id-ip:" + normalizeRateLimitKey(username + ":" + email) + ":" + clientIp,
                3,
                Duration.ofMinutes(15),
                "重置密码过于频繁，请稍后再试"
        ));
        if (rateLimitResponse != null) {
            return rateLimitResponse;
        }
        rateLimitResponse = toLimitResponse(rateLimitService.check(
                "auth:forgot:ip:" + clientIp,
                10,
                Duration.ofHours(1),
                "重置密码过于频繁，请稍后再试"
        ));
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

        passwordResetTokenService.issueResetToken(username, email, clientIp);
        return ResponseEntity.status(HttpStatus.ACCEPTED).body(Map.of("message", "如果账号信息匹配，系统会发送密码重置指引"));
    }

    @PostMapping("/reset-password")
    public ResponseEntity<?> resetPassword(@RequestBody ResetPasswordRequest body) {
        String token = body == null ? null : body.getToken();
        String newPassword = body == null ? null : body.getNewPassword();
        if (!isStrongPassword(newPassword)) {
            return ResponseEntity.badRequest().body(Map.of("message", PasswordPolicy.MESSAGE));
        }

        return passwordResetTokenService.consumeToken(token)
                .map(user -> {
                    user.setPassword(passwordEncoder.encode(newPassword));
                    user.setTokenVersion(nextTokenVersion(user.getTokenVersion()));
                    user.setForceChangePassword(false);
                    userService.updateById(user);
                    return ResponseEntity.ok(Map.of("message", "密码已重置，请重新登录"));
                })
                .orElseGet(() -> ResponseEntity.badRequest().body(Map.of("message", "重置链接无效或已过期")));
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

        AuthResponse.UserDTO userDTO = toUserDTO(user);

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
            return ResponseEntity.badRequest().body(java.util.Map.of("message", PasswordPolicy.MESSAGE));
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
        user.setForceChangePassword(false);
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

    private String normalizeRateLimitKey(String value) {
        if (value == null || value.isBlank()) {
            return "anonymous";
        }
        return value.trim().toLowerCase().replaceAll("[^a-z0-9@._:-]", "_");
    }

    private String normalizeEmail(String value) {
        return value == null ? null : value.trim().toLowerCase();
    }

    private int nextTokenVersion(Integer tokenVersion) {
        return tokenVersion == null ? 1 : tokenVersion + 1;
    }

    private AuthResponse.UserDTO toUserDTO(User user) {
        return new AuthResponse.UserDTO(
                user.getId(),
                user.getUsername(),
                user.getEmail(),
                user.getPhone(),
                user.getAvatar(),
                user.getRole(),
                user.getSourceChannel(),
                user.getLevel(),
                user.getPoints(),
                user.getExp(),
                Boolean.TRUE.equals(user.getForceChangePassword()),
                user.getBio(),
                user.getExpertise(),
                user.getGender(),
                user.getJobTitle(),
                user.getLocation(),
                user.getWebsite(),
                user.getCoverImage(),
                user.getNotificationEmailEnabled() == null || user.getNotificationEmailEnabled(),
                user.getNotificationPushEnabled() == null || user.getNotificationPushEnabled(),
                user.getThemePreference(),
                user.getLastLoginTime()
        );
    }

    private String resolveClientIp(HttpServletRequest request) {
        if (request == null) {
            return "unknown";
        }
        String forwarded = firstHeaderValue(request.getHeader("X-Forwarded-For"));
        if (forwarded != null) {
            return normalizeRateLimitKey(forwarded);
        }
        String realIp = firstHeaderValue(request.getHeader("X-Real-IP"));
        if (realIp != null) {
            return normalizeRateLimitKey(realIp);
        }
        return normalizeRateLimitKey(request.getRemoteAddr());
    }

    private String firstHeaderValue(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        String first = value.split(",", 2)[0].trim();
        return first.isBlank() ? null : first;
    }

    private ResponseEntity<?> toLimitResponse(RateLimitResult result) {
        if (result == null || result.allowed()) {
            return null;
        }
        return ResponseEntity.status(429).body(Map.of(
                "message", result.message(),
                "retryAfterSeconds", result.retryAfterSeconds()
        ));
    }
}
