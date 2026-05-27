package com.excel.forum.service.impl;

import com.excel.forum.config.FileStorageConfig;
import com.excel.forum.service.FileStorageService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class LocalFileStorageService implements FileStorageService {
    private final FileStorageConfig fileStorageConfig;

    @Override
    public String store(MultipartFile file) {
        try {
            String originalFilename = file.getOriginalFilename();
            String fileExtension = "";
            if (originalFilename != null && originalFilename.contains(".")) {
                fileExtension = originalFilename.substring(originalFilename.lastIndexOf("."));
            }
            String fileName = UUID.randomUUID().toString() + fileExtension;

            Path uploadPath = uploadRoot().resolve(storageFolderForExtension(fileExtension)).normalize();
            if (!uploadPath.startsWith(uploadRoot())) {
                throw new IllegalArgumentException("文件保存路径无效");
            }
            if (!Files.exists(uploadPath)) {
                Files.createDirectories(uploadPath);
            }
            Path filePath = uploadPath.resolve(fileName);
            Files.copy(file.getInputStream(), filePath);

            return toFileUrl(uploadRoot().relativize(filePath));
        } catch (IOException e) {
            throw new RuntimeException("文件上传失败", e);
        }
    }

    @Override
    public String store(String fileName, byte[] content) {
        try {
            String extension = "";
            if (fileName != null && fileName.contains(".")) {
                extension = fileName.substring(fileName.lastIndexOf("."));
            }
            String storedFileName = UUID.randomUUID() + extension;
            Path uploadPath = uploadRoot().resolve(storageFolderForExtension(extension)).normalize();
            if (!uploadPath.startsWith(uploadRoot())) {
                throw new IllegalArgumentException("文件保存路径无效");
            }
            if (!Files.exists(uploadPath)) {
                Files.createDirectories(uploadPath);
            }
            Path filePath = uploadPath.resolve(storedFileName);
            Files.write(filePath, content == null ? new byte[0] : content);
            return toFileUrl(uploadRoot().relativize(filePath));
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

    @Override
    public String moveToRecycle(String fileUrl, String recycleKey) {
        if (fileUrl == null || fileUrl.isBlank()) {
            return null;
        }
        try {
            Path source = resolveLocalPath(fileUrl);
            if (!Files.exists(source)) {
                return null;
            }
            Path uploadRoot = uploadRoot();
            Path trashRoot = uploadRoot.resolve(".trash").normalize();
            Path targetDir = trashRoot.resolve(sanitizeRecycleKey(recycleKey)).normalize();
            if (!targetDir.startsWith(trashRoot)) {
                throw new IllegalArgumentException("回收站路径无效");
            }
            Files.createDirectories(targetDir);
            Path target = uniquePath(targetDir.resolve(source.getFileName()));
            Files.move(source, target, StandardCopyOption.ATOMIC_MOVE);
            return toFileUrl(uploadRoot.relativize(target));
        } catch (IOException e) {
            throw new RuntimeException("文件移入回收站失败", e);
        }
    }

    @Override
    public String restoreFromRecycle(String recycleFileUrl, String originalFileUrl) {
        if (recycleFileUrl == null || recycleFileUrl.isBlank()) {
            return null;
        }
        try {
            Path source = resolveLocalPath(recycleFileUrl);
            if (!Files.exists(source)) {
                throw new IllegalArgumentException("回收站文件不存在");
            }
            Path uploadRoot = uploadRoot();
            Path target = resolveLocalPath(originalFileUrl);
            if (target.startsWith(uploadRoot.resolve(".trash").normalize())) {
                throw new IllegalArgumentException("恢复路径无效");
            }
            if (target.getParent() != null) {
                Files.createDirectories(target.getParent());
            }
            target = uniquePath(target);
            Files.move(source, target, StandardCopyOption.ATOMIC_MOVE);
            return toFileUrl(uploadRoot.relativize(target));
        } catch (IOException e) {
            throw new RuntimeException("文件恢复失败", e);
        }
    }

    @Override
    public void deletePermanently(String fileUrl) {
        delete(fileUrl);
    }

    @Override
    public Long size(String fileUrl) {
        if (fileUrl == null || fileUrl.isBlank()) {
            return null;
        }
        try {
            Path filePath = resolveLocalPath(fileUrl);
            return Files.exists(filePath) ? Files.size(filePath) : null;
        } catch (IllegalArgumentException | IOException ignored) {
            return null;
        }
    }

    private Path resolveLocalPath(String fileUrl) {
        if (fileUrl == null || !fileUrl.startsWith(fileStorageConfig.getLocal().getUrlPrefix())) {
            throw new IllegalArgumentException("文件地址无效");
        }
        String fileName = fileUrl.substring(fileStorageConfig.getLocal().getUrlPrefix().length() + 1);
        String decodedFileName = URLDecoder.decode(fileName, StandardCharsets.UTF_8);
        if (decodedFileName.isBlank() || containsTraversalSegment(decodedFileName)) {
            throw new IllegalArgumentException("文件地址无效");
        }
        Path uploadRoot = uploadRoot();
        Path relativePath = Paths.get(decodedFileName);
        Path resolved = uploadRoot.resolve(relativePath).normalize();
        if (relativePath.isAbsolute() || !resolved.startsWith(uploadRoot)) {
            throw new IllegalArgumentException("文件地址无效");
        }
        return resolved;
    }

    private boolean containsTraversalSegment(String path) {
        String normalized = path.replace('\\', '/');
        for (String segment : normalized.split("/")) {
            if ("..".equals(segment)) {
                return true;
            }
        }
        return false;
    }

    private Path uploadRoot() {
        return Paths.get(fileStorageConfig.getLocal().getPath()).toAbsolutePath().normalize();
    }

    private String sanitizeRecycleKey(String recycleKey) {
        if (recycleKey == null || recycleKey.isBlank()) {
            return "unclassified";
        }
        return recycleKey.replace("\\", "/").replaceAll("^/+", "").replace("..", "_");
    }

    private Path uniquePath(Path target) {
        if (!Files.exists(target)) {
            return target;
        }
        String fileName = target.getFileName().toString();
        String stem = fileName;
        String extension = "";
        int dotIndex = fileName.lastIndexOf('.');
        if (dotIndex > -1) {
            stem = fileName.substring(0, dotIndex);
            extension = fileName.substring(dotIndex);
        }
        return target.getParent().resolve(stem + "-" + UUID.randomUUID() + extension);
    }

    private String toFileUrl(Path relativePath) {
        String relativeUrl = relativePath.toString().replace('\\', '/');
        return fileStorageConfig.getLocal().getUrlPrefix() + "/" + relativeUrl;
    }

    private String storageFolderForExtension(String extension) {
        if (extension == null) {
            return "";
        }
        String normalized = extension.toLowerCase();
        return ".xlsx".equals(normalized) || ".xls".equals(normalized) ? "private" : "";
    }
}
