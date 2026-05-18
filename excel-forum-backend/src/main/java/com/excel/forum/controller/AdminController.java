package com.excel.forum.controller;

import com.baomidou.mybatisplus.core.conditions.update.UpdateWrapper;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.excel.forum.config.ExperienceProperties;
import com.excel.forum.entity.*;
import com.excel.forum.entity.dto.AdminQuestionRequest;
import com.excel.forum.mapper.AdminLogMapper;
import com.excel.forum.mapper.CheckinRecordMapper;
import com.excel.forum.mapper.DailyChallengeMapper;
import com.excel.forum.mapper.PostEditHistoryMapper;
import com.excel.forum.mapper.PracticeChapterMapper;
import com.excel.forum.mapper.PracticeLevelMapper;
import com.excel.forum.mapper.PracticeAnswerMapper;
import com.excel.forum.mapper.PracticeRecordMapper;
import com.excel.forum.entity.dto.PostDTO;
import com.excel.forum.service.*;
import com.excel.forum.util.DtoConverter;
import com.excel.forum.util.HtmlSanitizer;
import com.excel.forum.util.PasswordPolicy;
import com.excel.forum.util.UsernamePolicy;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
@Slf4j
public class AdminController {
    private static final String POINTS_OPTION_KIND_TYPE = "type";
    private static final String POINTS_OPTION_KIND_TASK_KEY = "task_key";
    private static final String USER_SUBMISSION_CATEGORY_NAME = "用户上传";
    private static final String USER_SUBMISSION_CATEGORY_GROUP = "用户投稿";


    private final UserService userService;
    private final PostService postService;
    private final CategoryService categoryService;
    private final ReplyService replyService;
    private final ReportService reportService;
    private final FeedbackService feedbackService;
    private final LikeService likeService;
    private final FavoriteService favoriteService;
    private final PostViewService postViewService;
    private final PostShareService postShareService;
    private final FollowService followService;
    private final CategoryFollowService categoryFollowService;
    private final MessageService messageService;
    private final ChatMessageService chatMessageService;
    private final PasswordEncoder passwordEncoder;
    private final ForumEventService eventService;
    private final NotificationService notificationService;
    private final PointsRuleService pointsRuleService;
    private final PointsRuleOptionService pointsRuleOptionService;
    private final PointsRecordService pointsRecordService;
    private final PointsTaskService pointsTaskService;
    private final QuestionService questionService;
    private final QuestionCategoryService questionCategoryService;
    private final QuestionExcelTemplateService questionExcelTemplateService;
    private final PracticeQuestionSubmissionService practiceQuestionSubmissionService;
    private final SiteNotificationService siteNotificationService;
    private final PostDraftService postDraftService;
    private final MallService mallService;
    private final ExperienceService experienceService;
    private final ExperienceProperties experienceProperties;
    private final ExperienceRuleService experienceRuleService;
    private final ExperienceLevelRuleService experienceLevelRuleService;
    private final UserEntitlementService userEntitlementService;
    private final ExcelTemplateGradingService excelTemplateGradingService;
    private final PracticeLevelMapper practiceLevelMapper;
    private final PracticeChapterMapper practiceChapterMapper;
    private final DailyChallengeMapper dailyChallengeMapper;
    private final PracticeRecordMapper practiceRecordMapper;
    private final PracticeAnswerMapper practiceAnswerMapper;
    private final CheckinRecordMapper checkinRecordMapper;
    private final AdminLogMapper adminLogMapper;
    private final PostEditHistoryMapper postEditHistoryMapper;
    private final HtmlSanitizer htmlSanitizer;
    private final PracticeCampaignService practiceCampaignService;

