package com.excel.forum.controller;

import com.excel.forum.entity.dto.AdminQaAssignRequest;
import com.excel.forum.entity.dto.AdminQaBatchAssignRequest;
import com.excel.forum.entity.dto.AdminQaBatchReviewRequest;
import com.excel.forum.entity.dto.AdminQaFeaturedShareRequest;
import com.excel.forum.entity.dto.AdminQaFeedbackHandleRequest;
import com.excel.forum.entity.dto.AdminQaReviewRequest;
import com.excel.forum.service.QaService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class AdminQaControllerTest {

    @Mock
    private QaService qaService;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(new AdminQaController(qaService)).build();
    }

    @Test
    void assignCaseDelegatesToServiceWithAdminContext() throws Exception {
        when(qaService.adminAssignCase(eq(31L), eq(9L), org.mockito.ArgumentMatchers.any()))
                .thenReturn(Map.of("id", 31L, "assignedUserId", 88L));

        mockMvc.perform(put("/api/admin/qa/cases/31/assign")
                        .requestAttr("userId", 9L)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"assigneeUserId":88,"note":"交给讲师处理"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.assignedUserId").value(88));

        ArgumentCaptor<AdminQaAssignRequest> captor = ArgumentCaptor.forClass(AdminQaAssignRequest.class);
        verify(qaService).adminAssignCase(eq(31L), eq(9L), captor.capture());
        assertThat(captor.getValue().getAssigneeUserId()).isEqualTo(88L);
        assertThat(captor.getValue().getNote()).isEqualTo("交给讲师处理");
    }

    @Test
    void reviewAnswerDelegatesApprovalPayload() throws Exception {
        when(qaService.adminReviewCaseAnswer(eq(44L), eq(9L), org.mockito.ArgumentMatchers.any()))
                .thenReturn(Map.of("id", 44L, "status", "approved"));

        mockMvc.perform(put("/api/admin/qa/answers/44/review")
                        .requestAttr("userId", 9L)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"action":"approve","note":"答案准确，可以发布"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("approved"));

        ArgumentCaptor<AdminQaReviewRequest> captor = ArgumentCaptor.forClass(AdminQaReviewRequest.class);
        verify(qaService).adminReviewCaseAnswer(eq(44L), eq(9L), captor.capture());
        assertThat(captor.getValue().getAction()).isEqualTo("approve");
        assertThat(captor.getValue().getNote()).isEqualTo("答案准确，可以发布");
    }

    @Test
    void batchReviewAnswersDelegatesSelectedIds() throws Exception {
        when(qaService.adminBatchReviewCaseAnswers(eq(9L), org.mockito.ArgumentMatchers.any()))
                .thenReturn(Map.of("successCount", 2, "failedCount", 0, "failedIds", List.of()));

        mockMvc.perform(post("/api/admin/qa/answers/batch-review")
                        .requestAttr("userId", 9L)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"ids":[44,45],"action":"reject","note":"答案无法复现"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.successCount").value(2));

        ArgumentCaptor<AdminQaBatchReviewRequest> captor = ArgumentCaptor.forClass(AdminQaBatchReviewRequest.class);
        verify(qaService).adminBatchReviewCaseAnswers(eq(9L), captor.capture());
        assertThat(captor.getValue().getIds()).containsExactly(44L, 45L);
        assertThat(captor.getValue().getAction()).isEqualTo("reject");
    }

    @Test
    void batchAssignCasesDelegatesSelectedIds() throws Exception {
        when(qaService.adminBatchAssignCases(eq(9L), org.mockito.ArgumentMatchers.any()))
                .thenReturn(Map.of("successCount", 2, "failedCount", 0, "failedIds", List.of()));

        mockMvc.perform(post("/api/admin/qa/cases/batch-assign")
                        .requestAttr("userId", 9L)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"ids":[31,32],"assigneeUserId":88,"note":"批量分配"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.successCount").value(2));

        ArgumentCaptor<AdminQaBatchAssignRequest> captor = ArgumentCaptor.forClass(AdminQaBatchAssignRequest.class);
        verify(qaService).adminBatchAssignCases(eq(9L), captor.capture());
        assertThat(captor.getValue().getIds()).containsExactly(31L, 32L);
        assertThat(captor.getValue().getAssigneeUserId()).isEqualTo(88L);
    }

    @Test
    void handleFeedbackDelegatesStatusAndNote() throws Exception {
        when(qaService.adminHandleFeedback(eq(70L), eq(9L), org.mockito.ArgumentMatchers.any()))
                .thenReturn(Map.of("id", 70L, "status", "handled"));

        mockMvc.perform(put("/api/admin/qa/feedback/70/handle")
                        .requestAttr("userId", 9L)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"status":"handled","note":"已补充说明"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("handled"));

        ArgumentCaptor<AdminQaFeedbackHandleRequest> captor = ArgumentCaptor.forClass(AdminQaFeedbackHandleRequest.class);
        verify(qaService).adminHandleFeedback(eq(70L), eq(9L), captor.capture());
        assertThat(captor.getValue().getStatus()).isEqualTo("handled");
        assertThat(captor.getValue().getNote()).isEqualTo("已补充说明");
    }

    @Test
    void createFeaturedShareDelegatesQaSource() throws Exception {
        when(qaService.adminCreateFeaturedShare(eq(9L), org.mockito.ArgumentMatchers.any()))
                .thenReturn(Map.of("id", 81L, "sourceType", "qa_case", "qaCaseId", 31L));

        mockMvc.perform(post("/api/admin/qa/featured-shares")
                        .requestAttr("userId", 9L)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"caseId":31,"answerId":44,"title":"多条件统计公式错误","thoughtText":"建议拆分条件检查。"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.sourceType").value("qa_case"))
                .andExpect(jsonPath("$.qaCaseId").value(31));

        ArgumentCaptor<AdminQaFeaturedShareRequest> captor = ArgumentCaptor.forClass(AdminQaFeaturedShareRequest.class);
        verify(qaService).adminCreateFeaturedShare(eq(9L), captor.capture());
        assertThat(captor.getValue().getCaseId()).isEqualTo(31L);
        assertThat(captor.getValue().getAnswerId()).isEqualTo(44L);
    }
}
