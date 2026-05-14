# 部署与运维说明

## 目标

本文档定义当前生产环境的唯一部署入口、标准部署命令、健康检查和回滚方式。

当前原则：

- 不改变现有 `Nginx + systemd + Spring Boot` 拓扑
- 生产部署源码目录唯一指向 `/www/wwwroot/excelcc/kick-deploy/repo`
- `/www/wwwroot/kick-src/kick` 仅作为历史工作目录保留，不再作为发布入口

## 服务器拓扑

- 站点域名：`https://www.excelcc.cn`
- Nginx 配置：`/etc/nginx/conf.d/kick.conf`
- 前端静态目录：`/www/wwwroot/excelcc/kick-web`
- 后端运行目录：`/www/wwwroot/excelcc/kick-backend`
- 后端服务：`kick-backend.service`
- 后端监听地址：`127.0.0.1:8081`
- 部署仓目录：`/www/wwwroot/excelcc/kick-deploy/repo`
- 部署环境文件：`/www/wwwroot/excelcc/kick-deploy/deploy.env`
- 后端环境文件：`/www/wwwroot/excelcc/kick-backend/.env.production`
- 备份目录：`/www/wwwroot/excelcc/kick-deploy/backups`

## 目录约定

生产环境只允许以下目录参与发布：

- 源码与构建入口：`/www/wwwroot/excelcc/kick-deploy/repo`
- 前端运行时目录：`/www/wwwroot/excelcc/kick-web`
- 后端运行时目录：`/www/wwwroot/excelcc/kick-backend`
- 发布备份目录：`/www/wwwroot/excelcc/kick-deploy/backups`

历史目录说明：

- `/www/wwwroot/kick-src/kick`
  这是历史工作目录，不再作为发布入口，也不应作为“当前线上源码”的判断依据。

## 标准部署

执行前确认：

- 当前操作目录为 `/www/wwwroot/excelcc/kick-deploy/repo`
- 运行服务为 `kick-backend.service`
- 本次发布目标是“服务器从 Git 拉取代码后构建发布”，不是临时在其他目录手工替换文件
- 本地变更已经提交并推送到 `deploy.env` 配置的 `BRANCH`，否则服务器无法按标准流程拉取到本次更新。GitHub 拉取失败时，使用下方 Git bundle 回退部署流程。

部署环境文件 `/www/wwwroot/excelcc/kick-deploy/deploy.env` 需要包含 Git 拉取配置：

```bash
REPO_URL="https://github.com/Laowang3366/recet_excel_project.git"
BRANCH="main"
GIT_REMOTE="origin"
GIT_PULL_BEFORE_BUILD="1"
```

当前线上更新分支沿用 `main`。如果后续切换到新的发布分支，需要先更新服务器 `/www/wwwroot/excelcc/kick-deploy/deploy.env` 的 `BRANCH`，再执行部署脚本。

仓库内提供了示例文件：

```bash
scripts/deploy/deploy.env.example
```

标准部署命令：

```bash
cd /www/wwwroot/excelcc/kick-deploy/repo
bash scripts/deploy/production-deploy.sh
```

部署脚本会执行：

1. 校验配置和依赖命令
2. 校验部署仓库是否干净
3. 按 `deploy.env` 的 `REPO_URL`、`BRANCH` 和 `GIT_REMOTE` 拉取最新代码
4. 构建前端 `reace_web/dist`
5. 构建后端 `excel-forum-backend/target/forum-1.0.0.jar`
6. 为将被覆盖的前端受管文件和后端 JAR 建立时间戳备份
7. 发布前端受管文件，不替换或删除整个前端运行时目录
8. 重启 `kick-backend.service`
9. 通过 HTTP 接口进行健康检查
10. 如失败则自动回滚

如果需要跳过拉取，仅构建服务器当前代码，可以在执行时覆盖配置：

```bash
GIT_PULL_BEFORE_BUILD=0 bash scripts/deploy/production-deploy.sh
```

这个命令只适用于服务器部署仓已经处在目标提交的情况。GitHub 拉取失败时，不要临时手工执行 `git fetch <bundle>`、`git checkout`、`git merge` 等零散命令，改用仓库内的 bundle 脚本。

## Git Bundle 回退部署

适用场景：

- 目标代码已经在本地提交
- 服务器访问 GitHub 失败，`production-deploy.sh` 无法完成 `git fetch` / `git pull`
- 仍然要从 `/www/wwwroot/excelcc/kick-deploy/repo` 构建发布，并保留现有备份、健康检查和自动回滚能力

本地导出 bundle：

```bash
cd <local-repo>
bash scripts/deploy/export-git-bundle.sh
```

如需明确指定发布分支或输出路径：

```bash
BRANCH=main bash scripts/deploy/export-git-bundle.sh /tmp/kick-release.bundle
```

