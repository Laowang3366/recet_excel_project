package com.excel.forum.service.impl;

import com.excel.forum.config.FileStorageConfig;
import com.excel.forum.service.WorkbookSecurityGuard;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.mock.web.MockMultipartFile;

import java.nio.file.Path;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;

class DocumentConversionServiceImplTest {
    @TempDir
    Path tempDir;

    @Test
    void rejectsLegacyOfficeFilesBeforeStartingConversionProcess() {
        DocumentConversionServiceImpl service = new DocumentConversionServiceImpl(fileStorageConfig(), mock(WorkbookSecurityGuard.class));
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "legacy.xls",
                "application/vnd.ms-excel",
                new byte[] { (byte) 0xD0, (byte) 0xCF, 0x11, (byte) 0xE0 }
        );

        assertThatThrownBy(() -> service.convert(file, "excel"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("不支持旧版 Office 文件");
    }

    private FileStorageConfig fileStorageConfig() {
        FileStorageConfig config = new FileStorageConfig();
        FileStorageConfig.Local local = new FileStorageConfig.Local();
        local.setPath(tempDir.toString());
        local.setUrlPrefix("/uploads");
        config.setLocal(local);
        return config;
    }
}
