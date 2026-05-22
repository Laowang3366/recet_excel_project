package com.excel.forum.util;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.RedisConnectionFailureException;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.security.MessageDigest;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.HexFormat;
import java.util.Iterator;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;

@Component
@Slf4j
public class JwtUtil {
    private static final int MIN_SECRET_BYTES = 64;
    private static final ConcurrentHashMap<String, Long> LOCAL_BLACKLIST = new ConcurrentHashMap<>();

    @Value("${jwt.secret}")
    private String secret;

    @Value("${jwt.expiration}")
    private Long expiration;

    private final StringRedisTemplate redisTemplate;

    public JwtUtil(StringRedisTemplate redisTemplate) {
        this.redisTemplate = redisTemplate;
    }

    @PostConstruct
    public void validateSecret() {
        if (secret == null || secret.isBlank()) {
            throw new IllegalStateException("必须配置 JWT_SECRET");
        }
        if (secret.getBytes(StandardCharsets.UTF_8).length < MIN_SECRET_BYTES) {
            throw new IllegalStateException("JWT_SECRET 长度不足，至少需要 64 字节");
        }
    }

    private SecretKey getSigningKey() {
        byte[] keyBytes = secret.getBytes(StandardCharsets.UTF_8);
        return Keys.hmacShaKeyFor(keyBytes);
    }

    public String generateToken(Long userId, String username, String role, Integer tokenVersion) {
        Date now = new Date();
        Date expiryDate = new Date(now.getTime() + expiration);

        return Jwts.builder()
                .subject(userId.toString())
                .claim("username", username)
                .claim("role", role)
                .claim("tokenVersion", tokenVersion == null ? 0 : tokenVersion)
                .issuedAt(now)
                .expiration(expiryDate)
                .signWith(getSigningKey())
                .compact();
    }

    public Claims parseToken(String token) {
        return Jwts.parser()
                .verifyWith(getSigningKey())
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }

    public Long getUserIdFromToken(String token) {
        Claims claims = parseToken(token);
        return Long.parseLong(claims.getSubject());
    }

    public String getUsernameFromToken(String token) {
        Claims claims = parseToken(token);
        return claims.get("username", String.class);
    }

    public String getRoleFromToken(String token) {
        Claims claims = parseToken(token);
        return claims.get("role", String.class);
    }

    public Integer getTokenVersionFromToken(String token) {
        Claims claims = parseToken(token);
        Integer tokenVersion = claims.get("tokenVersion", Integer.class);
        return tokenVersion == null ? 0 : tokenVersion;
    }

    public boolean validateToken(String token) {
        try {
            parseToken(token);
            return !isBlacklisted(token);
        } catch (Exception e) {
            return false;
        }
    }

    public void invalidateToken(String token) {
        if (token == null || token.isBlank()) return;
        try {
            Claims claims = parseToken(token);
            long ttl = Math.max(claims.getExpiration().getTime() - System.currentTimeMillis(), 0L);
            LOCAL_BLACKLIST.put(buildBlacklistKey(token), System.currentTimeMillis() + ttl);
            redisTemplate.opsForValue().set(buildBlacklistKey(token), "1", ttl, TimeUnit.MILLISECONDS);
        } catch (Exception exception) {
            log.debug("Failed to invalidate JWT token", exception);
        }
    }

    private boolean isBlacklisted(String token) {
        pruneLocalBlacklist();
        String key = buildBlacklistKey(token);
        Long localExpiry = LOCAL_BLACKLIST.get(key);
        if (localExpiry != null && localExpiry > System.currentTimeMillis()) {
            return true;
        }
        try {
            Boolean exists = redisTemplate.hasKey(key);
            return Boolean.TRUE.equals(exists);
        } catch (RedisConnectionFailureException exception) {
            log.debug("Redis unavailable while checking token blacklist", exception);
            return true;
        } catch (Exception exception) {
            log.debug("Token blacklist lookup failed", exception);
            return true;
        }
    }

    private String buildBlacklistKey(String token) {
        return "jwt:blacklist:sha256:" + sha256(token);
    }

    private String sha256(String token) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(token.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception exception) {
            throw new IllegalStateException("JWT blacklist key generation failed", exception);
        }
    }

    private void pruneLocalBlacklist() {
        long now = System.currentTimeMillis();
        Iterator<Map.Entry<String, Long>> iterator = LOCAL_BLACKLIST.entrySet().iterator();
        while (iterator.hasNext()) {
            Map.Entry<String, Long> entry = iterator.next();
            if (entry.getValue() <= now) {
                iterator.remove();
            }
        }
    }
}
