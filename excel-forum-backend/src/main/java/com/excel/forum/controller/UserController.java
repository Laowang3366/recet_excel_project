package com.excel.forum.controller;

import com.excel.forum.entity.User;
import com.excel.forum.entity.UserEntitlement;
import com.excel.forum.service.CheckinService;
import com.excel.forum.service.ExperienceService;
import com.excel.forum.service.UserEntitlementService;
import com.excel.forum.service.UserService;
import com.excel.forum.util.UsernamePolicy;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
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
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {
    private final UserService userService;
    private final ExperienceService experienceService;
    private final UserEntitlementService userEntitlementService;
    private final CheckinService checkinService;

    @PutMapping("/{id}")
    public ResponseEntity<?> updateProfile(
            @PathVariable Long id,
            @RequestAttribute Long userId,
            @RequestBody Map<String, Object> body) {

        if (!userId.equals(id)) {
            return ResponseEntity.status(403).body(Map.of("message", "只能修改自己的资料"));
        }

        User user = userService.getById(id);
        if (user == null) {
            return ResponseEntity.notFound().build();
        }

        if (body.containsKey("username")) {
            String newUsername = UsernamePolicy.normalize((String) body.get("username"));
            if (newUsername != null && !newUsername.isBlank()) {
                if (!UsernamePolicy.isValid(newUsername)) {
                    return ResponseEntity.badRequest().body(Map.of("message", "用户名仅支持 2-30 位中文、字母、数字、下划线和中划线"));
                }
                if (UsernamePolicy.isReserved(newUsername)) {
                    return ResponseEntity.badRequest().body(Map.of("message", "该用户名不可使用"));
                }
                User existing = userService.findByUsername(newUsername);
                if (existing != null && !existing.getId().equals(id)) {
                    return ResponseEntity.badRequest().body(Map.of("message", "用户名已被占用"));
                }
                user.setUsername(newUsername);
            }
        }
        if (body.containsKey("bio")) {
            user.setBio((String) body.get("bio"));
        }
        if (body.containsKey("gender")) {
            String gender = body.get("gender") == null ? null : String.valueOf(body.get("gender")).trim();
            if (gender == null || gender.isBlank()) {
                user.setGender(null);
            } else if ("male".equals(gender) || "female".equals(gender)) {
                user.setGender(gender);
            } else {
                return ResponseEntity.badRequest().body(Map.of("message", "性别设置无效"));
            }
        }
        if (body.containsKey("avatar")) {
            user.setAvatar((String) body.get("avatar"));
        }
        if (body.containsKey("jobTitle")) {
            user.setJobTitle(normalizeNullableString(body.get("jobTitle")));
        }
        if (body.containsKey("location")) {
            user.setLocation(normalizeNullableString(body.get("location")));
        }
        if (body.containsKey("website")) {
            user.setWebsite(normalizeNullableString(body.get("website")));
        }
        if (body.containsKey("coverImage")) {
            user.setCoverImage(normalizeNullableString(body.get("coverImage")));
        }
        if (body.containsKey("expertise")) {
            Object expertise = body.get("expertise");
            if (expertise instanceof List<?>) {
                List<?> expertiseList = (List<?>) expertise;
                user.setExpertise(expertiseList.stream()
                        .filter(Objects::nonNull)
                        .map(Object::toString)
                        .collect(Collectors.joining(",")));
            } else if (expertise instanceof String text) {
                user.setExpertise(text);
            }
        }
        if (body.containsKey("notificationEmailEnabled")) {
            user.setNotificationEmailEnabled(parseBoolean(body.get("notificationEmailEnabled"), true));
        }
        if (body.containsKey("notificationPushEnabled")) {
            user.setNotificationPushEnabled(parseBoolean(body.get("notificationPushEnabled"), true));
        }
        if (body.containsKey("themePreference")) {
            user.setThemePreference(normalizeThemePreference(body.get("themePreference") == null ? null : body.get("themePreference").toString()));
        }

        userService.updateById(user);

        user.setPassword(null);
        return ResponseEntity.ok(user);
    }

    @GetMapping("/center/overview")
    public ResponseEntity<?> getCenterOverview(@RequestAttribute Long userId) {
        User user = userService.getById(userId);
        if (user == null) {
            return ResponseEntity.status(404).body(Map.of("message", "用户不存在"));
        }

        Map<String, Object> response = new HashMap<>();
        response.put("user", buildCenterUser(user));
        response.put("privacy", buildPrivacySettings(user));
        response.put("accountStatus", buildAccountStatus(user.getStatus()));
        response.put("expProgress", experienceService.getProgress(user.getExp()));
        return ResponseEntity.ok(response);
    }

    @GetMapping("/center/exp-logs")
    public ResponseEntity<?> getCenterExpLogs(
            @RequestAttribute Long userId,
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "10") Integer size) {
        return ResponseEntity.ok(experienceService.getUserExpLogs(userId, page, size));
    }

    @GetMapping("/me/props")
    public ResponseEntity<?> getMyProps(@RequestAttribute Long userId) {
        List<UserEntitlement> entitlements = userEntitlementService.getUserEntitlements(userId);
        UserEntitlement currentBadge = userEntitlementService.getLatestActiveBadge(userId);
        return ResponseEntity.ok(Map.of(
                "records", entitlements.stream()
                        .map(item -> serializeEntitlementItem(item, currentBadge))
                        .collect(Collectors.toList())
        ));
    }

    @PostMapping("/me/props/{entitlementId}/use")
    public ResponseEntity<?> useMyProp(@RequestAttribute Long userId, @PathVariable Long entitlementId) {
        UserEntitlement entitlement = userEntitlementService.getById(entitlementId);
        if (entitlement == null || !userId.equals(entitlement.getUserId())) {
            return ResponseEntity.status(404).body(Map.of("message", "道具不存在"));
        }

        if (UserEntitlementService.KEY_CHECKIN_MAKEUP_CARD.equals(entitlement.getEntitlementKey())) {
            try {
                return ResponseEntity.ok(checkinService.performMakeupCheckin(userId));
            } catch (IllegalStateException e) {
                return ResponseEntity.status(409).body(Map.of("message", e.getMessage()));
            }
        }

        if ("badge".equalsIgnoreCase(entitlement.getEntitlementType())) {
            UserEntitlement equipped = userEntitlementService.equipBadge(userId, entitlementId);
            if (equipped == null) {
                return ResponseEntity.status(409).body(Map.of("message", "当前头衔不可佩戴"));
            }
            return ResponseEntity.ok(Map.of(
                    "message", "头衔已佩戴",
                    "entitlement", serializeEntitlementItem(equipped, equipped)
            ));
        }

        return ResponseEntity.badRequest().body(Map.of("message", "该道具暂不支持直接使用"));
    }

    @PostMapping("/me/props/{entitlementId}/unequip")
    public ResponseEntity<?> unequipMyProp(@RequestAttribute Long userId, @PathVariable Long entitlementId) {
        UserEntitlement entitlement = userEntitlementService.getById(entitlementId);
        if (entitlement == null || !userId.equals(entitlement.getUserId())) {
            return ResponseEntity.status(404).body(Map.of("message", "道具不存在"));
        }
        if (!"badge".equalsIgnoreCase(entitlement.getEntitlementType())) {
            return ResponseEntity.badRequest().body(Map.of("message", "该道具不支持取消佩戴"));
        }
        userEntitlementService.unequipBadge(userId, entitlementId);
        return ResponseEntity.ok(Map.of("message", "头衔已取消佩戴"));
    }

    @GetMapping("/privacy")
    public ResponseEntity<?> getPrivacySettings(@RequestAttribute Long userId) {
        User user = userService.getById(userId);
        if (user == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(buildPrivacySettings(user));
    }

    @PutMapping("/privacy")
    public ResponseEntity<?> updatePrivacySettings(
            @RequestAttribute Long userId,
            @RequestBody Map<String, Boolean> body) {

        User user = userService.getById(userId);
        if (user == null) {
            return ResponseEntity.notFound().build();
        }

        if (body.containsKey("publicProfile")) {
            user.setPublicProfile(body.get("publicProfile"));
        }
        if (body.containsKey("showOnlineStatus")) {
            user.setShowOnlineStatus(body.get("showOnlineStatus"));
        }

        userService.updateById(user);

        return ResponseEntity.ok(Map.of("message", "隐私设置已更新"));
    }

    private Map<String, Object> buildCenterUser(User user) {
        Map<String, Object> response = new HashMap<>();
        response.put("id", user.getId());
        response.put("username", user.getUsername());
        response.put("email", user.getEmail());
        response.put("avatar", user.getAvatar());
        response.put("bio", user.getBio());
        response.put("gender", user.getGender());
        response.put("level", user.getLevel());
        response.put("points", user.getPoints());
        response.put("exp", user.getExp());
        response.put("role", user.getRole());
        response.put("status", user.getStatus());
        response.put("excelLevel", user.getExcelLevel());
        response.put("mallBadge", buildMallBadgeResponse(user.getId()));
        response.put("expertise", user.getExpertise());
        response.put("jobTitle", user.getJobTitle());
        response.put("location", user.getLocation());
        response.put("website", user.getWebsite());
        response.put("coverImage", user.getCoverImage());
        response.put("themePreference", normalizeThemePreference(user.getThemePreference()));
        response.put("notificationEmailEnabled", user.getNotificationEmailEnabled() == null || user.getNotificationEmailEnabled());
        response.put("notificationPushEnabled", user.getNotificationPushEnabled() == null || user.getNotificationPushEnabled());
        response.put("createTime", user.getCreateTime());
        return response;
    }

    private Map<String, Object> buildPrivacySettings(User user) {
        Map<String, Object> settings = new HashMap<>();
        settings.put("publicProfile", user.getPublicProfile() != null ? user.getPublicProfile() : true);
        settings.put("showOnlineStatus", user.getShowOnlineStatus() != null ? user.getShowOnlineStatus() : true);
        return settings;
    }

    private Map<String, Object> buildAccountStatus(Integer status) {
        Map<String, Object> accountStatus = new HashMap<>();
        accountStatus.put("status", status);
        accountStatus.put("label", resolveAccountStatusLabel(status));
        accountStatus.put("description", resolveAccountStatusDescription(status));
        return accountStatus;
    }

    private String resolveAccountStatusLabel(Integer status) {
        if (status == null || status == 0) {
            return "正常";
        }
        if (status == 1) {
            return "受限";
        }
        if (status == 2) {
            return "封禁";
        }
        return "状态未知";
    }

    private String resolveAccountStatusDescription(Integer status) {
        if (status == null || status == 0) {
            return "当前账号状态正常，可继续使用学习、练习、模板和 AI 助手功能。";
        }
        if (status == 1) {
            return "账号当前存在部分限制，如部分操作范围受限。";
        }
        if (status == 2) {
            return "账号当前已被封禁，如有疑问请联系管理员。";
        }
        return "请前往设置或联系管理员确认账号状态。";
    }

    private String normalizeNullableString(Object value) {
        if (value == null) {
            return null;
        }
        String text = value.toString().trim();
        return text.isEmpty() ? null : text;
    }

    private Boolean parseBoolean(Object value, boolean fallback) {
        if (value instanceof Boolean bool) {
            return bool;
        }
        if (value instanceof String text && !text.isBlank()) {
            return Boolean.parseBoolean(text.trim());
        }
        return fallback;
    }

    private String normalizeThemePreference(String themePreference) {
        if (themePreference == null || themePreference.isBlank()) {
            return "light";
        }
        return switch (themePreference.trim().toLowerCase()) {
            case "dark", "system" -> themePreference.trim().toLowerCase();
            default -> "light";
        };
    }

    private Map<String, Object> buildMallBadgeResponse(Long userId) {
        UserEntitlement badge = userEntitlementService.getLatestActiveBadge(userId);
        if (badge == null) {
            return null;
        }
        Map<String, Object> response = new HashMap<>();
        response.put("name", badge.getDisplayName());
        response.put("status", badge.getStatus());
        response.put("effectiveUntil", badge.getEffectiveUntil());
        return response;
    }

    private Map<String, Object> serializeEntitlementItem(UserEntitlement item, UserEntitlement currentBadge) {
        Map<String, Object> response = new HashMap<>();
        response.put("id", item.getId());
        response.put("itemId", item.getItemId());
        response.put("name", item.getDisplayName());
        response.put("type", item.getEntitlementType());
        response.put("key", item.getEntitlementKey());
        response.put("status", item.getStatus());
        response.put("statusLabel", switch (String.valueOf(item.getStatus())) {
            case "active" -> "可用";
            case "pending" -> "待发放";
            case "revoked" -> "已撤销";
            case "expired" -> "已使用";
            default -> "未知";
        });
        response.put("effectiveFrom", item.getEffectiveFrom());
        response.put("effectiveUntil", item.getEffectiveUntil());
        response.put("current", currentBadge != null && Objects.equals(currentBadge.getId(), item.getId()));
        response.put("canUse", canUseEntitlement(item));
        response.put("canUnequip", "badge".equalsIgnoreCase(item.getEntitlementType())
                && currentBadge != null
                && Objects.equals(currentBadge.getId(), item.getId()));
        response.put("actionLabel", resolveEntitlementActionLabel(item));
        return response;
    }

    private boolean canUseEntitlement(UserEntitlement item) {
        if (item == null || !"active".equalsIgnoreCase(item.getStatus())) {
            return false;
        }
        if (UserEntitlementService.KEY_CHECKIN_MAKEUP_CARD.equals(item.getEntitlementKey())) {
            return true;
        }
        return "badge".equalsIgnoreCase(item.getEntitlementType());
    }

    private String resolveEntitlementActionLabel(UserEntitlement item) {
        if (item == null) {
            return "查看";
        }
        if (!"active".equalsIgnoreCase(item.getStatus())) {
            return switch (String.valueOf(item.getStatus())) {
                case "pending" -> "待发放";
                case "revoked" -> "已撤销";
                case "expired" -> "已使用";
                default -> "不可用";
            };
        }
        if (UserEntitlementService.KEY_CHECKIN_MAKEUP_CARD.equals(item.getEntitlementKey())) {
            return "立即使用";
        }
        if ("badge".equalsIgnoreCase(item.getEntitlementType())) {
            return "佩戴";
        }
        return "已拥有";
    }
}
