package com.excel.forum.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.excel.forum.entity.MallItem;
import com.excel.forum.entity.MallRedemption;
import com.excel.forum.entity.UserEntitlement;
import com.excel.forum.mapper.UserEntitlementMapper;
import com.excel.forum.service.UserEntitlementService;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

import static com.excel.forum.util.QueryPageUtils.first;

@Service
@RequiredArgsConstructor
@Slf4j
public class UserEntitlementServiceImpl extends ServiceImpl<UserEntitlementMapper, UserEntitlement> implements UserEntitlementService {
    public static final String STATUS_PENDING = "pending";
    public static final String STATUS_ACTIVE = "active";
    public static final String STATUS_EXPIRED = "expired";
    public static final String STATUS_REVOKED = "revoked";
    public static final String TYPE_BADGE = "badge";

    private final ObjectMapper objectMapper;

    @Override
    public UserEntitlement grantForRedemption(Long userId, MallItem item, MallRedemption redemption) {
        if (userId == null || item == null || redemption == null) {
            return null;
        }
        UserEntitlement entitlement = first(this, new QueryWrapper<UserEntitlement>()
                .eq("source_redemption_id", redemption.getId())
                .orderByAsc("id"));
        if (entitlement == null) {
            entitlement = new UserEntitlement();
            entitlement.setUserId(userId);
            entitlement.setItemId(item.getId());
            entitlement.setEntitlementType(item.getType());
            entitlement.setEntitlementKey(buildEntitlementKey(item));
            entitlement.setDisplayName(item.getName());
            entitlement.setPayloadJson(buildPayloadJson(item));
            entitlement.setSourceRedemptionId(redemption.getId());
        }
        entitlement.setEffectiveFrom(LocalDateTime.now());
        entitlement.setEffectiveUntil(null);
        entitlement.setStatus(resolveInitialStatus(item));
        saveOrUpdate(entitlement);
        return entitlement;
    }

    @Override
    public UserEntitlement activateForRedemption(Long redemptionId) {
        if (redemptionId == null) {
            return null;
        }
        UserEntitlement entitlement = first(this, new QueryWrapper<UserEntitlement>()
                .eq("source_redemption_id", redemptionId)
                .orderByAsc("id"));
        if (entitlement == null) {
            return null;
        }
        entitlement.setStatus(STATUS_ACTIVE);
        if (entitlement.getEffectiveFrom() == null) {
            entitlement.setEffectiveFrom(LocalDateTime.now());
        }
        updateById(entitlement);
        return entitlement;
    }

    @Override
    public void revokeForRedemption(Long redemptionId) {
        if (redemptionId == null) {
            return;
        }
        UserEntitlement entitlement = first(this, new QueryWrapper<UserEntitlement>()
                .eq("source_redemption_id", redemptionId)
                .orderByAsc("id"));
        if (entitlement == null) {
            return;
        }
        entitlement.setStatus(STATUS_REVOKED);
        entitlement.setEffectiveUntil(LocalDateTime.now());
        updateById(entitlement);
    }

    @Override
    public UserEntitlement getLatestActiveBadge(Long userId) {
        if (userId == null) {
            return null;
        }
        List<UserEntitlement> badges = list(new QueryWrapper<UserEntitlement>()
                .eq("user_id", userId)
                .eq("entitlement_type", TYPE_BADGE)
                .eq("status", STATUS_ACTIVE)
                .and(wrapper -> wrapper.isNull("effective_until").or().gt("effective_until", LocalDateTime.now()))
                .orderByDesc("effective_from")
                .orderByDesc("id"));
        return resolveCurrentBadge(badges);
    }

    @Override
    public Map<Long, UserEntitlement> getLatestActiveBadgeMap(Collection<Long> userIds) {
        if (userIds == null || userIds.isEmpty()) {
            return Map.of();
        }
        List<UserEntitlement> entitlements = list(new QueryWrapper<UserEntitlement>()
                .in("user_id", userIds)
                .eq("entitlement_type", TYPE_BADGE)
                .eq("status", STATUS_ACTIVE)
                .and(wrapper -> wrapper.isNull("effective_until").or().gt("effective_until", LocalDateTime.now()))
                .orderByDesc("effective_from")
                .orderByDesc("id"));
        Map<Long, List<UserEntitlement>> grouped = entitlements.stream()
                .filter(item -> item.getUserId() != null)
                .collect(Collectors.groupingBy(UserEntitlement::getUserId, LinkedHashMap::new, Collectors.toList()));
        Map<Long, UserEntitlement> result = new LinkedHashMap<>();
        for (Map.Entry<Long, List<UserEntitlement>> entry : grouped.entrySet()) {
            UserEntitlement current = resolveCurrentBadge(entry.getValue());
            if (current != null) {
                result.put(entry.getKey(), current);
            }
        }
        return result;
    }

