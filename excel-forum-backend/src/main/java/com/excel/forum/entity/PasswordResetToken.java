package com.excel.forum.entity;

import com.baomidou.mybatisplus.annotation.FieldFill;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("password_reset_token")
public class PasswordResetToken {
    @TableId(type = IdType.AUTO)
    private Long id;
    private Long userId;
    private String tokenHash;
    private String requestIp;
    private LocalDateTime expiresAt;
    private LocalDateTime usedAt;
    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;
}
