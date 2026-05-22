package com.excel.forum.service.impl;

import com.excel.forum.config.FileStorageConfig;
import com.excel.forum.service.DocumentConversionService;
import com.excel.forum.service.WorkbookSecurityGuard;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.DataFormatter;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.ss.usermodel.WorkbookFactory;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.apache.poi.xwpf.usermodel.XWPFParagraph;
import org.apache.poi.xwpf.usermodel.XWPFRun;
import org.apache.poi.xwpf.usermodel.XWPFTable;
import org.apache.poi.xwpf.usermodel.XWPFTableCell;
import org.apache.poi.xwpf.usermodel.XWPFTableRow;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.StandardCopyOption;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Comparator;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
import java.util.stream.Stream;

@Service
@RequiredArgsConstructor
@Slf4j
public class DocumentConversionServiceImpl implements DocumentConversionService {
    private static final long MAX_FILE_SIZE = 20L * 1024 * 1024;
    private static final long CONVERSION_TIMEOUT_SECONDS = 90;
    private static final DateTimeFormatter FILE_TIME_FORMAT = DateTimeFormatter.ofPattern("yyyyMMddHHmmss");
    private static final DataFormatter EXCEL_DATA_FORMATTER = new DataFormatter(Locale.SIMPLIFIED_CHINESE);

    private final FileStorageConfig fileStorageConfig;
    private final WorkbookSecurityGuard workbookSecurityGuard;

