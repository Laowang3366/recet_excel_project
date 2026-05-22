package com.excel.forum.controller;

import com.excel.forum.entity.User;
import com.excel.forum.mapper.UserMapper;
import com.excel.forum.service.DocumentConversionRecordService;
import com.excel.forum.service.DocumentConversionService;
import com.excel.forum.service.FileStorageService;
import com.excel.forum.service.PointsRecordService;
import com.excel.forum.service.RateLimitResult;
import com.excel.forum.service.RateLimitService;
import com.excel.forum.service.UserService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.converter.json.MappingJackson2HttpMessageConverter;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class ToolControllerTest {
    @Mock
    private DocumentConversionService documentConversionService;
    @Mock
    private DocumentConversionRecordService documentConversionRecordService;
    @Mock
    private UserService userService;
    @Mock
    private UserMapper userMapper;
    @Mock
    private PointsRecordService pointsRecordService;
    @Mock
    private RateLimitService rateLimitService;
    @Mock
    private FileStorageService fileStorageService;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(new ToolController(
                        documentConversionService,
                        documentConversionRecordService,
                        userService,
                        userMapper,
                        pointsRecordService,
                        rateLimitService,
                        fileStorageService
                ))
                .setMessageConverters(new MappingJackson2HttpMessageConverter())
                .build();
    }

    @Test
    void convertDocumentReturnsTooManyRequestsWhenRateLimited() throws Exception {
        User user = new User();
        user.setId(7L);
        user.setPoints(100);
        when(userService.getById(7L)).thenReturn(user);
        when(rateLimitService.check(argThat(key -> key != null && key.equals("tools:convert:user:7")), any(Integer.class), any(), any()))
                .thenReturn(RateLimitResult.limited("文档转换过于频繁，请稍后再试", 60));

        MockMultipartFile file = new MockMultipartFile("file", "demo.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", new byte[] { 1, 2, 3 });

        mockMvc.perform(multipart("/api/tools/convert")
                        .file(file)
                        .param("targetType", "pdf")
                        .requestAttr("userId", 7L))
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.message").value("文档转换过于频繁，请稍后再试"))
                .andExpect(jsonPath("$.retryAfterSeconds").value(60));

        verify(userMapper, never()).deductPoints(anyLong(), anyInt());
        verify(documentConversionService, never()).convert(any(), any());
    }
}
