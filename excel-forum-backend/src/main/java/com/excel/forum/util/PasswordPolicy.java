package com.excel.forum.util;

public final class PasswordPolicy {
    public static final String MESSAGE = "密码需为 8-64 位，包含大小写字母、数字和特殊字符";
    private static final String SPECIAL_CHARS = "!@#$%^&*()_+\\-=\\[\\]{};':\"\\\\|,.<>/?`~";

    private PasswordPolicy() {
    }

    public static boolean isStrongPassword(String password) {
        if (password == null || password.length() < 8 || password.length() > 64 || password.matches(".*\\s.*")) {
            return false;
        }
        boolean hasUpper = password.chars().anyMatch(Character::isUpperCase);
        boolean hasLower = password.chars().anyMatch(Character::isLowerCase);
        boolean hasDigit = password.chars().anyMatch(Character::isDigit);
        boolean hasSpecial = password.chars().anyMatch(ch -> SPECIAL_CHARS.indexOf(ch) >= 0);
        return hasUpper && hasLower && hasDigit && hasSpecial;
    }
}
