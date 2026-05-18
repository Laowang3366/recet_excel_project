# Release Checklist

## 环境

- [ ] 已配置 `DB_URL`
- [ ] 已配置 `DB_USERNAME`
- [ ] 已配置 `DB_PASSWORD`
- [ ] 已配置 `JWT_SECRET`
- [ ] 已配置 `ALLOWED_ORIGINS`
- [ ] 若需要首启管理员引导，已显式配置 `ADMIN_BOOTSTRAP_*`
- [ ] MySQL 可连接
- [ ] Redis 可连接
- [ ] 上传目录或对象存储已准备

## 数据

- [ ] 生产数据库已备份
- [ ] Flyway 迁移已在目标环境演练
- [ ] 默认管理员口令已修改
- [ ] 已确认生产环境未错误启用管理员自动引导
- [ ] 已确认生产部署仓 `kick-deploy/repo` 工作树状态符合预期
- [ ] 已确认唯一发布入口为 `/www/wwwroot/excelcc/kick-deploy/repo`

## 质量门禁

- [ ] `powershell -ExecutionPolicy Bypass -File scripts/quality/check.ps1` 通过
- [ ] 后端 `mvn test` 通过
- [ ] 后端 `mvn -q -DskipTests compile` 通过
- [ ] 前端 `npm ci` 通过
- [ ] 前端 `npm audit --audit-level=moderate` 通过
- [ ] 前端 `npm run typecheck` 通过
- [ ] 前端 `npm run test` 通过
- [ ] 前端 `npm run build` 通过
- [ ] 后端源码门禁通过：活跃 Controller 无 `@RequestBody Map`，主代码无 `.last(...)` 和 `catch (... ignored)`
- [ ] GitHub Actions 全绿
- [ ] 当前代码审查无 P0 / 阻断项，历史审计可参考 `docs/archive/audits/release-audit-2026-05-18.md`

## 烟测

- [ ] 首页可访问
- [ ] `http://127.0.0.1:8080/api/public/home-overview` 返回 `200`
- [ ] 登录可用
- [ ] 小试牛刀章节 / 题目可用
- [ ] 通知中心可用
- [ ] 练习模块可用
- [ ] 后台总览可访问
- [ ] 教程详情页可用
- [ ] 模板中心下载可用
- [ ] AI 助手可用
- [ ] 旧论坛接口返回 `410 Gone`
- [ ] 已生成当前发布备份并确认回滚路径
