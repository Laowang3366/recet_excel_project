# 旧论坛数据库表归档说明

更新时间：2026-05-18

## 归档策略

ExcelCC 当前产品方向已从旧论坛收敛为做题、教程、模板和 AI 助手平台。旧论坛接口已经下线并返回 `410 Gone`，但历史数据仍需保留一段时间用于审计、备份和必要的数据追溯。

本轮只做归档登记，不删除、不重命名、不迁移旧数据表。Flyway 迁移 `V54__archive_legacy_forum_tables.sql` 新增 `legacy_table_archive` 登记表，用于标记旧论坛表的归档状态和保留策略。

## 已标记归档的表

- `category`
- `category_follow`
- `post`
- `reply`
- `like`
- `favorite`
- `report`
- `message`
- `chat_message`
- `attachment`
- `follow`
- `post_draft`
- `post_view`
- `post_share`
- `post_edit_history`

`notification` 表仍承载当前系统通知、站内通知和反馈结果通知，不作为整表归档对象。旧论坛类型通知由现有通知白名单策略隐藏或拒绝 mutation。

## 线上行为

- 旧论坛前端页面和后台入口已清理。
- 旧论坛活跃接口统一由下线策略返回 `410 Gone`。
- 当前业务表和接口保持不变，包括小试牛刀、教程、模板中心、AI 助手、用户/单位管理和后台统计。
- `legacy_table_archive` 只是元数据登记表，不参与线上业务读写路径。

## 后续彻底删除条件

彻底删除旧论坛表必须单独排期，且同时满足：

- 生产数据库已完成全量备份。
- 旧论坛历史数据已按需导出并校验。
- 后端代码、SQL、MyBatis Mapper、前端入口和通知跳转均确认无引用。
- 单独新增 Flyway migration 执行 drop，不修改历史 migration。
- 部署前后完成旧接口 `410 Gone` 和当前核心业务 smoke 验证。
