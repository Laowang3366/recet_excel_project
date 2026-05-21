# ExcelCC Auth Content File Security Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the highest-risk security findings from the account, content, Excel file, and practice-answer audit without changing core product routes.

**Architecture:** Keep fixes local to the modules that own the risk: Auth owns login/register/password reset and local credential storage, ExcelTemplateGradingService owns workbook path resolution, Practice owns answer disclosure throttling, and notification rendering owns HTML sanitization. Avoid new platform-wide abstractions except one small request-IP helper inside `AuthController`.

**Tech Stack:** Spring Boot 3.2, MyBatis-Plus, MockMvc/JUnit 5, React 18/Vite, Vitest.

---

## Task 1: Auth Rate Limits And Password Reset Safety

**Files:**
- Modify: `excel-forum-backend/src/main/java/com/excel/forum/controller/AuthController.java`
- Modify: `excel-forum-backend/src/main/java/com/excel/forum/util/PasswordPolicy.java`
- Modify: `excel-forum-backend/src/main/java/com/excel/forum/entity/dto/ForgotPasswordRequest.java`
- Test: `excel-forum-backend/src/test/java/com/excel/forum/controller/AuthControllerTest.java`

- [x] Add failing MockMvc tests that login/register rate-limit keys include client IP.
- [x] Add failing MockMvc test that `/api/auth/forgot-password` never updates password directly and returns a generic accepted response.
- [x] Strengthen `PasswordPolicy` to require 8-64 chars, uppercase, lowercase, digit, and symbol.
- [x] Update auth messages to the new password rule.
- [x] Change login/register/forgot endpoints to apply user/email plus IP limits.
- [x] Keep old forgot-password route as a safe compatibility endpoint that accepts the request but does not reset the password without a verifiable one-time channel.
- [x] Run `cd excel-forum-backend; mvn -Dtest=AuthControllerTest test`.

## Task 2: Remove Frontend Plaintext Password Persistence

**Files:**
- Modify: `reace_web/src/app/lib/session-store.ts`
- Modify: `reace_web/src/app/pages/Auth.tsx`
- Test: `reace_web/src/app/lib/session-store.test.ts`

- [x] Add failing Vitest coverage proving legacy remembered passwords are discarded.
- [x] Store only remembered login identifier, never password.
- [x] Rename UI copy from `记住密码` to `记住账号`.
- [x] Stop auto-filling password on login and forgot-password success.
- [x] Run `cd reace_web; npm run test -- session-store.test.ts`.

## Task 3: Safe Excel Upload Path Resolution

**Files:**
- Modify: `excel-forum-backend/src/main/java/com/excel/forum/service/impl/ExcelTemplateGradingServiceImpl.java`
- Test: `excel-forum-backend/src/test/java/com/excel/forum/service/impl/ExcelTemplateGradingServiceImplTest.java`

- [x] Add failing tests for `/uploads/../outside.xlsx` and encoded traversal-like paths.
- [x] Normalize and verify resolved paths stay under the configured upload root.
- [x] Reject blank path segments and directory traversal before reading workbook bytes.
- [x] Run `cd excel-forum-backend; mvn -Dtest=ExcelTemplateGradingServiceImplTest test`.

## Task 4: Notification HTML Sanitization

**Files:**
- Modify: `reace_web/src/app/lib/rich-content.ts`
- Modify: `reace_web/src/app/pages/NotificationDetail.tsx`
- Modify: `reace_web/src/app/components/layout/SitePopupNotificationDialog.tsx`
- Test: `reace_web/src/app/lib/rich-content.test.ts`

- [x] Add failing Vitest coverage proving script tags, inline event handlers, and `javascript:` URLs are removed.
- [x] Export a dedicated `sanitizeRichHtml` helper from `rich-content.ts`.
- [x] Use sanitized rendering for announcement details and popup notification details.
- [x] Run `cd reace_web; npm run test -- rich-content.test.ts`.

## Task 5: Practice Answer Disclosure Abuse Mitigation

**Files:**
- Modify: `excel-forum-backend/src/main/java/com/excel/forum/controller/PracticeController.java`
- Test: `excel-forum-backend/src/test/java/com/excel/forum/controller/PracticeControllerTest.java`

- [x] Add failing MockMvc coverage for per-question submit throttling.
- [x] Keep existing result response shape for legitimate submissions.
- [x] Add a secondary per-user+question limit before service submission so scripts cannot rapidly harvest answers by enumerating question IDs.
- [x] Run `cd excel-forum-backend; mvn -Dtest=PracticeControllerTest test`.

## Task 6: Full Verification

- [x] Run `cd excel-forum-backend; mvn test`.
- [x] Run `cd reace_web; npm run test`.
- [x] Run `cd reace_web; npm run build`.
- [x] Review `git diff --check`.
- [x] Summarize residual risks that still require product decisions, such as full email-based password reset and opaque resource IDs.
