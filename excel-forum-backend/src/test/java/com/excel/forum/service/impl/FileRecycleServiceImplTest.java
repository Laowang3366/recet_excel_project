package com.excel.forum.service.impl;

import com.excel.forum.entity.FileRecycleItem;
import com.excel.forum.entity.TemplateCenterItem;
import com.excel.forum.entity.User;
import com.excel.forum.mapper.FileRecycleItemMapper;
import com.excel.forum.mapper.QaCaseHelpAnswerMapper;
import com.excel.forum.mapper.QaCaseHelpMapper;
import com.excel.forum.mapper.QuestionExcelTemplateMapper;
import com.excel.forum.mapper.QuestionMapper;
import com.excel.forum.mapper.TemplateCenterItemMapper;
import com.excel.forum.mapper.UserMapper;
import com.excel.forum.service.FileStorageService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class FileRecycleServiceImplTest {
    @Mock
    private FileRecycleItemMapper fileRecycleItemMapper;
    @Mock
    private QuestionMapper questionMapper;
    @Mock
    private QuestionExcelTemplateMapper questionExcelTemplateMapper;
    @Mock
    private TemplateCenterItemMapper templateCenterItemMapper;
    @Mock
    private QaCaseHelpMapper qaCaseHelpMapper;
    @Mock
    private QaCaseHelpAnswerMapper qaCaseHelpAnswerMapper;
    @Mock
    private FileStorageService fileStorageService;
    @Mock
    private UserMapper userMapper;

    private FileRecycleServiceImpl service;

    @BeforeEach
    void setUp() {
        service = new FileRecycleServiceImpl(
                fileRecycleItemMapper,
                questionMapper,
                questionExcelTemplateMapper,
                templateCenterItemMapper,
                qaCaseHelpMapper,
                qaCaseHelpAnswerMapper,
                userMapper,
                fileStorageService,
                new ObjectMapper()
        );
    }

    @Test
    void recyclesTemplateFilesAndMarksBusinessRecordDeleted() {
        TemplateCenterItem item = new TemplateCenterItem();
        item.setId(11L);
        item.setTitle("财务模板");
        item.setTemplateFileUrl("/uploads/template.xlsx");
        item.setPreviewImageUrl("/uploads/preview.png");
        item.setEnabled(true);
        when(fileStorageService.moveToRecycle("/uploads/template.xlsx", "template/11"))
                .thenReturn("/uploads/.trash/template/11/template.xlsx");
        when(fileStorageService.moveToRecycle("/uploads/preview.png", "template/11"))
                .thenReturn("/uploads/.trash/template/11/preview.png");
        when(fileRecycleItemMapper.insert(any(FileRecycleItem.class))).thenAnswer(invocation -> {
            FileRecycleItem inserted = invocation.getArgument(0);
            inserted.setId(99L);
            return 1;
        });

        FileRecycleItem recycleItem = service.recycleTemplate(item, 3L);

        assertThat(recycleItem.getId()).isEqualTo(99L);
        assertThat(recycleItem.getStatus()).isEqualTo("active");
        assertThat(recycleItem.getExpiresAt()).isAfter(recycleItem.getDeletedAt().plusDays(89));
        assertThat(item.getDeletedAt()).isNotNull();
        assertThat(item.getDeletedBy()).isEqualTo(3L);
        verify(templateCenterItemMapper).updateById(item);
    }

    @Test
    void restoreTemplateMovesFilesBackAndClearsDeletedFields() {
        FileRecycleItem recycleItem = new FileRecycleItem();
        recycleItem.setId(99L);
        recycleItem.setResourceType("template");
        recycleItem.setResourceId(11L);
        recycleItem.setStatus("active");
        recycleItem.setFilesJson("""
                [
                  {"label":"templateFile","originalFileUrl":"/uploads/template.xlsx","recycleFileUrl":"/uploads/.trash/template/11/template.xlsx"},
                  {"label":"previewImage","originalFileUrl":"/uploads/preview.png","recycleFileUrl":"/uploads/.trash/template/11/preview.png"}
                ]
                """);
        TemplateCenterItem item = new TemplateCenterItem();
        item.setId(11L);
        item.setDeletedAt(LocalDateTime.now());
        item.setDeletedBy(3L);
        when(fileRecycleItemMapper.selectById(99L)).thenReturn(recycleItem);
        when(templateCenterItemMapper.selectById(11L)).thenReturn(item);
        when(fileStorageService.restoreFromRecycle("/uploads/.trash/template/11/template.xlsx", "/uploads/template.xlsx"))
                .thenReturn("/uploads/template.xlsx");
        when(fileStorageService.restoreFromRecycle("/uploads/.trash/template/11/preview.png", "/uploads/preview.png"))
                .thenReturn("/uploads/preview.png");

        service.restore(99L);

        ArgumentCaptor<TemplateCenterItem> captor = ArgumentCaptor.forClass(TemplateCenterItem.class);
        verify(templateCenterItemMapper).updateById(captor.capture());
        assertThat(captor.getValue().getDeletedAt()).isNull();
        assertThat(captor.getValue().getDeletedBy()).isNull();
        assertThat(captor.getValue().getTemplateFileUrl()).isEqualTo("/uploads/template.xlsx");
        assertThat(captor.getValue().getPreviewImageUrl()).isEqualTo("/uploads/preview.png");
        verify(fileRecycleItemMapper).updateById(recycleItem);
    }

    @Test
    @SuppressWarnings("unchecked")
    void listItemsReturnsStatsFileSizesDeleteUserNamesAndServerSideFilters() {
        LocalDateTime futureExpiry = LocalDateTime.now().plusDays(30);
        FileRecycleItem template = recycleItem(
                1L,
                "template",
                "old_template.xlsx",
                3L,
                LocalDateTime.of(2026, 5, 26, 10, 20),
                futureExpiry,
                """
                        [
                          {"label":"templateFile","originalFileUrl":"/uploads/template.xlsx","recycleFileUrl":"/uploads/.trash/template/11/template.xlsx"},
                          {"label":"previewImage","originalFileUrl":"/uploads/preview.png","recycleFileUrl":"/uploads/.trash/template/11/preview.png"}
                        ]
                        """
        );
        FileRecycleItem image = recycleItem(
                2L,
                "qa_answer",
                "qa_attachment.png",
                8L,
                LocalDateTime.of(2026, 5, 25, 10, 20),
                futureExpiry.plusDays(15),
                """
                        [
                          {"label":"answerFile","originalFileUrl":"/uploads/answer.png","recycleFileUrl":"/uploads/.trash/qa_answer/12/answer.png"}
                        ]
                        """
        );
        when(fileRecycleItemMapper.selectList(any())).thenReturn(List.of(template, image));
        User admin = new User();
        admin.setId(3L);
        admin.setUsername("admin");
        when(userMapper.selectBatchIds(List.of(3L))).thenReturn(List.of(admin));
        when(fileStorageService.size("/uploads/.trash/template/11/template.xlsx")).thenReturn(240L * 1024L);
        when(fileStorageService.size("/uploads/.trash/template/11/preview.png")).thenReturn(64L * 1024L);

        Map<String, Object> page = service.listItems(
                "all",
                "template",
                null,
                "excel",
                3L,
                LocalDateTime.of(2026, 5, 26, 0, 0),
                LocalDateTime.of(2026, 5, 26, 23, 59, 59),
                1,
                10
        );

        List<Map<String, Object>> records = (List<Map<String, Object>>) page.get("records");
        Map<String, Object> stats = (Map<String, Object>) page.get("stats");
        List<Map<String, Object>> deletedByOptions = (List<Map<String, Object>>) page.get("deletedByOptions");
        assertThat(records).hasSize(1);
        assertThat(records.get(0).get("deletedByName")).isEqualTo("admin");
        assertThat(records.get(0).get("fileSizeBytes")).isEqualTo(311296L);
        assertThat(records.get(0).get("fileSizeLabel")).isEqualTo("304KB");
        assertThat(stats.get("totalRecords")).isEqualTo(1);
        assertThat(stats.get("totalFileCount")).isEqualTo(2L);
        assertThat(stats.get("totalSizeBytes")).isEqualTo(311296L);
        assertThat(stats.get("sourceModules")).isEqualTo(List.of("模板中心"));
        assertThat(stats.get("expiredFileCount")).isEqualTo(0L);
        assertThat(stats.get("expiredSizeBytes")).isEqualTo(0L);
        assertThat(stats.get("expiredSourceModules")).isEqualTo(List.of());
        assertThat(stats.get("expiredSourceModuleCounts")).isEqualTo(List.of());
        assertThat(deletedByOptions).containsExactly(Map.of("value", 3L, "label", "admin"));
    }

    @Test
    void restoreBatchRestoresDistinctIds() {
        FileRecycleItem first = activeRecycleItem(1L, "template", 11L);
        FileRecycleItem second = activeRecycleItem(2L, "qa_answer", 12L);
        when(fileRecycleItemMapper.selectById(1L)).thenReturn(first);
        when(fileRecycleItemMapper.selectById(2L)).thenReturn(second);
        TemplateCenterItem template = new TemplateCenterItem();
        template.setId(11L);
        when(templateCenterItemMapper.selectById(11L)).thenReturn(template);
        when(qaCaseHelpAnswerMapper.selectById(12L)).thenReturn(new com.excel.forum.entity.QaCaseHelpAnswer());

        int count = service.restoreBatch(Arrays.asList(1L, 2L, 1L, null));

        assertThat(count).isEqualTo(2);
        verify(fileRecycleItemMapper).updateById(first);
        verify(fileRecycleItemMapper).updateById(second);
    }

    private FileRecycleItem activeRecycleItem(Long id, String resourceType, Long resourceId) {
        FileRecycleItem item = new FileRecycleItem();
        item.setId(id);
        item.setResourceType(resourceType);
        item.setResourceId(resourceId);
        item.setStatus("active");
        item.setFilesJson("[]");
        return item;
    }

    private FileRecycleItem recycleItem(
            Long id,
            String resourceType,
            String displayName,
            Long deletedBy,
            LocalDateTime deletedAt,
            LocalDateTime expiresAt,
            String filesJson
    ) {
        FileRecycleItem item = new FileRecycleItem();
        item.setId(id);
        item.setResourceType(resourceType);
        item.setResourceId(11L);
        item.setDisplayName(displayName);
        item.setOriginalFileUrl("/uploads/" + displayName);
        item.setRecycleFileUrl("/uploads/.trash/" + displayName);
        item.setFilesJson(filesJson);
        item.setDeletedBy(deletedBy);
        item.setDeletedAt(deletedAt);
        item.setExpiresAt(expiresAt);
        item.setStatus("active");
        return item;
    }
}
