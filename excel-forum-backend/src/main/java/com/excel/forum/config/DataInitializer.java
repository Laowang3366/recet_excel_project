package com.excel.forum.config;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.excel.forum.entity.User;
import com.excel.forum.mapper.UserMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.env.Environment;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import com.excel.forum.util.UsernamePolicy;

import java.security.SecureRandom;

@Slf4j
@Component
@RequiredArgsConstructor
public class DataInitializer implements CommandLineRunner {
    private static final String PASSWORD_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

    private final UserMapper userMapper;
    private final PasswordEncoder passwordEncoder;
    private final Environment environment;

    @Override
    public void run(String... args) throws Exception {
        initAdminUser();
    }
    
    private void initAdminUser() {
        QueryWrapper<User> queryWrapper = new QueryWrapper<>();
        queryWrapper.eq("role", "admin");
        Long adminCount = userMapper.selectCount(queryWrapper);
        
        if (adminCount != 0) {
            log.info("管理员账户已存在，跳过初始化");
            return;
        }

        boolean isDev = environment.matchesProfiles("dev");
        boolean bootstrapEnabled = Boolean.parseBoolean(environment.getProperty("ADMIN_BOOTSTRAP_ENABLED", isDev ? "true" : "false"));
        if (!bootstrapEnabled) {
            log.warn("未检测到管理员账户，且 ADMIN_BOOTSTRAP_ENABLED=false，跳过管理员初始化");
            return;
        }

        String username = defaultIfBlank(environment.getProperty("ADMIN_BOOTSTRAP_USERNAME"), "admin");
        String email = defaultIfBlank(environment.getProperty("ADMIN_BOOTSTRAP_EMAIL"), "admin@excelforum.com");
        String rawPassword = environment.getProperty("ADMIN_BOOTSTRAP_PASSWORD");
        boolean generatedPassword = false;

        if (rawPassword == null || rawPassword.isBlank()) {
            if (!isDev) {
                log.error("生产环境未检测到管理员账户，且未提供 ADMIN_BOOTSTRAP_PASSWORD，已拒绝自动初始化");
                return;
            }
            rawPassword = generateBootstrapPassword(16);
            generatedPassword = true;
        }

        if (!UsernamePolicy.isValid(username)) {
            log.error("管理员初始化用户名不符合安全策略：{}", username);
            return;
        }
        if (email == null || !email.matches("^[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9.-]{1,190}\\.[A-Za-z]{2,63}$")) {
            log.error("管理员初始化邮箱不符合安全策略：{}", email);
            return;
        }

        log.info("开始初始化管理员账户...");

        User admin = new User();
        admin.setUsername(username);
        admin.setEmail(email);
        admin.setPassword(passwordEncoder.encode(rawPassword));
        admin.setTokenVersion(0);
        admin.setRole("admin");
        admin.setStatus(0);
        admin.setIsMuted(Boolean.FALSE);
        admin.setLevel(1);
        admin.setPoints(0);
        admin.setExp(0);
        admin.setBio("系统管理员");

        userMapper.insert(admin);

        log.info("管理员账户初始化完成");
        log.warn("管理员初始化账户：{}", username);
        if (generatedPassword) {
            log.warn("开发环境已生成一次性管理员密码：{}", rawPassword);
        } else {
            log.warn("管理员密码来自环境变量 ADMIN_BOOTSTRAP_PASSWORD，请登录后立即修改");
        }
    }

    private String defaultIfBlank(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value.trim();
    }

    private String generateBootstrapPassword(int length) {
        SecureRandom random = new SecureRandom();
        StringBuilder builder = new StringBuilder(length);
        for (int index = 0; index < length; index += 1) {
            int pointer = random.nextInt(PASSWORD_CHARS.length());
            builder.append(PASSWORD_CHARS.charAt(pointer));
        }
        return builder.toString();
    }
}
