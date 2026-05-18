package com.excel.forum.entity.dto;

import lombok.Data;

@Data
public class AdminUserRequest {
    private String username;
    private String email;
    private String password;
    private String role;
    private Object status;
    private Boolean isMuted;
}
