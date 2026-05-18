# 文档索引

本目录只保留当前仍有执行价值的运维、质量和归档文档。历史方案、旧审计和一次性计划统一放入 `docs/archive/`，避免根目录和 `docs/` 根层继续堆积。

## 常用入口

- [部署与运维说明](./deployment-operations.md)
- [发布检查清单](./maintenance/release-checklist.md)
- [代码审查清单](./maintenance/code-review-checklist.md)
- [代码审查问题台账](./maintenance/code-review-issues.md)
- [性能压测说明](./performance-load-testing.md)
- [运行参数调优](./runtime-tuning.md)
- [数据库性能诊断](./database-performance.md)

## 生产与运行

- [部署与运维说明](./deployment-operations.md)
- [一键部署通道](./deployment-operations.md#一键部署通道)
- [LAN 服务器监控脚本](./lan-server-monitoring.md)
- [LAN Nginx cache and rate-limit runbook](./nginx-lan-cache.md)

## 历史归档

- [旧论坛运行面归档](./legacy-forum-archive.md)
- [旧论坛数据库表归档说明](./legacy-forum-data-archive.md)
- [历史文档归档索引](./archive/README.md)

## 根目录保留规则

根目录只保留跨工具或高频入口：

- `README.md`
- `AGENTS.md`
- `CLAUDE.md`
- `SECURITY.md`
- `ONLINE_UPDATE_LOG.md`

新增文档优先放入 `docs/` 的对应子目录；一次性计划、历史设计和过期审计放入 `docs/archive/`。
