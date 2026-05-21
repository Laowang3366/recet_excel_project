# ExcelCC P0 Security Closure Plan

**Goal:** Close the remaining P0 security items without changing public product routes or weakening current practice/template/QA flows.

## Task 1: Password Reset Token Flow

- [x] Add tests that forgot-password issues a backend token only for matching accounts and never returns the token.
- [x] Add tests that reset-password consumes a single-use, non-expired token and increments tokenVersion.
- [x] Add `password_reset_token` migration, entity, mapper, service, and DTO.
- [x] Keep `/api/auth/forgot-password` response generic.
- [x] Add `/api/auth/reset-password`.

## Task 2: Private File And Path Safety

- [x] Add tests that local storage rejects traversal and encoded traversal paths.
- [x] Decode and normalize local storage paths before read/move/delete.
- [x] Deny direct static access to `/uploads/private/**`; business downloads continue through API controllers.
- [x] Add security config coverage for direct private uploads.

## Task 3: Upload/Download Abuse Guardrails

- [x] Add upload tests for spoofed MIME/magic mismatch and oversized files.
- [x] Add download throttling tests for practice/template/QA file endpoints.
- [x] Keep existing business API download URLs intact.

## Task 4: Answer Leakage And Ownership Tests

- [x] Add tests that practice question detail/list payloads do not expose correct answer, explanation, answer snapshots, or raw template file URLs.
- [x] Add tests that practice history detail remains owner-only.
- [x] Add QA tests for non-owner edit/delete denial and answer file endpoint visibility.

## Task 5: Admin Security Baseline

- [x] Add tests that non-admin users cannot access `/api/admin/**`.
- [x] Add persisted admin audit log for mutating admin API calls.
- [x] Add production config tests preventing fixed default secrets/passwords and stack traces.

## Task 6: Full Verification

- [x] Run backend targeted tests.
- [x] Run `mvn test`.
- [x] Run frontend tests/build if frontend changed.
- [x] Run `git diff --check`.
