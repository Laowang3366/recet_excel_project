package com.excel.forum.entity.dto;

import lombok.Data;

@Data
public class AuthEmailChangeRequest {
    private String newEmail;
    private String password;
}
