package com.excel.forum.service;

import com.excel.forum.config.FileStorageConfig;
import com.excel.forum.service.impl.LocalFileStorageService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.mock.web.MockMultipartFile;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class LocalFileStorageServiceTest {

    @TempDir
    Path tempDir;

    @Test
    void movesRestoresAndPurgesUploadedFile() throws Exception {
        FileStorageConfig config = new FileStorageConfig();
        FileStorageConfig.Local local = new FileStorageConfig.Local();
        local.setPath(tempDir.toString());
        local.setUrlPrefix("/uploads");
        config.setLocal(local);

        LocalFileStorageService storage = new LocalFileStorageService(config);
        Path source = tempDir.resolve("sample.xlsx");
        Files.writeString(source, "excel-content", StandardCharsets.UTF_8);

        String recycleUrl = storage.moveToRecycle("/uploads/sample.xlsx", "question/7");

        assertThat(recycleUrl).isEqualTo("/uploads/.trash/question/7/sample.xlsx");
        assertThat(storage.size(recycleUrl)).isEqualTo(13L);
        assertThat(source).doesNotExist();
        assertThat(tempDir.resolve(".trash/question/7/sample.xlsx")).exists();

        String restoredUrl = storage.restoreFromRecycle(recycleUrl, "/uploads/sample.xlsx");

        assertThat(restoredUrl).isEqualTo("/uploads/sample.xlsx");
        assertThat(source).exists();
        assertThat(tempDir.resolve(".trash/question/7/sample.xlsx")).doesNotExist();

        recycleUrl = storage.moveToRecycle("/uploads/sample.xlsx", "question/7");
        storage.deletePermanently(recycleUrl);

        assertThat(tempDir.resolve(".trash/question/7/sample.xlsx")).doesNotExist();
        assertThat(storage.size(recycleUrl)).isNull();
    }

    @Test
    void storesExcelFilesUnderPrivatePrefix() {
        LocalFileStorageService storage = new LocalFileStorageService(config());
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "answer.xlsx",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                new byte[] {1, 2, 3}
        );

        String fileUrl = storage.store(file);

        assertThat(fileUrl).startsWith("/uploads/private/");
        assertThat(tempDir.resolve(fileUrl.substring("/uploads/".length()))).exists();
    }

    @Test
    void rejectsTraversalWhenLoadingFiles() throws Exception {
        LocalFileStorageService storage = new LocalFileStorageService(config());
        Files.writeString(tempDir.resolve("sample.xlsx"), "excel-content", StandardCharsets.UTF_8);

        assertThatThrownBy(() -> storage.load("/uploads/private/../sample.xlsx"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("文件地址无效");
        assertThatThrownBy(() -> storage.load("/uploads/private/%2e%2e/sample.xlsx"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("文件地址无效");
    }

    @Test
    void keepsImageUploadsPublic() {
        LocalFileStorageService storage = new LocalFileStorageService(config());
        MockMultipartFile file = new MockMultipartFile("file", "cover.png", "image/png", new byte[] {1, 2, 3});

        String fileUrl = storage.store(file);

        assertThat(fileUrl).startsWith("/uploads/");
        assertThat(fileUrl).doesNotContain("/private/");
    }

    private FileStorageConfig config() {
        FileStorageConfig config = new FileStorageConfig();
        FileStorageConfig.Local local = new FileStorageConfig.Local();
        local.setPath(tempDir.toString());
        local.setUrlPrefix("/uploads");
        config.setLocal(local);
        return config;
    }
}
