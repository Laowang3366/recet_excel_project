package com.excel.forum.service.impl;

import com.excel.forum.entity.AiAssistantConfig;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class AiAssistantConfigServiceImplTest {
    private final AiAssistantConfigServiceImpl service = new AiAssistantConfigServiceImpl(
            new ObjectMapper(),
            new MockEnvironment(),
            null
    );

    @Test
    void adminMapExposesTimeoutMinutesForUi() {
        AiAssistantConfig config = new AiAssistantConfig();
        config.setId(1L);
        config.setName("默认配置");
        config.setTimeoutMs(3_600_000);

        Map<String, Object> map = ReflectionTestUtils.invokeMethod(service, "toAdminMap", config);

        assertThat(map).containsEntry("timeoutMs", 3_600_000);
        assertThat(map).containsEntry("timeoutMinutes", 60);
    }
}
