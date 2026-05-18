# 小试牛刀闯关模式文档总索引

## 1. 文档目标

本索引用于把“小试牛刀闯关模式”相关文档整理成一套可以直接进入研发执行的文档包。

适用对象：

- 产品
- 前端
- 后端
- 测试
- 运营配置人员

---

## 2. 文档目录

### 2.1 总方案

- [闯关模式方案总览](./practice-campaign-plan.md)

适用：

- 了解整体方向
- 评估产品可行性
- 对齐玩法目标

### 2.2 页面原型

- [前端页面原型说明](./practice-campaign-ui-wireframe.md)

适用：

- 前端页面设计
- 页面结构拆解
- 移动端与桌面端页面收口

### 2.3 数据结构

- [数据库 SQL 草案](./practice-campaign-schema.md)

适用：

- Flyway 迁移
- 数据表设计
- 后端实体与 Mapper 建模

### 2.4 接口设计

- [接口设计说明](./practice-campaign-api.md)

适用：

- Controller / Service 开发
- 前后端联调
- DTO 约定

### 2.5 任务拆解

- [开发任务拆解](./practice-campaign-task-breakdown.md)

适用：

- 排期
- 分工
- 验收

### 2.6 实施说明

- [项目实施说明](./practice-campaign-implementation-spec.md)

适用：

- 明确改哪些文件
- 先做哪些模块
- 与现有系统如何融合

### 2.7 后台配置设计

- [后台配置与运营设计](./practice-campaign-admin-ops.md)

适用：

- 后台功能补充
- 章节/关卡/每日挑战配置
- 运营使用流程

### 2.8 DTO 与枚举

- [DTO 与枚举约定](./practice-campaign-dto-spec.md)

适用：

- 前后端字段统一
- 状态枚举统一
- 错误码约定

### 2.9 测试清单

- [测试与验收清单](./practice-campaign-test-checklist.md)

适用：

- 功能测试
- 联调测试
- 回归测试
- 上线验收

---

## 3. 推荐阅读顺序

### 产品 / 需求确认

1. [闯关模式方案总览](./practice-campaign-plan.md)
2. [前端页面原型说明](./practice-campaign-ui-wireframe.md)
3. [后台配置与运营设计](./practice-campaign-admin-ops.md)

### 前端开发

1. [前端页面原型说明](./practice-campaign-ui-wireframe.md)
2. [接口设计说明](./practice-campaign-api.md)
3. [DTO 与枚举约定](./practice-campaign-dto-spec.md)
4. [项目实施说明](./practice-campaign-implementation-spec.md)

### 后端开发

1. [数据库 SQL 草案](./practice-campaign-schema.md)
2. [接口设计说明](./practice-campaign-api.md)
3. [DTO 与枚举约定](./practice-campaign-dto-spec.md)
4. [项目实施说明](./practice-campaign-implementation-spec.md)

### 测试

1. [开发任务拆解](./practice-campaign-task-breakdown.md)
2. [测试与验收清单](./practice-campaign-test-checklist.md)

---

## 4. 当前建议执行顺序

建议按这 5 步推进：

1. 先建表
2. 先做章节与关卡读取接口
3. 前端替换现有 Practice 首页为闯关大厅
4. 改造现有答题页接入关卡上下文
5. 接通提交与结算

---

## 5. 当前仓库实施入口

### 前端重点文件

- `reace_web/src/app/pages/Practice.tsx`
- `reace_web/src/app/pages/PracticeDetail.tsx`
- `reace_web/src/app/pages/PracticeHistory.tsx`
- `reace_web/src/app/pages/PracticeRecordDetail.tsx`
- `reace_web/src/app/routes.tsx`
- `reace_web/src/app/components/Layout.tsx`
- `reace_web/src/app/lib/query-keys.ts`

### 后端重点目录

- `excel-forum-backend/src/main/java/com/excel/forum/controller`
- `excel-forum-backend/src/main/java/com/excel/forum/service`
- `excel-forum-backend/src/main/java/com/excel/forum/mapper`
- `excel-forum-backend/src/main/java/com/excel/forum/entity`
- `excel-forum-backend/src/main/resources/db/migration`

---

## 6. 文档状态

当前文档包状态：

- 需求方案：已完成
- 页面原型：已完成
- 数据结构：已完成
- 接口设计：已完成
- 任务拆解：已完成
- 实施说明：已完成
- 后台配置：已完成
- DTO 约定：已完成
- 测试清单：已完成
