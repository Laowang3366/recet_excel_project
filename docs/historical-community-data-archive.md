# 历史社区数据库表归档说明

更新时间：2026-05-21

## 归档策略

ExcelCC 当前产品方向是做题、教程、模板、QA 和 AI 助手平台。早期社区运行面已经从活动代码中移除，但历史数据仍需保留一段时间用于审计、备份和必要的数据追溯。

本策略只做归档登记，不删除、不重命名、不迁移历史数据表。Flyway 迁移 `V54__archive_legacy_forum_tables.sql` 新增 `legacy_table_archive` 登记表，用于标记历史社区表的归档状态和保留策略。

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

`notification` 表仍承载当前系统通知、站内通知和反馈结果通知，不作为整表归档对象。历史社区类型通知由现有通知白名单策略隐藏或拒绝 mutation。

## 线上行为

- 早期社区前端页面和后台入口已清理。
- 早期社区 Controller、Service、Mapper、Entity、DTO 和 WebSocket 支持已从活动源码移除。
- 当前不保留专门的已下线路由拦截器；已删除的旧路径走标准路由/安全处理。
- 当前业务表和接口保持不变，包括小试牛刀、教程、模板中心、QA、AI 助手、用户/单位管理和后台统计。
- `legacy_table_archive` 只是元数据登记表，不参与线上业务读写路径。

## 后续彻底删除条件

彻底删除历史社区表必须单独排期，且同时满足：

- 生产数据库已完成全量备份。
- 历史社区数据已按需导出并校验。
- 后端代码、SQL、MyBatis Mapper、前端入口和通知跳转均确认无引用。
- 单独新增 Flyway migration 执行 drop，不修改历史 migration。
- 部署前后完成当前核心业务 smoke 验证。
