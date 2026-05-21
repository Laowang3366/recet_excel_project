# ExcelCC Practice Upload Download Risk Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development when implementing independent backend/frontend/deploy slices, or superpowers:executing-plans when implementing sequentially. Keep every checkbox updated as work completes.

**Goal:** Harden ExcelCC against scripted practice submissions, malicious or oversized QA/template uploads, and high-concurrency file downloads without changing existing public product flows.

**Architecture:** Add small, focused backend services for rate limiting, workbook safety, controlled file access, and reward idempotency. Keep Practice, QA, Template Center, and Notification modules as callers only. Apply Nginx limits as an outer guard, with application-level business limits as the source of truth.

**Tech Stack:** Spring Boot 3.2, MyBatis-Plus, MySQL/Flyway, Redis, Apache POI, React 18/Vite, Nginx, existing deploy script `scripts/deploy/production-deploy.sh`.

## Current Implementation Progress

- [x] Working branch created: `codex/security-hardening`.
- [x] Unified `RateLimitService` added and applied to auth, AI, upload, practice submit, question download, template download, QA create/answer/download/snapshot flows.
- [x] Reward idempotency migration and service changes added; practice/campaign rewards now use deterministic idempotency keys and atomic point balance updates.
- [x] `WorkbookSecurityGuard` added and wired into upload, template parsing, workbook materialization, grading, QA upload, and QA snapshot submission.
- [x] Sensitive Excel uploads now go under `/uploads/private/`; `/uploads/private/**` requires authentication and `/uploads/.trash/**` requires admin.
- [x] Public practice payloads no longer expose raw `templateFileUrl`.
- [x] User-facing frontend no longer calls `/api/practice/template-snapshot?fileUrl=...`; uploaded Excel preview uses `/api/upload` workbook snapshots, and QA editor uses case/answer ID snapshot endpoints.
- [x] `/api/practice/template-snapshot?fileUrl=...` is retained only as an admin-compatible endpoint through security rules.
- [x] Verification run: `cd excel-forum-backend; mvn test` passed with 123 tests, 0 failures.
- [x] Verification run: `cd reace_web; npm run build` passed.
- [ ] Production Nginx guardrails and live deployment verification are still pending.

---

## Phase 0: Baseline And Safety

- [ ] Create a short implementation branch or worktree before touching code.
- [ ] Confirm current production branch/commit matches local `main`.
- [ ] Run baseline checks:
  - [ ] `cd excel-forum-backend; mvn test`
  - [ ] `cd reace_web; npm run build`
- [ ] Capture current response behavior:
  - [ ] Logged-in `/api/practice/submit`
  - [ ] `/api/practice/questions/{id}/file`
  - [ ] `/api/templates/{id}/file`
  - [ ] `/api/qa/cases/{id}/file`
  - [ ] `/uploads/{known-file}`
- [ ] Confirm current Nginx limits before editing server config:
  - [ ] `nginx -T | grep -E 'client_max_body_size|limit_req|limit_conn|limit_rate'`

## Phase 1: Unified RateLimitService

### Backend Files

- [ ] Add `excel-forum-backend/src/main/java/com/excel/forum/service/RateLimitService.java`.
- [ ] Add `excel-forum-backend/src/main/java/com/excel/forum/service/impl/RedisBackedRateLimitService.java`.
- [ ] Add DTO/value object `RateLimitResult` if a simple boolean cannot carry retry metadata.
- [ ] Refactor local duplicate limiters in:
  - [ ] `AuthController`
  - [ ] `AssistantController`
  - [ ] `UploadController`

### Behavior

- [ ] Use Redis when available.
- [ ] Use bounded in-memory fallback when Redis fails.
- [ ] Fail closed enough to protect the service: fallback must still reject bursts.
- [ ] Return HTTP `429` with stable JSON shape:

```json
{
  "message": "操作过于频繁，请稍后再试",
  "retryAfterSeconds": 30
}
```

### Tests

- [ ] Add backend tests for allowed requests below threshold.
- [ ] Add backend tests for `429` above threshold.
- [ ] Add backend tests for Redis failure fallback.

## Phase 2: Practice Submit Anti刷 And Reward Idempotency

### Backend Files

- [ ] Modify `PracticeController` to guard `/api/practice/submit` and `/api/practice/questions/submit` before service execution.
- [ ] Modify `PracticeCampaignServiceImpl.submitCampaignLevel` to reject a finished attempt before calling `practiceService.submitPractice`.
- [ ] Add `RewardGrantService` to centralize reward idempotency:
  - [ ] Practice pass reward.
  - [ ] Practice complete experience.
  - [ ] Points task reward.
  - [ ] Campaign level reward.
- [ ] Update `PointsRecordServiceImpl` to use atomic balance update.
- [ ] Add migration `V60__harden_reward_idempotency.sql`.

### Database

- [ ] Add `idempotency_key` to `points_record`.
- [ ] Backfill existing task reward records with deterministic keys.
- [ ] Add unique index on `points_record.idempotency_key`.
- [ ] Add an equivalent idempotency key or unique index for experience logs where needed.
- [ ] Keep old rows and IDs; do not reorder IDs.

