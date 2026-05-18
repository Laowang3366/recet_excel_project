package com.excel.forum.entity.dto;

import lombok.Data;

@Data
public class AuthPasswordChangeRequest {
    private String oldPassword;
    private String newPassword;
}
