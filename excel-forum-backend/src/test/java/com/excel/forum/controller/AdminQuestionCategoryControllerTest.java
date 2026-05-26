package com.excel.forum.controller;

import com.excel.forum.entity.QuestionCategory;
import com.excel.forum.service.PracticeCampaignService;
import com.excel.forum.service.QuestionCategoryService;
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

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class AdminQuestionCategoryControllerTest {
    @Mock
    private QuestionCategoryService questionCategoryService;
    @Mock
    private PracticeCampaignService practiceCampaignService;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders
                .standaloneSetup(new AdminQuestionCategoryController(questionCategoryService, practiceCampaignService))
                .build();
    }

    @Test
    void listQuestionCategoriesReturnsPersistedDesignFields() throws Exception {
        QuestionCategory category = new QuestionCategory();
        category.setId(3L);
        category.setName("函数基础");
        category.setFrontDisplayName("函数应用进阶");
        category.setIconKey("sigma");
        category.setRecommendedDifficulty("hard");
        category.setSortOrder(10);
        category.setEnabled(true);
        category.setQuestionCount(18L);
        when(questionCategoryService.listWithQuestionCount(false)).thenReturn(List.of(category));

        mockMvc.perform(get("/api/admin/question-categories"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].frontDisplayName").value("函数应用进阶"))
                .andExpect(jsonPath("$[0].iconKey").value("sigma"))
                .andExpect(jsonPath("$[0].recommendedDifficulty").value("hard"));
    }

    @Test
    void createQuestionCategoryPersistsDesignFields() throws Exception {
        doAnswer(invocation -> {
            QuestionCategory category = invocation.getArgument(0);
            category.setId(9L);
            return true;
        }).when(questionCategoryService).save(any(QuestionCategory.class));
        when(questionCategoryService.getById(9L)).thenAnswer(invocation -> {
            QuestionCategory category = new QuestionCategory();
            category.setId(9L);
            category.setName("函数应用进阶");
            category.setFrontDisplayName("函数章节进阶");
            category.setIconKey("chart");
            category.setRecommendedDifficulty("medium");
            category.setSortOrder(15);
            category.setEnabled(true);
            return category;
        });
        when(questionCategoryService.countQuestions(9L)).thenReturn(0L);

        mockMvc.perform(post("/api/admin/question-categories")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "name":"函数应用进阶",
                                  "frontDisplayName":"函数章节进阶",
                                  "iconKey":"chart",
                                  "recommendedDifficulty":"medium",
                                  "sortOrder":15,
                                  "enabled":true
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.frontDisplayName").value("函数章节进阶"))
                .andExpect(jsonPath("$.iconKey").value("chart"))
                .andExpect(jsonPath("$.recommendedDifficulty").value("medium"));

        ArgumentCaptor<QuestionCategory> categoryCaptor = ArgumentCaptor.forClass(QuestionCategory.class);
        verify(questionCategoryService).save(categoryCaptor.capture());
        assertThat(categoryCaptor.getValue().getFrontDisplayName()).isEqualTo("函数章节进阶");
        assertThat(categoryCaptor.getValue().getIconKey()).isEqualTo("chart");
        assertThat(categoryCaptor.getValue().getRecommendedDifficulty()).isEqualTo("medium");
    }

    @Test
    void batchSortUpdatesSortOrdersWithOneRequest() throws Exception {
        when(questionCategoryService.updateBatchById(any())).thenReturn(true);

        mockMvc.perform(put("/api/admin/question-categories/sort")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"items":[{"id":2,"sortOrder":10},{"id":1,"sortOrder":20}]}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("分类排序已保存"));

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<QuestionCategory>> categoryCaptor = ArgumentCaptor.forClass(List.class);
        verify(questionCategoryService).updateBatchById(categoryCaptor.capture());
        assertThat(categoryCaptor.getValue())
                .extracting(QuestionCategory::getId, QuestionCategory::getSortOrder)
                .containsExactly(org.assertj.core.groups.Tuple.tuple(2L, 10), org.assertj.core.groups.Tuple.tuple(1L, 20));
        verify(practiceCampaignService).syncCampaignCatalog();
    }
}
