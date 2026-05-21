package com.excel.forum.service;

import com.excel.forum.entity.User;

import java.util.Optional;

public interface PasswordResetTokenService {
    void issueResetToken(String username, String email, String requestIp);

    Optional<User> consumeToken(String rawToken);
}
