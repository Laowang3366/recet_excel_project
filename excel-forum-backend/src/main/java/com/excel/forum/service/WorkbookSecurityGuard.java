package com.excel.forum.service;

import com.excel.forum.entity.dto.ExcelWorkbookSnapshot;
import org.apache.poi.ss.usermodel.Workbook;

public interface WorkbookSecurityGuard {
    void applyZipBombProtection();

    void assertWorkbookSafe(Workbook workbook, String label);

    void assertSnapshotSafe(ExcelWorkbookSnapshot snapshot, String label);
}
