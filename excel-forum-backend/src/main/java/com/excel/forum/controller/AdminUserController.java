package com.excel.forum.controller;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.excel.forum.entity.User;
import com.excel.forum.entity.dto.AdminResetPasswordRequest;
import com.excel.forum.entity.dto.AdminUserRequest;
import com.excel.forum.service.NotificationService;
import com.excel.forum.service.UserService;
import com.excel.forum.util.PasswordPolicy;
import com.excel.forum.util.UsernamePolicy;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;

@RestController
@RequestMapping("/api/admin/users")
@RequiredArgsConstructor
@Slf4j
public class AdminUserController {
    private final UserService userService;
    private final PasswordEncoder passwordEncoder;
    private final NotificationService notificationService;

    @GetMapping
    public ResponseEntity<?> getUsers(
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "10") Integer size,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String role,
            @RequestParam(required = false) Integer status,
            @RequestParam(required = false) Integer level,
            @RequestParam(required = false) Integer minLevel,
            @RequestParam(required = false) String startDate,
            @RequestParam(required = false) String endDate) {

        Page<User> pageRequest = new Page<>(page, size);
        QueryWrapper<User> queryWrapper = new QueryWrapper<>();
        LocalDate parsedStartDate = parseDate(startDate);
        LocalDate parsedEndDate = parseDate(endDate);
        if ((StringUtils.hasText(startDate) && parsedStartDate == null)
                || (StringUtils.hasText(endDate) && parsedEndDate == null)) {
            return ResponseEntity.badRequest().body(Map.of("message", "注册时间格式不正确"));
        }

        if (StringUtils.hasText(keyword)) {
            queryWrapper.and(wrapper -> wrapper
                    .like("username", keyword)
                    .or()
                    .like("email", keyword)
                    .or()
                    .like("phone", keyword)
            );
        }
        if (StringUtils.hasText(role)) {
            queryWrapper.eq("role", role);
        }
        if (status != null) {
            queryWrapper.eq("status", status);
        }
        if (level != null) {
            queryWrapper.eq("level", level);
        }
        if (minLevel != null) {
            queryWrapper.ge("level", minLevel);
        }
        if (parsedStartDate != null) {
            queryWrapper.ge("create_time", parsedStartDate.atStartOfDay());
        }
        if (parsedEndDate != null) {
            queryWrapper.lt("create_time", parsedEndDate.plusDays(1).atStartOfDay());
        }
        queryWrapper.orderByDesc("create_time");

        Page<User> result = userService.page(pageRequest, queryWrapper);
        result.getRecords().forEach(user -> user.setPassword(null));

        Map<String, Object> response = new HashMap<>();
        response.put("records", result.getRecords());
        response.put("total", result.getTotal());
        response.put("current", result.getCurrent());
        response.put("size", result.getSize());
        return ResponseEntity.ok(response);
    }

    @PostMapping
    public ResponseEntity<?> createUser(@RequestBody AdminUserRequest request) {
        String username = UsernamePolicy.normalize(request.getUsername());
        String email = request.getEmail() == null ? null : request.getEmail().trim().toLowerCase();
        String phone = normalizePhone(request.getPhone());
        String password = request.getPassword();
        String role = normalizeUserRole(request.getRole(), "user");
        if (role == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "用户角色不正确"));
        }
        Integer status = parseUserStatus(request.getStatus(), 0);
        if (status == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "用户状态不正确"));
        }

        if (username == null || username.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("message", "用户名不能为空"));
        }
        if (!UsernamePolicy.isValid(username)) {
            return ResponseEntity.badRequest().body(Map.of("message", "用户名仅支持 2-30 位中文、字母、数字、下划线和中划线"));
        }
        if (UsernamePolicy.isReserved(username)) {
            return ResponseEntity.badRequest().body(Map.of("message", "该用户名不可使用"));
        }
        if (email == null || email.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("message", "邮箱不能为空"));
        }
        if (!email.matches("^[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9.-]{1,190}\\.[A-Za-z]{2,63}$")) {
            return ResponseEntity.badRequest().body(Map.of("message", "邮箱格式不正确"));
        }
        if (password == null || password.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("message", "密码不能为空"));
        }
        if (!PasswordPolicy.isStrongPassword(password)) {
            return ResponseEntity.badRequest().body(Map.of("message", PasswordPolicy.MESSAGE));
        }

        QueryWrapper<User> checkWrapper = new QueryWrapper<>();
        checkWrapper.eq("username", username);
        if (userService.count(checkWrapper) > 0) {
            return ResponseEntity.badRequest().body(Map.of("message", "用户名已存在"));
        }

        QueryWrapper<User> emailWrapper = new QueryWrapper<>();
        emailWrapper.eq("email", email);
        if (userService.count(emailWrapper) > 0) {
            return ResponseEntity.badRequest().body(Map.of("message", "邮箱已被注册"));
        }

        User user = new User();
        user.setUsername(username);
        user.setEmail(email);
        user.setPhone(phone);
        user.setAvatar(normalizeAvatar(request.getAvatar()));
        user.setPassword(passwordEncoder.encode(password));
        user.setTokenVersion(0);
        user.setForceChangePassword(Boolean.TRUE.equals(request.getForceChangePassword()));
        user.setRole(role);
        user.setSourceChannel("后台创建");
        user.setStatus(status);
        user.setIsMuted(Boolean.TRUE.equals(request.getIsMuted()));
        user.setLevel(1);
        user.setPoints(0);
        user.setExp(0);

        userService.save(user);
        notifyUserIfRequested(request.getNotifyUser(), user.getId(), "管理员已为你创建账号，请使用分配的账号登录并按要求修改密码。");
        user.setPassword(null);
        return ResponseEntity.ok(user);
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> updateUser(@PathVariable Long id, @RequestBody AdminUserRequest request) {
        User existingUser = userService.getById(id);
        if (existingUser == null) {
            return ResponseEntity.notFound().build();
        }

        String email = request.getEmail() == null ? null : request.getEmail().trim().toLowerCase();
        String phone = normalizePhone(request.getPhone());
        String role = normalizeUserRole(request.getRole(), null);
        if (request.getRole() != null && role == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "用户角色不正确"));
        }
        Integer status = parseUserStatus(request.getStatus(), existingUser.getStatus() == null ? 0 : existingUser.getStatus());
        if (status == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "用户状态不正确"));
        }
        Boolean isMuted = request.getIsMuted() == null ? existingUser.getIsMuted() : request.getIsMuted();

        if (email != null) {
            if (!email.matches("^[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9.-]{1,190}\\.[A-Za-z]{2,63}$")) {
                return ResponseEntity.badRequest().body(Map.of("message", "邮箱格式不正确"));
            }
            existingUser.setEmail(email);
        }
        if (request.getAvatar() != null) {
            existingUser.setAvatar(normalizeAvatar(request.getAvatar()));
        }
        if (request.getPhone() != null) {
            existingUser.setPhone(phone);
        }
        if (role != null) {
            existingUser.setRole(role);
        }
        existingUser.setStatus(status);
        existingUser.setIsMuted(Boolean.TRUE.equals(isMuted));

        userService.updateById(existingUser);
        existingUser = userService.getById(id);
        existingUser.setPassword(null);
        return ResponseEntity.ok(existingUser);
    }

    @PutMapping("/{id}/password")
    public ResponseEntity<?> resetPassword(@PathVariable Long id, @RequestBody AdminResetPasswordRequest body) {
        User user = userService.getById(id);
        if (user == null) {
            return ResponseEntity.notFound().build();
        }

        String password = body == null ? null : body.getPassword();
        if (password == null || password.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("message", "密码不能为空"));
        }
        if (!PasswordPolicy.isStrongPassword(password)) {
            return ResponseEntity.badRequest().body(Map.of("message", PasswordPolicy.MESSAGE));
        }

        user.setPassword(passwordEncoder.encode(password));
        user.setTokenVersion(user.getTokenVersion() == null ? 1 : user.getTokenVersion() + 1);
        user.setForceChangePassword(Boolean.TRUE.equals(body.getForceChangePassword()));
        userService.updateById(user);
        notifyUserIfRequested(body.getNotifyUser(), user.getId(), "管理员已重置你的登录密码，请使用新密码登录并按要求修改密码。");
        return ResponseEntity.ok(Map.of("message", "密码重置成功"));
    }

    @PutMapping("/{id}/lock")
    public ResponseEntity<?> toggleUserLock(@PathVariable Long id, @RequestAttribute("userId") Long adminUserId) {
        User user = userService.getById(id);
        if (user == null) {
            return ResponseEntity.notFound().build();
        }
        if (adminUserId != null && adminUserId.equals(id)) {
            return ResponseEntity.badRequest().body(Map.of("message", "不能锁定当前登录账号"));
        }

        boolean locked = user.getStatus() != null && user.getStatus() == 1;
        user.setStatus(locked ? 0 : 1);
        if (!locked) {
            user.setIsOnline(false);
        }
        userService.updateById(user);

        return ResponseEntity.ok(Map.of(
                "locked", !locked,
                "status", user.getStatus(),
                "message", !locked ? "用户已锁定" : "用户已解锁"
        ));
    }

    @PutMapping("/{id}/mute")
    public ResponseEntity<?> toggleUserMute(@PathVariable Long id, @RequestAttribute("userId") Long adminUserId) {
        User user = userService.getById(id);
        if (user == null) {
            return ResponseEntity.notFound().build();
        }
        if (adminUserId != null && adminUserId.equals(id)) {
            return ResponseEntity.badRequest().body(Map.of("message", "不能禁言当前登录账号"));
        }

        boolean muted = Boolean.TRUE.equals(user.getIsMuted());
        user.setIsMuted(!muted);
        userService.updateById(user);

        return ResponseEntity.ok(Map.of(
                "muted", !muted,
                "isMuted", user.getIsMuted(),
                "message", !muted ? "用户已禁言" : "用户已解除禁言"
        ));
    }

    @DeleteMapping("/{id}")
    @Transactional
    public ResponseEntity<?> deleteUser(@PathVariable Long id, @RequestAttribute("userId") Long adminUserId) {
        User user = userService.getById(id);
        if (user == null) {
            return ResponseEntity.notFound().build();
        }
        if (adminUserId != null && adminUserId.equals(id)) {
            return ResponseEntity.badRequest().body(Map.of("message", "不能停用当前登录账号"));
        }

        user.setStatus(1);
        user.setIsOnline(false);
        user.setTokenVersion(user.getTokenVersion() == null ? 1 : user.getTokenVersion() + 1);
        userService.updateById(user);
        log.info("管理员停用用户: userId={}, username={}", id, user.getUsername());
        return ResponseEntity.ok(Map.of("message", "用户已停用"));
    }

    private String normalizeUserRole(String role, String fallback) {
        String normalized = StringUtils.hasText(role) ? role.trim().toLowerCase() : fallback;
        if (normalized == null) {
            return null;
        }
        return Set.of("admin", "moderator", "user").contains(normalized) ? normalized : null;
    }

    private Integer parseUserStatus(Object value, int defaultValue) {
        if (value == null) {
            return defaultValue;
        }
        Integer parsed = parseInteger(value);
        if (parsed == null || (parsed != 0 && parsed != 1)) {
            return null;
        }
        return parsed;
    }

    private Integer parseInteger(Object value) {
        if (value instanceof Number number) {
            return number.intValue();
        }
        if (value instanceof String text && !text.isBlank()) {
            try {
                return Integer.parseInt(text.trim());
            } catch (NumberFormatException exception) {
                return null;
            }
        }
        return null;
    }

    private String normalizeAvatar(String avatar) {
        if (!StringUtils.hasText(avatar)) {
            return null;
        }
        String normalized = avatar.trim();
        return normalized.length() > 512 ? normalized.substring(0, 512) : normalized;
    }

    private String normalizePhone(String phone) {
        if (!StringUtils.hasText(phone)) {
            return null;
        }
        String normalized = phone.trim().replaceAll("\\s+", "");
        return normalized.length() > 32 ? normalized.substring(0, 32) : normalized;
    }

    private LocalDate parseDate(String value) {
        if (!StringUtils.hasText(value)) {
            return null;
        }
        try {
            return LocalDate.parse(value.trim());
        } catch (DateTimeParseException exception) {
            return null;
        }
    }

    private void notifyUserIfRequested(Boolean notifyUser, Long userId, String content) {
        if (!Boolean.TRUE.equals(notifyUser) || userId == null) {
            return;
        }
        notificationService.createNotification(userId, "system", content, null);
    }
}
