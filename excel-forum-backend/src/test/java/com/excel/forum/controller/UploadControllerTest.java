package com.excel.forum.controller;

import com.excel.forum.entity.dto.ExcelWorkbookSnapshot;
import com.excel.forum.service.ExcelTemplateGradingService;
import com.excel.forum.service.FileStorageService;
import com.excel.forum.service.RateLimitResult;
import com.excel.forum.service.RateLimitService;
import com.excel.forum.service.WorkbookSecurityGuard;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.http.converter.StringHttpMessageConverter;
import org.springframework.http.converter.json.MappingJackson2HttpMessageConverter;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;

import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class UploadControllerTest {
    @Mock
    private FileStorageService fileStorageService;

    @Mock
    private RateLimitService rateLimitService;
    @Mock
    private WorkbookSecurityGuard workbookSecurityGuard;
    @Mock
    private ExcelTemplateGradingService excelTemplateGradingService;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(new UploadController(fileStorageService, rateLimitService, workbookSecurityGuard, excelTemplateGradingService))
                .setMessageConverters(
                        new StringHttpMessageConverter(StandardCharsets.UTF_8),
                        new MappingJackson2HttpMessageConverter()
                )
                .build();
    }

    @Test
    void uploadReturnsTooManyRequestsWhenRateLimited() throws Exception {
        when(rateLimitService.check(argThat(key -> key != null && key.startsWith("upload:user:7")), any(Integer.class), any(), any()))
                .thenReturn(RateLimitResult.limited("上传频率过高，请稍后再试", 10));

        MockMultipartFile file = new MockMultipartFile(
                "file",
                "case.xlsx",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                new byte[] { 'P', 'K', 3, 4 }
        );

        mockMvc.perform(multipart("/api/upload")
                        .file(file)
                        .requestAttr("userId", 7L))
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.message").value("上传频率过高，请稍后再试"))
                .andExpect(jsonPath("$.retryAfterSeconds").value(10));

        verify(fileStorageService, never()).store(any(MockMultipartFile.class));
    }

    @Test
    void excelUploadReturnsSnapshotSoFrontendDoesNotNeedRawFileUrlParsing() throws Exception {
        byte[] workbookBytes = createWorkbookBytes();
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "case.xlsx",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                workbookBytes
        );
        ExcelWorkbookSnapshot snapshot = new ExcelWorkbookSnapshot();
        when(fileStorageService.store(any(MockMultipartFile.class))).thenReturn("/uploads/private/case.xlsx");
        when(excelTemplateGradingService.loadWorkbookSnapshot("/uploads/private/case.xlsx")).thenReturn(snapshot);

        mockMvc.perform(multipart("/api/upload")
                        .file(file)
                        .requestAttr("userId", 7L))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.url").value("/uploads/private/case.xlsx"))
                .andExpect(jsonPath("$.workbook.sheets").isArray());
    }

    @Test
    void uploadRejectsSpoofedExcelWhenMagicDoesNotMatchExtension() throws Exception {
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "case.xlsx",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                new byte[] { (byte) 0x89, 'P', 'N', 'G', 13, 10, 26, 10 }
        );

        mockMvc.perform(multipart("/api/upload")
                        .file(file)
                        .requestAttr("userId", 7L))
                .andExpect(status().isBadRequest())
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.content().string("不支持的文件类型"));

        verify(fileStorageService, never()).store(any(MockMultipartFile.class));
    }

    @Test
    void uploadRejectsOversizedFileBeforeStorage() throws Exception {
        byte[] content = new byte[20 * 1024 * 1024 + 1];
        content[0] = 'P';
        content[1] = 'K';
        content[2] = 3;
        content[3] = 4;
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "large.xlsx",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                content
        );

        mockMvc.perform(multipart("/api/upload")
                        .file(file)
                        .requestAttr("userId", 7L))
                .andExpect(status().isBadRequest())
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.content().string("文件大小超过限制"));

        verify(fileStorageService, never()).store(any(MockMultipartFile.class));
    }

    private byte[] createWorkbookBytes() throws Exception {
        try (XSSFWorkbook workbook = new XSSFWorkbook();
             ByteArrayOutputStream outputStream = new ByteArrayOutputStream()) {
            workbook.createSheet("Sheet1").createRow(0).createCell(0).setCellValue("demo");
            workbook.write(outputStream);
            return outputStream.toByteArray();
        }
    }
}
