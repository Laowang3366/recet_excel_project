# Legacy Forum Archive

ExcelCC has moved from the original forum product shape to the current learning platform focused on practice, tutorials, templates, points, and the AI assistant.

## Current Policy

- Legacy forum frontend pages are removed from the active app bundle.
- Legacy forum public/admin routes are no longer exposed through the frontend router.
- Legacy forum HTTP APIs are blocked by `LegacyForumFeatureShutdownFilter` and return `410 Gone`.
- Legacy database tables are retained as historical data. Do not drop them during routine feature deploys.

## Legacy API Groups

The following API groups are treated as offline legacy forum surface:

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

## Retained Legacy Tables

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

Physical removal requires a full database backup, a separately reviewed Flyway migration, and live verification that current product routes still pass:

- `/api/practice/**`
- `/api/tutorials/**`
- `/api/templates/**`
- `/api/assistant/**`
- `/api/admin/assistant/**`
