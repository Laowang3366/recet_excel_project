package com.excel.forum.entity.dto;

import lombok.Data;

@Data
public class ForgotPasswordRequest {
    private String username;
    private String email;
    private String newPassword;
}
