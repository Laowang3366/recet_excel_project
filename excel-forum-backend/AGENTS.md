# ExcelCC Backend

## 项目结构

- `src/main/java/com/excel/forum/` 主代码目录
  - `controller/` 当前 REST 控制器
  - `service/` 与 `service/impl/` 业务逻辑层
  - `mapper/` MyBatis-Plus Mapper
  - `entity/` 数据库实体
  - `config/` 安全、缓存、定时任务、初始化配置
  - `security/` JWT 认证
  - `util/` 通用工具
- `src/main/resources/application.yml` 配置文件
- `src/main/resources/db/migration/` Flyway 迁移

## 环境要求

- Java 17
- MySQL 8.0+
- Redis
- Maven 3.6+

## 数据库配置

1. 创建数据库：

```sql
CREATE DATABASE excel_forum CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

2. 启动应用，由 Flyway 自动执行 `src/main/resources/db/migration/` 中的迁移。
3. 现有老库会在首次启用 Flyway 时自动 baseline 接管，再继续执行增量迁移。

## 迁移策略

- 结构变更只允许新增 Flyway 迁移。
- 不要编辑历史 migration。
- 不要在常规功能部署中删除历史社区表。
- 历史社区表作为归档数据保留，清理策略见仓库根目录 `docs/retired-runtime-cleanup.md`。

## 构建运行

```bash
mvn clean test
mvn clean package
java -jar target/forum-1.0.0.jar

# 开发模式
mvn spring-boot:run
```

## 当前 API 范围

- 认证：`/api/auth/**`
- 当前用户与用户中心：`/api/users/**`
- 练习与题库：`/api/practice/**`
- 教程：`/api/tutorials/**`
- 模板：`/api/templates/**`
- 商城与权益：`/api/mall/**`
- 通知：`/api/notifications/**`
- AI 助手：`/api/assistant/**`
- 后台管理：`/api/admin/**`

早期社区 API 实现已从活动源码移除，不保留专门兼容拦截器。新增接口不得复用已归档的旧路径或历史表作为业务模型。

## 注意事项

- `DataInitializer` 只保留当前平台启动所需的管理员引导。
- 旧的兜底数据库初始化、`schema.sql`、`db/update.sql` 已从活动源码移除。
- 积分、经验和等级配置以当前练习平台业务为准。
- 文件存储支持本地和 MinIO，通过 `file.storage.type` 配置。