    @Override
    public Map<Long, UserEntitlement> getByRedemptionIds(Collection<Long> redemptionIds) {
        if (redemptionIds == null || redemptionIds.isEmpty()) {
            return Map.of();
        }
        return list(new QueryWrapper<UserEntitlement>()
                .in("source_redemption_id", redemptionIds))
                .stream()
                .filter(item -> item.getSourceRedemptionId() != null)
                .collect(Collectors.toMap(UserEntitlement::getSourceRedemptionId, item -> item, (left, right) -> left));
    }

    @Override
    public List<UserEntitlement> getUserEntitlements(Long userId) {
        if (userId == null) {
            return List.of();
        }
        return list(new QueryWrapper<UserEntitlement>()
                .eq("user_id", userId)
                .orderByDesc("effective_from")
                .orderByDesc("id"));
    }

    @Override
    public long countAvailableByKey(Long userId, String entitlementKey) {
        if (userId == null || !StringUtils.hasText(entitlementKey)) {
            return 0;
        }
        return listAvailableByKey(userId, entitlementKey).size();
    }

    @Override
    public UserEntitlement consumeAvailableByKey(Long userId, String entitlementKey) {
        if (userId == null || !StringUtils.hasText(entitlementKey)) {
            return null;
        }
        UserEntitlement entitlement = listAvailableByKey(userId, entitlementKey).stream().findFirst().orElse(null);
        if (entitlement == null) {
            return null;
        }
        entitlement.setStatus(STATUS_EXPIRED);
        entitlement.setEffectiveUntil(LocalDateTime.now());
        updateById(entitlement);
        return entitlement;
    }

    @Override
    public UserEntitlement equipBadge(Long userId, Long entitlementId) {
        if (userId == null || entitlementId == null) {
            return null;
        }
        UserEntitlement entitlement = getById(entitlementId);
        if (entitlement == null
                || !userId.equals(entitlement.getUserId())
                || !TYPE_BADGE.equalsIgnoreCase(entitlement.getEntitlementType())
                || !STATUS_ACTIVE.equalsIgnoreCase(entitlement.getStatus())) {
            return null;
        }
        List<UserEntitlement> badges = list(new QueryWrapper<UserEntitlement>()
                .eq("user_id", userId)
                .eq("entitlement_type", TYPE_BADGE)
                .eq("status", STATUS_ACTIVE)
                .and(wrapper -> wrapper.isNull("effective_until").or().gt("effective_until", LocalDateTime.now())));
        LocalDateTime now = LocalDateTime.now();
        for (UserEntitlement badge : badges) {
            writeEquippedState(badge, Objects.equals(badge.getId(), entitlementId));
            if (Objects.equals(badge.getId(), entitlementId)) {
                badge.setEffectiveFrom(now);
            }
            updateById(badge);
        }
        entitlement.setEffectiveFrom(now);
        writeEquippedState(entitlement, true);
        return entitlement;
    }

    @Override
    public void unequipBadge(Long userId, Long entitlementId) {
        if (userId == null || entitlementId == null) {
            return;
        }
        UserEntitlement entitlement = getById(entitlementId);
        if (entitlement == null
                || !userId.equals(entitlement.getUserId())
                || !TYPE_BADGE.equalsIgnoreCase(entitlement.getEntitlementType())
                || !STATUS_ACTIVE.equalsIgnoreCase(entitlement.getStatus())) {
            return;
        }
        List<UserEntitlement> badges = list(new QueryWrapper<UserEntitlement>()
                .eq("user_id", userId)
                .eq("entitlement_type", TYPE_BADGE)
                .eq("status", STATUS_ACTIVE)
                .and(wrapper -> wrapper.isNull("effective_until").or().gt("effective_until", LocalDateTime.now())));
        for (UserEntitlement badge : badges) {
            writeEquippedState(badge, false);
            updateById(badge);
        }
    }

    private String resolveInitialStatus(MallItem item) {
        if (TYPE_BADGE.equalsIgnoreCase(item.getType())) {
            return STATUS_ACTIVE;
        }
        if ("manual_review".equalsIgnoreCase(item.getDeliveryType())) {
            return STATUS_PENDING;
        }
        return STATUS_ACTIVE;
    }

