package com.excel.forum.entity.dto;

import com.fasterxml.jackson.annotation.JsonAnySetter;

import java.util.LinkedHashMap;
import java.util.Map;

public class UserProfileUpdateRequest {
    private final Map<String, Object> fields = new LinkedHashMap<>();

    @JsonAnySetter
    public void put(String field, Object value) {
        fields.put(field, value);
    }

    public boolean containsKey(String field) {
        return fields.containsKey(field);
    }

    public Object get(String field) {
        return fields.get(field);
    }
}