    @GetMapping("/users")
    public ResponseEntity<?> getUsers(
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "10") Integer size,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String role,
            @RequestParam(required = false) Integer status) {
        
        Page<User> pageRequest = new Page<>(page, size);
        QueryWrapper<User> queryWrapper = new QueryWrapper<>();
        
        if (keyword != null && !keyword.isEmpty()) {
            queryWrapper.and(wrapper -> wrapper
                .like("username", keyword)
                .or()
                .like("email", keyword)
            );
        }
        
        if (role != null && !role.isEmpty()) {
            queryWrapper.eq("role", role);
        }
        
        if (status != null) {
            queryWrapper.eq("status", status);
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

    @PostMapping("/users")
    public ResponseEntity<?> createUser(@RequestBody Map<String, Object> body) {
        String username = UsernamePolicy.normalize((String) body.get("username"));
        String email = body.get("email") == null ? null : String.valueOf(body.get("email")).trim().toLowerCase();
        String password = (String) body.get("password");
        String role = (String) body.get("role");
        Integer status = body.get("status") != null ? (Integer) body.get("status") : 0;
        @SuppressWarnings("unchecked")
        List<Integer> managedCategories = (List<Integer>) body.get("managedCategories");
        
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
            return ResponseEntity.badRequest().body(Map.of("message", "密码必须至少8位，且只能包含字母和数字"));
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
        user.setPassword(passwordEncoder.encode(password));
        user.setTokenVersion(0);
        user.setRole(role != null ? role : "user");
        user.setStatus(status);
        user.setIsMuted(Boolean.FALSE);
        user.setLevel(1);
        user.setPoints(0);
        user.setExp(0);
        
        if ("moderator".equals(role) && managedCategories != null && !managedCategories.isEmpty()) {
            try {
                user.setManagedCategories(new com.fasterxml.jackson.databind.ObjectMapper().writeValueAsString(managedCategories));
            } catch (Exception e) {
                user.setManagedCategories("[]");
            }
        }
        
        userService.save(user);
        user.setPassword(null);
        
        return ResponseEntity.ok(user);
    }

    @PutMapping("/users/{id}")
    public ResponseEntity<?> updateUser(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        User existingUser = userService.getById(id);
        if (existingUser == null) {
            return ResponseEntity.notFound().build();
        }
        
        String email = body.get("email") == null ? null : String.valueOf(body.get("email")).trim().toLowerCase();
        String role = (String) body.get("role");
        Integer status = body.get("status") != null ? (Integer) body.get("status") : existingUser.getStatus();
        Boolean isMuted = body.get("isMuted") instanceof Boolean ? (Boolean) body.get("isMuted") : existingUser.getIsMuted();
        @SuppressWarnings("unchecked")
        List<Integer> managedCategories = (List<Integer>) body.get("managedCategories");
        
        if (email != null) {
            if (!email.matches("^[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9.-]{1,190}\\.[A-Za-z]{2,63}$")) {
                return ResponseEntity.badRequest().body(Map.of("message", "邮箱格式不正确"));
            }
            existingUser.setEmail(email);
        }
        if (role != null) {
            existingUser.setRole(role);
        }
        existingUser.setStatus(status);
        existingUser.setIsMuted(Boolean.TRUE.equals(isMuted));
        
        String effectiveRole = role != null ? role : existingUser.getRole();
        
        if ("moderator".equals(effectiveRole) && managedCategories != null) {
            try {
                existingUser.setManagedCategories(new com.fasterxml.jackson.databind.ObjectMapper().writeValueAsString(managedCategories));
            } catch (Exception e) {
                existingUser.setManagedCategories("[]");
            }
        } else if (!"moderator".equals(effectiveRole)) {
            existingUser.setManagedCategories(null);
        }
        
        userService.updateById(existingUser);
        
        existingUser = userService.getById(id);
        existingUser.setPassword(null);
        return ResponseEntity.ok(existingUser);
    }

    @PutMapping("/users/{id}/password")
    public ResponseEntity<?> resetPassword(@PathVariable Long id, @RequestBody Map<String, String> body) {
        User user = userService.getById(id);
        if (user == null) {
            return ResponseEntity.notFound().build();
        }
        
        String password = body.get("password");
        if (password == null || password.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("message", "密码不能为空"));
        }

        if (!PasswordPolicy.isStrongPassword(password)) {
            return ResponseEntity.badRequest().body(Map.of("message", "密码必须至少8位，包含大小写字母、数字和特殊字符"));
        }

        user.setPassword(passwordEncoder.encode(password));
        user.setTokenVersion(user.getTokenVersion() == null ? 1 : user.getTokenVersion() + 1);
        userService.updateById(user);

        return ResponseEntity.ok(Map.of("message", "密码重置成功"));
    }

    @PutMapping("/users/{id}/lock")
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

    @PutMapping("/users/{id}/mute")
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

    @DeleteMapping("/users/{id}")
    @Transactional
    public ResponseEntity<?> deleteUser(@PathVariable Long id) {
        User user = userService.getById(id);
        if (user == null) {
            return ResponseEntity.notFound().build();
        }

        Set<Long> userPostIds = postService.list(new QueryWrapper<Post>()
                        .eq("user_id", id)
                        .select("id"))
                .stream()
                .map(Post::getId)
                .filter(Objects::nonNull)
                .collect(Collectors.toCollection(LinkedHashSet::new));
        Set<Long> replyIds = collectReplyIdsForUserDeletion(id, userPostIds);

        cleanupPostAndReplyReferences(userPostIds, replyIds);
        notificationService.remove(new QueryWrapper<Notification>().eq("sender_id", id));
        pointsRecordService.remove(new QueryWrapper<PointsRecord>().eq("user_id", id));
        postEditHistoryMapper.delete(new QueryWrapper<PostEditHistory>().eq("user_id", id));
        adminLogMapper.delete(new QueryWrapper<AdminLog>().eq("admin_user_id", id));

        userService.removeById(id);
        log.info("管理员删除用户: userId={}, username={}", id, user.getUsername());
        return ResponseEntity.ok(Map.of("message", "用户已删除"));
    }

    @GetMapping("/posts")
    public ResponseEntity<?> getPosts(
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "10") Integer size,
            @RequestParam(required = false) Long categoryId,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String username,
            @RequestParam(required = false) String startDate,
            @RequestParam(required = false) String endDate) {
        
        Page<Post> pageRequest = new Page<>(page, size);
        QueryWrapper<Post> queryWrapper = new QueryWrapper<>();
        
        if (categoryId != null) {
            queryWrapper.eq("category_id", categoryId);
        }
        
        if (status != null && !status.isEmpty()) {
            if ("active".equalsIgnoreCase(status)) {
                queryWrapper.eq("status", 0);
            } else if ("deleted".equalsIgnoreCase(status)) {
                queryWrapper.in("status", 1, 2);
            } else if ("locked".equalsIgnoreCase(status)) {
                queryWrapper.eq("is_locked", true);
            } else if ("top".equalsIgnoreCase(status)) {
                queryWrapper.eq("is_top", true);
            } else if ("essence".equalsIgnoreCase(status)) {
                queryWrapper.eq("is_essence", true);
            } else {
                try {
                    Integer statusValue = Integer.parseInt(status);
                    queryWrapper.eq("status", statusValue);
                } catch (NumberFormatException e) {
                    // 忽略无效的状态值
                }
            }
        }
        
        if (keyword != null && !keyword.isBlank()) {
            String normalizedKeyword = keyword.trim();
            queryWrapper.and(wrapper -> wrapper
                    .like("title", normalizedKeyword)
                    .or()
                    .like("content", normalizedKeyword));
        }

        if (username != null && !username.isBlank()) {
            List<Long> userIds = userService.list(new QueryWrapper<User>()
                            .select("id")
                            .like("username", username.trim()))
                    .stream()
                    .map(User::getId)
                    .filter(Objects::nonNull)
                    .toList();
            if (userIds.isEmpty()) {
                queryWrapper.apply("1 = 0");
            } else {
                queryWrapper.in("user_id", userIds);
            }
        }

        if (startDate != null && !startDate.isBlank()) {
            try {
                LocalDate normalizedStartDate = LocalDate.parse(startDate.trim());
                queryWrapper.ge("create_time", normalizedStartDate.atStartOfDay());
            } catch (Exception ignored) {
            }
        }

        if (endDate != null && !endDate.isBlank()) {
            try {
                LocalDate normalizedEndDate = LocalDate.parse(endDate.trim());
                queryWrapper.lt("create_time", normalizedEndDate.plusDays(1).atStartOfDay());
            } catch (Exception ignored) {
            }
        }
        
        queryWrapper.orderByDesc("create_time");
        
        Page<Post> result = postService.page(pageRequest, queryWrapper);
        
        Map<String, Object> response = new HashMap<>();
        response.put("records", DtoConverter.convertPosts(result.getRecords(), userService, userEntitlementService, categoryService, replyService));
        response.put("total", result.getTotal());
        response.put("current", result.getCurrent());
        response.put("size", result.getSize());
        
        return ResponseEntity.ok(response);
    }

    @PutMapping("/posts/{id}/status")
    public ResponseEntity<?> updatePostStatus(@PathVariable Long id, @RequestBody Map<String, Integer> body) {
        Post post = postService.getById(id);
        if (post == null) {
            return ResponseEntity.notFound().build();
        }
        
        Integer status = body.get("status");
        if (status == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "状态不能为空"));
        }
        
        post.setStatus(status);
        postService.updateById(post);
        log.info("管理员更新帖子状态: postId={}, status={}", id, status);
        
        return ResponseEntity.ok(post);
    }

    @PutMapping("/posts/{id}/lock")
    public ResponseEntity<?> togglePostLock(@PathVariable Long id) {
        Post post = postService.getById(id);
        if (post == null) {
            return ResponseEntity.notFound().build();
        }
        
        post.setIsLocked(post.getIsLocked() == null ? true : !post.getIsLocked());
        postService.updateById(post);
        
        eventService.publishEvent(ForumEvent.postUpdated(id, Map.of(
            "isLocked", post.getIsLocked(),
            "isTop", post.getIsTop(),
            "isEssence", post.getIsEssence()
        )));
        
        Map<String, Object> response = new HashMap<>();
        response.put("isTop", post.getIsTop());
        response.put("isEssence", post.getIsEssence());
        response.put("isLocked", post.getIsLocked());
        return ResponseEntity.ok(response);
    }

    @PutMapping("/posts/{id}/top")
    public ResponseEntity<?> togglePostTop(@PathVariable Long id) {
        Post post = postService.getById(id);
        if (post == null) {
            return ResponseEntity.notFound().build();
        }
        
        post.setIsTop(post.getIsTop() == null ? true : !post.getIsTop());
        postService.updateById(post);
        
        eventService.publishEvent(ForumEvent.postUpdated(id, Map.of(
            "isTop", post.getIsTop(),
            "isEssence", post.getIsEssence(),
            "isLocked", post.getIsLocked()
        )));
        
        Map<String, Object> response = new HashMap<>();
        response.put("isTop", post.getIsTop());
        response.put("isEssence", post.getIsEssence());
        response.put("isLocked", post.getIsLocked());
        return ResponseEntity.ok(response);
    }

    @PutMapping("/posts/{id}/essence")
    public ResponseEntity<?> togglePostEssence(@PathVariable Long id) {
        Post post = postService.getById(id);
        if (post == null) {
            return ResponseEntity.notFound().build();
        }
        
        post.setIsEssence(post.getIsEssence() == null ? true : !post.getIsEssence());
        postService.updateById(post);
        
        eventService.publishEvent(ForumEvent.postUpdated(id, Map.of(
            "isEssence", post.getIsEssence(),
            "isTop", post.getIsTop(),
            "isLocked", post.getIsLocked()
        )));
        
        Map<String, Object> response = new HashMap<>();
        response.put("isTop", post.getIsTop());
        response.put("isEssence", post.getIsEssence());
        response.put("isLocked", post.getIsLocked());
        return ResponseEntity.ok(response);
    }

    @PostMapping("/posts/batch-lock")
    public ResponseEntity<?> batchLockPosts(@RequestBody Map<String, List<Long>> body) {
        List<Long> ids = body.get("ids");
        if (ids == null || ids.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("message", "请选择要锁定的帖子"));
        }
        
        for (Long id : ids) {
            Post post = postService.getById(id);
            if (post != null) {
                post.setIsLocked(true);
                postService.updateById(post);
            }
        }
        log.info("管理员批量锁定帖子: ids={}", ids);
        
        return ResponseEntity.ok(Map.of("message", "批量锁定成功"));
    }

    @PostMapping("/posts/batch-unlock")
    public ResponseEntity<?> batchUnlockPosts(@RequestBody Map<String, List<Long>> body) {
        List<Long> ids = body.get("ids");
        if (ids == null || ids.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("message", "请选择要解锁的帖子"));
        }
        
        for (Long id : ids) {
            Post post = postService.getById(id);
            if (post != null) {
                post.setIsLocked(false);
                postService.updateById(post);
            }
        }
        log.info("管理员批量解锁帖子: ids={}", ids);
        
        return ResponseEntity.ok(Map.of("message", "批量解锁成功"));
    }

    @DeleteMapping("/posts/{id}")
    public ResponseEntity<?> deletePost(@PathVariable Long id, @RequestBody(required = false) Map<String, String> body, @RequestAttribute("userId") Long userId) {
        Post post = postService.getById(id);
        if (post == null) {
            return ResponseEntity.notFound().build();
        }
        
        String reason = body != null ? body.get("reason") : null;
        
        post.setStatus(99);
        postService.updateById(post);
        
        String notificationContent = "您的帖子「" + post.getTitle() + "」已被管理员删除";
        if (reason != null && !reason.isEmpty()) {
            notificationContent += "，原因：" + reason;
        }
        
        try {
            notificationService.createNotification(
                post.getUserId(),
                "post_deleted",
                notificationContent,
                id
            );
        } catch (Exception e) {
            // ignore notification delivery failure here to avoid blocking deletion
        }
        AdminLog adminLog = new AdminLog();
        adminLog.setAdminUserId(userId);
        adminLog.setAction("delete_post");
        adminLog.setTargetType("post");
        adminLog.setTargetId(id);
        adminLog.setDetail(reason);
        adminLogMapper.insert(adminLog);
        log.info("管理员删除帖子: postId={}, adminUserId={}, reason={}", id, userId, reason);
        
        eventService.publishEvent(ForumEvent.postDeleted(id));
        
        return ResponseEntity.ok(Map.of("message", "删除成功"));
    }
    
    @PutMapping("/posts/{id}/restore")
    public ResponseEntity<?> restorePost(@PathVariable Long id) {
        Post post = postService.getById(id);
        if (post == null) {
            return ResponseEntity.notFound().build();
        }
        
        post.setStatus(0);
        postService.updateById(post);
        
        eventService.publishEvent(ForumEvent.postUpdated(id, Map.of("status", 0)));
        
        return ResponseEntity.ok(Map.of("message", "恢复成功"));
    }
    
    @PostMapping("/posts")
    public ResponseEntity<?> createPost(@RequestBody Post post, @RequestAttribute("userId") Long userId) {
        if (post.getTitle() == null || post.getTitle().isEmpty()) {
            return ResponseEntity.badRequest().body("标题不能为空");
        }
        
        if (post.getContent() == null || post.getContent().isEmpty()) {
            return ResponseEntity.badRequest().body("内容不能为空");
        }
        
        if (post.getCategoryId() == null) {
            return ResponseEntity.badRequest().body("版块不能为空");
        }
        
        post.setUserId(userId);
        post.setViewCount(0);
        post.setLikeCount(0);
        post.setReplyCount(0);
        
        if (post.getStatus() == null) {
            post.setStatus(0);
        }
        
        if (post.getType() == null) {
            post.setType(0);
        }
        
        postService.save(post);
        
        return ResponseEntity.ok(post);
    }

    @GetMapping("/categories")
    public ResponseEntity<?> getCategories() {
        QueryWrapper<Category> categoryQuery = new QueryWrapper<>();
        categoryQuery.orderByAsc("sort_order").orderByAsc("id");
        List<Category> categories = categoryService.list(categoryQuery);
        Map<Long, Long> postCountMap = categoryService.countActivePostsByCategoryIds(
                categories.stream()
                        .map(Category::getId)
                        .filter(Objects::nonNull)
                        .toList()
        );
        
        List<Map<String, Object>> result = categories.stream().map(category -> {
            Map<String, Object> map = new HashMap<>();
            map.put("id", category.getId());
            map.put("name", category.getName());
            map.put("description", category.getDescription());
            map.put("groupName", category.getGroupName());
            map.put("sortOrder", category.getSortOrder());
            map.put("createTime", category.getCreateTime());
            map.put("updateTime", category.getUpdateTime());
            map.put("postCount", postCountMap.getOrDefault(category.getId(), 0L));
            
            return map;
        }).collect(Collectors.toList());
        
        return ResponseEntity.ok(result);
    }

    @PostMapping("/categories")
    public ResponseEntity<?> createCategory(@RequestBody Category category) {
        categoryService.save(category);
        
        eventService.publishEvent(ForumEvent.categoryUpdated(category.getId()));
        
        return ResponseEntity.ok(category);
    }

    @PutMapping("/categories/{id}")
    public ResponseEntity<?> updateCategory(@PathVariable Long id, @RequestBody Category category) {
        Category existingCategory = categoryService.getById(id);
        if (existingCategory == null) {
            return ResponseEntity.notFound().build();
        }
        
        category.setId(id);
        categoryService.updateById(category);
        
        eventService.publishEvent(ForumEvent.categoryUpdated(id));
        
        return ResponseEntity.ok(category);
    }

    @DeleteMapping("/categories/{id}")
    public ResponseEntity<?> deleteCategory(@PathVariable Long id) {
        Category category = categoryService.getById(id);
        if (category == null) {
            return ResponseEntity.notFound().build();
        }

        long count = categoryService.countActivePostsByCategoryIds(List.of(id)).getOrDefault(id, 0L);
        
        if (count > 0) {
            return ResponseEntity.badRequest().body("该版块下还有帖子，无法删除");
        }
        
        categoryService.removeById(id);
        
        eventService.publishEvent(ForumEvent.categoryUpdated(id));

        return ResponseEntity.ok(Map.of("message", "分类已删除"));
    }

    @GetMapping("/question-categories")
    public ResponseEntity<?> getQuestionCategories() {
        List<Map<String, Object>> result = questionCategoryService.listWithQuestionCount(false).stream()
                .map(this::buildQuestionCategoryResponse)
                .toList();
        return ResponseEntity.ok(result);
    }

    @PostMapping("/question-categories")
    public ResponseEntity<?> createQuestionCategory(@RequestBody QuestionCategory category) {
        if (!StringUtils.hasText(category.getName())) {
            return ResponseEntity.badRequest().body(Map.of("message", "分类名称不能为空"));
        }
        if (category.getSortOrder() == null) {
            category.setSortOrder(0);
        }
        if (category.getEnabled() == null) {
            category.setEnabled(true);
        }
        questionCategoryService.save(category);
        practiceCampaignService.syncCampaignCatalog();
        QuestionCategory saved = questionCategoryService.getById(category.getId());
        saved.setQuestionCount(questionCategoryService.countQuestions(saved.getId()));
        return ResponseEntity.ok(buildQuestionCategoryResponse(saved));
    }

    @PutMapping("/question-categories/{id}")
    public ResponseEntity<?> updateQuestionCategory(@PathVariable Long id, @RequestBody QuestionCategory category) {
        QuestionCategory existing = questionCategoryService.getById(id);
        if (existing == null) {
            return ResponseEntity.notFound().build();
        }
        if (!StringUtils.hasText(category.getName())) {
            return ResponseEntity.badRequest().body(Map.of("message", "分类名称不能为空"));
        }
        category.setId(id);
        if (category.getSortOrder() == null) {
            category.setSortOrder(existing.getSortOrder());
        }
        if (category.getEnabled() == null) {
            category.setEnabled(existing.getEnabled());
        }
        questionCategoryService.updateById(category);
        practiceCampaignService.syncCampaignCatalog();
        QuestionCategory updated = questionCategoryService.getById(id);
        updated.setQuestionCount(questionCategoryService.countQuestions(id));
        return ResponseEntity.ok(buildQuestionCategoryResponse(updated));
    }

    @DeleteMapping("/question-categories/{id}")
    public ResponseEntity<?> deleteQuestionCategory(@PathVariable Long id) {
        QuestionCategory category = questionCategoryService.getById(id);
        if (category == null) {
            return ResponseEntity.notFound().build();
        }
        long count = questionCategoryService.countQuestions(id);
        if (count > 0) {
            return ResponseEntity.badRequest().body(Map.of("message", "当前分类下仍有题目，无法删除"));
        }
        questionCategoryService.removeById(id);
        practiceCampaignService.syncCampaignCatalog();
        return ResponseEntity.ok(Map.of("message", "题目分类已删除"));
    }

    @GetMapping("/stats")
    public ResponseEntity<?> getStats() {
        Map<String, Object> stats = new HashMap<>();

        LocalDateTime todayStart = LocalDate.now().atStartOfDay();

        long userCount = userService.count();
        long onlineUserCount = userService.count(new QueryWrapper<User>().eq("is_online", true));
        long adminCount = userService.count(new QueryWrapper<User>().eq("role", "admin"));
        long moderatorCount = userService.count(new QueryWrapper<User>().eq("role", "moderator"));
        long lockedUserCount = userService.count(new QueryWrapper<User>().eq("status", 1));
        long mutedUserCount = userService.count(new QueryWrapper<User>().eq("is_muted", true));
        long todayNewUsers = userService.count(new QueryWrapper<User>().ge("create_time", todayStart));

        long notificationCount = notificationService.count();
        long siteNotificationCount = siteNotificationService.count();
        long unreadNotificationCount = notificationService.count(new QueryWrapper<Notification>().eq("is_read", 0));

        long pendingFeedback = feedbackService.count(new QueryWrapper<Feedback>().eq("status", 0));
        long handledFeedback = feedbackService.count(new QueryWrapper<Feedback>().eq("status", 1));
        long ignoredFeedback = feedbackService.count(new QueryWrapper<Feedback>().eq("status", 2));

        long questionCount = questionService.count();
        long enabledQuestionCount = questionService.count(new QueryWrapper<Question>().eq("enabled", true));
        long questionCategoryCount = questionCategoryService.count();
        long questionTemplateCount = questionExcelTemplateService.count();
        long practiceRecordCount = practiceRecordMapper.selectCount(null);
        long practiceAnswerCount = practiceAnswerMapper.selectCount(null);
        long practiceSubmissionCount = practiceQuestionSubmissionService.count();
        long pendingPracticeSubmissionCount = practiceQuestionSubmissionService.count(new QueryWrapper<PracticeQuestionSubmission>().eq("status", "pending"));
        long approvedPracticeSubmissionCount = practiceQuestionSubmissionService.count(new QueryWrapper<PracticeQuestionSubmission>().eq("status", "approved"));
        long rejectedPracticeSubmissionCount = practiceQuestionSubmissionService.count(new QueryWrapper<PracticeQuestionSubmission>().eq("status", "rejected"));

        long pointsRuleCount = pointsRuleService.count();
        long enabledPointsRuleCount = pointsRuleService.count(new QueryWrapper<PointsRule>().eq("enabled", true));
        long pointsOptionCount = pointsRuleOptionService.count();
        long pointsRecordCount = pointsRecordService.count();

        long expRuleCount = experienceRuleService.count();
        long enabledExpRuleCount = experienceRuleService.count(new QueryWrapper<ExperienceRule>().eq("enabled", true));
        long levelRuleCount = experienceLevelRuleService.count();
        long enabledLevelRuleCount = experienceLevelRuleService.count(new QueryWrapper<ExperienceLevelRule>().eq("enabled", true));
        long expLogCount = experienceService.count();
        long entitlementCount = userEntitlementService.count();
        long todayCheckins = checkinRecordMapper.selectCount(new QueryWrapper<CheckinRecord>().ge("create_time", todayStart));

        stats.put("userCount", userCount);
        stats.put("pendingFeedback", pendingFeedback);

        stats.put("overview", Map.of(
                "onlineUsers", onlineUserCount,
                "todayNewUsers", todayNewUsers,
                "todayCheckins", todayCheckins
        ));
        stats.put("users", Map.of(
                "total", userCount,
                "online", onlineUserCount,
                "admins", adminCount,
                "moderators", moderatorCount,
                "locked", lockedUserCount,
                "muted", mutedUserCount
        ));
        stats.put("notifications", Map.of(
                "notifications", notificationCount,
                "total", notificationCount,
                "siteNotifications", siteNotificationCount,
                "unreadNotifications", unreadNotificationCount,
                "unread", unreadNotificationCount
        ));
        stats.put("moderation", Map.of(
                "pendingFeedback", pendingFeedback,
                "handledFeedback", handledFeedback,
                "ignoredFeedback", ignoredFeedback,
                "pendingPracticeSubmissions", pendingPracticeSubmissionCount
        ));
        stats.put("practice", Map.of(
                "questions", questionCount,
                "enabledQuestions", enabledQuestionCount,
                "questionCategories", questionCategoryCount,
                "questionTemplates", questionTemplateCount,
                "practiceRecords", practiceRecordCount,
                "practiceAnswers", practiceAnswerCount,
                "submissions", practiceSubmissionCount,
                "completedSubmissions", approvedPracticeSubmissionCount,
                "rejectedSubmissions", rejectedPracticeSubmissionCount
        ));
        stats.put("pointsAndLevels", Map.of(
                "pointsRules", pointsRuleCount,
                "enabledPointsRules", enabledPointsRuleCount,
                "pointsOptions", pointsOptionCount,
                "pointsRecords", pointsRecordCount,
                "expRules", expRuleCount,
                "enabledExpRules", enabledExpRuleCount,
                "levelRules", levelRuleCount,
                "enabledLevelRules", enabledLevelRuleCount,
                "expLogs", expLogCount,
                "entitlements", entitlementCount
        ));

        return ResponseEntity.ok(Map.of("stats", stats));
    }
    
    @GetMapping("/replies")
    public ResponseEntity<?> getReplies(
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "10") Integer size,
            @RequestParam(required = false) Long postId) {
        
        Page<Reply> pageRequest = new Page<>(page, size);
        QueryWrapper<Reply> queryWrapper = new QueryWrapper<>();
        
        if (postId != null) {
            queryWrapper.eq("post_id", postId);
        }
        
        queryWrapper.orderByDesc("create_time");
        
        Page<Reply> result = replyService.page(pageRequest, queryWrapper);
        
        List<Map<String, Object>> replies = result.getRecords().stream().map(reply -> {
            Map<String, Object> map = new HashMap<>();
            map.put("id", reply.getId());
            map.put("content", reply.getContent());
            map.put("likeCount", reply.getLikeCount());
            map.put("createdAt", reply.getCreateTime());
            map.put("status", reply.getStatus());
            
            User author = userService.getById(reply.getUserId());
            if (author != null) {
                Map<String, Object> authorMap = new HashMap<>();
                authorMap.put("id", author.getId());
                authorMap.put("username", author.getUsername());
                authorMap.put("avatar", author.getAvatar());
                map.put("author", authorMap);
            }
            
            Post post = postService.getById(reply.getPostId());
            if (post != null) {
                Map<String, Object> postMap = new HashMap<>();
                postMap.put("id", post.getId());
                postMap.put("title", post.getTitle());
                map.put("post", postMap);
            }
            
            return map;
        }).collect(Collectors.toList());
        
        Map<String, Object> response = new HashMap<>();
        response.put("replies", replies);
        response.put("total", result.getTotal());
        
        return ResponseEntity.ok(response);
    }
    
    @DeleteMapping("/replies/{id}")
    @Transactional
    public ResponseEntity<?> deleteReply(@PathVariable Long id) {
        Reply reply = replyService.getById(id);
        if (reply == null) {
            return ResponseEntity.notFound().build();
        }

        // 删除回复及其所有后代回复
        List<Long> allDescendantIds = replyService.findAllDescendantIds(reply.getId());
        int deletedCount = 1 + allDescendantIds.size();
        if (!allDescendantIds.isEmpty()) {
            replyService.removeByIds(allDescendantIds);
        }
        replyService.removeById(id);

        if (reply.getPostId() != null) {
            postService.recalculateReplyCount(reply.getPostId());
        }
        log.info("管理员删除回复: replyId={}, postId={}, descendantCount={}", id, reply.getPostId(), deletedCount - 1);

        return ResponseEntity.ok(Map.of("message", "删除成功"));
    }
    
    @GetMapping("/reports")
    public ResponseEntity<?> getReports(
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "10") Integer size,
            @RequestParam(required = false) String status) {
        
        Page<Report> pageRequest = new Page<>(page, size);
        QueryWrapper<Report> queryWrapper = new QueryWrapper<>();
        
        if (status != null && !status.isEmpty()) {
            if ("pending".equalsIgnoreCase(status)) {
                queryWrapper.eq("status", 0);
            } else if ("handled".equalsIgnoreCase(status)) {
                queryWrapper.eq("status", 1);
            } else if ("ignored".equalsIgnoreCase(status)) {
                queryWrapper.eq("status", 2);
            }
        }
        
        queryWrapper.orderByDesc("create_time");
        
        Page<Report> result = reportService.page(pageRequest, queryWrapper);
        
        List<Map<String, Object>> reports = result.getRecords().stream().map(report -> {
            Map<String, Object> map = new HashMap<>();
            map.put("id", report.getId());
            map.put("targetType", report.getTargetType());
            map.put("reason", report.getReason());
            map.put("description", report.getDescription());
            map.put("status", report.getStatus() == 0 ? "pending" : report.getStatus() == 1 ? "handled" : "ignored");
            map.put("createdAt", report.getCreateTime());
            
            User reporter = userService.getById(report.getReporterId());
            if (reporter != null) {
                Map<String, Object> reporterMap = new HashMap<>();
                reporterMap.put("id", reporter.getId());
                reporterMap.put("username", reporter.getUsername());
                reporterMap.put("avatar", reporter.getAvatar());
                map.put("reporter", reporterMap);
            }
            
            if ("post".equals(report.getTargetType())) {
                Post post = postService.getById(report.getTargetId());
                if (post != null) {
                    Map<String, Object> targetMap = new HashMap<>();
                    targetMap.put("id", post.getId());
                    targetMap.put("title", post.getTitle());
                    targetMap.put("content", post.getContent());
                    map.put("target", targetMap);
                }
            } else if ("reply".equals(report.getTargetType())) {
                Reply reply = replyService.getById(report.getTargetId());
                if (reply != null) {
                    Map<String, Object> targetMap = new HashMap<>();
                    targetMap.put("id", reply.getId());
                    targetMap.put("content", reply.getContent());
                    map.put("target", targetMap);
                }
            }
            
            return map;
        }).collect(Collectors.toList());
        
        Map<String, Object> response = new HashMap<>();
        response.put("reports", reports);
        response.put("total", result.getTotal());
        
        return ResponseEntity.ok(response);
    }
    
    @PutMapping("/reports/{id}/handle")
    @Transactional
    public ResponseEntity<?> handleReport(@PathVariable Long id, @RequestBody Map<String, String> body) {
        Report report = reportService.getById(id);
        if (report == null) {
            return ResponseEntity.notFound().build();
        }

        String action = body.get("action");

        if ("delete".equals(action)) {
            if ("post".equals(report.getTargetType())) {
                Post post = postService.getById(report.getTargetId());
                if (post != null) {
                    // 发送通知给帖子作者
                    notificationService.createNotification(
                        post.getUserId(),
                        "report_delete",
                        "您的帖子《" + post.getTitle() + "》因违规被管理员删除",
                        null
                    );
                    post.setStatus(99);
                    postService.updateById(post);
                }
            } else if ("reply".equals(report.getTargetType())) {
                Reply targetReply = replyService.getById(report.getTargetId());
                if (targetReply != null) {
                    // 发送通知给回复作者
                    notificationService.createNotification(
                        targetReply.getUserId(),
                        "report_delete",
                        "您的回复因违规被管理员删除",
                        targetReply.getPostId()
                    );
                    // 删除回复及其所有后代回复
                    List<Long> allDescendantIds = replyService.findAllDescendantIds(targetReply.getId());
                    int deletedCount = 1 + allDescendantIds.size();
                    if (!allDescendantIds.isEmpty()) {
                        replyService.removeByIds(allDescendantIds);
                    }
                    replyService.removeById(targetReply.getId());
                    postService.recalculateReplyCount(targetReply.getPostId());
                }
            }
            report.setStatus(1);
        } else if ("ignore".equals(action)) {
            report.setStatus(2);
        }

        reportService.updateById(report);

        eventService.publishEvent(ForumEvent.reportUpdated(id));

        return ResponseEntity.ok(Map.of("message", "处理成功"));
    }

    @GetMapping("/feedback")
    public ResponseEntity<?> getFeedback(
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "10") Integer size,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String type,
            @RequestParam(required = false) String keyword) {

        Page<Feedback> pageRequest = new Page<>(page, size);
        QueryWrapper<Feedback> queryWrapper = new QueryWrapper<>();

        if (StringUtils.hasText(status)) {
            if ("pending".equalsIgnoreCase(status)) {
                queryWrapper.eq("status", 0);
            } else if ("handled".equalsIgnoreCase(status)) {
                queryWrapper.eq("status", 1);
            } else if ("ignored".equalsIgnoreCase(status)) {
                queryWrapper.eq("status", 2);
            }
        }

        if (StringUtils.hasText(type)) {
            queryWrapper.eq("type", type.trim());
        }

        if (StringUtils.hasText(keyword)) {
            queryWrapper.like("content", keyword.trim());
        }

        queryWrapper.orderByDesc("create_time");

        Page<Feedback> result = feedbackService.page(pageRequest, queryWrapper);
        Set<Long> userIds = result.getRecords().stream()
                .flatMap(item -> java.util.stream.Stream.of(item.getUserId(), item.getHandlerId()))
                .filter(Objects::nonNull)
                .collect(Collectors.toCollection(LinkedHashSet::new));
        Map<Long, User> userMap = userIds.isEmpty()
                ? Map.of()
                : userService.listByIds(userIds).stream().collect(Collectors.toMap(User::getId, item -> item, (a, b) -> a));

        List<Map<String, Object>> records = result.getRecords().stream().map(item -> {
            Map<String, Object> map = new HashMap<>();
            map.put("id", item.getId());
            map.put("type", item.getType());
            map.put("content", item.getContent());
            map.put("status", item.getStatus() == null || item.getStatus() == 0 ? "pending" : item.getStatus() == 1 ? "handled" : "ignored");
            map.put("createTime", item.getCreateTime());
            map.put("handleTime", item.getHandleTime());
            map.put("handleNote", item.getHandleNote());

            User author = userMap.get(item.getUserId());
            if (author != null) {
                Map<String, Object> userPayload = new HashMap<>();
                userPayload.put("id", author.getId());
                userPayload.put("username", author.getUsername());
                userPayload.put("avatar", author.getAvatar());
                map.put("user", userPayload);
            }

            User handler = userMap.get(item.getHandlerId());
            if (handler != null) {
                Map<String, Object> handlerPayload = new HashMap<>();
                handlerPayload.put("id", handler.getId());
                handlerPayload.put("username", handler.getUsername());
                map.put("handler", handlerPayload);
            }
            return map;
        }).collect(Collectors.toList());

        return ResponseEntity.ok(Map.of(
                "records", records,
                "total", result.getTotal(),
                "current", result.getCurrent(),
                "size", result.getSize()
        ));
    }

    @PutMapping("/feedback/{id}/handle")
    @Transactional
    public ResponseEntity<?> handleFeedback(
            @PathVariable Long id,
            @RequestAttribute Long userId,
            @RequestBody Map<String, String> body) {
        Feedback feedback = feedbackService.getById(id);
        if (feedback == null) {
            return ResponseEntity.notFound().build();
        }

        String action = body.getOrDefault("action", "").trim();
        String note = body.getOrDefault("note", "").trim();
        if (!"handle".equals(action) && !"ignore".equals(action)) {
            return ResponseEntity.badRequest().body(Map.of("message", "处理动作无效"));
        }

        feedback.setStatus("handle".equals(action) ? 1 : 2);
        feedback.setHandlerId(userId);
        feedback.setHandleNote(note.isBlank() ? null : note);
        feedback.setHandleTime(LocalDateTime.now());
        feedbackService.updateById(feedback);

        if (feedback.getUserId() != null) {
            String message;
            if ("handle".equals(action)) {
                message = "您的反馈建议已处理";
            } else {
                message = "您的反馈建议已查看，当前暂未采纳";
            }
            if (StringUtils.hasText(note)) {
                message = message + "：" + note.trim();
            }
            notificationService.createNotification(feedback.getUserId(), "feedback_result", message, null);
        }

        return ResponseEntity.ok(Map.of("message", "反馈已处理"));
    }
    
    @DeleteMapping("/posts/{id}/permanent")
    @Transactional
    public ResponseEntity<?> permanentDeletePost(@PathVariable Long id) {
        Post post = postService.getById(id);
        if (post == null) {
            return ResponseEntity.notFound().build();
        }

        Set<Long> replyIds = replyService.list(new QueryWrapper<Reply>()
                        .eq("post_id", id)
                        .select("id"))
                .stream()
                .map(Reply::getId)
                .filter(Objects::nonNull)
                .collect(Collectors.toCollection(LinkedHashSet::new));

        cleanupPostAndReplyReferences(Set.of(id), replyIds);
        replyService.remove(new QueryWrapper<Reply>().eq("post_id", id));
        postService.removeById(id);
        log.info("管理员永久删除帖子: postId={}, replyCount={}", id, replyIds.size());

        eventService.publishEvent(ForumEvent.postDeleted(id));

        return ResponseEntity.ok(Map.of("message", "永久删除成功"));
    }

    @GetMapping("/posts/review")
    public ResponseEntity<?> getPostsForReview(
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "10") Integer size,
            @RequestParam(required = false) String reviewStatus) {
        
        Page<Post> pageRequest = new Page<>(page, size);
        QueryWrapper<Post> queryWrapper = new QueryWrapper<>();
        
        if (reviewStatus != null && !reviewStatus.isEmpty()) {
            queryWrapper.eq("review_status", reviewStatus);
        } else {
            queryWrapper.eq("review_status", "pending");
        }
        
        queryWrapper.orderByDesc("create_time");
        
        Page<Post> result = postService.page(pageRequest, queryWrapper);
        
        Map<String, Object> response = new HashMap<>();
        response.put("records", DtoConverter.convertPosts(result.getRecords(), userService, userEntitlementService, categoryService, replyService));
        response.put("total", result.getTotal());
        
        return ResponseEntity.ok(response);
    }

    @PutMapping("/posts/{id}/review")
    @Transactional
    public ResponseEntity<?> reviewPost(@PathVariable Long id, @RequestBody Map<String, String> body) {
        Post post = postService.getById(id);
        if (post == null) {
            return ResponseEntity.notFound().build();
        }

        String status = body.get("status");
        String reason = body.get("reason");

        if (status == null || (!status.equals("approved") && !status.equals("rejected"))) {
            return ResponseEntity.badRequest().body(Map.of("message", "无效的审核状态"));
        }

        UpdateWrapper<Post> reviewUpdate = new UpdateWrapper<>();
        reviewUpdate.eq("id", id)
                .eq("review_status", "pending")
                .set("review_status", status)
                .set("review_reason", "approved".equals(status) ? null : reason)
                .set("status", "approved".equals(status) ? 0 : -1);
        if (!postService.update(reviewUpdate)) {
            return ResponseEntity.badRequest().body(Map.of("message", "帖子已被其他管理员处理"));
        }

        post = postService.getById(id);

        if ("approved".equals(status)) {
            experienceService.awardPostApproved(post.getUserId(), post.getId(), post.getTitle());
            pointsTaskService.awardTask(post.getUserId(), PointsTaskService.TASK_DAILY_POST, post.getId(), "完成今日发帖");
            pointsTaskService.awardTask(post.getUserId(), PointsTaskService.TASK_FIRST_POST, null, "完成首次发帖");
        }
        log.info("管理员审核帖子: postId={}, reviewStatus={}, reason={}", id, status, reason);

        String notificationContent = "approved".equals(status)
            ? "您的帖子「" + post.getTitle() + "」已通过审核"
            : "您的帖子「" + post.getTitle() + "」未通过审核" + (reason != null ? "，原因：" + reason : "");

        String reviewerNotificationContent = "approved".equals(status)
                ? "帖子「" + post.getTitle() + "」已审核通过"
                : "帖子「" + post.getTitle() + "」已驳回" + (reason != null ? "，原因：" + reason : "");

        UpdateWrapper<Notification> reviewerNotificationUpdate = new UpdateWrapper<>();
        reviewerNotificationUpdate.eq("type", "review_request")
                .eq("related_id", id)
                .set("type", "post_review")
                .set("content", reviewerNotificationContent)
                .set("is_read", 1);
        notificationService.update(reviewerNotificationUpdate);

        notificationService.createNotification(
            post.getUserId(),
            "post_review",
            notificationContent,
            id
        );

        return ResponseEntity.ok(Map.of("message", "审核完成"));
    }

    @GetMapping("/drafts")
    public ResponseEntity<?> getDrafts(
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "10") Integer size,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) Long categoryId,
            @RequestParam(required = false) String username,
            @RequestParam(required = false) Boolean expired,
            @RequestParam(defaultValue = "latest") String sort) {
        Page<PostDraft> result = postDraftService.listAdminDrafts(page, size, keyword, status, categoryId, username, expired, sort);

        List<Map<String, Object>> records = result.getRecords().stream()
                .map(this::buildAdminDraftResponse)
                .collect(Collectors.toList());

        return ResponseEntity.ok(Map.of(
                "records", records,
                "total", result.getTotal(),
                "current", result.getCurrent(),
                "size", result.getSize(),
                "pages", result.getPages(),
                "maxExpireDays", PostDraftService.DRAFT_EXPIRE_DAYS
        ));
    }

    @DeleteMapping("/drafts/{id}")
    public ResponseEntity<?> deleteDraftByAdmin(@PathVariable Long id) {
        try {
            postDraftService.deleteDraftByAdmin(id);
            return ResponseEntity.ok(Map.of("message", "草稿已删除"));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(404).body(Map.of("message", e.getMessage()));
        }
    }

    @DeleteMapping("/drafts/by-user/{userId}")
    public ResponseEntity<?> deleteDraftsByUser(@PathVariable Long userId) {
        User user = userService.getById(userId);
        if (user == null) {
            return ResponseEntity.status(404).body(Map.of("message", "用户不存在"));
        }

        long count = postDraftService.deleteDraftsByAdminUser(userId);
        return ResponseEntity.ok(Map.of(
                "message", count > 0 ? "已清理该用户的 " + count + " 条草稿" : "该用户当前没有草稿",
                "count", count
        ));
    }

    @GetMapping("/levels/overview")
    public ResponseEntity<?> getLevelOverview() {
        List<ExperienceProperties.LevelRule> sortedLevels = getSortedLevelRules();
        List<User> users = userService.list(new QueryWrapper<User>()
                .select("id", "username", "avatar", "level", "exp", "points", "role", "status", "create_time"));
        List<UserExpLog> todayLogs = experienceService.list(new QueryWrapper<UserExpLog>()
                .ge("create_time", LocalDateTime.now().toLocalDate().atStartOfDay()));

        int totalExp = users.stream().mapToInt(user -> safeInt(user.getExp())).sum();
        int highestLevel = users.stream().map(User::getLevel).filter(Objects::nonNull).max(Integer::compareTo).orElse(1);
        long highestLevelUsers = users.stream().filter(user -> safeInt(user.getLevel()) == highestLevel).count();
        int todayExp = todayLogs.stream().mapToInt(log -> safeInt(log.getExpChange())).sum();

        List<Map<String, Object>> levelDistribution = new ArrayList<>();
        for (ExperienceProperties.LevelRule rule : sortedLevels) {
            int level = safeInt(rule.getLevel());
            long userCount = users.stream().filter(user -> safeInt(user.getLevel()) == level).count();
            Map<String, Object> item = new HashMap<>();
            item.put("level", level);
            item.put("name", defaultText(rule.getName(), "未命名等级"));
            item.put("threshold", safeInt(rule.getThreshold()));
            item.put("userCount", userCount);
            levelDistribution.add(item);
        }

        List<Map<String, Object>> levelRules;
        List<ExperienceLevelRule> configuredLevelRules = experienceLevelRuleService.listOrderedRules();
        if (!configuredLevelRules.isEmpty()) {
            levelRules = configuredLevelRules.stream()
                    .map(this::buildLevelRuleResponse)
                    .collect(Collectors.toList());
        } else {
            levelRules = sortedLevels.stream().map(rule -> {
                Map<String, Object> item = new HashMap<>();
                item.put("level", safeInt(rule.getLevel()));
                item.put("name", defaultText(rule.getName(), "未命名等级"));
                item.put("threshold", safeInt(rule.getThreshold()));
                item.put("enabled", true);
                item.put("sortOrder", safeInt(rule.getLevel()));
                item.put("rangeText", "达到 " + safeInt(rule.getThreshold()) + " 经验");
                return item;
            }).collect(Collectors.toList());
        }

        List<Map<String, Object>> expRules = experienceRuleService.listOrderedRules().stream()
                .map(this::buildExpRuleResponse)
                .collect(Collectors.toList());

        return ResponseEntity.ok(Map.of(
                "stats", Map.of(
                        "userCount", users.size(),
                        "totalExp", totalExp,
                        "todayExp", todayExp,
                        "highestLevel", highestLevel,
                        "highestLevelName", resolveLevelName(highestLevel),
                        "highestLevelUsers", highestLevelUsers
                ),
                "levelRules", levelRules,
                "expRules", expRules,
                "distribution", levelDistribution
        ));
    }

    @PostMapping("/levels/rules")
    public ResponseEntity<?> createLevelRule(@RequestBody Map<String, Object> body) {
        Integer level = parseInteger(body.get("level"));
        String name = body.get("name") == null ? null : String.valueOf(body.get("name")).trim();
        Integer threshold = parseInteger(body.get("threshold"));
        Boolean enabled = body.get("enabled") instanceof Boolean value ? value : Boolean.TRUE;
        Integer sortOrder = body.get("sortOrder") == null ? null : parseInteger(body.get("sortOrder"));

        if (level == null || level < 1) {
            return ResponseEntity.badRequest().body(Map.of("message", "等级值必须大于 0"));
        }
        if (experienceLevelRuleService.getByLevel(level) != null) {
            return ResponseEntity.badRequest().body(Map.of("message", "该等级定义已存在"));
        }
        if (name == null || name.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("message", "等级名称不能为空"));
        }
        if (threshold == null || threshold < 0) {
            return ResponseEntity.badRequest().body(Map.of("message", "等级阈值不能小于 0"));
        }

        ResponseEntity<?> invalidThreshold = validateLevelThreshold(level, threshold, null);
        if (invalidThreshold != null) {
            return invalidThreshold;
        }

        ExperienceLevelRule created = new ExperienceLevelRule();
        created.setLevel(level);
        created.setName(name);
        created.setThreshold(threshold);
        created.setEnabled(enabled == null || enabled);
        created.setSortOrder(sortOrder == null ? level * 10 : Math.max(sortOrder, 0));
        experienceLevelRuleService.save(created);

        int recalculated = recalculateAllLevels();
        Map<String, Object> response = buildLevelRuleResponse(created);
        response.put("recalculatedUsers", recalculated);
        return ResponseEntity.ok(response);
    }

    @PutMapping("/levels/rules/{level}")
    public ResponseEntity<?> updateLevelRule(@PathVariable Integer level, @RequestBody Map<String, Object> body) {
        ExperienceLevelRule existing = experienceLevelRuleService.getByLevel(level);
        if (existing == null) {
            return ResponseEntity.status(404).body(Map.of("message", "等级规则不存在"));
        }

        String nextName = body.get("name") == null ? existing.getName() : String.valueOf(body.get("name")).trim();
        Integer nextThreshold = body.get("threshold") == null ? existing.getThreshold() : parseInteger(body.get("threshold"));
        Boolean nextEnabled = body.get("enabled") instanceof Boolean value ? value : existing.getEnabled();

        if (nextName == null || nextName.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("message", "等级名称不能为空"));
        }
        if (nextThreshold == null || nextThreshold < 0) {
            return ResponseEntity.badRequest().body(Map.of("message", "等级阈值不能小于 0"));
        }
        if (Boolean.FALSE.equals(nextEnabled) && (existing.getEnabled() == null || existing.getEnabled())
                && experienceLevelRuleService.listEnabledRules().size() <= 1) {
            return ResponseEntity.badRequest().body(Map.of("message", "至少保留一个启用等级"));
        }

        ResponseEntity<?> invalidThreshold = validateLevelThreshold(level, nextThreshold, existing.getId());
        if (invalidThreshold != null) {
            return invalidThreshold;
        }

        existing.setName(nextName);
        existing.setThreshold(nextThreshold);
        existing.setEnabled(nextEnabled == null || nextEnabled);
        if (existing.getSortOrder() == null) {
            existing.setSortOrder(safeInt(existing.getLevel()));
        }
        experienceLevelRuleService.updateById(existing);
        int recalculated = recalculateAllLevels();
        Map<String, Object> response = buildLevelRuleResponse(existing);
        response.put("recalculatedUsers", recalculated);
        return ResponseEntity.ok(response);
    }

    @DeleteMapping("/levels/rules/{level}")
    public ResponseEntity<?> deleteLevelRule(@PathVariable Integer level) {
        ExperienceLevelRule existing = experienceLevelRuleService.getByLevel(level);
        if (existing == null) {
            return ResponseEntity.status(404).body(Map.of("message", "等级规则不存在"));
        }
        if (experienceLevelRuleService.count() <= 1) {
            return ResponseEntity.badRequest().body(Map.of("message", "至少保留一条等级定义"));
        }
        if ((existing.getEnabled() == null || existing.getEnabled()) && experienceLevelRuleService.listEnabledRules().size() <= 1) {
            return ResponseEntity.badRequest().body(Map.of("message", "至少保留一个启用等级"));
        }

        experienceLevelRuleService.removeById(existing.getId());
        int recalculated = recalculateAllLevels();
        return ResponseEntity.ok(Map.of(
                "message", "等级定义已删除",
                "level", safeInt(existing.getLevel()),
                "recalculatedUsers", recalculated
        ));
    }

    @PostMapping("/levels/exp-rules")
    public ResponseEntity<?> createExpRule(@RequestBody ExperienceRule body) {
        String ruleKey = body.getRuleKey() == null ? null : body.getRuleKey().trim();
        String name = body.getName() == null ? null : body.getName().trim();
        int minExp = body.getMinExp() == null ? 0 : Math.max(body.getMinExp(), 0);
        int maxExp = body.getMaxExp() == null ? minExp : Math.max(body.getMaxExp(), 0);
        Integer maxObtainCount = body.getMaxObtainCount() == null ? null : Math.max(body.getMaxObtainCount(), 0);
        if (ruleKey == null || ruleKey.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("message", "规则标识不能为空"));
        }
        if (!ruleKey.matches("^[a-z0-9_]+$")) {
            return ResponseEntity.badRequest().body(Map.of("message", "规则标识仅支持小写字母、数字和下划线"));
        }
        if (experienceRuleService.getByRuleKey(ruleKey) != null) {
            return ResponseEntity.badRequest().body(Map.of("message", "该规则标识已存在"));
        }
        if (name == null || name.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("message", "规则名称不能为空"));
        }
        if (maxExp < minExp) {
            return ResponseEntity.badRequest().body(Map.of("message", "最大经验不能小于最小经验"));
        }

        ExperienceRule created = new ExperienceRule();
        created.setRuleKey(ruleKey);
        created.setName(name);
        created.setDescription(body.getDescription() == null ? null : body.getDescription().trim());
        created.setMinExp(minExp);
        created.setMaxExp(maxExp);
        created.setEnabled(body.getEnabled() == null || body.getEnabled());
        created.setMaxObtainCount(maxObtainCount);
        experienceRuleService.save(created);
        return ResponseEntity.ok(buildExpRuleResponse(created));
    }

    @PutMapping("/levels/exp-rules/{ruleKey}")
    public ResponseEntity<?> updateExpRule(@PathVariable String ruleKey, @RequestBody ExperienceRule body) {
        ExperienceRule existing = experienceRuleService.getByRuleKey(ruleKey);
        if (existing == null) {
            return ResponseEntity.status(404).body(Map.of("message", "经验规则不存在"));
        }

        int minExp = body.getMinExp() == null ? safeInt(existing.getMinExp()) : Math.max(body.getMinExp(), 0);
        int maxExp = body.getMaxExp() == null ? safeInt(existing.getMaxExp()) : Math.max(body.getMaxExp(), 0);
        Integer maxObtainCount = body.getMaxObtainCount() == null ? existing.getMaxObtainCount() : Math.max(body.getMaxObtainCount(), 0);
        if (maxExp < minExp) {
            return ResponseEntity.badRequest().body(Map.of("message", "最大经验不能小于最小经验"));
        }

        existing.setMinExp(minExp);
        existing.setMaxExp(maxExp);
        if (body.getName() != null && !body.getName().isBlank()) {
            existing.setName(body.getName().trim());
        }
        if (body.getDescription() != null) {
            existing.setDescription(body.getDescription().trim());
        }
        if (body.getEnabled() != null) {
            existing.setEnabled(body.getEnabled());
        }
        existing.setMaxObtainCount(maxObtainCount);

        experienceRuleService.updateById(existing);
        return ResponseEntity.ok(buildExpRuleResponse(existing));
    }

    @DeleteMapping("/levels/exp-rules/{ruleKey}")
    public ResponseEntity<?> deleteExpRule(@PathVariable String ruleKey) {
        ExperienceRule existing = experienceRuleService.getByRuleKey(ruleKey);
        if (existing == null) {
            return ResponseEntity.status(404).body(Map.of("message", "经验规则不存在"));
        }
        experienceRuleService.removeById(existing.getId());
        return ResponseEntity.ok(Map.of(
                "message", "经验规则已删除",
                "key", defaultText(existing.getRuleKey(), ruleKey)
        ));
    }

    @GetMapping("/levels/users")
    public ResponseEntity<?> getLevelUsers(
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "10") Integer size,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) Integer level) {
        Page<User> pageRequest = new Page<>(page, size);
        QueryWrapper<User> queryWrapper = new QueryWrapper<>();

        if (keyword != null && !keyword.isBlank()) {
            queryWrapper.and(wrapper -> wrapper
                    .like("username", keyword.trim())
                    .or()
                    .like("email", keyword.trim()));
        }
        if (level != null) {
            queryWrapper.eq("level", level);
        }

        queryWrapper.orderByDesc("exp").orderByDesc("level").orderByDesc("create_time");

        Page<User> result = userService.page(pageRequest, queryWrapper);
        List<Map<String, Object>> records = result.getRecords().stream()
                .map(this::buildLevelUserResponse)
                .collect(Collectors.toList());

        return ResponseEntity.ok(Map.of(
                "records", records,
                "total", result.getTotal(),
                "current", result.getCurrent(),
                "size", result.getSize(),
                "pages", result.getPages()
        ));
    }

    @PutMapping("/levels/users/{id}")
    public ResponseEntity<?> updateLevelUser(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        User existing = userService.getById(id);
        if (existing == null) {
            return ResponseEntity.status(404).body(Map.of("message", "用户不存在"));
        }

        Integer targetLevel = parseInteger(body.get("level"));
        Integer targetExp = parseInteger(body.get("exp"));
        if (targetLevel == null || targetLevel < 1) {
            return ResponseEntity.badRequest().body(Map.of("message", "等级不能为空"));
        }
        if (targetExp == null || targetExp < 0) {
            return ResponseEntity.badRequest().body(Map.of("message", "经验值不能小于 0"));
        }

        List<ExperienceProperties.LevelRule> sortedLevels = getSortedLevelRules();
        ExperienceProperties.LevelRule currentRule = sortedLevels.stream()
                .filter(rule -> safeInt(rule.getLevel()) == targetLevel)
                .findFirst()
                .orElse(null);
        if (currentRule == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "目标等级不存在"));
        }

        int minExp = safeInt(currentRule.getThreshold());
        int maxExp = Integer.MAX_VALUE;
        for (ExperienceProperties.LevelRule rule : sortedLevels) {
            if (safeInt(rule.getLevel()) == targetLevel + 1) {
                maxExp = Math.max(safeInt(rule.getThreshold()) - 1, minExp);
                break;
            }
        }

        int normalizedExp = Math.max(targetExp, minExp);
        if (maxExp != Integer.MAX_VALUE) {
            normalizedExp = Math.min(normalizedExp, maxExp);
        }

        User updated = new User();
        updated.setId(id);
        updated.setLevel(targetLevel);
        updated.setExp(normalizedExp);
        userService.updateById(updated);

        User refreshed = userService.getById(id);
        return ResponseEntity.ok(buildLevelUserResponse(refreshed));
    }

    @GetMapping("/levels/logs")
    public ResponseEntity<?> getLevelLogs(
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "10") Integer size,
            @RequestParam(required = false) String username,
            @RequestParam(required = false) String bizType) {
        Page<UserExpLog> pageRequest = new Page<>(page, size);
        QueryWrapper<UserExpLog> queryWrapper = new QueryWrapper<>();

        if (bizType != null && !bizType.isBlank()) {
            queryWrapper.eq("biz_type", bizType.trim());
        }

        List<User> matchedUsers = null;
        if (username != null && !username.isBlank()) {
            matchedUsers = userService.list(new QueryWrapper<User>()
                    .select("id", "username", "avatar", "level", "exp")
                    .like("username", username.trim()));
            if (matchedUsers.isEmpty()) {
                return ResponseEntity.ok(Map.of(
                        "records", List.of(),
                        "total", 0,
                        "current", pageRequest.getCurrent(),
                        "size", pageRequest.getSize(),
                        "pages", 0
                ));
            }
            queryWrapper.in("user_id", matchedUsers.stream().map(User::getId).toList());
        }

        queryWrapper.orderByDesc("create_time");
        Page<UserExpLog> result = experienceService.page(pageRequest, queryWrapper);

        List<Long> userIds = result.getRecords().stream().map(UserExpLog::getUserId).distinct().toList();
        Map<Long, User> userMap = (matchedUsers != null ? matchedUsers : userService.list(new QueryWrapper<User>()
                .select("id", "username", "avatar", "level", "exp")
                .in(!userIds.isEmpty(), "id", userIds)))
                .stream()
                .collect(Collectors.toMap(User::getId, user -> user, (left, right) -> left));

        List<Map<String, Object>> records = result.getRecords().stream()
                .map(log -> buildLevelLogResponse(log, userMap.get(log.getUserId())))
                .collect(Collectors.toList());

        return ResponseEntity.ok(Map.of(
                "records", records,
                "total", result.getTotal(),
                "current", result.getCurrent(),
                "size", result.getSize(),
                "pages", result.getPages()
        ));
    }

    @PostMapping("/levels/recalculate")
    public ResponseEntity<?> recalculateLevels() {
        int updated = recalculateAllLevels();
        return ResponseEntity.ok(Map.of(
                "message", updated > 0 ? "已重新校准 " + updated + " 个用户等级" : "所有用户等级已是最新状态",
                "updated", updated
        ));
    }

    @GetMapping("/points/rules")
    public ResponseEntity<?> getPointsRules() {
        QueryWrapper<PointsRule> queryWrapper = new QueryWrapper<>();
        queryWrapper.orderByAsc("sort_order").orderByAsc("id");
        return ResponseEntity.ok(pointsRuleService.list(queryWrapper));
    }

    @GetMapping("/points/options")
    public ResponseEntity<?> getPointsRuleOptions() {
        Map<String, Object> response = new HashMap<>();
        response.put("types", buildPointsRuleOptionResponses(POINTS_OPTION_KIND_TYPE));
        response.put("taskKeys", buildPointsRuleOptionResponses(POINTS_OPTION_KIND_TASK_KEY));
        return ResponseEntity.ok(response);
    }

    @PostMapping("/points/options")
    public ResponseEntity<?> createPointsRuleOption(@RequestBody PointsRuleOption option) {
        ResponseEntity<?> validationError = validatePointsRuleOption(option, null);
        if (validationError != null) {
            return validationError;
        }
        normalizePointsRuleOption(option);
        pointsRuleOptionService.save(option);
        return ResponseEntity.ok(buildPointsRuleOptionResponse(option));
    }

    @PutMapping("/points/options/{id}")
    public ResponseEntity<?> updatePointsRuleOption(@PathVariable Long id, @RequestBody PointsRuleOption option) {
        PointsRuleOption existing = pointsRuleOptionService.getById(id);
        if (existing == null) {
            return ResponseEntity.notFound().build();
        }
        ResponseEntity<?> validationError = validatePointsRuleOption(option, id);
        if (validationError != null) {
            return validationError;
        }
        normalizePointsRuleOption(option);
        long usageCount = countPointsRulesUsingOption(existing.getKind(), existing.getOptionValue());
        boolean isValueChanged = !Objects.equals(existing.getKind(), option.getKind()) || !Objects.equals(existing.getOptionValue(), option.getOptionValue());
        if (isValueChanged && usageCount > 0) {
            return ResponseEntity.badRequest().body(Map.of("message", "该选项已被积分规则使用，无法修改标识值"));
        }
        option.setId(id);
        pointsRuleOptionService.updateById(option);
        return ResponseEntity.ok(buildPointsRuleOptionResponse(pointsRuleOptionService.getById(id)));
    }

    @DeleteMapping("/points/options/{id}")
    public ResponseEntity<?> deletePointsRuleOption(@PathVariable Long id) {
        PointsRuleOption existing = pointsRuleOptionService.getById(id);
        if (existing == null) {
            return ResponseEntity.notFound().build();
        }
        long usageCount = countPointsRulesUsingOption(existing.getKind(), existing.getOptionValue());
        if (usageCount > 0) {
            return ResponseEntity.badRequest().body(Map.of("message", "该选项已被积分规则使用，请先修改或删除相关规则"));
        }
        pointsRuleOptionService.removeById(id);
        return ResponseEntity.ok(Map.of("message", "积分规则选项已删除"));
    }

    @PostMapping("/points/rules")
    public ResponseEntity<?> createPointsRule(@RequestBody PointsRule rule) {
        ResponseEntity<?> validationError = validatePointsRule(rule, null);
        if (validationError != null) {
            return validationError;
        }
        applyPointsRuleDefaults(rule);
        pointsRuleService.save(rule);
        return ResponseEntity.ok(rule);
    }

    @PutMapping("/points/rules/{id}")
    public ResponseEntity<?> updatePointsRule(@PathVariable Long id, @RequestBody PointsRule rule) {
        PointsRule existing = pointsRuleService.getById(id);
        if (existing == null) {
            return ResponseEntity.notFound().build();
        }
        ResponseEntity<?> validationError = validatePointsRule(rule, id);
        if (validationError != null) {
            return validationError;
        }
        applyPointsRuleDefaults(rule);
        rule.setId(id);
        pointsRuleService.updateById(rule);
        return ResponseEntity.ok(rule);
    }

    @DeleteMapping("/points/rules/{id}")
    public ResponseEntity<?> deletePointsRule(@PathVariable Long id) {
        pointsRuleService.removeById(id);
        return ResponseEntity.ok(Map.of("message", "积分规则已删除"));
    }

    @GetMapping("/points/stats")
    public ResponseEntity<?> getPointsStats() {
        Map<String, Object> stats = new HashMap<>();
        
        QueryWrapper<User> activeWrapper = new QueryWrapper<>();
        activeWrapper.gt("points", 0);
        stats.put("activeUsers", userService.count(activeWrapper));

        QueryWrapper<PointsRecord> totalWrapper = new QueryWrapper<>();
        totalWrapper.select("COALESCE(SUM(`change`), 0) AS total_points");
        stats.put("totalPoints", extractStatValue(pointsRecordService.getMap(totalWrapper), "total_points"));

        QueryWrapper<PointsRecord> todayWrapper = new QueryWrapper<>();
        todayWrapper.select("COALESCE(SUM(`change`), 0) AS total_points")
                .ge("create_time", LocalDateTime.now().withHour(0).withMinute(0).withSecond(0).withNano(0));
        stats.put("todayPoints", extractStatValue(pointsRecordService.getMap(todayWrapper), "total_points"));
        
        return ResponseEntity.ok(stats);
    }

    @GetMapping("/points/records")
    public ResponseEntity<?> getPointsRecords(
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "10") Integer size,
            @RequestParam(required = false) String username) {
        return ResponseEntity.ok(pointsRecordService.getRecordsPage(page, size, username));
    }

    @GetMapping("/questions")
    public ResponseEntity<?> getQuestions(
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "10") Integer size,
            @RequestParam(required = false) String type,
            @RequestParam(required = false) Long questionCategoryId) {
        String effectiveType = StringUtils.hasText(type) ? type : "excel_template";
        Map<String, Object> response = questionService.getQuestionsPage(page, size, effectiveType, questionCategoryId);
        @SuppressWarnings("unchecked")
        List<Question> records = (List<Question>) response.getOrDefault("questions", List.of());
        Map<Long, QuestionExcelTemplate> templateMap = questionExcelTemplateService.mapByQuestionIds(
                records.stream()
                        .filter(item -> "excel_template".equals(item.getType()))
                        .map(Question::getId)
                        .toList()
        );
        response.put("questions", records.stream().map(question -> buildAdminQuestionResponse(question, templateMap.get(question.getId()))).toList());
        return ResponseEntity.ok(response);
    }

    @GetMapping("/practice-submissions")
    public ResponseEntity<?> getPracticeSubmissions(
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "10") Integer size,
            @RequestParam(defaultValue = "pending") String status) {
        return ResponseEntity.ok(practiceQuestionSubmissionService.getReviewPage(page, size, status));
    }

    @PutMapping("/practice-submissions/{id}/review")
    @Transactional
    public ResponseEntity<?> reviewPracticeSubmission(
            @PathVariable Long id,
            @RequestAttribute("userId") Long reviewerId,
            @RequestBody Map<String, String> body) {
        PracticeQuestionSubmission submission = practiceQuestionSubmissionService.getById(id);
        if (submission == null) {
            return ResponseEntity.notFound().build();
        }
        if (!"pending".equalsIgnoreCase(String.valueOf(submission.getStatus()))) {
            return ResponseEntity.badRequest().body(Map.of("message", "该投稿已处理"));
        }

        String status = body.getOrDefault("status", "").trim();
        String reason = body.getOrDefault("reason", "").trim();
        if (!"approved".equals(status) && !"rejected".equals(status)) {
            return ResponseEntity.badRequest().body(Map.of("message", "无效的审核状态"));
        }
        if ("rejected".equals(status) && !StringUtils.hasText(reason)) {
            return ResponseEntity.badRequest().body(Map.of("message", "请填写驳回原因"));
        }

        if ("approved".equals(status)) {
            QuestionCategory targetCategory = ensureUserSubmissionQuestionCategory();
            Question question = new Question();
            question.setTitle(submission.getTitle());
            question.setType("excel_template");
            question.setQuestionCategoryId(targetCategory.getId());
            question.setDifficulty(submission.getDifficulty() == null ? 1 : submission.getDifficulty());
            question.setPoints(submission.getPoints() == null ? 0 : submission.getPoints());
            question.setExplanation(submission.getDescription());
            question.setEnabled(true);
            question.setOptions(null);
            question.setAnswer("");
            questionService.save(question);

            QuestionExcelTemplate template = new QuestionExcelTemplate();
            template.setQuestionId(question.getId());
            template.setTemplateFileUrl(submission.getTemplateFileUrl());
            template.setAnswerSheet(submission.getAnswerSheet());
            template.setAnswerRange(submission.getAnswerRange());
            template.setAnswerSnapshotJson(submission.getAnswerSnapshotJson());
            template.setCheckFormula(Boolean.TRUE.equals(submission.getCheckFormula()));
            template.setGradingRuleJson(excelTemplateGradingService.normalizeRuleJson(submission.getGradingRuleJson()));
            template.setExpectedSnapshotJson(submission.getExpectedSnapshotJson());
            template.setSheetCountLimit(submission.getSheetCountLimit() == null || submission.getSheetCountLimit() < 1 ? 5 : submission.getSheetCountLimit());
            template.setVersion(submission.getVersion() == null || submission.getVersion() < 1 ? 1 : submission.getVersion());
            questionExcelTemplateService.save(template);
            practiceCampaignService.syncCampaignCatalog();

            submission.setReviewNote("已完成，已归属到【" + targetCategory.getName() + "】模块，入库题目 #" + question.getId());
        } else {
            submission.setReviewNote(reason);
        }

        submission.setStatus(status);
        submission.setReviewerId(reviewerId);
        submission.setReviewedTime(LocalDateTime.now());
        practiceQuestionSubmissionService.updateById(submission);

        if (submission.getUserId() != null) {
            String message = "approved".equals(status)
                    ? "您投稿的试题《" + submission.getTitle() + "》已通过审核"
                    : "您投稿的试题《" + submission.getTitle() + "》未通过审核，原因：" + reason;
            notificationService.createNotification(submission.getUserId(), "feedback_result", message, null);
        }

        return ResponseEntity.ok(Map.of("message", "审核完成"));
    }

    @GetMapping("/questions/template-snapshot")
    public ResponseEntity<?> getQuestionTemplateSnapshot(@RequestParam String fileUrl) {
        if (!StringUtils.hasText(fileUrl)) {
            return ResponseEntity.badRequest().body(Map.of("message", "模板文件不能为空"));
        }
        return ResponseEntity.ok(excelTemplateGradingService.loadWorkbookSnapshot(fileUrl));
    }

    @PostMapping("/questions")
    public ResponseEntity<?> createQuestion(@RequestBody AdminQuestionRequest request) {
        if (request.getTitle() == null || request.getTitle().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("message", "题目内容不能为空"));
        }

        request.setType("excel_template");
        ResponseEntity<?> validationError = validateExcelTemplateRequest(request);
        if (validationError != null) {
            return validationError;
        }

        Question question = buildQuestionEntity(request, new Question());
        questionService.save(question);
        QuestionExcelTemplate template = buildQuestionExcelTemplate(question.getId(), request, new QuestionExcelTemplate());
        questionExcelTemplateService.save(template);
        practiceCampaignService.syncCampaignCatalog();
        return ResponseEntity.ok(buildAdminQuestionResponse(question, template));
    }

    @PutMapping("/questions/{id}")
    public ResponseEntity<?> updateQuestion(@PathVariable Long id, @RequestBody AdminQuestionRequest request) {
        Question existing = questionService.getById(id);
        if (existing == null) {
            return ResponseEntity.notFound().build();
        }
        QuestionExcelTemplate existingTemplate = questionExcelTemplateService.getByQuestionId(id);
        request.setType("excel_template");
        if (!StringUtils.hasText(request.getTemplateFileUrl()) && existingTemplate != null) {
            request.setTemplateFileUrl(existingTemplate.getTemplateFileUrl());
        }
        if (!StringUtils.hasText(request.getAnswerSheet()) && existingTemplate != null) {
            request.setAnswerSheet(existingTemplate.getAnswerSheet());
        }
        if (!StringUtils.hasText(request.getAnswerRange()) && existingTemplate != null) {
            request.setAnswerRange(existingTemplate.getAnswerRange());
        }
        if (!StringUtils.hasText(request.getAnswerSnapshotJson()) && existingTemplate != null) {
            request.setAnswerSnapshotJson(existingTemplate.getAnswerSnapshotJson());
        }
        if (request.getCheckFormula() == null && existingTemplate != null) {
            request.setCheckFormula(existingTemplate.getCheckFormula());
        }
        if (request.getSheetCountLimit() == null && existingTemplate != null) {
            request.setSheetCountLimit(existingTemplate.getSheetCountLimit());
        }
        if (request.getVersion() == null && existingTemplate != null) {
            request.setVersion(existingTemplate.getVersion());
        }
        ResponseEntity<?> validationError = validateExcelTemplateRequest(request);
        if (validationError != null) {
            return validationError;
        }

        Question updatedQuestion = buildQuestionEntity(request, existing);
        updatedQuestion.setId(id);
        questionService.updateById(updatedQuestion);

        QuestionExcelTemplate template = buildQuestionExcelTemplate(
                id,
                request,
                Objects.requireNonNullElseGet(existingTemplate, QuestionExcelTemplate::new)
        );
        questionExcelTemplateService.saveOrUpdate(template);
        practiceCampaignService.syncCampaignCatalog();
        return ResponseEntity.ok(buildAdminQuestionResponse(updatedQuestion, template));
    }

    @DeleteMapping("/questions/{id}")
    public ResponseEntity<?> deleteQuestion(@PathVariable Long id) {
        questionExcelTemplateService.removeByQuestionId(id);
        questionService.removeById(id);
        practiceCampaignService.syncCampaignCatalog();
        return ResponseEntity.ok(Map.of("message", "题目已删除"));
    }

    @GetMapping("/practice-campaign/levels")
    public ResponseEntity<?> getPracticeCampaignLevels() {
        practiceCampaignService.syncCampaignCatalog();
        QueryWrapper<PracticeLevel> levelQuery = new QueryWrapper<>();
        levelQuery.eq("enabled", true).orderByAsc("chapter_id").orderByAsc("sort_order").orderByAsc("id");
        List<Map<String, Object>> records = practiceLevelMapper.selectList(levelQuery).stream().map(level -> {
            PracticeChapter chapter = practiceChapterMapper.selectById(level.getChapterId());
            Question question = questionService.getById(level.getQuestionId());
            Map<String, Object> item = new HashMap<>();
            item.put("id", level.getId());
            item.put("title", defaultText(level.getTitle(), question == null ? "未命名关卡" : question.getTitle()));
            item.put("chapterId", level.getChapterId());
            item.put("chapterName", chapter == null ? "-" : chapter.getName());
            item.put("questionId", level.getQuestionId());
            item.put("questionTitle", question == null ? "-" : question.getTitle());
            item.put("difficulty", defaultText(level.getDifficulty(), "easy"));
            item.put("levelType", defaultText(level.getLevelType(), "normal"));
            item.put("targetTimeSeconds", safeInt(level.getTargetTimeSeconds()));
            item.put("rewardExp", safeInt(level.getRewardExp()));
            item.put("rewardPoints", safeInt(level.getRewardPoints()));
            item.put("firstPassBonus", safeInt(level.getFirstPassBonus()));
            item.put("enabled", level.getEnabled() == null || level.getEnabled());
            return item;
        }).toList();
        return ResponseEntity.ok(Map.of("records", records));
    }

    @PutMapping("/practice-campaign/levels/{id}")
    public ResponseEntity<?> updatePracticeCampaignLevel(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        PracticeLevel level = practiceLevelMapper.selectById(id);
        if (level == null) {
            return ResponseEntity.notFound().build();
        }
        String levelType = body.get("levelType") == null ? level.getLevelType() : String.valueOf(body.get("levelType")).trim();
        String difficulty = body.get("difficulty") == null ? level.getDifficulty() : String.valueOf(body.get("difficulty")).trim();
        Integer targetTimeSeconds = body.get("targetTimeSeconds") == null ? level.getTargetTimeSeconds() : parseInteger(body.get("targetTimeSeconds"));
        Integer rewardExp = body.get("rewardExp") == null ? level.getRewardExp() : parseInteger(body.get("rewardExp"));
        Integer rewardPoints = body.get("rewardPoints") == null ? level.getRewardPoints() : parseInteger(body.get("rewardPoints"));
        Integer firstPassBonus = body.get("firstPassBonus") == null ? level.getFirstPassBonus() : parseInteger(body.get("firstPassBonus"));
        Boolean enabled = body.get("enabled") == null ? level.getEnabled() : parseBoolean(body.get("enabled"), true);

        level.setLevelType(defaultText(levelType, "normal"));
        level.setDifficulty(defaultText(difficulty, "easy"));
        level.setTargetTimeSeconds(targetTimeSeconds == null ? 300 : Math.max(30, targetTimeSeconds));
        level.setRewardExp(rewardExp == null ? 10 : Math.max(0, rewardExp));
        level.setRewardPoints(rewardPoints == null ? 5 : Math.max(0, rewardPoints));
        level.setFirstPassBonus(firstPassBonus == null ? 0 : Math.max(0, firstPassBonus));
        level.setEnabled(enabled);
        practiceLevelMapper.updateById(level);
        return ResponseEntity.ok(Map.of("message", "关卡配置已更新"));
    }

    @GetMapping("/practice-campaign/daily-challenge")
    public ResponseEntity<?> getPracticeCampaignDailyChallengeConfig() {
        QueryWrapper<DailyChallenge> queryWrapper = new QueryWrapper<>();
        queryWrapper.orderByDesc("challenge_date").orderByDesc("id").last("limit 1");
        DailyChallenge challenge = dailyChallengeMapper.selectOne(queryWrapper);
        if (challenge == null) {
            return ResponseEntity.ok(Map.of("record", Map.of()));
        }
        PracticeLevel level = practiceLevelMapper.selectById(challenge.getLevelId());
        PracticeChapter chapter = level == null ? null : practiceChapterMapper.selectById(level.getChapterId());
        return ResponseEntity.ok(Map.of("record", Map.of(
                "id", challenge.getId(),
                "challengeDate", challenge.getChallengeDate(),
                "levelId", challenge.getLevelId(),
                "levelTitle", level == null ? "-" : defaultText(level.getTitle(), "未命名关卡"),
                "chapterName", chapter == null ? "-" : chapter.getName(),
                "rewardExp", safeInt(challenge.getRewardExp()),
                "rewardPoints", safeInt(challenge.getRewardPoints()),
                "enabled", challenge.getEnabled() == null || challenge.getEnabled()
        )));
    }

    @PutMapping("/practice-campaign/daily-challenge")
    public ResponseEntity<?> savePracticeCampaignDailyChallenge(@RequestBody Map<String, Object> body) {
        Long levelId = parseLong(body.get("levelId"));
        LocalDate challengeDate = parseLocalDate(body.get("challengeDate"));
        if (levelId == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "请选择每日挑战关卡"));
        }
        if (challengeDate == null) {
            challengeDate = LocalDate.now();
        }
        PracticeLevel level = practiceLevelMapper.selectById(levelId);
        if (level == null || !Boolean.TRUE.equals(level.getEnabled())) {
            return ResponseEntity.badRequest().body(Map.of("message", "所选关卡不存在或未启用"));
        }
        QueryWrapper<DailyChallenge> queryWrapper = new QueryWrapper<>();
        queryWrapper.eq("challenge_date", challengeDate).last("limit 1");
        DailyChallenge challenge = dailyChallengeMapper.selectOne(queryWrapper);
        if (challenge == null) {
            challenge = new DailyChallenge();
            challenge.setChallengeDate(challengeDate);
        }
        challenge.setLevelId(levelId);
        challenge.setRewardExp(parseInteger(body.get("rewardExp"), safeInt(level.getRewardExp())));
        challenge.setRewardPoints(parseInteger(body.get("rewardPoints"), safeInt(level.getRewardPoints())));
        challenge.setEnabled(parseBoolean(body.get("enabled"), true));
        if (challenge.getId() == null) {
            dailyChallengeMapper.insert(challenge);
        } else {
            dailyChallengeMapper.updateById(challenge);
        }
        return ResponseEntity.ok(Map.of("message", "每日挑战已更新"));
    }

    @GetMapping("/notifications")
    public ResponseEntity<?> getNotifications(
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "10") Integer size) {
        return ResponseEntity.ok(siteNotificationService.getNotificationsPage(page, size));
    }

    @GetMapping("/notifications/stats")
    public ResponseEntity<?> getNotificationStats() {
        return ResponseEntity.ok(siteNotificationService.getStats());
    }

    @PostMapping("/notifications")
    public ResponseEntity<?> createNotification(@RequestBody Map<String, Object> body, @RequestAttribute("userId") Long userId) {
        SiteNotification notification = buildSiteNotification(body, new SiteNotification());
        if (notification.getTitle() == null || notification.getTitle().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("message", "标题不能为空"));
        }
        if (notification.getContent() == null || notification.getContent().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("message", "内容不能为空"));
        }
        
        notification.setCreatedBy(userId);
        notification.setReadCount(0);
        
        if ("sent".equals(notification.getStatus())) {
            notification.setSendTime(java.time.LocalDateTime.now());
        }
        
        siteNotificationService.save(notification);
        
        if ("sent".equals(notification.getStatus())) {
            siteNotificationService.sendNotification(notification.getId());
        }
        
        return ResponseEntity.ok(notification);
    }

    @PutMapping("/notifications/{id}")
    public ResponseEntity<?> updateNotification(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        SiteNotification existing = siteNotificationService.getById(id);
        if (existing == null) {
            return ResponseEntity.notFound().build();
        }
        String previousStatus = existing.getStatus();
        SiteNotification notification = buildSiteNotification(body, existing);
        notification.setId(id);
        siteNotificationService.updateById(notification);
        if (!"sent".equals(previousStatus) && "sent".equals(notification.getStatus())) {
            siteNotificationService.sendNotification(id);
            notification = siteNotificationService.getById(id);
        }
        return ResponseEntity.ok(notification);
    }

    @PutMapping("/notifications/{id}/send")
    public ResponseEntity<?> sendNotification(@PathVariable Long id) {
        SiteNotification notification = siteNotificationService.getById(id);
        if (notification == null) {
            return ResponseEntity.notFound().build();
        }
        siteNotificationService.sendNotification(id);
        return ResponseEntity.ok(Map.of("message", "发送成功"));
    }

    @DeleteMapping("/notifications/{id}")
    public ResponseEntity<?> deleteNotification(@PathVariable Long id) {
        siteNotificationService.removeById(id);
        return ResponseEntity.ok(Map.of("message", "通知已删除"));
    }

    private SiteNotification buildSiteNotification(Map<String, Object> body, SiteNotification notification) {
        notification.setTitle(stringValue(body.get("title")));
        notification.setContent(htmlSanitizer.sanitize(stringValue(body.get("content"))));
        notification.setType(defaultValue(stringValue(body.get("type")), "system"));
        notification.setStatus(defaultValue(stringValue(body.get("status")), "draft"));
        notification.setTargetType(defaultValue(stringValue(body.get("targetType")), "all"));
        notification.setTargetRoles("role".equals(notification.getTargetType()) ? normalizeTargetRoles(body.get("targetRoles")) : null);
        notification.setAttachments(stringValue(body.get("attachments")));

        if ("sent".equals(notification.getStatus())) {
            if (notification.getSendTime() == null) {
                notification.setSendTime(java.time.LocalDateTime.now());
            }
        } else {
            notification.setSendTime(null);
        }

        return notification;
    }

    private ResponseEntity<?> validateExcelTemplateRequest(AdminQuestionRequest request) {
        if (!StringUtils.hasText(request.getTemplateFileUrl())) {
            return ResponseEntity.badRequest().body(Map.of("message", "Excel 模板文件不能为空"));
        }
        try {
            excelTemplateGradingService.validateAnswerArea(request.getTemplateFileUrl(), request.getAnswerSheet(), request.getAnswerRange());
            String normalizedAnswerSnapshot = excelTemplateGradingService.normalizeAnswerSnapshotJson(
                    request.getTemplateFileUrl(),
                    request.getAnswerSheet(),
                    request.getAnswerRange(),
                    request.getCheckFormula(),
                    request.getAnswerSnapshotJson()
            );
            request.setAnswerSnapshotJson(normalizedAnswerSnapshot);
            request.setGradingRuleJson(excelTemplateGradingService.buildRuleJson(
                    request.getTemplateFileUrl(),
                    request.getAnswerSheet(),
                    request.getAnswerRange(),
                    request.getCheckFormula(),
                    request.getGradingRuleJson()
            ));
            request.setExpectedSnapshotJson(excelTemplateGradingService.buildExpectedSnapshotJson(
                    request.getTemplateFileUrl(),
                    request.getAnswerSheet(),
                    request.getAnswerRange(),
                    request.getCheckFormula(),
                    normalizedAnswerSnapshot,
                    request.getGradingRuleJson(),
                    request.getExpectedSnapshotJson()
            ));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
        return null;
    }

    private Question buildQuestionEntity(AdminQuestionRequest request, Question target) {
        if (request.getTitle() != null) {
            target.setTitle(request.getTitle());
        }
        if (request.getType() != null) {
            target.setType(request.getType());
        }
        if (request.getCategoryId() != null || target.getId() == null) {
            target.setCategoryId(request.getCategoryId());
        }
        if (request.getQuestionCategoryId() != null || target.getId() == null) {
            target.setQuestionCategoryId(request.getQuestionCategoryId());
        }
        if (request.getDifficulty() != null || target.getId() == null) {
            target.setDifficulty(request.getDifficulty());
        }
        if (request.getPoints() != null || target.getId() == null) {
            target.setPoints(request.getPoints());
        }
        if (request.getExplanation() != null || target.getId() == null) {
            target.setExplanation(request.getExplanation());
        }
        if (request.getEnabled() != null || target.getId() == null) {
            target.setEnabled(request.getEnabled() == null || request.getEnabled());
        }
        target.setOptions(null);
        target.setAnswer("");
        return target;
    }

    private QuestionExcelTemplate buildQuestionExcelTemplate(Long questionId, AdminQuestionRequest request, QuestionExcelTemplate target) {
        target.setQuestionId(questionId);
        target.setTemplateFileUrl(request.getTemplateFileUrl());
        target.setAnswerSheet(request.getAnswerSheet());
        target.setAnswerRange(request.getAnswerRange());
        target.setAnswerSnapshotJson(request.getAnswerSnapshotJson());
        target.setCheckFormula(Boolean.TRUE.equals(request.getCheckFormula()));
        target.setGradingRuleJson(excelTemplateGradingService.normalizeRuleJson(request.getGradingRuleJson()));
        target.setExpectedSnapshotJson(request.getExpectedSnapshotJson());
        target.setSheetCountLimit(request.getSheetCountLimit() == null || request.getSheetCountLimit() < 1 ? 5 : request.getSheetCountLimit());
        target.setVersion(request.getVersion() == null || request.getVersion() < 1 ? 1 : request.getVersion());
        return target;
    }

    private Map<String, Object> buildAdminQuestionResponse(Question question, QuestionExcelTemplate template) {
        Map<String, Object> response = new HashMap<>();
        QuestionCategory questionCategory = question.getQuestionCategoryId() == null
                ? null
                : questionCategoryService.getById(question.getQuestionCategoryId());
        response.put("id", question.getId());
        response.put("title", question.getTitle());
        response.put("type", question.getType());
        response.put("categoryId", question.getCategoryId());
        response.put("questionCategoryId", question.getQuestionCategoryId());
        response.put("questionCategoryName", questionCategory == null ? null : questionCategory.getName());
        response.put("options", question.getOptions());
        response.put("answer", question.getAnswer());
        response.put("difficulty", question.getDifficulty());
        response.put("points", question.getPoints());
        response.put("explanation", question.getExplanation());
        response.put("enabled", question.getEnabled());
        response.put("createTime", question.getCreateTime());
        response.put("updateTime", question.getUpdateTime());
        if (template != null) {
            response.put("templateFileUrl", template.getTemplateFileUrl());
            response.put("answerSheet", template.getAnswerSheet());
            response.put("answerRange", template.getAnswerRange());
            response.put("answerSnapshotJson", template.getAnswerSnapshotJson());
            response.put("checkFormula", template.getCheckFormula());
            response.put("gradingRuleJson", template.getGradingRuleJson());
            response.put("expectedSnapshotJson", template.getExpectedSnapshotJson());
            response.put("sheetCountLimit", template.getSheetCountLimit());
            response.put("version", template.getVersion());
            response.put("gradingRuleSummary", excelTemplateGradingService.buildRuleSummary(template.getGradingRuleJson()));
        }
        return response;
    }

    private Map<String, Object> buildQuestionCategoryResponse(QuestionCategory category) {
        Map<String, Object> response = new HashMap<>();
        response.put("id", category.getId());
        response.put("name", category.getName());
        response.put("description", category.getDescription());
        response.put("groupName", category.getGroupName());
        response.put("sortOrder", category.getSortOrder());
        response.put("enabled", category.getEnabled());
        response.put("questionCount", category.getQuestionCount() == null ? 0 : category.getQuestionCount());
        response.put("createTime", category.getCreateTime());
        response.put("updateTime", category.getUpdateTime());
        return response;
    }

    private QuestionCategory ensureUserSubmissionQuestionCategory() {
        QuestionCategory category = questionCategoryService.getOne(new QueryWrapper<QuestionCategory>()
                .eq("name", USER_SUBMISSION_CATEGORY_NAME)
                .last("LIMIT 1"), false);
        if (category != null) {
            return category;
        }
        QuestionCategory created = new QuestionCategory();
        created.setName(USER_SUBMISSION_CATEGORY_NAME);
        created.setDescription("统一收纳用户投稿并审核通过的练习题。");
        created.setGroupName(USER_SUBMISSION_CATEGORY_GROUP);
        created.setSortOrder(999);
        created.setEnabled(true);
        questionCategoryService.save(created);
        return created;
    }

    private String normalizeTargetRoles(Object rawTargetRoles) {
        if (rawTargetRoles == null) {
            return null;
        }
        if (rawTargetRoles instanceof String value) {
            String normalized = value.trim();
            return normalized.isEmpty() ? null : normalized;
        }
        if (rawTargetRoles instanceof Collection<?> values) {
            String normalized = values.stream()
                    .map(value -> value == null ? null : value.toString().trim())
                    .filter(value -> value != null && !value.isEmpty())
                    .collect(Collectors.joining(","));
            return normalized.isEmpty() ? null : normalized;
        }
        String normalized = rawTargetRoles.toString().trim();
        return normalized.isEmpty() ? null : normalized;
    }

    private String stringValue(Object value) {
        if (value == null) {
            return null;
        }
        String text = value.toString().trim();
        return text.isEmpty() ? null : text;
    }

    private String defaultValue(String value, String fallback) {
        return value != null ? value : fallback;
    }

    private Map<String, Object> buildAdminDraftResponse(PostDraft draft) {
        Map<String, Object> response = new HashMap<>();
        response.put("id", draft.getId());
        response.put("userId", draft.getUserId());
        response.put("title", draft.getTitle());
        response.put("content", draft.getContent());
        response.put("categoryId", draft.getCategoryId());
        response.put("status", draft.getStatus());
        response.put("rewardPoints", draft.getRewardPoints());
        response.put("attachments", draft.getAttachments());
        response.put("tags", draft.getTags());
        response.put("createTime", draft.getCreateTime());
        response.put("updateTime", draft.getUpdateTime());
        response.put("expireTime", resolveDraftExpireTime(draft));
        response.put("expired", isDraftExpired(draft));

        User author = userService.getById(draft.getUserId());
        if (author != null) {
            Map<String, Object> authorMap = new HashMap<>();
            authorMap.put("id", author.getId());
            authorMap.put("username", author.getUsername());
            authorMap.put("avatar", author.getAvatar());
            authorMap.put("role", author.getRole());
            response.put("author", authorMap);
        }

        Category category = draft.getCategoryId() != null ? categoryService.getById(draft.getCategoryId()) : null;
        if (category != null) {
            Map<String, Object> categoryMap = new HashMap<>();
            categoryMap.put("id", category.getId());
            categoryMap.put("name", category.getName());
            response.put("category", categoryMap);
        }

        return response;
    }

    private java.time.LocalDateTime resolveDraftExpireTime(PostDraft draft) {
        java.time.LocalDateTime baseTime = draft.getUpdateTime() != null ? draft.getUpdateTime() : draft.getCreateTime();
        if (baseTime == null) {
            return null;
        }
        return baseTime.plusDays(PostDraftService.DRAFT_EXPIRE_DAYS);
    }

    private boolean isDraftExpired(PostDraft draft) {
        java.time.LocalDateTime expireTime = resolveDraftExpireTime(draft);
        return expireTime != null && !expireTime.isAfter(java.time.LocalDateTime.now());
    }

    private List<ExperienceProperties.LevelRule> getSortedLevelRules() {
        List<ExperienceLevelRule> configuredRules = experienceLevelRuleService.listEnabledRules();
        if (!configuredRules.isEmpty()) {
            return configuredRules.stream()
                    .map(this::toLevelRule)
                    .sorted(Comparator.comparingInt(rule -> safeInt(rule.getThreshold())))
                    .collect(Collectors.toList());
        }
        return experienceProperties.getLevels().stream()
                .sorted(Comparator.comparingInt(rule -> safeInt(rule.getThreshold())))
                .collect(Collectors.toList());
    }

    private ExperienceProperties.LevelRule toLevelRule(ExperienceLevelRule source) {
        ExperienceProperties.LevelRule item = new ExperienceProperties.LevelRule();
        item.setLevel(source.getLevel());
        item.setName(source.getName());
        item.setThreshold(source.getThreshold());
        return item;
    }

    private Map<String, Object> buildLevelUserResponse(User user) {
        Map<String, Object> response = new HashMap<>();
        response.put("id", user.getId());
        response.put("username", user.getUsername());
        response.put("avatar", user.getAvatar());
        response.put("role", user.getRole());
        response.put("status", user.getStatus());
        response.put("level", safeInt(user.getLevel()));
        response.put("levelName", resolveLevelName(safeInt(user.getLevel())));
        response.put("exp", safeInt(user.getExp()));
        response.put("points", safeInt(user.getPoints()));
        response.put("createTime", user.getCreateTime());
        response.put("progress", experienceService.getProgress(user.getExp()));
        return response;
    }

    private Map<String, Object> buildLevelLogResponse(UserExpLog log, User user) {
        Map<String, Object> response = new HashMap<>();
        response.put("id", log.getId());
        response.put("bizType", log.getBizType());
        response.put("bizLabel", mapExpRuleLabel(log.getBizType()));
        response.put("bizId", log.getBizId());
        response.put("expChange", safeInt(log.getExpChange()));
        response.put("reason", log.getReason());
        response.put("createTime", log.getCreateTime());

        if (user != null) {
            Map<String, Object> userMap = new HashMap<>();
            userMap.put("id", user.getId());
            userMap.put("username", user.getUsername());
            userMap.put("avatar", user.getAvatar());
            userMap.put("level", safeInt(user.getLevel()));
            userMap.put("exp", safeInt(user.getExp()));
            response.put("user", userMap);
        }

        return response;
    }

    private Map<String, Object> buildExpRuleResponse(ExperienceRule rule) {
        Map<String, Object> item = new HashMap<>();
        item.put("id", rule.getId());
        item.put("key", rule.getRuleKey());
        item.put("label", defaultText(rule.getName(), mapExpRuleLabel(rule.getRuleKey())));
        item.put("description", rule.getDescription());
        item.put("minExp", safeInt(rule.getMinExp()));
        item.put("maxExp", safeInt(rule.getMaxExp()));
        item.put("enabled", rule.getEnabled() == null || rule.getEnabled());
        item.put("maxObtainCount", rule.getMaxObtainCount());
        item.put("rangeText", safeInt(rule.getMinExp()) == safeInt(rule.getMaxExp())
                ? "+" + safeInt(rule.getMinExp()) + " 经验"
                : safeInt(rule.getMinExp()) + "-" + safeInt(rule.getMaxExp()) + " 经验");
        return item;
    }

    private Map<String, Object> buildLevelRuleResponse(ExperienceLevelRule rule) {
        Map<String, Object> item = new HashMap<>();
        item.put("id", rule.getId());
        item.put("level", safeInt(rule.getLevel()));
        item.put("name", defaultText(rule.getName(), "未命名等级"));
        item.put("threshold", safeInt(rule.getThreshold()));
        item.put("enabled", rule.getEnabled() == null || rule.getEnabled());
        item.put("sortOrder", safeInt(rule.getSortOrder()));
        item.put("rangeText", "达到 " + safeInt(rule.getThreshold()) + " 经验");
        return item;
    }

    private String resolveLevelName(int level) {
        return getSortedLevelRules().stream()
                .filter(rule -> safeInt(rule.getLevel()) == level)
                .map(ExperienceProperties.LevelRule::getName)
                .findFirst()
                .orElse("未命名等级");
    }

    private ResponseEntity<?> validateLevelThreshold(Integer level, Integer threshold, Long excludedId) {
        ExperienceLevelRule previousRule = experienceLevelRuleService.listOrderedRules().stream()
                .filter(rule -> !Objects.equals(rule.getId(), excludedId))
                .filter(rule -> safeInt(rule.getLevel()) < safeInt(level))
                .max(Comparator.comparingInt(rule -> safeInt(rule.getLevel())))
                .orElse(null);
        if (previousRule != null && threshold < safeInt(previousRule.getThreshold())) {
            return ResponseEntity.badRequest().body(Map.of(
                    "message", "等级阈值不能小于上一等级的经验阈值",
                    "previousLevel", safeInt(previousRule.getLevel()),
                    "previousThreshold", safeInt(previousRule.getThreshold())
            ));
        }

        ExperienceLevelRule nextRule = experienceLevelRuleService.listOrderedRules().stream()
                .filter(rule -> !Objects.equals(rule.getId(), excludedId))
                .filter(rule -> safeInt(rule.getLevel()) > safeInt(level))
                .min(Comparator.comparingInt(rule -> safeInt(rule.getLevel())))
                .orElse(null);
        if (nextRule != null && threshold > safeInt(nextRule.getThreshold())) {
            return ResponseEntity.badRequest().body(Map.of(
                    "message", "等级阈值不能大于下一等级的经验阈值",
                    "nextLevel", safeInt(nextRule.getLevel()),
                    "nextThreshold", safeInt(nextRule.getThreshold())
            ));
        }
        return null;
    }

    private int recalculateAllLevels() {
        List<User> users = userService.list(new QueryWrapper<User>().select("id", "level", "exp"));
        int updated = 0;

        for (User user : users) {
            Map<String, Object> progress = experienceService.getProgress(user.getExp());
            int expectedLevel = safeInt(progress.get("level"));
            if (!Objects.equals(user.getLevel(), expectedLevel)) {
                User updatedUser = new User();
                updatedUser.setId(user.getId());
                updatedUser.setLevel(expectedLevel);
                userService.updateById(updatedUser);
                updated += 1;
            }
        }
        return updated;
    }

    private String mapExpRuleLabel(String ruleKey) {
        if (ruleKey == null || ruleKey.isBlank()) {
            return "未知来源";
        }
        return switch (ruleKey) {
            case ExperienceService.BIZ_POST_DIRECT_PUBLISH -> "直接发帖";
            case ExperienceService.BIZ_POST_APPROVED -> "帖子过审";
            case ExperienceService.BIZ_REPLY_CREATE -> "发布回复";
            case ExperienceService.BIZ_DAILY_CHECKIN -> "每日签到";
            case ExperienceService.BIZ_PRACTICE_COMPLETE -> "完成练习";
            default -> ruleKey;
        };
    }

    private ResponseEntity<?> validatePointsRule(PointsRule rule, Long currentId) {
        if (rule == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "规则参数不能为空"));
        }
        if (rule.getName() == null || rule.getName().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("message", "规则名称不能为空"));
        }
        if (rule.getPoints() == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "积分值不能为空"));
        }
        String effectiveType = StringUtils.hasText(rule.getType()) ? rule.getType().trim() : "daily";
        if (pointsRuleOptionService.getByKindAndValue(POINTS_OPTION_KIND_TYPE, effectiveType) == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "请选择有效的规则类型"));
        }
        if (rule.getTaskKey() != null && !rule.getTaskKey().isBlank()) {
            String normalizedTaskKey = rule.getTaskKey().trim();
            if (pointsRuleOptionService.getByKindAndValue(POINTS_OPTION_KIND_TASK_KEY, normalizedTaskKey) == null) {
                return ResponseEntity.badRequest().body(Map.of("message", "请选择有效的任务类型"));
            }
            QueryWrapper<PointsRule> queryWrapper = new QueryWrapper<>();
            queryWrapper.eq("task_key", normalizedTaskKey);
            if (currentId != null) {
                queryWrapper.ne("id", currentId);
            }
            if (pointsRuleService.count(queryWrapper) > 0) {
                return ResponseEntity.badRequest().body(Map.of("message", "任务标识已存在"));
            }
        }
        return null;
    }

    private ResponseEntity<?> validatePointsRuleOption(PointsRuleOption option, Long currentId) {
        if (option == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "选项参数不能为空"));
        }
        String normalizedKind = option.getKind() == null ? "" : option.getKind().trim().toLowerCase();
        if (!POINTS_OPTION_KIND_TYPE.equals(normalizedKind) && !POINTS_OPTION_KIND_TASK_KEY.equals(normalizedKind)) {
            return ResponseEntity.badRequest().body(Map.of("message", "选项分类不合法"));
        }
        String normalizedValue = option.getOptionValue() == null ? "" : option.getOptionValue().trim().toLowerCase();
        if (normalizedValue.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("message", "标识值不能为空"));
        }
        if (!normalizedValue.matches("^[a-z0-9_-]+$")) {
            return ResponseEntity.badRequest().body(Map.of("message", "标识值仅支持小写字母、数字、下划线和短横线"));
        }
        String normalizedLabel = option.getLabel() == null ? "" : option.getLabel().trim();
        if (normalizedLabel.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("message", "显示名称不能为空"));
        }
        QueryWrapper<PointsRuleOption> queryWrapper = new QueryWrapper<>();
        queryWrapper.eq("kind", normalizedKind).eq("option_value", normalizedValue);
        if (currentId != null) {
            queryWrapper.ne("id", currentId);
        }
        if (pointsRuleOptionService.count(queryWrapper) > 0) {
            return ResponseEntity.badRequest().body(Map.of("message", "同类标识值已存在"));
        }
        return null;
    }

    private void applyPointsRuleDefaults(PointsRule rule) {
        if (rule.getTaskKey() != null) {
            String normalizedTaskKey = rule.getTaskKey().trim();
            rule.setTaskKey(normalizedTaskKey.isEmpty() ? null : normalizedTaskKey);
        }
        if (rule.getType() == null || rule.getType().isBlank()) {
            rule.setType("daily");
        }
        if (rule.getEnabled() == null) {
            rule.setEnabled(true);
        }
        if (rule.getUserVisible() == null) {
            rule.setUserVisible(true);
        }
        if (rule.getSortOrder() == null) {
            rule.setSortOrder(0);
        }
    }

    private void normalizePointsRuleOption(PointsRuleOption option) {
        option.setKind(option.getKind() == null ? null : option.getKind().trim().toLowerCase());
        option.setOptionValue(option.getOptionValue() == null ? null : option.getOptionValue().trim().toLowerCase());
        option.setLabel(option.getLabel() == null ? null : option.getLabel().trim());
        if (option.getSortOrder() == null) {
            option.setSortOrder(0);
        }
    }

    private List<Map<String, Object>> buildPointsRuleOptionResponses(String kind) {
        return pointsRuleOptionService.listByKind(kind).stream()
                .map(this::buildPointsRuleOptionResponse)
                .toList();
    }

    private Map<String, Object> buildPointsRuleOptionResponse(PointsRuleOption option) {
        Map<String, Object> item = new HashMap<>();
        item.put("id", option.getId());
        item.put("kind", option.getKind());
        item.put("value", option.getOptionValue());
        item.put("label", option.getLabel());
        item.put("sortOrder", safeInt(option.getSortOrder()));
        item.put("usageCount", countPointsRulesUsingOption(option.getKind(), option.getOptionValue()));
        item.put("createTime", option.getCreateTime());
        item.put("updateTime", option.getUpdateTime());
        return item;
    }

    private long countPointsRulesUsingOption(String kind, String optionValue) {
        if (!StringUtils.hasText(kind) || !StringUtils.hasText(optionValue)) {
            return 0L;
        }
        QueryWrapper<PointsRule> queryWrapper = new QueryWrapper<>();
        if (POINTS_OPTION_KIND_TYPE.equals(kind)) {
            queryWrapper.eq("type", optionValue);
        } else if (POINTS_OPTION_KIND_TASK_KEY.equals(kind)) {
            queryWrapper.eq("task_key", optionValue);
        } else {
            return 0L;
        }
        return pointsRuleService.count(queryWrapper);
    }

    private int extractStatValue(Map<String, Object> source, String key) {
        if (source == null || !source.containsKey(key)) {
            return 0;
        }
        return safeInt(source.get(key));
    }

    private int safeInt(Integer value) {
        return value == null ? 0 : value;
    }

    private int safeInt(Object value) {
        if (value instanceof Number number) {
            return number.intValue();
        }
        return 0;
    }

    private String defaultText(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value;
    }

    private Integer parseInteger(Object value) {
        if (value instanceof Number number) {
            return number.intValue();
        }
        if (value instanceof String text && !text.isBlank()) {
            try {
                return Integer.parseInt(text.trim());
            } catch (NumberFormatException ignored) {
                return null;
            }
        }
        return null;
    }

    private Integer parseInteger(Object value, int defaultValue) {
        Integer parsed = parseInteger(value);
        return parsed == null ? defaultValue : parsed;
    }

    private Long parseLong(Object value) {
        if (value instanceof Number number) {
            return number.longValue();
        }
        if (value instanceof String text && !text.isBlank()) {
            try {
                return Long.parseLong(text.trim());
            } catch (NumberFormatException ignored) {
                return null;
            }
        }
        return null;
    }

    private LocalDate parseLocalDate(Object value) {
        if (value instanceof LocalDate localDate) {
            return localDate;
        }
        if (value instanceof String text && !text.isBlank()) {
            try {
                return LocalDate.parse(text.trim());
            } catch (Exception ignored) {
                return null;
            }
        }
        return null;
    }

    private boolean parseBoolean(Object value, boolean defaultValue) {
        if (value instanceof Boolean flag) {
            return flag;
        }
        if (value instanceof String text && !text.isBlank()) {
            return Boolean.parseBoolean(text.trim());
        }
        return defaultValue;
    }

    private Set<Long> collectReplyIdsForUserDeletion(Long userId, Set<Long> userPostIds) {
        Set<Long> replyIds = replyService.list(new QueryWrapper<Reply>()
                        .eq("user_id", userId)
                        .select("id"))
                .stream()
                .map(Reply::getId)
                .filter(Objects::nonNull)
                .collect(Collectors.toCollection(LinkedHashSet::new));
        if (!userPostIds.isEmpty()) {
            replyIds.addAll(replyService.list(new QueryWrapper<Reply>()
                            .in("post_id", userPostIds)
                            .select("id"))
                    .stream()
                    .map(Reply::getId)
                    .filter(Objects::nonNull)
                    .toList());
        }
        return replyIds;
    }

    private void cleanupPostAndReplyReferences(Collection<Long> postIds, Collection<Long> replyIds) {
        if (postIds != null && !postIds.isEmpty()) {
            likeService.remove(new QueryWrapper<Like>().eq("target_type", "post").in("target_id", postIds));
            favoriteService.remove(new QueryWrapper<Favorite>().in("post_id", postIds));
            postViewService.remove(new QueryWrapper<PostView>().in("post_id", postIds));
            reportService.remove(new QueryWrapper<Report>().eq("target_type", "post").in("target_id", postIds));
            postEditHistoryMapper.delete(new QueryWrapper<PostEditHistory>().in("post_id", postIds));
        }

        if (replyIds != null && !replyIds.isEmpty()) {
            likeService.remove(new QueryWrapper<Like>().eq("target_type", "reply").in("target_id", replyIds));
            reportService.remove(new QueryWrapper<Report>().eq("target_type", "reply").in("target_id", replyIds));
        }

        QueryWrapper<Notification> notificationCleanup = buildNotificationCleanupWrapper(postIds, replyIds);
        if (notificationCleanup != null) {
            notificationService.remove(notificationCleanup);
        }
    }

    private QueryWrapper<Notification> buildNotificationCleanupWrapper(Collection<Long> postIds, Collection<Long> replyIds) {
        boolean hasPosts = postIds != null && !postIds.isEmpty();
        boolean hasReplies = replyIds != null && !replyIds.isEmpty();
        if (!hasPosts && !hasReplies) {
            return null;
        }

        QueryWrapper<Notification> wrapper = new QueryWrapper<>();
        wrapper.and(notification -> {
            if (hasPosts) {
                notification.and(postRelated -> postRelated
                        .in("type", List.of("reply", "like", "favorite", "MENTION", "review_request", "post_deleted", "post_review"))
                        .in("related_id", postIds));
            }
            if (hasReplies) {
                if (hasPosts) {
                    notification.or();
                }
                notification.in("reply_id", replyIds);
            }
        });
        return wrapper;
    }
}
