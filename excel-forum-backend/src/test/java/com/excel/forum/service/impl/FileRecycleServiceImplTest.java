package com.excel.forum.service.impl;

import com.excel.forum.entity.FileRecycleItem;
import com.excel.forum.entity.TemplateCenterItem;
import com.excel.forum.mapper.FileRecycleItemMapper;
import com.excel.forum.mapper.QaCaseHelpAnswerMapper;
import com.excel.forum.mapper.QaCaseHelpMapper;
import com.excel.forum.mapper.QuestionExcelTemplateMapper;
import com.excel.forum.mapper.QuestionMapper;
import com.excel.forum.mapper.TemplateCenterItemMapper;
import com.excel.forum.service.FileStorageService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;

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
}