    @Override
    public Map<String, Object> convert(MultipartFile file, String targetType) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("请上传文件");
        }
        if (file.getSize() > MAX_FILE_SIZE) {
            throw new IllegalArgumentException("文件大小不能超过20MB");
        }

        ConversionTarget target = ConversionTarget.from(targetType);
        SourceType sourceType = SourceType.fromFilename(file.getOriginalFilename());
        if (sourceType == SourceType.UNKNOWN) {
            throw new IllegalArgumentException("仅支持 Word、Excel、PDF 文件");
        }
        validateSourceFileSafety(file, sourceType);

        Path uploadRoot = resolveUploadRoot();
        Path conversionDir = uploadRoot.resolve("private").resolve("conversions");
        Path tempDir = conversionDir.resolve("tmp");
        try {
            Files.createDirectories(conversionDir);
            Files.createDirectories(tempDir);

            String sourceExt = sourceType.primaryExtension(file.getOriginalFilename());
            Path sourcePath = tempDir.resolve(UUID.randomUUID() + sourceExt);
            String outputFilename = buildOutputFilename(file.getOriginalFilename(), target);
            Path outputPath = conversionDir.resolve(outputFilename);
            Files.copy(file.getInputStream(), sourcePath);

            if (shouldCopyDirectly(sourceExt, target)) {
                Files.copy(sourcePath, outputPath);
            } else {
                runConversion(sourcePath, outputPath, target);
            }

            if (!Files.exists(outputPath)) {
                throw new IllegalStateException("转换失败，未生成结果文件");
            }

            Files.deleteIfExists(sourcePath);
            return Map.of(
                    "message", "转换成功",
                    "fileName", outputFilename,
                    "url", fileStorageConfig.getLocal().getUrlPrefix() + "/private/conversions/" + outputFilename,
                    "sourceType", sourceType.label,
                    "targetType", target.label
            );
        } catch (IOException e) {
            throw new IllegalStateException("文件处理失败");
        }
    }

    private void runConversion(Path sourcePath, Path outputPath, ConversionTarget target) throws IOException {
        if (!isWindows()) {
            runLibreOfficeConversion(sourcePath, outputPath, target);
            return;
        }

        Path scriptPath = Files.createTempFile(sourcePath.getParent(), "doc-convert-", ".ps1");
        Files.writeString(scriptPath, buildPowerShellScript(), StandardCharsets.UTF_8);

        Process process = new ProcessBuilder(
                "powershell.exe",
                "-NoLogo",
                "-NoProfile",
                "-ExecutionPolicy", "Bypass",
                "-File", scriptPath.toString(),
                "-InputPath", sourcePath.toString(),
                "-OutputPath", outputPath.toString(),
                "-TargetKind", target.id
        ).redirectErrorStream(true).start();

        String output;
        try {
            boolean finished = process.waitFor(CONVERSION_TIMEOUT_SECONDS, TimeUnit.SECONDS);
            if (!finished) {
                process.destroyForcibly();
                throw new IllegalStateException("文件转换超时，请缩小文件或简化内容后重试");
            }
            output = new String(process.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
            int exitCode = process.exitValue();
            if (exitCode != 0) {
                throw new IllegalStateException(normalizeScriptError(output));
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("文件转换被中断");
        } finally {
            Files.deleteIfExists(scriptPath);
        }
    }

    private void runLibreOfficeConversion(Path sourcePath, Path outputPath, ConversionTarget target) throws IOException {
        String officeExecutable = findOfficeExecutable();
        if (!StringUtils.hasText(officeExecutable)) {
            throw new IllegalStateException("服务器未安装 LibreOffice，暂时无法执行文件转换");
        }

        String sourceExtension = SourceType.extensionOf(sourcePath.getFileName().toString());
        if (target == ConversionTarget.WORD && (".xls".equals(sourceExtension) || ".xlsx".equals(sourceExtension))) {
            convertExcelWorkbookToWord(sourcePath, outputPath);
            return;
        }

        String filter = switch (target) {
            case PDF -> "pdf";
            case WORD -> "docx";
            case EXCEL -> "xlsx";
        };

        Path profileDir = Files.createTempDirectory(sourcePath.getParent(), "lo-profile-");
        try {
            ProcessBuilder processBuilder = new ProcessBuilder(
                    officeExecutable,
                    "--headless",
                    "-env:UserInstallation=" + profileDir.toUri(),
                    "--convert-to", filter,
                    "--outdir", outputPath.getParent().toString(),
                    sourcePath.toString()
            ).redirectErrorStream(true);
            processBuilder.directory(sourcePath.getParent().toFile());
            processBuilder.environment().put("HOME", profileDir.toString());
            Process process = processBuilder.start();
            boolean finished = process.waitFor(CONVERSION_TIMEOUT_SECONDS, TimeUnit.SECONDS);
            if (!finished) {
                process.destroyForcibly();
                throw new IllegalStateException("文件转换超时，请缩小文件或简化内容后重试");
            }
            String output = new String(process.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
            int exitCode = process.exitValue();
            if (exitCode != 0) {
                throw new IllegalStateException(normalizeLibreOfficeError(output));
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("文件转换被中断");
        } finally {
            deleteDirectory(profileDir);
        }

        Path generatedPath = outputPath.getParent().resolve(replaceExtension(sourcePath.getFileName().toString(), target.extension));
        if (!Files.exists(generatedPath)) {
            throw new IllegalStateException("当前服务器暂不支持该文件格式组合");
        }
        if (!generatedPath.equals(outputPath)) {
            Files.move(generatedPath, outputPath, StandardCopyOption.REPLACE_EXISTING);
        }
    }

    private boolean isWindows() {
        return System.getProperty("os.name", "").toLowerCase(Locale.ROOT).contains("win");
    }

    private void validateSourceFileSafety(MultipartFile file, SourceType sourceType) {
        String extension = SourceType.extensionOf(file.getOriginalFilename());
        if (".doc".equals(extension) || ".xls".equals(extension)) {
            throw new IllegalArgumentException("不支持旧版 Office 文件，请先转为 docx/xlsx 后再上传");
        }
        if (".docx".equals(extension) || ".xlsx".equals(extension)) {
            rejectDangerousOfficePackage(file);
        }
        if (sourceType == SourceType.EXCEL) {
            workbookSecurityGuard.applyZipBombProtection();
            try (InputStream inputStream = file.getInputStream();
                 Workbook workbook = WorkbookFactory.create(inputStream)) {
                workbookSecurityGuard.assertWorkbookSafe(workbook, "转换文件");
            } catch (IllegalArgumentException exception) {
                throw exception;
            } catch (Exception exception) {
                throw new IllegalArgumentException("Excel 文件解析失败");
            }
        }
    }

    private void rejectDangerousOfficePackage(MultipartFile file) {
        try (InputStream inputStream = file.getInputStream();
             ZipInputStream zipInputStream = new ZipInputStream(inputStream)) {
            ZipEntry entry;
            while ((entry = zipInputStream.getNextEntry()) != null) {
                String name = entry.getName() == null ? "" : entry.getName().toLowerCase(Locale.ROOT);
                if (name.endsWith("vbaproject.bin")
                        || name.contains("/externallinks/")
                        || name.contains("/embeddings/")
                        || name.contains("/oleobjects/")) {
                    throw new IllegalArgumentException("文件包含宏、外部链接或嵌入对象，无法转换");
                }
            }
        } catch (IllegalArgumentException exception) {
            throw exception;
        } catch (IOException exception) {
            throw new IllegalArgumentException("文件结构解析失败");
        }
    }

    private String findOfficeExecutable() {
        for (String candidate : new String[] { "soffice", "libreoffice" }) {
            try {
                Process process = new ProcessBuilder(candidate, "--version")
                        .redirectErrorStream(true)
                        .start();
                int exitCode = process.waitFor();
                if (exitCode == 0) {
                    return candidate;
                }
            } catch (Exception exception) {
                log.debug("Office executable candidate is unavailable: {}", candidate, exception);
            }
        }
        return null;
    }

    private String normalizeLibreOfficeError(String output) {
        String message = output == null ? "" : output.trim();
        if (message.contains("Error: source file could not be loaded")) {
            return "源文件无法读取，可能已损坏或格式不受支持";
        }
        if (message.contains("no export filter")) {
            return "当前服务器暂不支持该文件格式组合";
        }
        return StringUtils.hasText(message) ? message : "文件转换失败";
    }

    private void deleteDirectory(Path path) {
        if (path == null || !Files.exists(path)) {
            return;
        }
        try (Stream<Path> paths = Files.walk(path)) {
            paths.sorted(Comparator.reverseOrder()).forEach(item -> {
                try {
                    Files.deleteIfExists(item);
                } catch (IOException exception) {
                    log.debug("Failed to delete conversion temp path: {}", item, exception);
                }
            });
        } catch (IOException exception) {
            log.debug("Failed to walk conversion temp directory: {}", path, exception);
        }
    }

    private String replaceExtension(String filename, String extension) {
        int dotIndex = filename.lastIndexOf('.');
        String baseName = dotIndex > 0 ? filename.substring(0, dotIndex) : filename;
        return baseName + extension;
    }

    private void convertExcelWorkbookToWord(Path sourcePath, Path outputPath) throws IOException {
        try (InputStream inputStream = Files.newInputStream(sourcePath);
             Workbook workbook = WorkbookFactory.create(inputStream);
             XWPFDocument document = new XWPFDocument()) {
            for (int sheetIndex = 0; sheetIndex < workbook.getNumberOfSheets(); sheetIndex++) {
                Sheet sheet = workbook.getSheetAt(sheetIndex);
                int lastRowNum = sheet.getLastRowNum();
                int maxColumnCount = resolveMaxColumnCount(sheet);
                if (lastRowNum < 0 || maxColumnCount <= 0) {
                    continue;
                }

                if (sheetIndex > 0) {
                    document.createParagraph().setPageBreak(true);
                }

                XWPFParagraph titleParagraph = document.createParagraph();
                XWPFRun titleRun = titleParagraph.createRun();
                titleRun.setText(sheet.getSheetName());
                titleRun.setBold(true);
                titleRun.setFontSize(14);

                XWPFTable table = document.createTable(lastRowNum + 1, maxColumnCount);
                table.setWidth("100%");

                for (int rowIndex = 0; rowIndex <= lastRowNum; rowIndex++) {
                    Row row = sheet.getRow(rowIndex);
                    XWPFTableRow tableRow = table.getRow(rowIndex);
                    for (int columnIndex = 0; columnIndex < maxColumnCount; columnIndex++) {
                        XWPFTableCell cell = tableRow.getCell(columnIndex);
                        if (cell == null) {
                            cell = tableRow.addNewTableCell();
                        }
                        cell.removeParagraph(0);
                        XWPFParagraph paragraph = cell.addParagraph();
                        paragraph.setSpacingAfter(0);
                        paragraph.setSpacingBefore(0);
                        XWPFRun run = paragraph.createRun();
                        String text = "";
                        if (row != null) {
                            Cell workbookCell = row.getCell(columnIndex);
                            if (workbookCell != null) {
                                text = EXCEL_DATA_FORMATTER.formatCellValue(workbookCell);
                            }
                        }
                        run.setText(StringUtils.hasText(text) ? text : "");
                        run.setFontFamily("Noto Sans CJK SC");
                        run.setFontSize(10);
                    }
                }
            }

            if (document.getBodyElements().isEmpty()) {
                throw new IllegalStateException("Excel 文件没有可转换的内容");
            }

            try (OutputStream outputStream = Files.newOutputStream(outputPath)) {
                document.write(outputStream);
            }
        } catch (IllegalStateException e) {
            throw e;
        } catch (Exception e) {
            throw new IllegalStateException("Excel 转 Word 失败");
        }
    }

    private int resolveMaxColumnCount(Sheet sheet) {
        int maxColumnCount = 0;
        for (Row row : sheet) {
            maxColumnCount = Math.max(maxColumnCount, row.getLastCellNum());
        }
        return Math.max(maxColumnCount, 0);
    }

    private String normalizeScriptError(String output) {
        String message = output == null ? "" : output.trim();
        if (message.contains("ActiveX component can't create object")
                || message.contains("Retrieving the COM class factory component")
                || message.contains("Cannot create ActiveX component")) {
            return "本机未安装可用的 Microsoft Word/Excel，无法执行文件转换";
        }
        if (message.contains("PDF cannot be opened") || message.contains("无法打开")) {
            return "文件无法打开，可能已损坏或格式不受支持";
        }
        return StringUtils.hasText(message) ? message : "文件转换失败";
    }

    private Path resolveUploadRoot() {
        String uploadDir = fileStorageConfig.getLocal().getPath();
        Path path = Paths.get(uploadDir);
        return path.isAbsolute() ? path : Paths.get("").toAbsolutePath().resolve(path).normalize();
    }

    private String buildOutputFilename(String originalFilename, ConversionTarget target) {
        String baseName = "converted-file";
        if (StringUtils.hasText(originalFilename)) {
            int dotIndex = originalFilename.lastIndexOf('.');
            baseName = dotIndex > 0 ? originalFilename.substring(0, dotIndex) : originalFilename;
        }
        String sanitized = baseName.replaceAll("[^A-Za-z0-9\\u4e00-\\u9fa5_-]", "-");
        sanitized = sanitized.replaceAll("-{2,}", "-");
        if (!StringUtils.hasText(sanitized)) {
            sanitized = "converted-file";
        }
        return sanitized + "-" + LocalDateTime.now().format(FILE_TIME_FORMAT) + target.extension;
    }

    private boolean shouldCopyDirectly(String sourceExtension, ConversionTarget target) {
        return (".pdf".equals(sourceExtension) && target == ConversionTarget.PDF)
                || (".docx".equals(sourceExtension) && target == ConversionTarget.WORD)
                || (".xlsx".equals(sourceExtension) && target == ConversionTarget.EXCEL);
    }

    private String buildPowerShellScript() {
        return """
param(
  [Parameter(Mandatory=$true)][string]$InputPath,
  [Parameter(Mandatory=$true)][string]$OutputPath,
  [Parameter(Mandatory=$true)][ValidateSet('pdf','word','excel')][string]$TargetKind
)
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

function Release-ComObject($obj) {
  if ($null -ne $obj) {
    try { [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($obj) } catch {}
  }
}

function Convert-WordFile {
  param([string]$SourcePath,[string]$DestinationPath,[string]$Format)
  $word = $null
  $document = $null
  try {
    $word = New-Object -ComObject Word.Application
    $word.Visible = $false
    $word.DisplayAlerts = 0
    $document = $word.Documents.Open($SourcePath, $false, $true)
    switch ($Format) {
      'pdf' { $formatCode = 17 }
      'docx' { $formatCode = 16 }
      'filteredhtml' { $formatCode = 10 }
      default { throw "Unsupported Word format: $Format" }
    }
    $document.SaveAs2($DestinationPath, $formatCode)
  }
  finally {
    if ($document) { try { $document.Close($false) } catch {} }
    if ($word) { try { $word.Quit() } catch {} }
    Release-ComObject $document
    Release-ComObject $word
  }
}

function Convert-ExcelFile {
  param([string]$SourcePath,[string]$DestinationPath,[string]$Format)
  $excel = $null
  $workbook = $null
  try {
    $excel = New-Object -ComObject Excel.Application
    $excel.Visible = $false
    $excel.DisplayAlerts = $false
    $workbook = $excel.Workbooks.Open($SourcePath)
    switch ($Format) {
      'pdf' { $workbook.ExportAsFixedFormat(0, $DestinationPath) }
      'xlsx' { $workbook.SaveAs($DestinationPath, 51) }
      default { throw "Unsupported Excel format: $Format" }
    }
  }
  finally {
    if ($workbook) { try { $workbook.Close($false) } catch {} }
    if ($excel) { try { $excel.Quit() } catch {} }
    Release-ComObject $workbook
    Release-ComObject $excel
  }
}

function Convert-ExcelToWord {
  param([string]$SourcePath,[string]$DestinationPath)
  $excel = $null
  $workbook = $null
  $word = $null
  $document = $null
  try {
    $excel = New-Object -ComObject Excel.Application
    $excel.Visible = $false
    $excel.DisplayAlerts = $false
    $workbook = $excel.Workbooks.Open($SourcePath)

    $word = New-Object -ComObject Word.Application
    $word.Visible = $false
    $word.DisplayAlerts = 0
    $document = $word.Documents.Add()

    $firstSheet = $true
    foreach ($sheet in $workbook.Worksheets) {
      $usedRange = $sheet.UsedRange
      $cellCount = [int]$usedRange.Cells.Count
      $hasContent = $cellCount -gt 1 -or ([string]$usedRange.Text).Trim().Length -gt 0
      if (-not $hasContent) {
        Release-ComObject $usedRange
        Release-ComObject $sheet
        continue
      }
      if (-not $firstSheet) {
        $word.Selection.InsertBreak(7)
      }
      $firstSheet = $false
      $word.Selection.TypeText($sheet.Name)
      $word.Selection.TypeParagraph()
      $usedRange.Copy() | Out-Null
      $word.Selection.Paste()
      $word.Selection.TypeParagraph()
      Release-ComObject $usedRange
      Release-ComObject $sheet
    }

    $document.SaveAs2($DestinationPath, 16)
  }
  finally {
    if ($document) { try { $document.Close($false) } catch {} }
    if ($word) { try { $word.Quit() } catch {} }
    if ($workbook) { try { $workbook.Close($false) } catch {} }
    if ($excel) { try { $excel.Quit() } catch {} }
    Release-ComObject $document
    Release-ComObject $word
    Release-ComObject $workbook
    Release-ComObject $excel
  }
}

$inputExtension = [System.IO.Path]::GetExtension($InputPath).ToLowerInvariant()
$tempDir = [System.IO.Path]::GetDirectoryName($InputPath)
$tempHtml = [System.IO.Path]::Combine($tempDir, ([System.Guid]::NewGuid().ToString() + '.html'))

try {
  switch ($TargetKind) {
    'pdf' {
      switch ($inputExtension) {
        '.doc' { Convert-WordFile -SourcePath $InputPath -DestinationPath $OutputPath -Format 'pdf' }
        '.docx' { Convert-WordFile -SourcePath $InputPath -DestinationPath $OutputPath -Format 'pdf' }
        '.xls' { Convert-ExcelFile -SourcePath $InputPath -DestinationPath $OutputPath -Format 'pdf' }
        '.xlsx' { Convert-ExcelFile -SourcePath $InputPath -DestinationPath $OutputPath -Format 'pdf' }
        '.pdf' { Copy-Item -LiteralPath $InputPath -Destination $OutputPath -Force }
        default { throw "Unsupported source type for PDF conversion: $inputExtension" }
      }
    }
    'word' {
      switch ($inputExtension) {
        '.doc' { Convert-WordFile -SourcePath $InputPath -DestinationPath $OutputPath -Format 'docx' }
        '.docx' { Copy-Item -LiteralPath $InputPath -Destination $OutputPath -Force }
        '.pdf' { Convert-WordFile -SourcePath $InputPath -DestinationPath $OutputPath -Format 'docx' }
        '.xls' { Convert-ExcelToWord -SourcePath $InputPath -DestinationPath $OutputPath }
        '.xlsx' { Convert-ExcelToWord -SourcePath $InputPath -DestinationPath $OutputPath }
        default { throw "Unsupported source type for Word conversion: $inputExtension" }
      }
    }
    'excel' {
      switch ($inputExtension) {
        '.xls' { Convert-ExcelFile -SourcePath $InputPath -DestinationPath $OutputPath -Format 'xlsx' }
        '.xlsx' { Copy-Item -LiteralPath $InputPath -Destination $OutputPath -Force }
        '.doc' { Convert-WordFile -SourcePath $InputPath -DestinationPath $tempHtml -Format 'filteredhtml'; Convert-ExcelFile -SourcePath $tempHtml -DestinationPath $OutputPath -Format 'xlsx' }
        '.docx' { Convert-WordFile -SourcePath $InputPath -DestinationPath $tempHtml -Format 'filteredhtml'; Convert-ExcelFile -SourcePath $tempHtml -DestinationPath $OutputPath -Format 'xlsx' }
        '.pdf' { Convert-WordFile -SourcePath $InputPath -DestinationPath $tempHtml -Format 'filteredhtml'; Convert-ExcelFile -SourcePath $tempHtml -DestinationPath $OutputPath -Format 'xlsx' }
        default { throw "Unsupported source type for Excel conversion: $inputExtension" }
      }
    }
  }
}
finally {
  if (Test-Path -LiteralPath $tempHtml) {
    Remove-Item -LiteralPath $tempHtml -Force -ErrorAction SilentlyContinue
  }
}
""";
    }

    private enum ConversionTarget {
        PDF("pdf", ".pdf", "PDF"),
        WORD("word", ".docx", "Word"),
        EXCEL("excel", ".xlsx", "Excel");

        private final String id;
        private final String extension;
        private final String label;

        ConversionTarget(String id, String extension, String label) {
            this.id = id;
            this.extension = extension;
            this.label = label;
        }

        private static ConversionTarget from(String raw) {
            if (!StringUtils.hasText(raw)) {
                throw new IllegalArgumentException("请选择目标格式");
            }
            return switch (raw.trim().toLowerCase(Locale.ROOT)) {
                case "pdf" -> PDF;
                case "word", "doc", "docx" -> WORD;
                case "excel", "xls", "xlsx" -> EXCEL;
                default -> throw new IllegalArgumentException("不支持的目标格式");
            };
        }
    }

    private enum SourceType {
        WORD("word"),
        EXCEL("excel"),
        PDF("pdf"),
        UNKNOWN("unknown");

        private final String label;

        SourceType(String label) {
            this.label = label;
        }

        private static SourceType fromFilename(String originalFilename) {
            String ext = extensionOf(originalFilename);
            return switch (ext) {
                case ".doc", ".docx" -> WORD;
                case ".xls", ".xlsx" -> EXCEL;
                case ".pdf" -> PDF;
                default -> UNKNOWN;
            };
        }

        private String primaryExtension(String originalFilename) {
            String ext = extensionOf(originalFilename);
            return StringUtils.hasText(ext) ? ext : switch (this) {
                case WORD -> ".docx";
                case EXCEL -> ".xlsx";
                case PDF -> ".pdf";
                case UNKNOWN -> "";
            };
        }

        private static String extensionOf(String filename) {
            if (!StringUtils.hasText(filename) || !filename.contains(".")) {
                return "";
            }
            return filename.substring(filename.lastIndexOf('.')).toLowerCase(Locale.ROOT);
        }
    }
}
