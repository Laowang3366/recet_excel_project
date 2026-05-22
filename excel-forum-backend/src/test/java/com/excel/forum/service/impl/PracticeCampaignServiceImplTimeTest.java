package com.excel.forum.service.impl;

import com.excel.forum.entity.PracticeAttempt;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;

class PracticeCampaignServiceImplTimeTest {

    @Test
    void serverElapsedTimeTakesPrecedenceOverClientReportedSeconds() {
        PracticeAttempt attempt = new PracticeAttempt();
        attempt.setSubmitTime(LocalDateTime.of(2026, 5, 22, 10, 0, 0));

        int usedSeconds = PracticeCampaignServiceImpl.resolveServerUsedSeconds(
                attempt,
                1,
                LocalDateTime.of(2026, 5, 22, 10, 2, 5)
        );

        assertThat(usedSeconds).isEqualTo(125);
    }

    @Test
    void clientTimeFallbackIsClampedWhenServerStartTimeIsMissing() {
        int usedSeconds = PracticeCampaignServiceImpl.resolveServerUsedSeconds(
                new PracticeAttempt(),
                -30,
                LocalDateTime.of(2026, 5, 22, 10, 2, 5)
        );

        assertThat(usedSeconds).isZero();
    }
}
