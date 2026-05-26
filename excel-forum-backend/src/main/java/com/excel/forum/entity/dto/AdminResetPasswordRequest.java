package com.excel.forum.entity.dto;

import lombok.Data;

@Data
public class AdminResetPasswordRequest {
    private String password;
    private Boolean forceChangePassword;
    private Boolean notifyUser;
}
