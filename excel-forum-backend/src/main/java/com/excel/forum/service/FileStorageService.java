package com.excel.forum.service;

import org.springframework.web.multipart.MultipartFile;

public interface FileStorageService {
    String store(MultipartFile file);
    String store(String fileName, byte[] content);
    byte[] load(String fileUrl);
    void delete(String fileUrl);
    String moveToRecycle(String fileUrl, String recycleKey);
    String restoreFromRecycle(String recycleFileUrl, String originalFileUrl);
    void deletePermanently(String fileUrl);
}