    private String buildEntitlementKey(MallItem item) {
        if (isCheckinMakeupCard(item)) {
            return KEY_CHECKIN_MAKEUP_CARD;
        }
        String type = item.getType() == null ? "item" : item.getType().trim().toLowerCase();
        return type + "_" + item.getId();
    }

    private List<UserEntitlement> listAvailableByKey(Long userId, String entitlementKey) {
        QueryWrapper<UserEntitlement> queryWrapper = new QueryWrapper<>();
        queryWrapper.eq("user_id", userId)
                .eq("status", STATUS_ACTIVE)
                .and(wrapper -> wrapper.isNull("effective_until").or().gt("effective_until", LocalDateTime.now()));
        if (KEY_CHECKIN_MAKEUP_CARD.equals(entitlementKey)) {
            queryWrapper.and(wrapper -> wrapper
                    .eq("entitlement_key", entitlementKey)
                    .or(inner -> inner.eq("entitlement_type", "prop")
                            .and(nameWrapper -> nameWrapper.like("display_name", "签到卡").or().like("display_name", "补签卡"))));
        } else {
            queryWrapper.eq("entitlement_key", entitlementKey);
        }
        queryWrapper.orderByAsc("effective_from").orderByAsc("id");
        return list(queryWrapper);
    }

    private boolean isCheckinMakeupCard(MallItem item) {
        if (item == null || !"prop".equalsIgnoreCase(item.getType())) {
            return false;
        }
        String name = item.getName();
        return StringUtils.hasText(name) && (name.contains("签到卡") || name.contains("补签卡"));
    }

    private UserEntitlement resolveCurrentBadge(List<UserEntitlement> badges) {
        if (badges == null || badges.isEmpty()) {
            return null;
        }
        UserEntitlement equipped = badges.stream()
                .filter(item -> Boolean.TRUE.equals(readEquippedState(item)))
                .findFirst()
                .orElse(null);
        if (equipped != null) {
            return equipped;
        }
        boolean hasExplicitState = badges.stream().map(this::readEquippedState).anyMatch(Objects::nonNull);
        return hasExplicitState ? null : badges.get(0);
    }

    private Boolean readEquippedState(UserEntitlement entitlement) {
        Map<String, Object> payload = parsePayload(entitlement.getPayloadJson());
        if (!payload.containsKey("equipped")) {
            return null;
        }
        Object raw = payload.get("equipped");
        if (raw instanceof Boolean bool) {
            return bool;
        }
        return raw == null ? null : Boolean.parseBoolean(String.valueOf(raw));
    }

    private void writeEquippedState(UserEntitlement entitlement, Boolean equipped) {
        Map<String, Object> payload = parsePayload(entitlement.getPayloadJson());
        if (equipped == null) {
            payload.remove("equipped");
        } else {
            payload.put("equipped", equipped);
        }
        entitlement.setPayloadJson(writePayload(payload));
    }

    private Map<String, Object> parsePayload(String payloadJson) {
        if (!StringUtils.hasText(payloadJson)) {
            return new LinkedHashMap<>();
        }
        try {
            return objectMapper.readValue(payloadJson, new TypeReference<LinkedHashMap<String, Object>>() {});
        } catch (Exception exception) {
            log.debug("Failed to parse user entitlement payload, using empty payload", exception);
            return new LinkedHashMap<>();
        }
    }

    private String writePayload(Map<String, Object> payload) {
        try {
            return objectMapper.writeValueAsString(payload);
        } catch (Exception exception) {
            log.warn("Failed to serialize user entitlement payload, using empty JSON", exception);
            return "{}";
        }
    }

    private String buildPayloadJson(MallItem item) {
        StringBuilder builder = new StringBuilder("{");
        appendJsonField(builder, "itemName", item.getName());
        appendJsonField(builder, "iconKey", item.getIconKey());
        appendJsonField(builder, "themeColor", item.getThemeColor());
        appendJsonField(builder, "deliveryType", item.getDeliveryType());
        if (builder.length() > 1 && builder.charAt(builder.length() - 1) == ',') {
            builder.deleteCharAt(builder.length() - 1);
        }
        builder.append("}");
        return builder.toString();
    }

    private void appendJsonField(StringBuilder builder, String key, String value) {
        if (!StringUtils.hasText(value)) {
            return;
        }
        builder.append("\"")
                .append(escapeJson(key))
                .append("\":\"")
                .append(escapeJson(value))
                .append("\",");
    }

    private String escapeJson(String value) {
        return value == null ? "" : value.replace("\\", "\\\\").replace("\"", "\\\"");
    }
}
