package com.excel.forum.service.impl;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

final class FormulaExplainSupport {
    private static final int MAX_FORMULA_LENGTH = 2000;
    private static final Pattern FUNCTION_PATTERN = Pattern.compile("(?i)\\b([A-Z][A-Z0-9_.]{1,40})\\s*\\(");
    private static final Set<String> DYNAMIC_ARRAY_FUNCTIONS = Set.of("FILTER", "SORT", "SORTBY", "UNIQUE", "SEQUENCE", "RANDARRAY", "TAKE", "DROP", "CHOOSECOLS", "CHOOSEROWS", "WRAPROWS", "WRAPCOLS", "TOCOL", "TOROW", "EXPAND", "HSTACK", "VSTACK");
    private static final Set<String> VOLATILE_FUNCTIONS = Set.of("NOW", "TODAY", "RAND", "RANDBETWEEN", "OFFSET", "INDIRECT");

    private FormulaExplainSupport() {
    }

    static Analysis analyze(String input) {
        if (input == null || input.trim().isEmpty()) {
            throw new IllegalArgumentException("请输入需要解释的 Excel 公式");
        }
        String formula = input.trim();
        if (formula.length() > MAX_FORMULA_LENGTH) {
            throw new IllegalArgumentException("公式长度不能超过 2000 个字符");
        }
        if (!hasBalancedParentheses(formula)) {
            throw new IllegalArgumentException("公式括号不完整，请检查后再解释");
        }
        String normalizedFormula = formula.replaceFirst("^=\\s*", "");
        List<String> functions = extractFunctions(normalizedFormula);
        int depth = maxParenthesesDepth(normalizedFormula);
        boolean structuredReference = hasStructuredReference(normalizedFormula);
        boolean dynamicArrayFunction = functions.stream().anyMatch(DYNAMIC_ARRAY_FUNCTIONS::contains);
        return new Analysis(
                formula,
                normalizedFormula,
                functions,
                depth,
                depth,
                structuredReference,
                dynamicArrayFunction,
                riskFlags(functions, depth, structuredReference, dynamicArrayFunction)
        );
    }

    static String extractJsonObject(String text) {
        if (text == null || text.isBlank()) {
            throw new IllegalStateException("公式解释结果为空");
        }
        int start = text.indexOf('{');
        int end = text.lastIndexOf('}');
        if (start < 0 || end <= start) {
            throw new IllegalStateException("公式解释结果解析失败，请稍后重试");
        }
        return text.substring(start, end + 1);
    }

    private static boolean hasBalancedParentheses(String formula) {
        int depth = 0;
        boolean inString = false;
        for (int index = 0; index < formula.length(); index += 1) {
            char current = formula.charAt(index);
            if (current == '"') {
                if (inString && index + 1 < formula.length() && formula.charAt(index + 1) == '"') {
                    index += 1;
                    continue;
                }
                inString = !inString;
                continue;
            }
            if (inString) {
                continue;
            }
            if (current == '(') {
                depth += 1;
            } else if (current == ')') {
                depth -= 1;
                if (depth < 0) {
                    return false;
                }
            }
        }
        return depth == 0 && !inString;
    }

    private static List<String> extractFunctions(String formula) {
        Set<String> names = new LinkedHashSet<>();
        String searchable = stripStringLiterals(formula);
        Matcher matcher = FUNCTION_PATTERN.matcher(searchable);
        while (matcher.find()) {
            names.add(matcher.group(1).toUpperCase());
        }
        return new ArrayList<>(names);
    }

    private static int maxParenthesesDepth(String formula) {
        int max = 0;
        int depth = 0;
        boolean inString = false;
        for (int index = 0; index < formula.length(); index += 1) {
            char current = formula.charAt(index);
            if (current == '"') {
                if (inString && index + 1 < formula.length() && formula.charAt(index + 1) == '"') {
                    index += 1;
                    continue;
                }
                inString = !inString;
                continue;
            }
            if (inString) {
                continue;
            }
            if (current == '(') {
                depth += 1;
                max = Math.max(max, depth);
            } else if (current == ')') {
                depth -= 1;
            }
        }
        return max;
    }

    private static boolean hasStructuredReference(String formula) {
        String searchable = stripStringLiterals(formula);
        return searchable.contains("[") && searchable.contains("]");
    }

    private static List<String> riskFlags(List<String> functions, int depth, boolean structuredReference, boolean dynamicArrayFunction) {
        List<String> flags = new ArrayList<>();
        if (depth >= 3) {
            flags.add("deep_nesting");
        }
        if (structuredReference) {
            flags.add("structured_reference");
        }
        if (dynamicArrayFunction) {
            flags.add("dynamic_array");
        }
        if (functions.stream().anyMatch(VOLATILE_FUNCTIONS::contains)) {
            flags.add("volatile_function");
        }
        return flags;
    }

    private static String stripStringLiterals(String formula) {
        StringBuilder result = new StringBuilder(formula.length());
        boolean inString = false;
        for (int index = 0; index < formula.length(); index += 1) {
            char current = formula.charAt(index);
            if (current == '"') {
                if (inString && index + 1 < formula.length() && formula.charAt(index + 1) == '"') {
                    result.append(' ');
                    index += 1;
                    continue;
                }
                inString = !inString;
                result.append(' ');
            } else {
                result.append(inString ? ' ' : current);
            }
        }
        return result.toString();
    }

    record Analysis(String formula,
                    String normalizedFormula,
                    List<String> functions,
                    int parenthesesDepth,
                    int nestingDepth,
                    boolean structuredReference,
                    boolean dynamicArrayFunction,
                    List<String> riskFlags) {
    }
}