### Policy

- [ ] Practice submit burst limit: per user + per question, conservative default such as `6/min`.
- [ ] Practice global submit limit: per user, conservative default such as `30/min`.
- [ ] Same campaign attempt can only move from `started` to final once.
- [ ] Duplicate reward insert returns already-granted result, not a 500.

### Tests

- [ ] Repeated same attempt submit returns a controlled response.
- [ ] Concurrent duplicate reward attempts create one points record.
- [ ] Concurrent duplicate reward attempts update user points once.
- [ ] Repeated failed answer does not farm pass reward.
- [ ] Existing successful answer flow still returns current response shape.

## Phase 3: WorkbookSecurityGuard

### Backend Files

- [ ] Add `excel-forum-backend/src/main/java/com/excel/forum/service/WorkbookSecurityGuard.java`.
- [ ] Add `excel-forum-backend/src/main/java/com/excel/forum/service/impl/WorkbookSecurityGuardImpl.java`.
- [ ] Add config properties under `excel.security.workbook`.
- [ ] Apply guard in:
  - [ ] `UploadController` for Excel scenes before accepting final upload.
  - [ ] `ExcelTemplateGradingServiceImpl.loadWorkbookSnapshot`.
  - [ ] `ExcelTemplateGradingServiceImpl.buildWorkbookFileFromSnapshot`.
  - [ ] `QaServiceImpl.createCase`.
  - [ ] `QaServiceImpl.submitCaseAnswerFromSnapshot`.
  - [ ] `QaServiceImpl.updateCaseAnswerFromSnapshot`.

### Suggested Limits

- [ ] Max file bytes for Excel scenes: keep 20MB at first.
- [ ] Max workbook sheets: `8`.
- [ ] Max rows scanned per sheet: `5000`.
- [ ] Max non-empty cells: `50000`.
- [ ] Max formula length: `4000`.
- [ ] Max cell text length: `10000`.
- [ ] Max JSON snapshot request bytes: align to `8MB` for online answer submission.
- [ ] Set Apache POI zip protections at process startup:
  - [ ] minimum inflate ratio.
  - [ ] max entry size.
  - [ ] max text size.

### Notes

Add a short code comment where limits are enforced:

```java
// Workbook limits protect formula evaluation and XML inflation from exhausting CPU or heap.
```

### Tests

- [ ] Oversized sheet count returns 400.
- [ ] Too many cells returns 400.
- [ ] Too long formula returns 400.
- [ ] Abnormal zip ratio returns 400 or controlled validation error.
- [ ] Normal template upload still succeeds.
- [ ] Normal QA answer snapshot still succeeds.

## Phase 4: Controlled File Access

### Backend Files

- [ ] Add `FileAccessService` to resolve file access by business ID, not arbitrary `fileUrl`.
- [ ] Add controlled endpoints:
  - [ ] `GET /api/practice/questions/{id}/template-snapshot`
  - [ ] `GET /api/practice/questions/{id}/download`
  - [ ] `GET /api/templates/{id}/file`
  - [ ] `GET /api/qa/cases/{id}/file`
  - [ ] `GET /api/qa/cases/{caseId}/answers/{answerId}/file`
- [ ] Deprecate public arbitrary snapshot endpoint:
  - [ ] `/api/practice/template-snapshot?fileUrl=...`
- [ ] Keep endpoint temporarily for admin-only or logged-in migration compatibility if needed.
- [ ] Stop returning sensitive raw `templateFileUrl` to public practice payloads.

### Storage Rules

- [ ] Split upload storage by sensitivity:
  - [ ] `/uploads/public/...` for avatars and public preview images.
  - [ ] `/uploads/private/...` for Excel templates, QA files, and answer workbooks.
- [ ] Change `SecurityConfig` so `/uploads/private/**` is not public.
- [ ] Keep `/uploads/public/**` public.
- [ ] Ensure existing legacy `/uploads/*.xlsx` remains accessible only through compatibility code or migration rules.

### Frontend Files

- [ ] Update `reace_web/src/app/pages/Practice.tsx` to call question-ID snapshot endpoint.
- [ ] Update `reace_web/src/app/pages/PracticeDetail.tsx` to call question-ID snapshot endpoint.
- [ ] Update `QaCenter.tsx`, `QaCaseAnswer.tsx`, and `QaCaseDetail.tsx` to avoid arbitrary file URL snapshot calls.
- [ ] Update template download UI to always call controlled API endpoints.

### Tests

- [ ] Direct `/uploads/private/...xlsx` returns 401/403/404.
- [ ] Authorized template download still succeeds.
- [ ] Unauthorized template download fails.
- [ ] Practice question snapshot works for allowed user.
- [ ] Raw `fileUrl` snapshot no longer works for non-admin users.

## Phase 5: Download Rate Limiting And Streaming

### Backend Files

- [ ] Apply `RateLimitService` to:
  - [ ] Practice question file download.
  - [ ] Template file download.
  - [ ] QA case file download.
  - [ ] QA answer file download.
