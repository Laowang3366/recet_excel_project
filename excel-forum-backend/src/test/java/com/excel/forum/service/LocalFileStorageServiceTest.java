package com.excel.forum.service;

import com.excel.forum.config.FileStorageConfig;
import com.excel.forum.service.impl.LocalFileStorageService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.assertj.core.api.Assertions.assertThat;

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
        assertThat(source).doesNotExist();
        assertThat(tempDir.resolve(".trash/question/7/sample.xlsx")).exists();

        String restoredUrl = storage.restoreFromRecycle(recycleUrl, "/uploads/sample.xlsx");

        assertThat(restoredUrl).isEqualTo("/uploads/sample.xlsx");
        assertThat(source).exists();
        assertThat(tempDir.resolve(".trash/question/7/sample.xlsx")).doesNotExist();

        recycleUrl = storage.moveToRecycle("/uploads/sample.xlsx", "question/7");
        storage.deletePermanently(recycleUrl);

        assertThat(tempDir.resolve(".trash/question/7/sample.xlsx")).doesNotExist();
    }
}
