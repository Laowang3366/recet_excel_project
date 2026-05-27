package com.excel.forum.controller;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.excel.forum.config.ExperienceProperties;
import com.excel.forum.config.GlobalExceptionHandler;
import com.excel.forum.entity.Question;
import com.excel.forum.entity.QuestionCategory;
import com.excel.forum.entity.QuestionExcelTemplate;
import com.excel.forum.mapper.CheckinRecordMapper;
import com.excel.forum.mapper.PracticeAnswerMapper;
import com.excel.forum.mapper.PracticeChapterMapper;
import com.excel.forum.mapper.PracticeRecordMapper;
import com.excel.forum.mapper.PracticeLevelMapper;
import com.excel.forum.entity.SiteNotification;
import com.excel.forum.entity.User;
import com.excel.forum.entity.UserExpLog;
import com.excel.forum.entity.ExperienceLevelRule;
import com.excel.forum.entity.PointsRule;
import com.excel.forum.entity.PointsRuleOption;
import com.excel.forum.entity.ExperienceRule;
import com.excel.forum.util.HtmlSanitizer;
import com.excel.forum.service.ExperienceService;
import com.excel.forum.service.ExperienceLevelRuleService;
import com.excel.forum.service.ExperienceRuleService;
import com.excel.forum.service.FeedbackService;
import com.excel.forum.service.FileRecycleService;
import com.excel.forum.service.NotificationService;
import com.excel.forum.service.PointsRecordService;
import com.excel.forum.service.PointsRuleOptionService;
import com.excel.forum.service.PointsRuleService;
import com.excel.forum.service.PracticeCampaignService;
import com.excel.forum.service.PracticeQuestionSubmissionService;
import com.excel.forum.service.QuestionCategoryService;
import com.excel.forum.service.QuestionExcelTemplateService;
import com.excel.forum.service.QuestionService;
import com.excel.forum.service.SiteNotificationService;
import com.excel.forum.service.UserEntitlementService;
import com.excel.forum.service.UserService;
import com.excel.forum.service.ExcelTemplateGradingService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class AdminManagementControllersTest {

    @Mock
    private UserService userService;

    @Mock
    private FeedbackService feedbackService;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private NotificationService notificationService;

    @Mock
    private PointsRuleService pointsRuleService;

    @Mock
    private PointsRuleOptionService pointsRuleOptionService;

    @Mock
    private PointsRecordService pointsRecordService;

    @Mock
    private QuestionService questionService;

    @Mock
    private QuestionCategoryService questionCategoryService;

    @Mock
    private QuestionExcelTemplateService questionExcelTemplateService;

    @Mock
    private PracticeQuestionSubmissionService practiceQuestionSubmissionService;

    @Mock
    private PracticeCampaignService practiceCampaignService;

    @Mock
    private SiteNotificationService siteNotificationService;

    @Mock
    private ExperienceService experienceService;

    @Mock
    private ExperienceProperties experienceProperties;

    @Mock
    private ExperienceRuleService experienceRuleService;

    @Mock
    private ExperienceLevelRuleService experienceLevelRuleService;

    @Mock
    private ExcelTemplateGradingService excelTemplateGradingService;

    @Mock
    private FileRecycleService fileRecycleService;

    @Mock
    private UserEntitlementService userEntitlementService;

    @Mock
    private PracticeRecordMapper practiceRecordMapper;

    @Mock
    private PracticeAnswerMapper practiceAnswerMapper;

    @Mock
    private PracticeLevelMapper practiceLevelMapper;

    @Mock
    private PracticeChapterMapper practiceChapterMapper;

    @Mock
    private CheckinRecordMapper checkinRecordMapper;

    @Mock
    private HtmlSanitizer htmlSanitizer;

    @Captor
    private ArgumentCaptor<SiteNotification> notificationCaptor;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        lenient().when(htmlSanitizer.sanitize(anyString())).thenAnswer(invocation -> invocation.getArgument(0));
        AdminOverviewController overviewController = new AdminOverviewController(
                userService,
                feedbackService,
                notificationService,
                siteNotificationService,
                questionService,
                questionCategoryService,
                questionExcelTemplateService,
                practiceQuestionSubmissionService,
                pointsRuleService,
                pointsRuleOptionService,
                pointsRecordService,
                experienceService,
                experienceRuleService,
                experienceLevelRuleService,
                userEntitlementService,
                practiceRecordMapper,
                practiceAnswerMapper,
                checkinRecordMapper
        );
        AdminLevelController levelController = new AdminLevelController(
                userService,
                experienceService,
                experienceProperties,
                experienceRuleService,
                experienceLevelRuleService
        );
        AdminPointsController pointsController = new AdminPointsController(
                userService,
                pointsRecordService,
                notificationService,
                pointsRuleService,
                pointsRuleOptionService
        );
        AdminQuestionCategoryController questionCategoryController = new AdminQuestionCategoryController(
                questionCategoryService,
                practiceCampaignService
        );
        AdminQuestionController questionController = new AdminQuestionController(
                questionService,
                questionCategoryService,
                questionExcelTemplateService,
                excelTemplateGradingService,
                practiceCampaignService,
                fileRecycleService
        );
        AdminPracticeReviewController practiceReviewController = new AdminPracticeReviewController(
                practiceQuestionSubmissionService,
                questionCategoryService,
                questionService,
                questionExcelTemplateService,
                notificationService,
                excelTemplateGradingService,
                practiceCampaignService
        );
        AdminPracticeCampaignController practiceCampaignController = new AdminPracticeCampaignController(
                practiceLevelMapper,
                practiceChapterMapper,
                questionService,
                practiceCampaignService
        );
        AdminNotificationController notificationController = new AdminNotificationController(siteNotificationService, htmlSanitizer);
        AdminFeedbackController feedbackController = new AdminFeedbackController(userService, feedbackService, notificationService);
        AdminUserController userController = new AdminUserController(userService, passwordEncoder, notificationService);
        mockMvc = MockMvcBuilders.standaloneSetup(
                        overviewController,
                        levelController,
                        pointsController,
                        questionCategoryController,
                        questionController,
                        practiceReviewController,
                        practiceCampaignController,
                        notificationController,
                        feedbackController,
                        userController
                )
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @Test
    void createNotificationNormalizesRoleArray() throws Exception {
        when(siteNotificationService.save(any(SiteNotification.class))).thenAnswer(invocation -> {
            SiteNotification notification = invocation.getArgument(0);
            notification.setId(8L);
            return true;
        });

        mockMvc.perform(post("/api/admin/notifications")
                        .requestAttr("userId", 3L)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"title":"role-target","type":"system","content":"hello","sendType":"draft","targetType":"role","targetRoles":["user","admin"],"status":"draft"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(8L))
                .andExpect(jsonPath("$.targetRoles").value("user,admin"))
                .andExpect(jsonPath("$.targetType").value("role"));

        verify(siteNotificationService).save(notificationCaptor.capture());
        SiteNotification savedNotification = notificationCaptor.getValue();
        assertThat(savedNotification.getTargetRoles()).isEqualTo("user,admin");
        assertThat(savedNotification.getCreatedBy()).isEqualTo(3L);
        assertThat(savedNotification.getStatus()).isEqualTo("draft");
    }

    @Test
    void grantPointsAllowsManualDeduction() throws Exception {
        User user = new User();
        user.setId(7L);
        user.setUsername("excel_user_82");
        user.setPoints(120);
        User updatedUser = new User();
        updatedUser.setId(7L);
        updatedUser.setUsername("excel_user_82");
        updatedUser.setPoints(100);
        when(userService.findByUsername("excel_user_82")).thenReturn(user);
        when(userService.getById(7L)).thenReturn(updatedUser);

        mockMvc.perform(post("/api/admin/points/grant")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"username":"excel_user_82","points":-20,"reason":"模板兑换扣减"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.points").value(-20))
                .andExpect(jsonPath("$.balance").value(100));

        verify(pointsRecordService).addManualPointsRecord(7L, -20, "模板兑换扣减", null, true);
        verify(notificationService).createNotification(eq(7L), eq("system"), eq("管理员扣减了你 20 积分，原因：模板兑换扣减"), isNull());
    }

    @Test
    void grantPointsStoresBusinessNoAndSkipsNotificationWhenDisabled() throws Exception {
        User user = new User();
        user.setId(7L);
        user.setUsername("excel_user_82");
        user.setPoints(120);
        User updatedUser = new User();
        updatedUser.setId(7L);
        updatedUser.setUsername("excel_user_82");
        updatedUser.setPoints(170);
        when(userService.findByUsername("excel_user_82")).thenReturn(user);
        when(userService.getById(7L)).thenReturn(updatedUser);

        mockMvc.perform(post("/api/admin/points/grant")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"username":"excel_user_82","points":50,"reason":"活动补发积分","businessNo":"ORDER-20260524-018","notifyUser":false}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.points").value(50))
                .andExpect(jsonPath("$.businessNo").value("ORDER-20260524-018"))
                .andExpect(jsonPath("$.notifyUser").value(false));

        verify(pointsRecordService).addManualPointsRecord(7L, 50, "活动补发积分", "ORDER-20260524-018", false);
        verify(notificationService, never()).createNotification(any(), anyString(), anyString(), any());
    }

    @Test
    void createPointsRulePersistsLimitAndValidityWindow() throws Exception {
        PointsRuleOption type = new PointsRuleOption();
        type.setKind("type");
        type.setOptionValue("daily");
        PointsRuleOption taskKey = new PointsRuleOption();
        taskKey.setKind("task_key");
        taskKey.setOptionValue("daily_checkin");
        when(pointsRuleOptionService.getByKindAndValue("type", "daily")).thenReturn(type);
        when(pointsRuleOptionService.getByKindAndValue("task_key", "daily_checkin")).thenReturn(taskKey);
        when(pointsRuleService.count(any(QueryWrapper.class))).thenReturn(0L);
        doAnswer(invocation -> {
            PointsRule rule = invocation.getArgument(0);
            rule.setId(81L);
            return true;
        }).when(pointsRuleService).save(any(PointsRule.class));

        mockMvc.perform(post("/api/admin/points/rules")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"每日签到奖励","description":"每日签到可获得积分","taskKey":"daily_checkin","points":5,"type":"daily","dailyLimit":1,"effectiveAt":"2026-05-25T00:00:00","expiresAt":"2026-06-25T00:00:00","enabled":true,"userVisible":true,"sortOrder":10}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.dailyLimit").value(1));

        ArgumentCaptor<PointsRule> ruleCaptor = ArgumentCaptor.forClass(PointsRule.class);
        verify(pointsRuleService).save(ruleCaptor.capture());
        PointsRule savedRule = ruleCaptor.getValue();
        assertThat(savedRule.getDailyLimit()).isEqualTo(1);
        assertThat(savedRule.getEffectiveAt()).isEqualTo(LocalDateTime.of(2026, 5, 25, 0, 0));
        assertThat(savedRule.getExpiresAt()).isEqualTo(LocalDateTime.of(2026, 6, 25, 0, 0));
    }

    @Test
    void pointsStatsExposeIssuedConsumedAndAnomalyCounts() throws Exception {
        when(userService.count(any(QueryWrapper.class))).thenReturn(12L);
        when(pointsRecordService.getMap(any(QueryWrapper.class)))
                .thenReturn(Map.of("total_points", 9000))
                .thenReturn(Map.of("total_points", 12340))
                .thenReturn(Map.of("total_points", -4800));
        when(pointsRecordService.countManualAnomalyRecords()).thenReturn(2L);

        mockMvc.perform(get("/api/admin/points/stats"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.todayIssued").value(12340))
                .andExpect(jsonPath("$.todayConsumed").value(4800))
                .andExpect(jsonPath("$.anomalyRecords").value(2));
    }

    @Test
    void createUserRejectsInvalidRole() throws Exception {
        mockMvc.perform(post("/api/admin/users")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"username":"new_user","email":"new_user@example.com","password":"Abc12345","role":"owner","status":0}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("用户角色不正确"));

        verify(userService, never()).save(any(User.class));
    }

    @Test
    void updateLevelRulePersistsSortOrder() throws Exception {
        ExperienceLevelRule existing = new ExperienceLevelRule();
        existing.setId(14L);
        existing.setLevel(4);
        existing.setName("实战学员");
        existing.setThreshold(1200);
        existing.setEnabled(true);
        existing.setSortOrder(4);

        when(experienceLevelRuleService.getByLevel(4)).thenReturn(existing);
        when(experienceLevelRuleService.listOrderedRules()).thenReturn(List.of(existing));
        when(userService.list(any(QueryWrapper.class))).thenReturn(List.of());

        mockMvc.perform(put("/api/admin/levels/rules/4")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"实战学员","threshold":1200,"enabled":true,"sortOrder":9}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.sortOrder").value(9));

        ArgumentCaptor<ExperienceLevelRule> ruleCaptor = ArgumentCaptor.forClass(ExperienceLevelRule.class);
        verify(experienceLevelRuleService).updateById(ruleCaptor.capture());
        assertThat(ruleCaptor.getValue().getSortOrder()).isEqualTo(9);
    }

    @Test
    void updateLevelRulePersistsPresentationMetadata() throws Exception {
        ExperienceLevelRule existing = new ExperienceLevelRule();
        existing.setId(17L);
        existing.setLevel(7);
        existing.setName("公式大师");
        existing.setThreshold(8000);
        existing.setEnabled(true);
        existing.setSortOrder(7);

        when(experienceLevelRuleService.getByLevel(7)).thenReturn(existing);
        when(experienceLevelRuleService.listOrderedRules()).thenReturn(List.of(existing));
        when(userService.list(any(QueryWrapper.class))).thenReturn(List.of());

        mockMvc.perform(put("/api/admin/levels/rules/7")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"公式大师","threshold":8000,"maxExp":11999,"iconTone":"blue","benefits":"解锁高阶题库、优先体验新功能","enabled":true,"sortOrder":7}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.maxExp").value(11999))
                .andExpect(jsonPath("$.iconTone").value("blue"))
                .andExpect(jsonPath("$.benefits").value("解锁高阶题库、优先体验新功能"))
                .andExpect(jsonPath("$.rangeText").value("8000-11999 经验"));

        ArgumentCaptor<ExperienceLevelRule> ruleCaptor = ArgumentCaptor.forClass(ExperienceLevelRule.class);
        verify(experienceLevelRuleService).updateById(ruleCaptor.capture());
        assertThat(ruleCaptor.getValue().getMaxExp()).isEqualTo(11999);
        assertThat(ruleCaptor.getValue().getIconTone()).isEqualTo("blue");
        assertThat(ruleCaptor.getValue().getBenefits()).isEqualTo("解锁高阶题库、优先体验新功能");
    }

    @Test
    void getLevelUserDetailReturnsRecentLogs() throws Exception {
        ExperienceLevelRule levelRule = new ExperienceLevelRule();
        levelRule.setLevel(6);
        levelRule.setName("表格达人");
        levelRule.setThreshold(5000);
        levelRule.setEnabled(true);

        User user = new User();
        user.setId(7L);
        user.setUsername("aquan76504");
        user.setLevel(6);
        user.setExp(6240);
        user.setPoints(2450);

        UserExpLog log = new UserExpLog();
        log.setId(31L);
        log.setUserId(7L);
        log.setBizType("manual_adjust");
        log.setExpChange(120);
        log.setReason("管理员调整经验");

        Page<UserExpLog> page = new Page<>(1, 5, 1);
        page.setRecords(List.of(log));

        when(userService.getById(7L)).thenReturn(user);
        when(experienceLevelRuleService.listEnabledRules()).thenReturn(List.of(levelRule));
        when(experienceService.getProgress(6240)).thenReturn(Map.of("level", 6, "levelName", "表格达人"));
        when(experienceService.page(any(Page.class), any(QueryWrapper.class))).thenReturn(page);

        mockMvc.perform(get("/api/admin/levels/users/7"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.user.username").value("aquan76504"))
                .andExpect(jsonPath("$.user.levelName").value("表格达人"))
                .andExpect(jsonPath("$.recentLogs[0].reason").value("管理员调整经验"))
                .andExpect(jsonPath("$.recentLogs[0].expChange").value(120));
    }

    @Test
    void recalculatePreviewCountsAffectedUsersWithoutUpdating() throws Exception {
        User stale = new User();
        stale.setId(1L);
        stale.setLevel(2);
        stale.setExp(6240);
        User current = new User();
        current.setId(2L);
        current.setLevel(3);
        current.setExp(860);

        when(userService.list(any(QueryWrapper.class))).thenReturn(List.of(stale, current));
        when(experienceService.getProgress(6240)).thenReturn(Map.of("level", 6));
        when(experienceService.getProgress(860)).thenReturn(Map.of("level", 3));

        mockMvc.perform(get("/api/admin/levels/recalculate-preview"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.affectedUsers").value(1))
                .andExpect(jsonPath("$.totalUsers").value(2))
                .andExpect(jsonPath("$.estimatedMinutesMin").value(1))
                .andExpect(jsonPath("$.estimatedMinutesMax").value(3));

        verify(userService, never()).updateById(any(User.class));
    }

    @Test
    void getUsersAppliesLevelAndRegistrationDateFilters() throws Exception {
        Page<User> page = new Page<>(1, 10, 0);
        page.setRecords(List.of());
        when(userService.page(any(Page.class), any(QueryWrapper.class))).thenReturn(page);

        mockMvc.perform(get("/api/admin/users")
                        .param("minLevel", "4")
                        .param("startDate", "2026-05-01")
                        .param("endDate", "2026-05-26"))
                .andExpect(status().isOk());

        ArgumentCaptor<QueryWrapper<User>> wrapperCaptor = ArgumentCaptor.forClass(QueryWrapper.class);
        verify(userService).page(any(Page.class), wrapperCaptor.capture());
        String sqlSegment = wrapperCaptor.getValue().getCustomSqlSegment();
        assertThat(sqlSegment).contains("level", "create_time");
    }

    @Test
    void getUsersRejectsInvalidRegistrationDateFilter() throws Exception {
        mockMvc.perform(get("/api/admin/users")
                        .param("startDate", "2026/05/01"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("注册时间格式不正确"));

        verify(userService, never()).page(any(Page.class), any(QueryWrapper.class));
    }

    @Test
    void adminStatsReturnsUserMetricIndicators() throws Exception {
        when(userService.count()).thenReturn(10L);
        when(userService.count(any(QueryWrapper.class)))
                .thenReturn(2L, 1L, 1L, 1L, 1L, 2L, 8L, 4L);
        when(practiceRecordMapper.selectCount(null)).thenReturn(0L);
        when(practiceAnswerMapper.selectCount(null)).thenReturn(0L);
        when(checkinRecordMapper.selectCount(any(QueryWrapper.class))).thenReturn(0L);

        mockMvc.perform(get("/api/admin/stats"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.stats.users.totalGrowthRate").value(25.0))
                .andExpect(jsonPath("$.stats.users.todayGrowthRate").value(-50.0))
                .andExpect(jsonPath("$.stats.users.activeRate").value(20.0))
                .andExpect(jsonPath("$.stats.users.lockedRate").value(10.0))
                .andExpect(jsonPath("$.stats.users.lastWeekTotal").value(8))
                .andExpect(jsonPath("$.stats.users.yesterdayNew").value(4));
    }

    @Test
    void createUserPersistsAdminOnlyProfileFieldsAndNotifyOptions() throws Exception {
        when(userService.count(any(QueryWrapper.class))).thenReturn(0L);
        when(passwordEncoder.encode("Abc12345!")).thenReturn("encoded-password");
        doAnswer(invocation -> {
            User user = invocation.getArgument(0);
            user.setId(31L);
            return true;
        }).when(userService).save(any(User.class));

        mockMvc.perform(post("/api/admin/users")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"username":"new_user","email":"new_user@example.com","password":"Abc12345!","role":"user","status":0,"phone":"13812345678","forceChangePassword":true,"notifyUser":true}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(31L))
                .andExpect(jsonPath("$.phone").value("13812345678"))
                .andExpect(jsonPath("$.forceChangePassword").value(true))
                .andExpect(jsonPath("$.sourceChannel").value("后台创建"));

        ArgumentCaptor<User> userCaptor = ArgumentCaptor.forClass(User.class);
        verify(userService).save(userCaptor.capture());
        User savedUser = userCaptor.getValue();
        assertThat(savedUser.getPhone()).isEqualTo("13812345678");
        assertThat(savedUser.getForceChangePassword()).isTrue();
        assertThat(savedUser.getSourceChannel()).isEqualTo("后台创建");
        verify(notificationService).createNotification(eq(31L), eq("system"), anyString(), isNull());
    }

    @Test
    void updateUserRejectsInvalidStatusType() throws Exception {
        User user = new User();
        user.setId(12L);
        user.setUsername("editor");
        user.setEmail("editor@example.com");
        user.setRole("user");
        user.setStatus(0);
        when(userService.getById(12L)).thenReturn(user);

        mockMvc.perform(put("/api/admin/users/12")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"editor@example.com","role":"user","status":"locked"}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("用户状态不正确"));

        verify(userService, never()).updateById(any(User.class));
    }

    @Test
    void deleteUserRejectsCurrentAdmin() throws Exception {
        User user = new User();
        user.setId(5L);
        user.setUsername("admin");
        user.setStatus(0);
        user.setTokenVersion(2);
        when(userService.getById(5L)).thenReturn(user);

        mockMvc.perform(delete("/api/admin/users/5").requestAttr("userId", 5L))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("不能停用当前登录账号"));

        verify(userService, never()).removeById(5L);
        verify(userService, never()).updateById(any(User.class));
    }

    @Test
    void deleteUserDisablesAccountWithoutPhysicalDelete() throws Exception {
        User user = new User();
        user.setId(6L);
        user.setUsername("target");
        user.setStatus(0);
        user.setTokenVersion(3);
        user.setIsOnline(true);
        when(userService.getById(6L)).thenReturn(user);

        mockMvc.perform(delete("/api/admin/users/6").requestAttr("userId", 5L))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("用户已停用"));

        verify(userService, never()).removeById(6L);
        ArgumentCaptor<User> userCaptor = ArgumentCaptor.forClass(User.class);
        verify(userService).updateById(userCaptor.capture());
        User updated = userCaptor.getValue();
        assertThat(updated.getStatus()).isEqualTo(1);
        assertThat(updated.getIsOnline()).isFalse();
        assertThat(updated.getTokenVersion()).isEqualTo(4);
    }

    @Test
    void resetPasswordCanRequireNextLoginPasswordChangeAndNotifyUser() throws Exception {
        User user = new User();
        user.setId(21L);
        user.setUsername("target");
        user.setTokenVersion(2);
        when(userService.getById(21L)).thenReturn(user);
        when(passwordEncoder.encode("NewPass123!")).thenReturn("encoded-new-password");

        mockMvc.perform(put("/api/admin/users/21/password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"password":"NewPass123!","forceChangePassword":true,"notifyUser":true}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("密码重置成功"));

        ArgumentCaptor<User> userCaptor = ArgumentCaptor.forClass(User.class);
        verify(userService).updateById(userCaptor.capture());
        User updated = userCaptor.getValue();
        assertThat(updated.getPassword()).isEqualTo("encoded-new-password");
        assertThat(updated.getForceChangePassword()).isTrue();
        assertThat(updated.getTokenVersion()).isEqualTo(3);
        verify(notificationService).createNotification(eq(21L), eq("system"), anyString(), isNull());
    }

    @Test
    void getLevelUsersReturnsProgressAndLevelName() throws Exception {
        User user = new User();
        user.setId(9L);
        user.setUsername("leveler");
        user.setRole("user");
        user.setLevel(2);
        user.setExp(120);
        user.setPoints(8);

        Page<User> page = new Page<>(1, 10, 1);
        page.setRecords(List.of(user));
        page.setPages(1);

        when(userService.page(any(Page.class), any(QueryWrapper.class))).thenReturn(page);
        when(experienceService.getProgress(120)).thenReturn(java.util.Map.of(
                "exp", 120,
                "level", 2,
                "levelName", "入门",
                "currentInLevel", 20,
                "totalInLevel", 400,
                "remainingExp", 380,
                "maxLevel", false
        ));
        ExperienceProperties.LevelRule levelRule = new ExperienceProperties.LevelRule();
        levelRule.setLevel(2);
        levelRule.setName("入门");
        levelRule.setThreshold(100);
        when(experienceProperties.getLevels()).thenReturn(List.of(levelRule));

        mockMvc.perform(get("/api/admin/levels/users")
                        .param("page", "1")
                        .param("size", "10")
                        .param("keyword", "lev")
                        .param("level", "2"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.records[0].username").value("leveler"))
                .andExpect(jsonPath("$.records[0].level").value(2))
                .andExpect(jsonPath("$.records[0].levelName").value("入门"))
                .andExpect(jsonPath("$.records[0].progress.exp").value(120));
    }

    @Test
    void getLevelLogsReturnsMappedBizLabel() throws Exception {
        UserExpLog log = new UserExpLog();
        log.setId(11L);
        log.setUserId(5L);
        log.setBizType(ExperienceService.BIZ_DAILY_CHECKIN);
        log.setExpChange(6);
        log.setReason("每日签到");

        Page<UserExpLog> page = new Page<>(1, 10, 1);
        page.setRecords(List.of(log));
        page.setPages(1);

        User user = new User();
        user.setId(5L);
        user.setUsername("tester");
        user.setLevel(1);
        user.setExp(6);

        when(experienceService.page(any(Page.class), any(QueryWrapper.class))).thenReturn(page);
        when(userService.list(any(QueryWrapper.class))).thenReturn(List.of(user));

        mockMvc.perform(get("/api/admin/levels/logs")
                        .param("page", "1")
                        .param("size", "10")
                        .param("bizType", ExperienceService.BIZ_DAILY_CHECKIN))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.records[0].bizLabel").value("每日签到"))
                .andExpect(jsonPath("$.records[0].user.username").value("tester"))
                .andExpect(jsonPath("$.records[0].expChange").value(6));
    }

    @Test
    void dailyChallengeAdminEndpointsAreNotExposed() throws Exception {
        MockMvc routeOnlyMockMvc = MockMvcBuilders
                .standaloneSetup(new AdminPracticeCampaignController(
                        practiceLevelMapper,
                        practiceChapterMapper,
                        questionService,
                        practiceCampaignService
                ))
                .build();

        routeOnlyMockMvc.perform(get("/api/admin/practice-campaign/daily-challenge"))
                .andExpect(status().isNotFound());

        routeOnlyMockMvc.perform(put("/api/admin/practice-campaign/daily-challenge")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isNotFound());
    }

    @Test
    void updateExpRulePersistsRange() throws Exception {
        ExperienceRule rule = new ExperienceRule();
        rule.setId(1L);
        rule.setRuleKey(ExperienceService.BIZ_DAILY_CHECKIN);
        rule.setName("每日签到");
        rule.setDescription("旧说明");
        rule.setMinExp(1);
        rule.setMaxExp(20);
        rule.setMaxObtainCount(0);
        rule.setEnabled(true);

        when(experienceRuleService.getByRuleKey(ExperienceService.BIZ_DAILY_CHECKIN)).thenReturn(rule);

        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put("/api/admin/levels/exp-rules/daily_checkin")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"minExp":2,"maxExp":16,"description":"新的随机范围","enabled":true}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.minExp").value(2))
                .andExpect(jsonPath("$.maxExp").value(16))
                .andExpect(jsonPath("$.rangeText").value("2-16 经验"))
                .andExpect(jsonPath("$.maxObtainCount").value(0));

        verify(experienceRuleService).updateById(rule);
        assertThat(rule.getMinExp()).isEqualTo(2);
        assertThat(rule.getMaxExp()).isEqualTo(16);
    }

    @Test
    void createUserRejectsWeakPassword() throws Exception {
        mockMvc.perform(post("/api/admin/users")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"username":"tester","email":"tester@example.com","password":"weak!"}
                                
                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("密码需为 8-64 位，包含大小写字母、数字和特殊字符"));

        verify(userService, never()).save(any(User.class));
    }

    @Test
    void createExcelQuestionUsesExplicitTemplateFields() throws Exception {
        when(excelTemplateGradingService.normalizeAnswerSnapshotJson(anyString(), anyString(), anyString(), any(), anyString()))
                .thenReturn("{\"values\":[[\"100\"]],\"formulas\":[]}");
        when(excelTemplateGradingService.buildRuleJson("/uploads/demo.xlsx", "Sheet1", "B2", true, null))
                .thenReturn("{\"answerSheet\":\"Sheet1\",\"answerRange\":\"B2\",\"checkFormula\":true,\"score\":1}");
        when(excelTemplateGradingService.buildExpectedSnapshotJson(
                eq("/uploads/demo.xlsx"),
                eq("Sheet1"),
                eq("B2"),
                eq(true),
                eq("{\"values\":[[\"100\"]],\"formulas\":[]}"),
                eq("{\"answerSheet\":\"Sheet1\",\"answerRange\":\"B2\",\"checkFormula\":true,\"score\":1}"),
                isNull()
        ))
                .thenReturn("{\"rangeValues\":{\"Sheet1!B2\":[[\"100\"]]},\"rangeFormulas\":{\"Sheet1!B2\":[[\"\"]]}}");
        when(excelTemplateGradingService.normalizeRuleJson(anyString())).thenAnswer(invocation -> invocation.getArgument(0));
        when(excelTemplateGradingService.buildRuleSummary(anyString())).thenReturn(java.util.Map.of("mode", "simple_answer"));
        QuestionCategory category = new QuestionCategory();
        category.setId(3L);
        category.setName("函数练习");
        when(questionCategoryService.getById(3L)).thenReturn(category);
        doAnswer(invocation -> {
            Question question = invocation.getArgument(0);
            question.setId(21L);
            question.setType("excel_template");
            return true;
        }).when(questionService).save(any(Question.class));

        mockMvc.perform(post("/api/admin/questions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"title":"销售统计题","questionCategoryId":3,"difficulty":2,"points":15,"templateFileUrl":"/uploads/demo.xlsx","answerSheet":"Sheet1","answerRange":"B2","answerSnapshotJson":"{\\"sheets\\":[{\\"name\\":\\"Sheet1\\",\\"rowCount\\":3,\\"columnCount\\":3,\\"cells\\":{\\"B2\\":{\\"value\\":\\"100\\"}}}]}","checkFormula":true}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(21L))
                .andExpect(jsonPath("$.type").value("excel_template"))
                .andExpect(jsonPath("$.answerSheet").value("Sheet1"))
                .andExpect(jsonPath("$.answerRange").value("B2"))
                .andExpect(jsonPath("$.checkFormula").value(true));

        ArgumentCaptor<QuestionExcelTemplate> templateCaptor = ArgumentCaptor.forClass(QuestionExcelTemplate.class);
        verify(questionExcelTemplateService).save(templateCaptor.capture());
        QuestionExcelTemplate savedTemplate = templateCaptor.getValue();
        assertThat(savedTemplate.getQuestionId()).isEqualTo(21L);
        assertThat(savedTemplate.getAnswerSheet()).isEqualTo("Sheet1");
        assertThat(savedTemplate.getAnswerRange()).isEqualTo("B2");
        assertThat(savedTemplate.getAnswerSnapshotJson()).contains("\"100\"");
        assertThat(savedTemplate.getCheckFormula()).isTrue();
    }
}
