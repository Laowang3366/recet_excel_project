package com.excel.forum.util;

import java.util.Map;

public final class QuestionDifficultyCatalog {
    private static final Map<Integer, Integer> POINTS_BY_DIFFICULTY = Map.of(
            1, 12,
            2, 15,
            3, 18,
            4, 20,
            5, 22,
            6, 24,
            7, 26,
            8, 28,
            9, 30,
            10, 32
    );

    private QuestionDifficultyCatalog() {
    }

    public static int normalizeDifficulty(Integer value) {
        if (value == null) {
            return 1;
        }
        return Math.max(1, Math.min(10, value));
    }

    public static int resolvePoints(Integer difficulty) {
        int normalizedDifficulty = normalizeDifficulty(difficulty);
        return POINTS_BY_DIFFICULTY.getOrDefault(normalizedDifficulty, 12);
    }
}
