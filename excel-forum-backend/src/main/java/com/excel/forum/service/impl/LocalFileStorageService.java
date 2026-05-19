package com.excel.forum.service.impl;

import com.excel.forum.config.FileStorageConfig;
import com.excel.forum.service.FileStorageService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class LocalFileStorageService implements FileStorageService {
    private final FileStorageConfig fileStorageConfig;

    @Override
    public String store(MultipartFile file) {
        try {
            String uploadDir = fileStorageConfig.getLocal().getPath();
            Path uploadPath = Paths.get(uploadDir);
            if (!Files.exists(uploadPath)) {
                Files.createDirectories(uploadPath);
            }

            String originalFilename = file.getOriginalFilename();
            String fileExtension = "";
            if (originalFilename != null && originalFilename.contains(".")) {
                fileExtension = originalFilename.substring(originalFilename.lastIndexOf("."));
            }
            String fileName = UUID.randomUUID().toString() + fileExtension;

            Path filePath = uploadPath.resolve(fileName);
            Files.copy(file.getInputStream(), filePath);

            return fileStorageConfig.getLocal().getUrlPrefix() + "/" + fileName;
        } catch (IOException e) {
            throw new RuntimeException("文件上传失败", e);
        }
    }

    @Override
    public String store(String fileName, byte[] content) {
        try {
            String uploadDir = fileStorageConfig.getLocal().getPath();
            Path uploadPath = Paths.get(uploadDir);
            if (!Files.exists(uploadPath)) {
                Files.createDirectories(uploadPath);
            }

            String extension = "";
            if (fileName != null && fileName.contains(".")) {
                extension = fileName.substring(fileName.lastIndexOf("."));
            }
            String storedFileName = UUID.randomUUID() + extension;
            Files.write(uploadPath.resolve(storedFileName), content == null ? new byte[0] : content);
            return fileStorageConfig.getLocal().getUrlPrefix() + "/" + storedFileName;
        } catch (IOException e) {
            throw new RuntimeException("文件保存失败", e);
        }
    }

    @Override
    public byte[] load(String fileUrl) {
        Path filePath = resolveLocalPath(fileUrl);
        if (!Files.exists(filePath)) {
            throw new IllegalArgumentException("文件不存在");
        }
        try {
            return Files.readAllBytes(filePath);
        } catch (IOException e) {
            throw new IllegalArgumentException("文件读取失败", e);
        }
    }

    @Override
    public void delete(String fileUrl) {
        if (fileUrl == null || !fileUrl.startsWith(fileStorageConfig.getLocal().getUrlPrefix())) {
            return;
        }
        Path filePath = resolveLocalPath(fileUrl);
        try {
            Files.deleteIfExists(filePath);
        } catch (IOException e) {
            // 忽略删除失败
        }
    }

    private Path resolveLocalPath(String fileUrl) {
        if (fileUrl == null || !fileUrl.startsWith(fileStorageConfig.getLocal().getUrlPrefix())) {
            throw new IllegalArgumentException("文件地址无效");
        }
        String fileName = fileUrl.substring(fileStorageConfig.getLocal().getUrlPrefix().length() + 1);
        Path uploadRoot = Paths.get(fileStorageConfig.getLocal().getPath()).toAbsolutePath().normalize();
        Path resolved = uploadRoot.resolve(fileName).normalize();
        if (!resolved.startsWith(uploadRoot)) {
            throw new IllegalArgumentException("文件地址无效");
        }
        return resolved;
    }
}
