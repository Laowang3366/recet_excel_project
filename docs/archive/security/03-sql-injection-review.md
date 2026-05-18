# SQL 注入审查说明

更新时间：2026-04-13

## 结论

当前已审查到的手写 SQL 未发现直接字符串拼接用户输入形成 SQL 注入的情况。  
项目中的手写 SQL 主要使用 MyBatis 注解和参数绑定，占位符均为 `#{...}`，属于参数化查询。

## 已审查的手写 SQL 位置

### 安全

- `CategoryMapper`
  - 使用 `<script>` + `<foreach>` + `#{categoryId}`
  - 输入为 `Collection<Long>`，未发现 `${}` 拼接
- `ReplyMapper`
  - 使用 `<script>` + `<foreach>` + `#{postId}`
  - 未发现动态字符串拼接
- `MessageMapper`
  - 使用 `#{userId}` 参数绑定
  - 仅为固定 SQL 模板
- `MallItemMapper`
  - `@Update` 固定模板 + `#{itemId}`
  - 无拼接输入
- `UserMapper`
  - `@Update` 固定模板 + `#{userId}` / `#{amount}`
  - 无拼接输入

### 未发现问题

- `AdminLogMapper` 仅继承 `BaseMapper`
- 其余 Mapper 当前未发现注解 SQL 或 `${}` 拼接

## 风险点说明

虽然当前手写 SQL 未发现注入问题，但以下写法后续应继续禁止：

- `${}` 直接拼接用户输入
- `QueryWrapper.last()` 拼接用户可控字符串
- 排序字段、表名、列名直接由前端透传

## 后续规则

- 手写 SQL 只允许使用 `#{}` 参数绑定
- 若必须拼接排序字段，必须走白名单映射
- 新增 Mapper 注解 SQL 时，代码审查必须检查是否出现 `${}`
