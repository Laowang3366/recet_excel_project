# CLAUDE.md

This file provides repository guidance for the current ExcelCC learning platform.

## Project Overview

ExcelCC is no longer maintained as a forum product. The active platform focuses on:

- practice and grading
- tutorials
- template center
- points, levels, and mall props
- AI assistant and admin configuration
- site notifications and feedback handling

The workspace contains:

- `excel-forum-backend/`: Spring Boot 3.2 backend, Java 17
- `reace_web/`: React 18 + Vite frontend

The package/database names still contain historical `forum` wording for compatibility. Do not rename packages, database names, or production paths during routine feature work.

## Build And Test

Backend:

```bash
cd excel-forum-backend
mvn clean test
mvn clean package
java -jar target/forum-1.0.0.jar
```

Frontend:

```bash
cd reace_web
npm run build
```

The frontend has no dedicated dev or test script in `package.json`; do not invent one unless intentionally extending the toolchain.

## Backend Architecture

Main package: `com.excel.forum`

- `controller/`: active REST controllers for auth, users, practice, tutorials, templates, mall, notifications, assistant, admin
- `service/` and `service/impl/`: business services
- `mapper/`: MyBatis-Plus mappers
- `entity/`: database entities
- `config/`: security, MVC, MyBatis, cache, scheduling, data seeders
- `security/`: JWT authentication filter
- `util/`: shared helpers

Authentication is stateless JWT. Successful requests set `request.setAttribute("userId", userId)` and `ROLE_<role>` authorities. Production must provide a real `JWT_SECRET`.

## Database

Flyway migrations live in `excel-forum-backend/src/main/resources/db/migration/`.

Rules:

- Add new migrations for schema changes.
- Do not edit historical migrations.
- Do not drop historical community tables in routine deploys.
- Historical community tables are retained as archived data; see `docs/retired-runtime-cleanup.md`.

`DataInitializer` only seeds current bootstrap data such as the admin account. The old fallback `DatabaseInitializer`, `schema.sql`, and `db/update.sql` are removed from active source.

## Retired Runtime Policy

Early community pages, routes, WebSocket chat, post/reply/message controllers, services, mappers, DTOs, and tests have been removed from active source.

The retired HTTP surfaces below are deleted, not compatibility-routed. Do not add a new controller, filter, or frontend link for these paths without a new product decision and review:

- `/api/posts/**`
- `/api/replies/**`
- `/api/categories/**`
- `/api/favorites/**`
- `/api/likes/**`
- `/api/messages/**`
- `/api/chat/**`
- `/api/drafts/**`
- `/api/reports/**`
- `/api/admin/posts/**`
- `/api/admin/reports/**`
- `/api/admin/categories/**`
- `/api/admin/drafts/**`

The archived database tables are kept only for data retention. They are not active product models.

## Frontend Architecture

React SPA entry:

- `src/main.tsx`
- `src/app/App.tsx`
- `src/app/routes.tsx`

Key conventions:

- API calls go through `src/app/lib/api.ts`.
- React Query keys are in `src/app/lib/query-keys.ts`.
- Session state is in `src/app/lib/session.tsx` and `src/app/lib/session-store.ts`.
- Global dialogs use `GlobalFeedbackDialog` and `GlobalConfirmPromptDialog`; avoid native `alert`, `confirm`, and `prompt`.
- Admin modules are configured in `src/app/admin/config.ts`.
- Current public modules should route to practice, tutorials, templates, tools, mall, notifications, profile center, and AI assistant.

## Production Deploy

Before changing `https://www.excelcc.cn/`, read `ONLINE_UPDATE_LOG.md`.

Production deploys should use the server-side standard workflow documented in `docs/deployment-operations.md`:

```bash
cd /www/wwwroot/excelcc/kick-deploy/repo
bash scripts/deploy/production-deploy.sh
```

After a successful deploy, append a new top entry to `ONLINE_UPDATE_LOG.md` with scope, verification commands, deployment target, backup path, and notes. Do not include secrets.
