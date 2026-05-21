# Performance Load Testing

This repo keeps k6 load scripts under `scripts/perf`. Defaults are smoke-level so they are safe for local and LAN checks; increase `VUS`, `DURATION`, and thresholds explicitly for load runs.

## Scripts

| Script | Coverage | Default write behavior |
| --- | --- | --- |
| `scripts/perf/k6-public-smoke.js` | Public home, level rules, tutorials, practice category/list, campaign chapters, templates | none |
| `scripts/perf/k6-public-read-controlled.js` | Low-risk production read path mix for `www.excelcc.cn` pages and public APIs | none |
| `scripts/perf/k6-auth-smoke.js` | Login plus authenticated profile, notifications, points tasks, QA center, mall, practice history, template records | none |
| `scripts/perf/k6-mixed-write-smoke.js` | Login, authenticated reads, practice submit, campaign start/submit, optional template download | practice submit and campaign attempt writes enabled; template download disabled |

## Environment Variables

Common:

```powershell
$env:BASE_URL = "http://localhost:8080"
$env:VUS = "5"
$env:DURATION = "30s"
$env:THRESHOLD_HTTP_REQ_FAILED = "rate<0.05"
$env:THRESHOLD_HTTP_REQ_DURATION = "p(95)<1000"
$env:THRESHOLD_CHECKS = "rate>0.90"
```

Authenticated scripts require credentials. Do not commit real values.

```powershell
$env:K6_USERNAME = "<load-test-user>"
$env:K6_PASSWORD = "<load-test-password>"
```

Mixed write-path options:

```powershell
$env:K6_PRACTICE_QUESTION_ID = ""       # optional; auto-discovers first enabled practice question when empty
$env:K6_CAMPAIGN_LEVEL_ID = ""          # optional; auto-discovers first available/cleared/perfect campaign level when empty
$env:K6_ENABLE_CAMPAIGN_WRITE = "true"  # set false to skip campaign start/submit writes
$env:K6_ENABLE_TEMPLATE_DOWNLOAD = "false"
$env:K6_TEMPLATE_ID = ""                # optional; when template download is enabled, auto-discovers a free template with a file
```

Template download is off by default because `/api/templates/{id}/download` can deduct points and persists a download record. Enable it only for a disposable account or a known free template.

## Local Commands

Start the backend first:

```powershell
cd D:\project\recet_excel_project\excel-forum-backend
mvn spring-boot:run
```

Run public smoke:

```powershell
cd D:\project\recet_excel_project
$env:BASE_URL = "http://localhost:8080"
k6 run scripts/perf/k6-public-smoke.js
```

Run controlled production read smoke only after confirming the target window:

```powershell
cd D:\project\recet_excel_project
$env:BASE_URL = "https://www.excelcc.cn"
$env:VUS = "10"
$env:DURATION = "60s"
$env:SLEEP_MS = "1000"
k6 run scripts/perf/k6-public-read-controlled.js
```

Run authenticated smoke:

```powershell
cd D:\project\recet_excel_project
$env:BASE_URL = "http://localhost:8080"
$env:K6_USERNAME = "<load-test-user>"
$env:K6_PASSWORD = "<load-test-password>"
k6 run scripts/perf/k6-auth-smoke.js
```

Run mixed write-path smoke:

```powershell
cd D:\project\recet_excel_project
$env:BASE_URL = "http://localhost:8080"
$env:K6_USERNAME = "<load-test-user>"
$env:K6_PASSWORD = "<load-test-password>"
$env:VUS = "3"
$env:DURATION = "30s"
k6 run scripts/perf/k6-mixed-write-smoke.js
```

## LAN Commands

Use the exact LAN target in `BASE_URL`; do not reuse LAN results as public production evidence.

```powershell
cd D:\project\recet_excel_project
$env:BASE_URL = "https://lan.excelcc.cn"
$env:K6_USERNAME = "<load-test-user>"
$env:K6_PASSWORD = "<load-test-password>"
$env:VUS = "20"
$env:DURATION = "2m"
k6 run scripts/perf/k6-auth-smoke.js
```

```powershell
cd D:\project\recet_excel_project
$env:BASE_URL = "https://lan.excelcc.cn"
$env:K6_USERNAME = "<load-test-user>"
$env:K6_PASSWORD = "<load-test-password>"
$env:VUS = "10"
$env:DURATION = "2m"
$env:K6_ENABLE_TEMPLATE_DOWNLOAD = "false"
k6 run scripts/perf/k6-mixed-write-smoke.js
```

For a heavier mixed-path run, raise `VUS` gradually and keep a disposable test account pool in mind. These scripts currently use one credential pair, so login rate limits and per-user reward/progress writes can become the limiting factor before raw backend capacity.

## Interpreting Results

Use these as first-pass targets unless a test plan sets stricter values:

| Metric | Smoke target | Load target |
| --- | --- | --- |
| `http_req_failed` | below `5%` auth/public, below `10%` mixed write | below the configured threshold after warmup |
| `http_req_duration p(95)` | below `800-1500ms`, depending on script | compare against current baseline and endpoint mix |
| `checks` | above `90%` for mixed write | investigate any sustained drop |

Expected skip counters in mixed runs:

| Counter | Meaning |
| --- | --- |
| `skipped_practice_submits` | no practice question could be discovered and no `K6_PRACTICE_QUESTION_ID` was set |
| `skipped_campaign_writes` | campaign write disabled, no available level was discovered, or campaign start did not return an attempt |
| `skipped_template_downloads` | template download disabled or no safe template was discovered |

## Syntax Validation Without k6

```powershell
cd D:\project\recet_excel_project
powershell -ExecutionPolicy Bypass -File scripts/perf/validate-k6-scripts.ps1
```

This validates JavaScript syntax with `node --check` and fails if authenticated scripts reintroduce hardcoded credential fallbacks.
It is also part of `scripts/quality/check.ps1` and the production deploy workflow, so stale retired endpoints should fail before deployment.

## Intentionally Uncovered

- Registration, password reset, email change, and password change are excluded because they mutate identity state or rely on email/user uniqueness.
- Template download is present but gated by `K6_ENABLE_TEMPLATE_DOWNLOAD` because it can deduct points and persists a download record.
- Practice question submission/upload is excluded because it requires uploaded workbook files and answer snapshots; running it safely needs fixture file management.
- Admin endpoints are excluded from smoke/load scripts because they require elevated credentials and have a higher data mutation risk.
