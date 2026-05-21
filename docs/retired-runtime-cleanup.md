# Retired Runtime Cleanup

ExcelCC is now a learning platform focused on practice, tutorials, templates, QA, points, and the AI assistant. The early community runtime is no longer part of the active product surface.

## Current Policy

- Early community frontend pages are removed from the active app bundle.
- Early community public/admin routes are no longer exposed through the frontend router.
- Early community controllers, services, mappers, DTOs, WebSocket chat support, and tests are removed from active backend source.
- There is no dedicated compatibility filter for retired HTTP paths. Deleted routes should fall through normal routing/security behavior.
- Historical notification types are no longer counted or listed in current notification surfaces.
- Historical community database tables are retained only as archived data. Do not drop them during routine feature deploys.

## Removed API Groups

The following retired API groups must not be reintroduced without a new product design and code review:

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

## Retained Historical Tables

Keep these tables until a separate data archive and migration plan is approved:

- `post`
- `reply`
- `favorite`
- `report`
- `message`
- `chat_message`
- `post_draft`
- `post_view`
- `post_share`
- `post_edit_history`

## Cleanup Rule

Physical table removal requires a full database backup, a separately reviewed Flyway migration, and live verification that current product routes still pass:

- `/api/practice/**`
- `/api/tutorials/**`
- `/api/templates/**`
- `/api/qa/**`
- `/api/assistant/**`
- `/api/admin/assistant/**`
