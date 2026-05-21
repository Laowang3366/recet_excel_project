package com.excel.forum.controller;

import com.excel.forum.config.FileStorageConfig;
import com.excel.forum.entity.TemplateCenterItem;
import com.excel.forum.entity.TemplateDownloadRecord;
import com.excel.forum.entity.User;
import com.excel.forum.mapper.UserMapper;
import com.excel.forum.service.PointsRecordService;
import com.excel.forum.service.RateLimitResult;
import com.excel.forum.service.RateLimitService;
import com.excel.forum.service.TemplateCenterItemService;
import com.excel.forum.service.TemplateDownloadRecordService;
import com.excel.forum.service.UserService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.io.TempDir;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.hamcrest.Matchers.containsString;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class TemplateCenterControllerTest {

    @Mock
    private TemplateCenterItemService templateCenterItemService;

    @Mock
    private TemplateDownloadRecordService templateDownloadRecordService;

    @Mock
    private UserService userService;

    @Mock
    private UserMapper userMapper;

    @Mock
    private PointsRecordService pointsRecordService;

    @Mock
    private RateLimitService rateLimitService;

    @TempDir
    Path tempDir;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        FileStorageConfig fileStorageConfig = new FileStorageConfig();
        fileStorageConfig.getLocal().setPath(tempDir.toString());
        fileStorageConfig.getLocal().setUrlPrefix("/uploads");

        TemplateCenterController controller = new TemplateCenterController(
                templateCenterItemService,
                templateDownloadRecordService,
                userService,
                userMapper,
                pointsRecordService,
                new ObjectMapper(),
                fileStorageConfig,
                rateLimitService
        );
        mockMvc = MockMvcBuilders.standaloneSetup(controller).build();
    }

    @Test
    void downloadTemplateReturnsApiFileUrl() throws Exception {
        Files.write(tempDir.resolve("plan.xlsx"), "xlsx-bytes".getBytes());

        TemplateCenterItem item = new TemplateCenterItem();
        item.setId(3L);
        item.setEnabled(true);
        item.setTemplateFileUrl("/uploads/plan.xlsx");
        item.setTitle("方案模板");
        item.setDownloadCostPoints(0);

        User user = new User();
        user.setId(7L);
        user.setPoints(120);

        when(templateCenterItemService.getById(3L)).thenReturn(item);
        when(templateDownloadRecordService.hasDownloaded(7L, 3L)).thenReturn(false, true);
        when(userService.getById(7L)).thenReturn(user);

        mockMvc.perform(post("/api/templates/3/download").requestAttr("userId", 7L))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.url").value("/api/templates/3/file"))
                .andExpect(jsonPath("$.downloaded").value(true));
    }

    @Test
    void downloadTemplateDoesNotDeductWhenLocalFileIsMissing() throws Exception {
        TemplateCenterItem item = new TemplateCenterItem();
        item.setId(9L);
        item.setEnabled(true);
        item.setTemplateFileUrl("/uploads/missing.xlsx");
        item.setTitle("缺失模板");
        item.setDownloadCostPoints(20);

        when(templateCenterItemService.getById(9L)).thenReturn(item);

        mockMvc.perform(post("/api/templates/9/download").requestAttr("userId", 7L))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message").value("模板文件不存在，请联系管理员重新上传"));

        verifyNoInteractions(userMapper, userService, pointsRecordService);
    }

    @Test
    void downloadTemplateFileStreamsLocalUpload() throws Exception {
        Path file = tempDir.resolve("plan.xlsx");
        Files.write(file, "xlsx-bytes".getBytes());

        TemplateCenterItem item = new TemplateCenterItem();
        item.setId(3L);
        item.setEnabled(true);
        item.setTemplateFileUrl("/uploads/plan.xlsx");

        when(templateCenterItemService.getById(3L)).thenReturn(item);
        when(templateDownloadRecordService.hasDownloaded(7L, 3L)).thenReturn(true);

        mockMvc.perform(get("/api/templates/3/file").requestAttr("userId", 7L))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.CONTENT_DISPOSITION, containsString("attachment")))
                .andExpect(content().contentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")))
                .andExpect(content().bytes("xlsx-bytes".getBytes()));
    }

    @Test
    void downloadTemplateFileReturnsTooManyRequestsWhenRateLimited() throws Exception {
        when(rateLimitService.check(argThat(key -> key != null && key.startsWith("download:template:user:7")), any(Integer.class), any(), any()))
                .thenReturn(RateLimitResult.limited("文件下载过于频繁，请稍后再试", 20));

        mockMvc.perform(get("/api/templates/3/file").requestAttr("userId", 7L))
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.message").value("文件下载过于频繁，请稍后再试"))
                .andExpect(jsonPath("$.retryAfterSeconds").value(20));

        verify(templateCenterItemService, never()).getById(eq(3L));
    }
}
