package com.excel.forum.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@TableName("user")
public class User {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String username;
    private String email;
    private String password;
    private Integer tokenVersion;
    private String avatar;
    private String bio;
    private String gender;
    private Integer level;
    private Integer points;
    private Integer exp;
    private Integer status;
    private Boolean isMuted;
    private String role;
    private String excelLevel;
    private String expertise;
    private String jobTitle;
    private String location;
    private String website;
    private String coverImage;
    private Boolean notificationEmailEnabled;
    private Boolean notificationPushEnabled;
    private String themePreference;
    private Boolean isOnline;
    private LocalDateTime lastActiveTime;
    private Boolean publicProfile;
    private Boolean showOnlineStatus;
    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;
    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updateTime;
}
