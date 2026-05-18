# 小试牛刀闯关模式数据库 SQL 草案

## 1. 设计原则

闯关模式需要在现有题库基础上增加“章节、关卡、进度、挑战、排行”几层结构。

原则：

- 不破坏现有题库表
- 通过关联关系给现有题目套上闯关结构
- 用户进度独立落表
- 排行可由日志统计或单独汇总

## 2. 表结构建议

### 2.1 世界表

```sql
CREATE TABLE practice_world (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    description VARCHAR(255) DEFAULT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    enabled TINYINT(1) NOT NULL DEFAULT 1,
    create_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

### 2.2 章节表

```sql
CREATE TABLE practice_chapter (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    world_id BIGINT NOT NULL,
    name VARCHAR(100) NOT NULL,
    description VARCHAR(255) DEFAULT NULL,
    unlock_star INT NOT NULL DEFAULT 0,
    required_level INT NOT NULL DEFAULT 0,
    sort_order INT NOT NULL DEFAULT 0,
    enabled TINYINT(1) NOT NULL DEFAULT 1,
    create_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_practice_chapter_world FOREIGN KEY (world_id) REFERENCES practice_world(id)
);
```

### 2.3 关卡表

```sql
CREATE TABLE practice_level (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    chapter_id BIGINT NOT NULL,
    question_id BIGINT NOT NULL,
    title VARCHAR(120) NOT NULL,
    level_type VARCHAR(32) NOT NULL DEFAULT 'normal',
    difficulty VARCHAR(32) NOT NULL DEFAULT 'easy',
    target_time_seconds INT NOT NULL DEFAULT 300,
    reward_exp INT NOT NULL DEFAULT 10,
    reward_points INT NOT NULL DEFAULT 5,
    first_pass_bonus INT NOT NULL DEFAULT 0,
    sort_order INT NOT NULL DEFAULT 0,
    enabled TINYINT(1) NOT NULL DEFAULT 1,
    create_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_practice_level_chapter FOREIGN KEY (chapter_id) REFERENCES practice_chapter(id)
);
```

### 2.4 用户关卡进度表

```sql
CREATE TABLE user_level_progress (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    level_id BIGINT NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'locked',
    stars INT NOT NULL DEFAULT 0,
    best_score INT NOT NULL DEFAULT 0,
    best_time_seconds INT DEFAULT NULL,
    pass_count INT NOT NULL DEFAULT 0,
    fail_count INT NOT NULL DEFAULT 0,
    first_pass_time DATETIME DEFAULT NULL,
    last_attempt_time DATETIME DEFAULT NULL,
    create_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_user_level_progress (user_id, level_id),
    INDEX idx_user_level_progress_user (user_id),
    INDEX idx_user_level_progress_level (level_id)
);
```

### 2.5 用户章节进度表

```sql
CREATE TABLE user_chapter_progress (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    chapter_id BIGINT NOT NULL,
    unlocked TINYINT(1) NOT NULL DEFAULT 0,
    completed TINYINT(1) NOT NULL DEFAULT 0,
    total_stars INT NOT NULL DEFAULT 0,
    cleared_levels INT NOT NULL DEFAULT 0,
    create_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_user_chapter_progress (user_id, chapter_id),
    INDEX idx_user_chapter_progress_user (user_id)
);
```

### 2.6 挑战记录表

```sql
CREATE TABLE practice_attempt (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    level_id BIGINT NOT NULL,
    question_id BIGINT NOT NULL,
    attempt_type VARCHAR(32) NOT NULL DEFAULT 'campaign',
    result_status VARCHAR(32) NOT NULL DEFAULT 'failed',
    score INT NOT NULL DEFAULT 0,
    stars INT NOT NULL DEFAULT 0,
    used_seconds INT DEFAULT NULL,
    error_count INT NOT NULL DEFAULT 0,
    gained_exp INT NOT NULL DEFAULT 0,
    gained_points INT NOT NULL DEFAULT 0,
    is_first_pass TINYINT(1) NOT NULL DEFAULT 0,
    submit_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_practice_attempt_user (user_id),
    INDEX idx_practice_attempt_level (level_id),
    INDEX idx_practice_attempt_submit_time (submit_time)
);
```

### 2.7 每日挑战表

```sql
CREATE TABLE daily_challenge (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    challenge_date DATE NOT NULL,
    level_id BIGINT NOT NULL,
    reward_exp INT NOT NULL DEFAULT 20,
    reward_points INT NOT NULL DEFAULT 10,
    enabled TINYINT(1) NOT NULL DEFAULT 1,
    create_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_daily_challenge_date (challenge_date)
);
```

### 2.8 错题记录表

```sql
CREATE TABLE user_wrong_question (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    question_id BIGINT NOT NULL,
    level_id BIGINT DEFAULT NULL,
    wrong_count INT NOT NULL DEFAULT 1,
    last_wrong_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    resolved TINYINT(1) NOT NULL DEFAULT 0,
    create_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_user_wrong_question (user_id, question_id)
);
```

## 3. 状态值建议

### 3.1 关卡类型

- `normal`
- `elite`
- `exam`
- `boss`
- `daily`

### 3.2 难度

- `easy`
- `medium`
- `hard`
- `expert`

### 3.3 用户关卡状态

- `locked`
- `available`
- `cleared`
- `perfect`

### 3.4 挑战结果

- `passed`
- `failed`
- `timeout`

## 4. 初始化数据建议

首批初始化建议：

- `practice_world`：1 到 2 个世界
- `practice_chapter`：5 个章节
- 每章节 8 到 12 个关卡

## 5. 迁移建议

建议使用新 Flyway 脚本，示例命名：

- `Vxx__create_practice_world.sql`
- `Vxx__create_practice_chapter.sql`
- `Vxx__create_practice_level.sql`
- `Vxx__create_user_level_progress.sql`
- `Vxx__create_user_chapter_progress.sql`
- `Vxx__create_practice_attempt.sql`
- `Vxx__create_daily_challenge.sql`
- `Vxx__create_user_wrong_question.sql`

不要修改历史迁移文件。
