package com.excel.forum.controller;

import com.excel.forum.entity.dto.ExcelWorkbookSnapshot;
import com.excel.forum.service.ExcelTemplateGradingService;
import com.excel.forum.service.FileStorageService;
import com.excel.forum.service.RateLimitResult;
import com.excel.forum.service.RateLimitService;
import com.excel.forum.service.WorkbookSecurityGuard;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.ss.usermodel.WorkbookFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/upload")
@RequiredArgsConstructor
public class UploadController {
    private final FileStorageService fileStorageService;
    private final RateLimitService rateLimitService;
    private final WorkbookSecurityGuard workbookSecurityGuard;
    private final ExcelTemplateGradingService excelTemplateGradingService;

    private static final int MAX_UPLOADS_PER_MINUTE = 10;

    @PostMapping
    public ResponseEntity<?> uploadFile(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "scene", required = false) String scene,
            HttpServletRequest request) {
        if (file.isEmpty()) {
            return ResponseEntity.badRequest().body("文件为空");
        }

        if (!isAllowedFileType(file, scene)) {
            return ResponseEntity.badRequest().body("不支持的文件类型");
        }

        // 检查文件大小 (20MB)
        if (file.getSize() > 20 * 1024 * 1024) {
            return ResponseEntity.badRequest().body("文件大小超过限制");
        }

        Long userId = (Long) request.getAttribute("userId");
        if (userId != null) {
            ResponseEntity<?> limited = toLimitResponse(rateLimitService.check(
                    "upload:user:" + userId,
                    MAX_UPLOADS_PER_MINUTE,
                    Duration.ofMinutes(1),
                    "上传频率过高，请稍后再试"
            ));
            if (limited != null) {
                return limited;
            }
        }

        if (isExcelUpload(file)) {
            validateWorkbookSecurity(file);
        }

        String fileUrl = fileStorageService.store(file);
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("url", fileUrl);
        if (isExcelUpload(file)) {
            ExcelWorkbookSnapshot workbook = excelTemplateGradingService.loadWorkbookSnapshot(fileUrl);
            response.put("workbook", workbook);
        }
        return ResponseEntity.ok(response);
    }

    private boolean isAllowedFileType(MultipartFile file, String scene) {
        String originalFilename = file.getOriginalFilename() == null ? "" : file.getOriginalFilename().toLowerCase();
        String contentType = file.getContentType() == null ? "" : file.getContentType().toLowerCase();
        byte[] magic = readMagic(file);
        if (magic.length == 0) return false;

        boolean isExcel = (originalFilename.endsWith(".xlsx") && isZipFile(magic) &&
                isContentTypeCompatible(contentType,
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                        "application/octet-stream")) ||
                (originalFilename.endsWith(".xls") && isOleFile(magic) &&
                        isContentTypeCompatible(contentType,
                                "application/vnd.ms-excel",
                                "application/octet-stream"));
        if ("reply_attachment".equalsIgnoreCase(scene)) {
            return isExcel;
        }

        return isExcel ||
               (originalFilename.endsWith(".pdf") && isPdfFile(magic) &&
                       isContentTypeCompatible(contentType, "application/pdf", "application/octet-stream")) ||
               (originalFilename.endsWith(".png") && isPngFile(magic) &&
                       isContentTypeCompatible(contentType, "image/png", "application/octet-stream")) ||
               ((originalFilename.endsWith(".jpg") || originalFilename.endsWith(".jpeg")) && isJpegFile(magic) &&
                       isContentTypeCompatible(contentType, "image/jpeg", "image/jpg", "image/pjpeg", "application/octet-stream")) ||
               (originalFilename.endsWith(".gif") && isGifFile(magic) &&
                       isContentTypeCompatible(contentType, "image/gif", "application/octet-stream")) ||
               (originalFilename.endsWith(".webp") && isWebpFile(magic) &&
                       isContentTypeCompatible(contentType, "image/webp", "application/octet-stream"));
    }

    private boolean isExcelUpload(MultipartFile file) {
        String originalFilename = file.getOriginalFilename() == null ? "" : file.getOriginalFilename().toLowerCase();
        return originalFilename.endsWith(".xlsx") || originalFilename.endsWith(".xls");
    }

    private void validateWorkbookSecurity(MultipartFile file) {
        workbookSecurityGuard.applyZipBombProtection();
        try (InputStream inputStream = file.getInputStream();
             Workbook workbook = WorkbookFactory.create(inputStream)) {
            workbookSecurityGuard.assertWorkbookSafe(workbook, "上传文件");
        } catch (IllegalArgumentException exception) {
            throw exception;
        } catch (Exception exception) {
            throw new IllegalArgumentException("Excel 文件解析失败");
        }
    }

    private boolean isContentTypeCompatible(String contentType, String... acceptedTypes) {
        if (contentType == null || contentType.isBlank()) {
            return true;
        }
        for (String acceptedType : acceptedTypes) {
            if (contentType.equals(acceptedType) || contentType.startsWith(acceptedType + ";")) {
                return true;
            }
        }
        return false;
    }

    private byte[] readMagic(MultipartFile file) {
        try (InputStream inputStream = file.getInputStream()) {
            byte[] magic = new byte[12];
            int read = inputStream.read(magic);
            if (read <= 0) return new byte[0];
            if (read == magic.length) return magic;
            byte[] actual = new byte[read];
            System.arraycopy(magic, 0, actual, 0, read);
            return actual;
        } catch (IOException e) {
            return new byte[0];
        }
    }

    private boolean isZipFile(byte[] magic) {
        return magic.length >= 4 && magic[0] == 'P' && magic[1] == 'K';
    }

    private boolean isOleFile(byte[] magic) {
        return magic.length >= 8 &&
                (magic[0] & 0xFF) == 0xD0 &&
                (magic[1] & 0xFF) == 0xCF &&
                (magic[2] & 0xFF) == 0x11 &&
                (magic[3] & 0xFF) == 0xE0;
    }

    private boolean isPdfFile(byte[] magic) {
        return magic.length >= 5 && magic[0] == '%' && magic[1] == 'P' && magic[2] == 'D' && magic[3] == 'F' && magic[4] == '-';
    }

    private boolean isPngFile(byte[] magic) {
        return magic.length >= 8 &&
                (magic[0] & 0xFF) == 0x89 &&
                magic[1] == 'P' &&
                magic[2] == 'N' &&
                magic[3] == 'G';
    }

    private boolean isJpegFile(byte[] magic) {
        return magic.length >= 3 &&
                (magic[0] & 0xFF) == 0xFF &&
                (magic[1] & 0xFF) == 0xD8 &&
                (magic[2] & 0xFF) == 0xFF;
    }

    private boolean isGifFile(byte[] magic) {
        return magic.length >= 6 &&
                magic[0] == 'G' &&
                magic[1] == 'I' &&
                magic[2] == 'F';
    }

    private boolean isWebpFile(byte[] magic) {
        return magic.length >= 12 &&
                magic[0] == 'R' &&
                magic[1] == 'I' &&
                magic[2] == 'F' &&
                magic[3] == 'F' &&
                magic[8] == 'W' &&
                magic[9] == 'E' &&
                magic[10] == 'B' &&
                magic[11] == 'P';
    }

    private ResponseEntity<?> toLimitResponse(RateLimitResult result) {
        if (result == null || result.allowed()) {
            return null;
        }
        return ResponseEntity.status(429).body(Map.of(
                "message", result.message(),
                "retryAfterSeconds", result.retryAfterSeconds()
        ));
    }
}
