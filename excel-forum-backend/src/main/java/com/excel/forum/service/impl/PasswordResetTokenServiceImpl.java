package com.excel.forum.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.UpdateWrapper;
import com.excel.forum.entity.PasswordResetToken;
import com.excel.forum.entity.User;
import com.excel.forum.mapper.PasswordResetTokenMapper;
import com.excel.forum.service.PasswordResetTokenService;
import com.excel.forum.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class PasswordResetTokenServiceImpl implements PasswordResetTokenService {
    private static final SecureRandom RANDOM = new SecureRandom();
    private static final int TOKEN_BYTES = 32;
    private static final int TOKEN_TTL_MINUTES = 15;

    private final PasswordResetTokenMapper passwordResetTokenMapper;
    private final UserService userService;

    @Override
    @Transactional
    public void issueResetToken(String username, String email, String requestIp) {
        if (!StringUtils.hasText(username) || !StringUtils.hasText(email)) {
            return;
        }
        User user = userService.findByUsername(username);
        if (user == null || !email.equalsIgnoreCase(user.getEmail())) {
            return;
        }

        passwordResetTokenMapper.update(null, new UpdateWrapper<PasswordResetToken>()
                .set("used_at", LocalDateTime.now())
                .eq("user_id", user.getId())
                .isNull("used_at"));

        PasswordResetToken token = new PasswordResetToken();
        token.setUserId(user.getId());
        token.setTokenHash(hash(generateRawToken()));
        token.setRequestIp(requestIp);
        token.setExpiresAt(LocalDateTime.now().plusMinutes(TOKEN_TTL_MINUTES));
        passwordResetTokenMapper.insert(token);
        // The raw token is intentionally not returned or logged; delivery must
        // be wired through a trusted email/SMS channel before exposing it.
    }

    @Override
    @Transactional
    public Optional<User> consumeToken(String rawToken) {
        if (!StringUtils.hasText(rawToken)) {
            return Optional.empty();
        }
        PasswordResetToken token = passwordResetTokenMapper.selectOne(new QueryWrapper<PasswordResetToken>()
                .eq("token_hash", hash(rawToken.trim()))
                .isNull("used_at")
                .gt("expires_at", LocalDateTime.now())
                .last("LIMIT 1"));
        if (token == null) {
            return Optional.empty();
        }

        int updated = passwordResetTokenMapper.update(null, new UpdateWrapper<PasswordResetToken>()
                .set("used_at", LocalDateTime.now())
                .eq("id", token.getId())
                .isNull("used_at"));
        if (updated <= 0) {
            return Optional.empty();
        }
        User user = userService.getById(token.getUserId());
        return user == null ? Optional.empty() : Optional.of(user);
    }

    private String generateRawToken() {
        byte[] bytes = new byte[TOKEN_BYTES];
        RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private String hash(String rawToken) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(rawToken.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception exception) {
            throw new IllegalStateException("密码重置令牌生成失败", exception);
        }
    }
}
