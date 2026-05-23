package com.excel.forum.service;

import java.util.List;

public interface AiCompletionService {
    Result complete(Request request);

    record Request(
            String systemPromptOverride,
            String userPrompt,
            List<ImageInput> images,
            Integer maxOutputTokens,
            Double temperature
    ) {
    }

    record ImageInput(String name, String mimeType, Long size, String dataUrl) {
    }

    record Result(String answer, String model, boolean fallbackUsed, Long configId) {
    }
}
