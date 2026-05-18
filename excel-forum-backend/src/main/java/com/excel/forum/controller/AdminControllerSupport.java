package com.excel.forum.controller;

import java.time.LocalDate;

final class AdminControllerSupport {
    private AdminControllerSupport() {
    }

    static String stringValue(Object value) {
        if (value == null) {
            return null;
        }
        String text = value.toString().trim();
        return text.isEmpty() ? null : text;
    }

    static String defaultValue(String value, String fallback) {
        return value != null ? value : fallback;
    }

    static String defaultText(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value;
    }

    static int safeInt(Integer value) {
        return value == null ? 0 : value;
    }

    static int safeInt(Object value) {
        if (value instanceof Number number) {
            return number.intValue();
        }
        return 0;
    }

    static Integer parseInteger(Object value) {
        if (value instanceof Number number) {
            return number.intValue();
        }
        if (value instanceof String text && !text.isBlank()) {
            try {
                return Integer.parseInt(text.trim());
            } catch (NumberFormatException ignored) {
                return null;
            }
        }
        return null;
    }

    static Integer parseInteger(Object value, int defaultValue) {
        Integer parsed = parseInteger(value);
        return parsed == null ? defaultValue : parsed;
    }

    static Long parseLong(Object value) {
        if (value instanceof Number number) {
            return number.longValue();
        }
        if (value instanceof String text && !text.isBlank()) {
            try {
                return Long.parseLong(text.trim());
            } catch (NumberFormatException ignored) {
                return null;
            }
        }
        return null;
    }

    static LocalDate parseLocalDate(Object value) {
        if (value instanceof LocalDate localDate) {
            return localDate;
        }
        if (value instanceof String text && !text.isBlank()) {
            try {
                return LocalDate.parse(text.trim());
            } catch (Exception ignored) {
                return null;
            }
        }
        return null;
    }

    static boolean parseBoolean(Object value, boolean defaultValue) {
        if (value instanceof Boolean flag) {
            return flag;
        }
        if (value instanceof String text && !text.isBlank()) {
            return Boolean.parseBoolean(text.trim());
        }
        return defaultValue;
    }
}
