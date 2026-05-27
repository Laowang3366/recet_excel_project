package com.excel.forum.controller;

import com.baomidou.mybatisplus.core.conditions.Wrapper;
import com.excel.forum.entity.TemplateCenterItem;
import com.excel.forum.entity.TemplateDownloadRecord;
import com.excel.forum.service.FileRecycleService;
import com.excel.forum.service.FileStorageService;
import com.excel.forum.service.TemplateCenterItemService;
import com.excel.forum.service.TemplateDownloadRecordService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

import static org.hamcrest.Matchers.hasSize;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class AdminTemplateCenterControllerTest {

    @Mock
    private TemplateCenterItemService templateCenterItemService;

    @Mock
    private TemplateDownloadRecordService templateDownloadRecordService;

    @Mock
    private FileRecycleService fileRecycleService;

    @Mock
    private FileStorageService fileStorageService;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        AdminTemplateCenterController controller = new AdminTemplateCenterController(
                templateCenterItemService,
                templateDownloadRecordService,
                new ObjectMapper(),
                fileRecycleService,
                fileStorageService
        );
        mockMvc = MockMvcBuilders.standaloneSetup(controller).build();
    }

    @Test
    void listTemplatesSupportsFilterPaginationAndAdminMetadata() throws Exception {
        TemplateCenterItem match = template(
                1L,
                "销售数据分析看板",
                "销售",
                "数据分析",
                "中级",
                true
        );
        match.setTemplateFileUrl("/uploads/private/sales.xlsx");
        match.setFileName("sales_dashboard.xlsx");
        match.setFileSize(2_457_600L);
        match.setFileVersion("2.1");
        match.setUsageGuide("请先导入原始销售数据");
        match.setTagsJson("[\"销售分析\",\"看板\"]");
        match.setLastUploadedAt(LocalDateTime.of(2026, 5, 27, 9, 45));

        TemplateCenterItem filteredOut = template(2L, "库存周转表", "仓储", "库存管理", "基础", true);
        TemplateCenterItem draft = template(3L, "人事排班模板", "人事", "排班", "基础", false);

        when(templateCenterItemService.list(any(Wrapper.class))).thenReturn(List.of(match, filteredOut, draft));
        when(templateDownloadRecordService.count(any(Wrapper.class))).thenReturn(240L, 186L);

        mockMvc.perform(get("/api/admin/templates")
                        .param("industryCategory", "销售")
                        .param("useScenario", "数据分析")
                        .param("difficultyLevel", "中级")
                        .param("status", "enabled")
                        .param("keyword", "看板")
                        .param("page", "1")
                        .param("pageSize", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.total").value(1))
                .andExpect(jsonPath("$.page").value(1))
                .andExpect(jsonPath("$.pageSize").value(1))
                .andExpect(jsonPath("$.pageCount").value(1))
                .andExpect(jsonPath("$.records", hasSize(1)))
                .andExpect(jsonPath("$.records[0].fileName").value("sales_dashboard.xlsx"))
                .andExpect(jsonPath("$.records[0].fileSize").value(2457600))
                .andExpect(jsonPath("$.records[0].fileVersion").value("2.1"))
                .andExpect(jsonPath("$.records[0].usageGuide").value("请先导入原始销售数据"))
                .andExpect(jsonPath("$.records[0].tags[0]").value("销售分析"))
                .andExpect(jsonPath("$.records[0].functionsUsed[1]").value("看板"))
                .andExpect(jsonPath("$.records[0].lastUploadedAt").value("2026-05-27T09:45:00"))
                .andExpect(jsonPath("$.records[0].exchangeUserCount").value(186));
    }

    @Test
    void createTemplatePersistsSeparatedContentMetadataAndTags() throws Exception {
        when(templateCenterItemService.save(any(TemplateCenterItem.class))).thenReturn(true);

        Map<String, Object> request = Map.ofEntries(
                Map.entry("title", "销售数据分析看板"),
                Map.entry("industryCategory", "销售"),
                Map.entry("useScenario", "数据分析"),
                Map.entry("difficultyLevel", "中级"),
                Map.entry("downloadCostPoints", 30),
                Map.entry("templateFileUrl", "/uploads/private/sales.xlsx"),
                Map.entry("templateDescription", "多维度销售分析"),
                Map.entry("usageGuide", "请先导入原始销售数据"),
                Map.entry("tags", List.of("销售分析", "看板")),
                Map.entry("fileName", "sales_dashboard.xlsx"),
                Map.entry("fileSize", 2457600),
                Map.entry("fileVersion", "2.1"),
                Map.entry("enabled", true)
        );

        mockMvc.perform(post("/api/admin/templates")
                        .contentType("application/json")
                        .content(new ObjectMapper().writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.templateDescription").value("多维度销售分析"))
                .andExpect(jsonPath("$.usageGuide").value("请先导入原始销售数据"))
                .andExpect(jsonPath("$.tags[0]").value("销售分析"))
                .andExpect(jsonPath("$.fileName").value("sales_dashboard.xlsx"))
                .andExpect(jsonPath("$.fileSize").value(2457600))
                .andExpect(jsonPath("$.fileVersion").value("2.1"));

        ArgumentCaptor<TemplateCenterItem> captor = ArgumentCaptor.forClass(TemplateCenterItem.class);
        verify(templateCenterItemService).save(captor.capture());
        TemplateCenterItem saved = captor.getValue();
        org.assertj.core.api.Assertions.assertThat(saved.getTemplateDescription()).isEqualTo("多维度销售分析");
        org.assertj.core.api.Assertions.assertThat(saved.getUsageGuide()).isEqualTo("请先导入原始销售数据");
        org.assertj.core.api.Assertions.assertThat(saved.getTagsJson()).contains("销售分析");
        org.assertj.core.api.Assertions.assertThat(saved.getFileName()).isEqualTo("sales_dashboard.xlsx");
        org.assertj.core.api.Assertions.assertThat(saved.getFileSize()).isEqualTo(2_457_600L);
        org.assertj.core.api.Assertions.assertThat(saved.getFileVersion()).isEqualTo("2.1");
        org.assertj.core.api.Assertions.assertThat(saved.getLastUploadedAt()).isNotNull();
    }

    @Test
    void batchUploadCreatesDraftTemplatesWithFileMetadata() throws Exception {
        when(fileStorageService.store(any())).thenReturn("/uploads/private/sales.xlsx", "/uploads/private/inventory.xlsx");
        when(templateCenterItemService.save(any(TemplateCenterItem.class))).thenReturn(true);

        MockMultipartFile first = new MockMultipartFile(
                "files",
                "sales_dashboard.xlsx",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "excel-one".getBytes(StandardCharsets.UTF_8)
        );
        MockMultipartFile second = new MockMultipartFile(
                "files",
                "inventory_turnover.xls",
                "application/vnd.ms-excel",
                "excel-two".getBytes(StandardCharsets.UTF_8)
        );

        mockMvc.perform(multipart("/api/admin/templates/batch-upload").file(first).file(second))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.createdCount").value(2))
                .andExpect(jsonPath("$.records[0].title").value("sales_dashboard"))
                .andExpect(jsonPath("$.records[0].enabled").value(false))
                .andExpect(jsonPath("$.records[0].fileName").value("sales_dashboard.xlsx"))
                .andExpect(jsonPath("$.records[0].templateFileUrl").value("/uploads/private/sales.xlsx"));

        ArgumentCaptor<TemplateCenterItem> captor = ArgumentCaptor.forClass(TemplateCenterItem.class);
        verify(templateCenterItemService, times(2)).save(captor.capture());
        org.assertj.core.api.Assertions.assertThat(captor.getAllValues())
                .extracting(TemplateCenterItem::getFileName)
                .containsExactly("sales_dashboard.xlsx", "inventory_turnover.xls");
        org.assertj.core.api.Assertions.assertThat(captor.getAllValues().get(0).getEnabled()).isFalse();
    }

    @Test
    void operationsReportReturnsAggregateAndTopTemplates() throws Exception {
        TemplateCenterItem top = template(1L, "销售数据分析看板", "销售", "数据分析", "中级", true);
        top.setTemplateFileUrl("/uploads/private/sales.xlsx");
        TemplateCenterItem draft = template(2L, "人事排班模板", "人事", "", "基础", false);

        when(templateCenterItemService.list(any(Wrapper.class))).thenReturn(List.of(top, draft));
        when(templateDownloadRecordService.count(any(Wrapper.class))).thenReturn(240L, 40L, 240L, 40L);

        mockMvc.perform(get("/api/admin/templates/operations-report"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.summary.total").value(2))
                .andExpect(jsonPath("$.summary.enabled").value(1))
                .andExpect(jsonPath("$.summary.drafts").value(1))
                .andExpect(jsonPath("$.summary.missingMetadata").value(1))
                .andExpect(jsonPath("$.categoryStats[0].name").value("销售"))
                .andExpect(jsonPath("$.topTemplates[0].title").value("销售数据分析看板"))
                .andExpect(jsonPath("$.topTemplates[0].downloadCount").value(240));
    }

    private TemplateCenterItem template(Long id, String title, String industry, String scenario, String difficulty, boolean enabled) {
        TemplateCenterItem item = new TemplateCenterItem();
        item.setId(id);
        item.setTitle(title);
        item.setIndustryCategory(industry);
        item.setUseScenario(scenario);
        item.setPreviewImageUrl("/uploads/" + id + ".png");
        item.setTemplateDescription(title + "说明");
        item.setFunctionsUsed("[]");
        item.setDifficultyLevel(difficulty);
        item.setDownloadCostPoints(30);
        item.setTemplateFileUrl("");
        item.setSortOrder(10);
        item.setEnabled(enabled);
        item.setUpdateTime(LocalDateTime.of(2026, 5, 27, 10, 0));
        return item;
    }
}
