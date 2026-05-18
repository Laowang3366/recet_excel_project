package com.excel.forum.controller;

import com.excel.forum.config.ExperienceProperties;
import com.excel.forum.config.GlobalExceptionHandler;
import com.excel.forum.mapper.CheckinRecordMapper;
import com.excel.forum.mapper.DailyChallengeMapper;
import com.excel.forum.mapper.PracticeAnswerMapper;
import com.excel.forum.mapper.PracticeChapterMapper;
import com.excel.forum.mapper.PracticeLevelMapper;
import com.excel.forum.mapper.PracticeRecordMapper;
import com.excel.forum.service.ExcelTemplateGradingService;
import com.excel.forum.service.ExperienceLevelRuleService;
import com.excel.forum.service.ExperienceRuleService;
import com.excel.forum.service.ExperienceService;
import com.excel.forum.service.FeedbackService;
import com.excel.forum.service.NotificationService;
import com.excel.forum.service.PointsRecordService;
import com.excel.forum.service.PointsRuleOptionService;
import com.excel.forum.service.PointsRuleService;
import com.excel.forum.service.PointsTaskService;
import com.excel.forum.service.PracticeCampaignService;
import com.excel.forum.service.PracticeQuestionSubmissionService;
import com.excel.forum.service.QuestionCategoryService;
import com.excel.forum.service.QuestionExcelTemplateService;
import com.excel.forum.service.QuestionService;
import com.excel.forum.service.SiteNotificationService;
import com.excel.forum.service.UserEntitlementService;
import com.excel.forum.service.UserService;
import com.excel.forum.util.HtmlSanitizer;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class RequestParsingErrorTest {

    @Mock
    private UserService userService;
    @Mock
    private FeedbackService feedbackService;
    @Mock
    private NotificationService notificationService;
    @Mock
    private PointsRuleService pointsRuleService;
    @Mock
    private PointsRuleOptionService pointsRuleOptionService;
    @Mock
    private PointsRecordService pointsRecordService;
    @Mock
    private PointsTaskService pointsTaskService;
    @Mock
    private QuestionService questionService;
    @Mock
    private QuestionCategoryService questionCategoryService;
    @Mock
    private QuestionExcelTemplateService questionExcelTemplateService;
    @Mock
    private PracticeQuestionSubmissionService practiceQuestionSubmissionService;
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
    private UserEntitlementService userEntitlementService;
    @Mock
    private ExcelTemplateGradingService excelTemplateGradingService;
    @Mock
    private PracticeLevelMapper practiceLevelMapper;
    @Mock
    private PracticeChapterMapper practiceChapterMapper;
    @Mock
    private DailyChallengeMapper dailyChallengeMapper;
    @Mock
    private PracticeRecordMapper practiceRecordMapper;
    @Mock
    private PracticeAnswerMapper practiceAnswerMapper;
    @Mock
    private CheckinRecordMapper checkinRecordMapper;
    @Mock
    private HtmlSanitizer htmlSanitizer;
    @Mock
    private PracticeCampaignService practiceCampaignService;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        AdminController adminController = new AdminController(
                userService,
                feedbackService,
                notificationService,
                pointsRuleService,
                pointsRuleOptionService,
                pointsRecordService,
                pointsTaskService,
                questionService,
                questionCategoryService,
                questionExcelTemplateService,
                practiceQuestionSubmissionService,
                siteNotificationService,
                experienceService,
                experienceProperties,
                experienceRuleService,
                experienceLevelRuleService,
                userEntitlementService,
                excelTemplateGradingService,
                practiceLevelMapper,
                practiceChapterMapper,
                dailyChallengeMapper,
                practiceRecordMapper,
                practiceAnswerMapper,
                checkinRecordMapper,
                htmlSanitizer,
                practiceCampaignService
        );
        mockMvc = MockMvcBuilders.standaloneSetup(adminController)
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @Test
    void malformedAdminNotificationJsonReturnsBadRequest() throws Exception {
        mockMvc.perform(post("/api/admin/notifications")
                        .requestAttr("userId", 3L)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"broken\","))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("请求体格式错误"));
    }
}
