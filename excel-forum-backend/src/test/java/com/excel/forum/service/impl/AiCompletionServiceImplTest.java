package com.excel.forum.service.impl;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;
import org.springframework.test.util.ReflectionTestUtils;

import static org.assertj.core.api.Assertions.assertThat;

class AiCompletionServiceImplTest {

    @Test
    void timeoutUsesConfiguredValue() {
        MockEnvironment environment = new MockEnvironment()
                .withProperty("AI_ASSISTANT_TIMEOUT_MS", "120000");
        AiCompletionServiceImpl service = serviceWithEnvironment(environment);

        Integer timeoutMs = ReflectionTestUtils.invokeMethod(service, "environmentTimeoutMs");

        assertThat(timeoutMs).isEqualTo(120000);
    }

    @Test
    void timeoutSupportsUpToSixtyMinutes() {
        MockEnvironment environment = new MockEnvironment()
                .withProperty("AI_ASSISTANT_TIMEOUT_MS", "7200000");
        AiCompletionServiceImpl service = serviceWithEnvironment(environment);

        Integer timeoutMs = ReflectionTestUtils.invokeMethod(service, "environmentTimeoutMs");

        assertThat(timeoutMs).isEqualTo(3_600_000);
    }

    @Test
    void timeoutCanBeConfiguredInMinutes() {
        MockEnvironment environment = new MockEnvironment()
                .withProperty("AI_ASSISTANT_TIMEOUT_MINUTES", "45");
        AiCompletionServiceImpl service = serviceWithEnvironment(environment);

        Integer timeoutMs = ReflectionTestUtils.invokeMethod(service, "environmentTimeoutMs");

        assertThat(timeoutMs).isEqualTo(2_700_000);
    }

    @Test
    void timeoutFallsBackToSixtySecondsWhenMissing() {
        AiCompletionServiceImpl service = serviceWithEnvironment(new MockEnvironment());

        Integer timeoutMs = ReflectionTestUtils.invokeMethod(service, "environmentTimeoutMs");

        assertThat(timeoutMs).isEqualTo(60000);
    }

    private AiCompletionServiceImpl serviceWithEnvironment(MockEnvironment environment) {
        return new AiCompletionServiceImpl(null, null, environment, new ObjectMapper());
    }
}
