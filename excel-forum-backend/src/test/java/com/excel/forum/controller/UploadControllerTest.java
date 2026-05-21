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
import org.apache.poi.xssf.usermodel.XSSFWorkbook;

import java.io.ByteArrayOutputStream;

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
        mockMvc = MockMvcBuilders.standaloneSetup(new UploadController(fileStorageService, rateLimitService, workbookSecurityGuard, excelTemplateGradingService)).build();
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

    private byte[] createWorkbookBytes() throws Exception {
        try (XSSFWorkbook workbook = new XSSFWorkbook();
             ByteArrayOutputStream outputStream = new ByteArrayOutputStream()) {
            workbook.createSheet("Sheet1").createRow(0).createCell(0).setCellValue("demo");
            workbook.write(outputStream);
            return outputStream.toByteArray();
        }
    }
}
