package com.excel.forum.service.impl;

import com.excel.forum.entity.MallItem;
import com.excel.forum.entity.MallItemType;
import com.excel.forum.entity.MallRedemption;
import com.excel.forum.entity.User;
import com.excel.forum.entity.UserEntitlement;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

@Component
class MallResponseAssembler {
    Map<String, Object> toItemTypeResponse(MallItemType itemType) {
        Map<String, Object> response = new HashMap<>();
        response.put("id", itemType.getId());
        response.put("value", itemType.getTypeValue());
        response.put("label", itemType.getLabel());
        response.put("enabled", itemType.getEnabled() == null || itemType.getEnabled());
        response.put("sortOrder", safeInt(itemType.getSortOrder()));
        return response;
    }

    Map<String, Object> toItemResponse(MallItem item, MallItemType itemType, int currentPoints, Map<Long, Long> userRedemptionCountMap, LocalDateTime now) {
        String typeLabel = itemType == null ? item.getType() : itemType.getLabel();
        long userRedemptionCount = userRedemptionCountMap.getOrDefault(item.getId(), 0L);
        String unavailableReason = resolveUnavailableReason(item, currentPoints, userRedemptionCount, now);

        Map<String, Object> response = baseItemResponse(item, typeLabel);
        response.put("canRedeem", unavailableReason == null);
        response.put("exchangeState", unavailableReason == null ? "available" : mapUnavailableCode(item, currentPoints, userRedemptionCount, now));
        response.put("exchangeMessage", unavailableReason == null ? "可立即兑换" : unavailableReason);
        return response;
    }

    Map<String, Object> toAdminItemResponse(MallItem item, MallItemType itemType, LocalDateTime now) {
        Map<String, Object> response = baseItemResponse(item, itemType == null ? item.getType() : itemType.getLabel());
        response.put("statusText", resolveItemWindowStatus(item, now));
        return response;
    }

    Map<String, Object> toRedemptionResponse(MallRedemption redemption, User user, MallItemType itemType, UserEntitlement entitlement) {
        Map<String, Object> response = new HashMap<>();
        response.put("id", redemption.getId());
        response.put("itemId", redemption.getItemId());
        response.put("itemName", redemption.getItemName());
        response.put("itemType", redemption.getItemType());
        response.put("itemTypeLabel", itemType == null ? redemption.getItemType() : itemType.getLabel());
        response.put("price", safeInt(redemption.getPrice()));
        response.put("status", redemption.getStatus());
        response.put("statusLabel", mapRedemptionStatus(redemption.getStatus()));
        response.put("remark", redemption.getRemark());
        response.put("processedBy", redemption.getProcessedBy());
        response.put("processedTime", redemption.getProcessedTime());
        response.put("createTime", redemption.getCreateTime());
        if (entitlement != null) {
            response.put("entitlementStatus", entitlement.getStatus());
            response.put("entitlementType", entitlement.getEntitlementType());
        }
        if (user != null) {
            Map<String, Object> userPayload = new HashMap<>();
            userPayload.put("id", user.getId());
            userPayload.put("username", user.getUsername());
            userPayload.put("avatar", user.getAvatar());
            response.put("user", userPayload);
        }
        return response;
    }

    String resolveUnavailableReason(MallItem item, User user, long userRedemptionCount, LocalDateTime now) {
        return resolveUnavailableReason(item, user == null ? 0 : safeInt(user.getPoints()), userRedemptionCount, now);
    }

    String resolveUnavailableReason(MallItem item, int currentPoints, long userRedemptionCount, LocalDateTime now) {
        if (!Boolean.TRUE.equals(item.getEnabled())) return "商品已下架";
        if (item.getAvailableFrom() != null && now.isBefore(item.getAvailableFrom())) return "兑换活动尚未开始";
        if (item.getAvailableUntil() != null && now.isAfter(item.getAvailableUntil())) return "兑换活动已结束";
        if (item.getStock() != null && item.getStock() <= 0) return "商品已售罄";
        if (item.getTotalLimit() != null && safeInt(item.getRedeemedCount()) >= item.getTotalLimit()) return "商品已达到总兑换上限";
        if (item.getPerUserLimit() != null && userRedemptionCount >= item.getPerUserLimit()) return "你已达到该商品的个人限兑次数";
        if (currentPoints > 0 && currentPoints < safeInt(item.getPrice())) return "积分不足";
        return null;
    }

    private Map<String, Object> baseItemResponse(MallItem item, String typeLabel) {
        Map<String, Object> response = new HashMap<>();
        response.put("id", item.getId());
        response.put("name", item.getName());
        response.put("type", item.getType());
        response.put("typeLabel", typeLabel);
        response.put("price", safeInt(item.getPrice()));
        response.put("description", item.getDescription());
        response.put("coverImage", item.getCoverImage());
        response.put("iconKey", item.getIconKey());
        response.put("themeColor", item.getThemeColor());
        response.put("enabled", item.getEnabled() == null || item.getEnabled());
        response.put("sortOrder", safeInt(item.getSortOrder()));
        response.put("stock", item.getStock());
        response.put("redeemedCount", safeInt(item.getRedeemedCount()));
        response.put("perUserLimit", item.getPerUserLimit());
        response.put("totalLimit", item.getTotalLimit());
        response.put("exchangeNotice", item.getExchangeNotice());
        response.put("availableFrom", item.getAvailableFrom());
        response.put("availableUntil", item.getAvailableUntil());
        response.put("deliveryType", item.getDeliveryType());
        return response;
    }

    private String mapUnavailableCode(MallItem item, int currentPoints, long userRedemptionCount, LocalDateTime now) {
        if (!Boolean.TRUE.equals(item.getEnabled())) return "disabled";
        if (item.getAvailableFrom() != null && now.isBefore(item.getAvailableFrom())) return "not_started";
        if (item.getAvailableUntil() != null && now.isAfter(item.getAvailableUntil())) return "ended";
        if (item.getStock() != null && item.getStock() <= 0) return "sold_out";
        if (item.getTotalLimit() != null && safeInt(item.getRedeemedCount()) >= item.getTotalLimit()) return "total_limit";
        if (item.getPerUserLimit() != null && userRedemptionCount >= item.getPerUserLimit()) return "user_limit";
        if (currentPoints > 0 && currentPoints < safeInt(item.getPrice())) return "points_insufficient";
        return "available";
    }

    private String resolveItemWindowStatus(MallItem item, LocalDateTime now) {
        if (!Boolean.TRUE.equals(item.getEnabled())) return "已下架";
        if (item.getAvailableFrom() != null && now.isBefore(item.getAvailableFrom())) return "未开始";
        if (item.getAvailableUntil() != null && now.isAfter(item.getAvailableUntil())) return "已结束";
        if (item.getStock() != null && item.getStock() <= 0) return "已售罄";
        return "可兑换";
    }

    private String mapRedemptionStatus(String status) {
        if ("pending".equals(status)) return "待处理";
        if ("fulfilled".equals(status)) return "已发放";
        if ("cancelled".equals(status)) return "已取消";
        return status;
    }

    private int safeInt(Integer value) {
        return value == null ? 0 : value;
    }

}
