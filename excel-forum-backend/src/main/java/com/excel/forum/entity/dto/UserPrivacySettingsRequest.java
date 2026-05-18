package com.excel.forum.entity.dto;

import lombok.Data;

@Data
public class UserPrivacySettingsRequest {
    private Boolean publicProfile;
    private Boolean showOnlineStatus;
}