- [ ] Replace `ByteArrayResource` with streaming resources where the file already exists on disk.
- [ ] Add short TTL cache for generated practice workbook files only if profiling shows repeated generation is expensive.

### Policy

- [ ] Per user file download limit: example `30/min`.
- [ ] Per IP public/static fallback limit: example `60/min`.
- [ ] Per file hot limit: example `120/min/file`, to stop a single URL from being hammered.
- [ ] Return `429` with `Retry-After`.

### Tests

- [ ] Template download above threshold returns 429.
- [ ] Practice question file above threshold returns 429.
- [ ] QA file above threshold returns 429.
- [ ] Valid download below threshold returns file content.

## Phase 6: Nginx Guardrails

### Server Config

- [ ] Add site-level request and connection zones:

```nginx
limit_req_zone $binary_remote_addr zone=excelcc_api:10m rate=8r/s;
limit_req_zone $binary_remote_addr zone=excelcc_download:10m rate=2r/s;
limit_conn_zone $binary_remote_addr zone=excelcc_conn:10m;
```

- [ ] Apply to `/api/` with burst for normal UI usage.
- [ ] Apply stricter limits to `/uploads/` and file download routes.
- [ ] Set upload body size to match backend, preferably `20m`.
- [ ] Test config with `nginx -t` before reload.

### Notes

Nginx limits are a coarse outer shield. Business correctness must still be enforced in Java services because authenticated users and internal routes need per-user/per-resource semantics.

## Phase 7: Monitoring And Abuse Evidence

- [ ] Log rate-limited requests with user ID/IP, endpoint group, and limit key.
- [ ] Add counters for:
  - [ ] practice submit rejected.
  - [ ] upload rejected by file size/type/workbook guard.
  - [ ] download rejected by rate limit.
  - [ ] duplicate reward idempotency collision.
- [ ] Add admin-visible summary only if metrics already have a destination; otherwise keep logs first.
- [ ] Avoid logging raw file names when they may contain user data.

## Phase 8: Regression And Controlled Load Test

### Backend

- [ ] `cd excel-forum-backend; mvn test`
- [ ] Add MockMvc tests:
  - [ ] `/api/practice/submit` over limit.
  - [ ] duplicate campaign attempt submit.
  - [ ] duplicate reward idempotency.
  - [ ] oversized workbook upload.
  - [ ] unauthorized private file direct access.
  - [ ] template download over limit.

### Frontend

- [ ] `cd reace_web; npm run build`
- [ ] Verify:
  - [ ] practice list.
  - [ ] practice question page.
  - [ ] template center download.
  - [ ] QA case upload.
  - [ ] QA answer upload/download.
  - [ ] admin question editor.

### Controlled Load

- [ ] Run a low-risk read scenario first.
- [ ] Run authenticated submit burst against staging or a test user only.
- [ ] Confirm:
  - [ ] rate-limited requests return 429.
  - [ ] backend CPU remains stable.
  - [ ] points/experience do not duplicate.
  - [ ] download bandwidth is bounded.

## Phase 9: Deployment

- [ ] Read `ONLINE_UPDATE_LOG.md` before deployment.
- [ ] Push code to canonical repository.
- [ ] On server, deploy from `/www/wwwroot/excelcc/kick-deploy/repo`:

```bash
bash scripts/deploy/production-deploy.sh
```

- [ ] Verify live endpoints:
  - [ ] `https://www.excelcc.cn/`
  - [ ] `https://www.excelcc.cn/api/public/home-overview`
  - [ ] `https://www.excelcc.cn/practice`
  - [ ] `https://www.excelcc.cn/qa`
  - [ ] legacy forum endpoint still returns 410.
- [ ] Verify security cases:
  - [ ] high-frequency practice submit rejected.
  - [ ] private upload direct URL rejected.
  - [ ] high-frequency file download rejected.
- [ ] Append top entry to `ONLINE_UPDATE_LOG.md` with:
  - [ ] change scope.
  - [ ] verification commands.
  - [ ] deployment target.
  - [ ] server backup path.
  - [ ] notes and known residual risks.

## Rollback Plan

- [ ] If application rate limiting blocks normal traffic, reduce thresholds through config and restart backend.
- [ ] If private file migration breaks downloads, temporarily re-enable controlled compatibility endpoint, not public `/uploads/private/**`.
- [ ] If reward migration fails on duplicate historical data, stop deploy, deduplicate in a one-off audited migration, then re-run.
- [ ] If Nginx limits are too strict, rollback only Nginx include and reload; application code remains safe.

## Definition Of Done

- [ ] No direct public access to sensitive Excel files.
- [ ] Scripted practice submit cannot generate unlimited records or rewards.
- [ ] Upload and snapshot parsing have explicit workbook limits.
- [ ] Template/question/QA downloads have business-aware rate limits.
- [ ] Nginx has coarse request/connection protection.
- [ ] Backend tests cover the new guardrails.
- [ ] Frontend build passes.
- [ ] Production deployment is verified and logged.
