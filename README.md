# ExcelCC

ExcelCC 是面向 Excel 学习、做题、教程、模板、QA 与 AI 助手的前后端项目。当前产品方向是学习平台；早期社区运行面已从活动源码移除，历史数据按归档策略保留。

仓库包含：

- `excel-forum-backend/`：Spring Boot 3.2 + MyBatis Plus 后端
- `reace_web/`：React 18 + Vite 前端

## 运行环境

- Java 17
- Maven 3.9+
- Node.js 20+
- MySQL 8
- Redis 7

## 目录结构

```text
.
├─ excel-forum-backend
├─ reace_web
├─ docs
├─ scripts
└─ .github/workflows
```

## 环境变量

后端通过 `excel-forum-backend/src/main/resources/application.yml` 与 `application-dev.yml` 读取环境变量。

必须在目标环境配置：

- `DB_URL`
- `DB_USERNAME`
- `DB_PASSWORD`
- `JWT_SECRET`
- `ALLOWED_ORIGINS`

可选：

- `ADMIN_BOOTSTRAP_ENABLED`
- `ADMIN_BOOTSTRAP_USERNAME`
- `ADMIN_BOOTSTRAP_EMAIL`
- `ADMIN_BOOTSTRAP_PASSWORD`
- MinIO 相关配置
- Redis 密码

## 本地启动

### 后端

```powershell
cd excel-forum-backend
mvn spring-boot:run "-Dspring-boot.run.profiles=dev" "-Dmaven.test.skip=true"
```

### 前端

```powershell
cd reace_web
npm ci
npx vite --host 0.0.0.0
```

## 构建与测试

### 后端

```powershell
cd excel-forum-backend
mvn -q -DskipTests compile
mvn test
```

### 前端

```powershell
cd reace_web
npm ci
npm run build
```

## 上线前检查

上线前请至少完成：

- 阅读 [docs/README.md](./docs/README.md)
- 阅读 [docs/maintenance/release-checklist.md](./docs/maintenance/release-checklist.md)
- 阅读 [SECURITY.md](./SECURITY.md)
- 阅读 [docs/deployment-operations.md](./docs/deployment-operations.md)
- 阅读 [ONLINE_UPDATE_LOG.md](./ONLINE_UPDATE_LOG.md)

## 生产部署入口

当前生产环境唯一部署源码目录约定为 `/www/wwwroot/excelcc/kick-deploy/repo`。

以下目录职责固定：

- `/www/wwwroot/excelcc/kick-deploy/repo`：生产部署源码与构建入口
- `/www/wwwroot/excelcc/kick-web`：前端静态运行目录
- `/www/wwwroot/excelcc/kick-backend`：后端 JAR 与环境变量目录

`/www/wwwroot/kick-src/kick` 仅保留为历史工作目录，不再作为发布入口。