导出脚本只打包已提交的 Git 历史，不包含未提交文件。执行前应确认本次发布变更已经提交到目标分支。如果使用默认输出路径，以上传脚本打印的 `bundle written` 路径为准。

上传 bundle 到服务器固定目录：

```bash
ssh <server> "mkdir -p /www/wwwroot/excelcc/kick-deploy/bundles"
scp /tmp/kick-release.bundle <server>:/www/wwwroot/excelcc/kick-deploy/bundles/
```

服务器导入并发布：

```bash
cd /www/wwwroot/excelcc/kick-deploy/repo
bash scripts/deploy/deploy-from-git-bundle.sh /www/wwwroot/excelcc/kick-deploy/bundles/kick-release.bundle
```

`deploy-from-git-bundle.sh` 会执行：

1. 读取 `/www/wwwroot/excelcc/kick-deploy/deploy.env`
2. 校验 bundle 中包含 `BRANCH` / `GIT_BRANCH` 对应的 `refs/heads/<branch>`
3. 要求部署仓工作树干净
4. 将服务器同名分支快进到 bundle 提供的提交，拒绝非快进导入
5. 使用 `GIT_PULL_BEFORE_BUILD=0` 调用 `scripts/deploy/production-deploy.sh`

如只想导入 bundle、不立即发布，可以执行：

```bash
DEPLOY_AFTER_IMPORT=0 bash scripts/deploy/deploy-from-git-bundle.sh /www/wwwroot/excelcc/kick-deploy/bundles/kick-release.bundle
```

导入后再发布时仍使用固定命令：

```bash
GIT_PULL_BEFORE_BUILD=0 bash scripts/deploy/production-deploy.sh
```

部署完成后，在 `ONLINE_UPDATE_LOG.md` 顶部记录 bundle 文件名、发布提交、验证结果和服务器备份目录。

## 健康检查

后端健康检查统一使用：

```bash
curl -fsS http://127.0.0.1:8081/api/public/home-overview
```

服务状态检查：

```bash
systemctl status kick-backend.service --no-pager -l
systemctl is-active kick-backend.service
```

站点可达性检查：

```bash
curl -Iks https://www.excelcc.cn
```

判定标准：

- `kick-backend.service` 为 `active`
- `http://127.0.0.1:8081/api/public/home-overview` 返回 `200`
- `https://www.excelcc.cn` 首页可访问

## 回滚

每次标准部署都会在 `/www/wwwroot/excelcc/kick-deploy/backups/<timestamp>` 下生成：

- `kick-web-managed/`
- `forum-1.0.0.jar`

`kick-web-managed/` 只保存本次发布会覆盖的项目文件，例如 `index.html`、构建产物根文件和 `assets` 下同名文件。前端发布与回滚都不会整体删除、移动或替换 `/www/wwwroot/excelcc/kick-web`，避免影响同一目录里的其它项目。

如果自动回滚没有完成，人工回滚步骤如下：

```bash
export ROLLBACK_DIR=/www/wwwroot/excelcc/kick-deploy/backups/<timestamp>
install -d -o www -g www /www/wwwroot/excelcc/kick-web
if [ -f "$ROLLBACK_DIR/kick-web-managed/index.html" ]; then
  install -o www -g www -m 0644 "$ROLLBACK_DIR/kick-web-managed/index.html" /www/wwwroot/excelcc/kick-web/index.html
fi
if [ -d "$ROLLBACK_DIR/kick-web-managed/root-files" ]; then
  cp -a "$ROLLBACK_DIR/kick-web-managed/root-files/." /www/wwwroot/excelcc/kick-web/
fi
if [ -d "$ROLLBACK_DIR/kick-web-managed/assets" ]; then
  install -d -o www -g www /www/wwwroot/excelcc/kick-web/assets
  cp -a "$ROLLBACK_DIR/kick-web-managed/assets/." /www/wwwroot/excelcc/kick-web/assets/
fi
install -o www -g www -m 0644 "$ROLLBACK_DIR/forum-1.0.0.jar" /www/wwwroot/excelcc/kick-backend/forum-1.0.0.jar
systemctl restart kick-backend.service
curl -fsS http://127.0.0.1:8081/api/public/home-overview
```

如果只需要检查最近一次备份：

```bash
ls -lt /www/wwwroot/excelcc/kick-deploy/backups
```

## 变更约束

- 不要直接在 `/www/wwwroot/excelcc/kick-web` 手工编辑静态文件
- 不要整体删除、移动或替换 `/www/wwwroot/excelcc/kick-web`，发布只能覆盖本项目构建产生的受管文件
- 不要直接在 `/www/wwwroot/excelcc/kick-backend` 手工替换源码
- 不要从 `/www/wwwroot/kick-src/kick` 发版
- 任何对生产结构的进一步升级，优先在仓库文档与脚本里落地，再执行
