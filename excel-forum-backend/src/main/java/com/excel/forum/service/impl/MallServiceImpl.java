package com.excel.forum.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.excel.forum.entity.MallItem;
import com.excel.forum.entity.MallItemType;
import com.excel.forum.entity.MallRedemption;
import com.excel.forum.entity.PointsRecord;
import com.excel.forum.entity.User;
import com.excel.forum.entity.UserEntitlement;
import com.excel.forum.mapper.MallItemMapper;
import com.excel.forum.mapper.MallItemTypeMapper;
import com.excel.forum.mapper.MallRedemptionMapper;
import com.excel.forum.mapper.PointsRecordMapper;
import com.excel.forum.mapper.UserMapper;
import com.excel.forum.service.MallService;
import com.excel.forum.service.UserEntitlementService;
import com.excel.forum.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Collection;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

import static com.excel.forum.util.QueryPageUtils.first;
import static com.excel.forum.util.QueryPageUtils.limit;

@Service
@RequiredArgsConstructor
public class MallServiceImpl implements MallService {
    private static final String DELIVERY_TYPE_VIRTUAL_AUTO = "virtual_auto";
    private static final String DELIVERY_TYPE_MANUAL_REVIEW = "manual_review";
    private static final Set<String> VALID_DELIVERY_TYPES = Set.of(DELIVERY_TYPE_VIRTUAL_AUTO, DELIVERY_TYPE_MANUAL_REVIEW);
    private static final String REDEMPTION_STATUS_PENDING = "pending";
    private static final String REDEMPTION_STATUS_FULFILLED = "fulfilled";
    private static final String REDEMPTION_STATUS_CANCELLED = "cancelled";
    private static final Set<String> VALID_REDEMPTION_STATUSES = Set.of(REDEMPTION_STATUS_PENDING, REDEMPTION_STATUS_FULFILLED, REDEMPTION_STATUS_CANCELLED);

    private final MallItemMapper mallItemMapper;
    private final MallItemTypeMapper mallItemTypeMapper;
    private final MallRedemptionMapper mallRedemptionMapper;
    private final UserService userService;
    private final UserEntitlementService userEntitlementService;
    private final PointsRecordMapper pointsRecordMapper;
    private final UserMapper userMapper;

    @Override
    public Map<String, Object> getOverview(Long userId) {
        User user = userService.getById(userId);
        if (user == null) {
            throw new IllegalArgumentException("用户不存在");
        }

        QueryWrapper<MallRedemption> redemptionQuery = new QueryWrapper<>();
        redemptionQuery.eq("user_id", userId).orderByDesc("create_time");

        Map<String, Object> response = new HashMap<>();
        response.put("user", Map.of(
                "id", user.getId(),
                "username", user.getUsername(),
                "points", safeInt(user.getPoints())
        ));
        response.put("availableItems", countVisibleItems());
        List<MallRedemption> recentRedemptions = limit(mallRedemptionMapper, redemptionQuery, 5);
        Map<Long, UserEntitlement> entitlementMap = userEntitlementService.getByRedemptionIds(
                recentRedemptions.stream().map(MallRedemption::getId).filter(Objects::nonNull).toList()
        );
        response.put("recentRedemptions", recentRedemptions.stream()
                .map(redemption -> toRedemptionResponse(redemption, null, null, entitlementMap.get(redemption.getId())))
                .toList());
        response.put("totalRedemptions", countUserActiveRedemptions(userId));
        response.put("pendingRedemptions", countUserRedemptionsByStatus(userId, REDEMPTION_STATUS_PENDING));
        return response;
    }

    @Override
    public Map<String, Object> getItems(String type, Long userId) {
        List<MallItemType> enabledTypes = listVisibleTypes();
        Map<String, MallItemType> typeMap = enabledTypes.stream()
                .collect(Collectors.toMap(MallItemType::getTypeValue, item -> item, (left, right) -> left, LinkedHashMap::new));

        QueryWrapper<MallItem> queryWrapper = new QueryWrapper<>();
        queryWrapper.eq("enabled", true);
        if (!typeMap.isEmpty()) {
            queryWrapper.in("type", typeMap.keySet());
        } else {
            queryWrapper.apply("1 = 0");
        }
        if (StringUtils.hasText(type) && !"all".equalsIgnoreCase(type.trim())) {
            queryWrapper.eq("type", type.trim());
        }
        queryWrapper.orderByAsc("sort_order").orderByAsc("id");

        User user = userId == null ? null : userService.getById(userId);
        int currentPoints = user == null ? 0 : safeInt(user.getPoints());
        Map<Long, Long> userRedemptionCountMap = userId == null ? Map.of() : countUserRedemptionsByItem(userId);
        LocalDateTime now = LocalDateTime.now();

        List<Map<String, Object>> items = mallItemMapper.selectList(queryWrapper).stream()
                .map(item -> toItemResponse(item, typeMap.get(item.getType()), currentPoints, userRedemptionCountMap, now))
                .toList();

        return Map.of(
                "items", items,
                "types", enabledTypes.stream().map(this::toItemTypeResponse).toList(),
                "total", items.size()
        );
    }

    @Override
    public Map<String, Object> getItemTypes() {
        return Map.of("types", listVisibleTypes().stream().map(this::toItemTypeResponse).toList());
    }

    @Override
    @Transactional
    public Map<String, Object> redeem(Long userId, Long itemId) {
        User user = userService.getById(userId);
        if (user == null) {
            throw new IllegalArgumentException("用户不存在");
        }

        MallItem item = mallItemMapper.selectById(itemId);
        if (item == null) {
            throw new IllegalArgumentException("商品不存在");
        }

        String unavailableReason = resolveUnavailableReason(item, user, countUserRedemption(itemId, userId), LocalDateTime.now());
        if (unavailableReason != null) {
            throw new IllegalStateException(unavailableReason);
        }

        int price = safeInt(item.getPrice());
        int updated = userMapper.deductPoints(userId, price);
        if (updated == 0) {
            throw new IllegalStateException("积分不足");
        }

        if (mallItemMapper.reserveForRedeem(itemId) == 0) {
            throw new IllegalStateException("商品库存不足或已达到兑换上限");
        }

        MallItem latestItem = mallItemMapper.selectById(itemId);
        MallRedemption redemption = new MallRedemption();
        redemption.setUserId(userId);
        redemption.setItemId(itemId);
        redemption.setItemName(item.getName());
        redemption.setItemType(item.getType());
        redemption.setPrice(price);
        redemption.setStatus(isManualReview(latestItem) ? REDEMPTION_STATUS_PENDING : REDEMPTION_STATUS_FULFILLED);
        if (!isManualReview(latestItem)) {
            redemption.setProcessedTime(LocalDateTime.now());
            redemption.setRemark("系统自动发放");
        }
        mallRedemptionMapper.insert(redemption);
        UserEntitlement entitlement = userEntitlementService.grantForRedemption(userId, latestItem, redemption);

        User updatedUser = userService.getById(userId);
        PointsRecord pointsRecord = new PointsRecord();
        pointsRecord.setUserId(userId);
        pointsRecord.setRuleName("商城兑换");
        pointsRecord.setChange(-price);
        pointsRecord.setBalance(updatedUser == null ? 0 : safeInt(updatedUser.getPoints()));
        pointsRecord.setDescription("兑换商品：" + item.getName());
        pointsRecordMapper.insert(pointsRecord);

        MallItemType itemType = getItemType(item.getType());
        return Map.of(
                "message", "兑换成功",
                "redemption", toRedemptionResponse(redemption, updatedUser, itemType, entitlement),
                "points", updatedUser == null ? 0 : safeInt(updatedUser.getPoints())
        );
    }

    @Override
    public Map<String, Object> getRedemptions(Long userId, Integer page, Integer size) {
        Page<MallRedemption> pageRequest = new Page<>(normalizePage(page), normalizeSize(size));
        QueryWrapper<MallRedemption> queryWrapper = new QueryWrapper<>();
        queryWrapper.eq("user_id", userId).orderByDesc("create_time");

        Page<MallRedemption> result = mallRedemptionMapper.selectPage(pageRequest, queryWrapper);
        Map<String, MallItemType> typeMap = buildTypeMap(listAllTypes());
        User user = userService.getById(userId);
        Map<Long, UserEntitlement> entitlementMap = userEntitlementService.getByRedemptionIds(
                result.getRecords().stream().map(MallRedemption::getId).filter(Objects::nonNull).toList()
        );

        return Map.of(
                "records", result.getRecords().stream().map(item -> toRedemptionResponse(item, user, typeMap.get(item.getItemType()), entitlementMap.get(item.getId()))).toList(),
                "total", result.getTotal(),
                "current", result.getCurrent(),
                "size", result.getSize(),
                "pages", result.getPages()
        );
    }

    @Override
    public Map<String, Object> getAdminOverview() {
        Map<String, Object> stats = new HashMap<>();
        stats.put("totalItems", mallItemMapper.selectCount(null));
        stats.put("enabledItems", mallItemMapper.selectCount(new QueryWrapper<MallItem>().eq("enabled", true)));
        stats.put("typeCount", mallItemTypeMapper.selectCount(null));
        stats.put("pendingRedemptions", mallRedemptionMapper.selectCount(new QueryWrapper<MallRedemption>().eq("status", REDEMPTION_STATUS_PENDING)));
        stats.put("fulfilledRedemptions", mallRedemptionMapper.selectCount(new QueryWrapper<MallRedemption>().eq("status", REDEMPTION_STATUS_FULFILLED)));
        stats.put("cancelledRedemptions", mallRedemptionMapper.selectCount(new QueryWrapper<MallRedemption>().eq("status", REDEMPTION_STATUS_CANCELLED)));
        return Map.of("stats", stats);
    }

    @Override
    public Map<String, Object> getAdminItems(Integer page, Integer size, String keyword, String type, Boolean enabled, String stockStatus) {
        Page<MallItem> pageRequest = new Page<>(normalizePage(page), normalizeSize(size));
        QueryWrapper<MallItem> queryWrapper = new QueryWrapper<>();
        if (StringUtils.hasText(keyword)) {
            String normalized = keyword.trim();
            queryWrapper.and(wrapper -> wrapper.like("name", normalized).or().like("description", normalized));
        }
        if (StringUtils.hasText(type)) {
            queryWrapper.eq("type", type.trim());
        }
        if (enabled != null) {
            queryWrapper.eq("enabled", enabled);
        }
        if (StringUtils.hasText(stockStatus)) {
            String normalized = stockStatus.trim().toLowerCase();
            if ("sold_out".equals(normalized)) {
                queryWrapper.isNotNull("stock").le("stock", 0);
            } else if ("limited".equals(normalized)) {
                queryWrapper.isNotNull("stock");
            } else if ("unlimited".equals(normalized)) {
                queryWrapper.isNull("stock");
            }
        }
        queryWrapper.orderByAsc("sort_order").orderByAsc("id");

        Page<MallItem> result = mallItemMapper.selectPage(pageRequest, queryWrapper);
        Map<String, MallItemType> typeMap = buildTypeMap(listAllTypes());
        LocalDateTime now = LocalDateTime.now();

        return Map.of(
                "records", result.getRecords().stream().map(item -> toAdminItemResponse(item, typeMap.get(item.getType()), now)).toList(),
                "total", result.getTotal(),
                "current", result.getCurrent(),
                "size", result.getSize(),
                "pages", result.getPages()
        );
    }

    @Override
    public Map<String, Object> getAdminItemTypes() {
        List<MallItemType> records = listAllTypes();
        Map<String, Long> usageMap = mallItemMapper.selectList(new QueryWrapper<MallItem>().select("type"))
                .stream()
                .collect(Collectors.groupingBy(MallItem::getType, Collectors.counting()));
        return Map.of(
                "records", records.stream().map(item -> {
                    Map<String, Object> response = toItemTypeResponse(item);
                    response.put("usageCount", usageMap.getOrDefault(item.getTypeValue(), 0L));
                    return response;
                }).toList()
        );
    }

    @Override
    @Transactional
    public Map<String, Object> createAdminItem(MallItem item) {
        normalizeMallItem(item, null);
        validateMallItem(item, null);
        item.setRedeemedCount(0);
        mallItemMapper.insert(item);
        return toAdminItemResponse(item, getItemType(item.getType()), LocalDateTime.now());
    }

    @Override
    @Transactional
    public Map<String, Object> updateAdminItem(Long id, MallItem item) {
        MallItem existing = mallItemMapper.selectById(id);
        if (existing == null) {
            throw new IllegalArgumentException("商品不存在");
        }
        normalizeMallItem(item, existing);
        validateMallItem(item, id);
        item.setId(id);
        item.setRedeemedCount(existing.getRedeemedCount());
        mallItemMapper.updateById(item);
        MallItem latest = mallItemMapper.selectById(id);
        return toAdminItemResponse(latest, getItemType(latest.getType()), LocalDateTime.now());
    }

    @Override
    @Transactional
    public Map<String, Object> updateAdminItemEnabled(Long id, Boolean enabled) {
        MallItem existing = mallItemMapper.selectById(id);
        if (existing == null) {
            throw new IllegalArgumentException("商品不存在");
        }
        MallItem update = new MallItem();
        update.setId(id);
        update.setEnabled(enabled == null || enabled);
        mallItemMapper.updateById(update);
        MallItem latest = mallItemMapper.selectById(id);
        return toAdminItemResponse(latest, getItemType(latest.getType()), LocalDateTime.now());
    }

    @Override
    @Transactional
    public void deleteAdminItem(Long id) {
        MallItem existing = mallItemMapper.selectById(id);
        if (existing == null) {
            throw new IllegalArgumentException("商品不存在");
        }
        if (mallRedemptionMapper.selectCount(new QueryWrapper<MallRedemption>().eq("item_id", id)) > 0) {
            throw new IllegalStateException("该商品已有兑换记录，请改为下架而不是删除");
        }
        mallItemMapper.deleteById(id);
    }

    @Override
    @Transactional
    public Map<String, Object> createAdminItemType(MallItemType itemType) {
        normalizeItemType(itemType, null);
        validateItemType(itemType, null);
        mallItemTypeMapper.insert(itemType);
        return toItemTypeResponse(itemType);
    }

    @Override
    @Transactional
    public Map<String, Object> updateAdminItemType(Long id, MallItemType itemType) {
        MallItemType existing = mallItemTypeMapper.selectById(id);
        if (existing == null) {
            throw new IllegalArgumentException("商品类型不存在");
        }
        normalizeItemType(itemType, existing);
        validateItemType(itemType, id);
        itemType.setId(id);
        mallItemTypeMapper.updateById(itemType);
        return toItemTypeResponse(itemType);
    }

    @Override
    @Transactional
    public void deleteAdminItemType(Long id) {
        MallItemType existing = mallItemTypeMapper.selectById(id);
        if (existing == null) {
            throw new IllegalArgumentException("商品类型不存在");
        }
        if (mallItemMapper.selectCount(new QueryWrapper<MallItem>().eq("type", existing.getTypeValue())) > 0) {
            throw new IllegalStateException("该商品类型已被商品使用，无法删除");
        }
        mallItemTypeMapper.deleteById(id);
    }

    @Override
    public Map<String, Object> getAdminRedemptions(Integer page, Integer size, String username, Long itemId, String itemKeyword, String status, String dateFrom, String dateTo) {
        Page<MallRedemption> pageRequest = new Page<>(normalizePage(page), normalizeSize(size));
        QueryWrapper<MallRedemption> queryWrapper = new QueryWrapper<>();
        if (itemId != null) {
            queryWrapper.eq("item_id", itemId);
        }
        if (StringUtils.hasText(itemKeyword)) {
            queryWrapper.like("item_name", itemKeyword.trim());
        }
        if (StringUtils.hasText(status)) {
            queryWrapper.eq("status", status.trim());
        }
        if (StringUtils.hasText(username)) {
            List<Long> userIds = userService.list(new QueryWrapper<User>()
                            .select("id")
                            .like("username", username.trim()))
                    .stream()
                    .map(User::getId)
                    .filter(Objects::nonNull)
                    .toList();
            if (userIds.isEmpty()) {
                queryWrapper.apply("1 = 0");
            } else {
                queryWrapper.in("user_id", userIds);
            }
        }
        if (StringUtils.hasText(dateFrom)) {
            queryWrapper.ge("create_time", LocalDate.parse(dateFrom.trim()).atStartOfDay());
        }
        if (StringUtils.hasText(dateTo)) {
            queryWrapper.le("create_time", LocalDate.parse(dateTo.trim()).plusDays(1).atStartOfDay().minusSeconds(1));
        }
        queryWrapper.orderByDesc("create_time");

        Page<MallRedemption> result = mallRedemptionMapper.selectPage(pageRequest, queryWrapper);
        List<Long> userIds = result.getRecords().stream().map(MallRedemption::getUserId).filter(Objects::nonNull).distinct().toList();
        List<Long> processedUserIds = result.getRecords().stream().map(MallRedemption::getProcessedBy).filter(Objects::nonNull).distinct().toList();
        Map<Long, User> userMap = userIds.isEmpty() ? Map.of() : userService.listByIds(userIds).stream().collect(Collectors.toMap(User::getId, item -> item));
        Map<Long, User> processedMap = processedUserIds.isEmpty() ? Map.of() : userService.listByIds(processedUserIds).stream().collect(Collectors.toMap(User::getId, item -> item));
        Map<String, MallItemType> typeMap = buildTypeMap(listAllTypes());

        Map<Long, UserEntitlement> entitlementMap = userEntitlementService.getByRedemptionIds(
                result.getRecords().stream().map(MallRedemption::getId).filter(Objects::nonNull).toList()
        );
        List<Map<String, Object>> records = result.getRecords().stream().map(item -> {
            Map<String, Object> response = toRedemptionResponse(item, userMap.get(item.getUserId()), typeMap.get(item.getItemType()), entitlementMap.get(item.getId()));
            if (item.getProcessedBy() != null && processedMap.containsKey(item.getProcessedBy())) {
                User processedUser = processedMap.get(item.getProcessedBy());
                response.put("processedByUser", Map.of("id", processedUser.getId(), "username", processedUser.getUsername()));
            }
            return response;
        }).toList();

        return Map.of(
                "records", records,
                "total", result.getTotal(),
                "current", result.getCurrent(),
                "size", result.getSize(),
                "pages", result.getPages()
        );
    }

    @Override
    @Transactional
    public Map<String, Object> updateAdminRedemptionStatus(Long id, String status, String remark, Long processedBy) {
        MallRedemption existing = mallRedemptionMapper.selectById(id);
        if (existing == null) {
            throw new IllegalArgumentException("兑换记录不存在");
        }
        String nextStatus = status == null ? "" : status.trim().toLowerCase();
        if (!VALID_REDEMPTION_STATUSES.contains(nextStatus)) {
            throw new IllegalArgumentException("兑换状态不合法");
        }
        if (REDEMPTION_STATUS_CANCELLED.equals(existing.getStatus())) {
            throw new IllegalStateException("已取消的兑换记录不能再次修改");
        }
        if (REDEMPTION_STATUS_FULFILLED.equals(existing.getStatus()) && REDEMPTION_STATUS_PENDING.equals(nextStatus)) {
            throw new IllegalStateException("已发放记录不能回退为待处理");
        }

        if (REDEMPTION_STATUS_CANCELLED.equals(nextStatus) && !REDEMPTION_STATUS_CANCELLED.equals(existing.getStatus())) {
            userMapper.addPoints(existing.getUserId(), safeInt(existing.getPrice()));
            mallItemMapper.releaseReservation(existing.getItemId());
            userEntitlementService.revokeForRedemption(existing.getId());
            User updatedUser = userService.getById(existing.getUserId());
            PointsRecord refundRecord = new PointsRecord();
            refundRecord.setUserId(existing.getUserId());
            refundRecord.setRuleName("商城兑换撤销");
            refundRecord.setChange(safeInt(existing.getPrice()));
            refundRecord.setBalance(updatedUser == null ? 0 : safeInt(updatedUser.getPoints()));
            refundRecord.setDescription("兑换取消返还：" + existing.getItemName());
            pointsRecordMapper.insert(refundRecord);
        }

        existing.setStatus(nextStatus);
        existing.setRemark(normalizeNullableText(remark));
        existing.setProcessedBy(processedBy);
        existing.setProcessedTime(LocalDateTime.now());
        mallRedemptionMapper.updateById(existing);
        UserEntitlement entitlement = REDEMPTION_STATUS_FULFILLED.equals(nextStatus)
                ? userEntitlementService.activateForRedemption(existing.getId())
                : userEntitlementService.getByRedemptionIds(List.of(existing.getId())).get(existing.getId());
        return toRedemptionResponse(existing, userService.getById(existing.getUserId()), getItemType(existing.getItemType()), entitlement);
    }

    private void validateMallItem(MallItem item, Long currentId) {
        if (!StringUtils.hasText(item.getName())) {
            throw new IllegalArgumentException("商品名称不能为空");
        }
        if (!StringUtils.hasText(item.getType())) {
            throw new IllegalArgumentException("商品类型不能为空");
        }
        if (getItemType(item.getType()) == null) {
            throw new IllegalArgumentException("商品类型不存在");
        }
        if (safeInt(item.getPrice()) < 0) {
            throw new IllegalArgumentException("商品价格不能小于 0");
        }
        if (item.getStock() != null && item.getStock() < 0) {
            throw new IllegalArgumentException("库存不能小于 0");
        }
        if (item.getPerUserLimit() != null && item.getPerUserLimit() < 0) {
            throw new IllegalArgumentException("每人限兑不能小于 0");
        }
        if (item.getTotalLimit() != null && item.getTotalLimit() < 0) {
            throw new IllegalArgumentException("总限兑不能小于 0");
        }
        if (item.getTotalLimit() != null && safeInt(item.getRedeemedCount()) > item.getTotalLimit()) {
            throw new IllegalArgumentException("总限兑不能小于已兑换数量");
        }
        if (item.getAvailableFrom() != null && item.getAvailableUntil() != null && item.getAvailableUntil().isBefore(item.getAvailableFrom())) {
            throw new IllegalArgumentException("结束时间不能早于开始时间");
        }
        if (!VALID_DELIVERY_TYPES.contains(item.getDeliveryType())) {
            throw new IllegalArgumentException("发放方式不合法");
        }

        QueryWrapper<MallItem> duplicateWrapper = new QueryWrapper<>();
        duplicateWrapper.eq("name", item.getName());
        if (currentId != null) {
            duplicateWrapper.ne("id", currentId);
        }
        if (mallItemMapper.selectCount(duplicateWrapper) > 0) {
            throw new IllegalArgumentException("商品名称已存在");
        }
    }

    private void normalizeMallItem(MallItem target, MallItem existing) {
        target.setName(normalizeRequiredText(target.getName(), existing == null ? null : existing.getName()));
        target.setType(normalizeRequiredText(target.getType(), existing == null ? null : existing.getType()));
        target.setDescription(normalizeNullableText(target.getDescription()));
        target.setCoverImage(normalizeNullableText(target.getCoverImage()));
        target.setIconKey(normalizeNullableText(defaultText(target.getIconKey(), existing == null ? null : existing.getIconKey())));
        target.setThemeColor(normalizeNullableText(defaultText(target.getThemeColor(), existing == null ? null : existing.getThemeColor())));
        target.setPrice(target.getPrice() == null ? (existing == null ? 0 : safeInt(existing.getPrice())) : Math.max(target.getPrice(), 0));

        Integer stock = target.getStock();
        if (stock == null) {
            stock = existing == null ? null : existing.getStock();
        } else {
            stock = Math.max(stock, 0);
        }
        target.setStock(stock);

        Integer perUserLimit = target.getPerUserLimit();
        if (perUserLimit == null) {
            perUserLimit = existing == null ? null : existing.getPerUserLimit();
        } else {
            perUserLimit = Math.max(perUserLimit, 0);
        }
        target.setPerUserLimit(perUserLimit);

        Integer totalLimit = target.getTotalLimit();
        if (totalLimit == null) {
            totalLimit = existing == null ? null : existing.getTotalLimit();
        } else {
            totalLimit = Math.max(totalLimit, 0);
        }
        target.setTotalLimit(totalLimit);

        target.setExchangeNotice(normalizeNullableText(target.getExchangeNotice()));
        target.setAvailableFrom(target.getAvailableFrom() == null && existing != null ? existing.getAvailableFrom() : target.getAvailableFrom());
        target.setAvailableUntil(target.getAvailableUntil() == null && existing != null ? existing.getAvailableUntil() : target.getAvailableUntil());
        target.setDeliveryType(defaultText(normalizeNullableText(target.getDeliveryType()), existing == null ? DELIVERY_TYPE_VIRTUAL_AUTO : existing.getDeliveryType()));

        Boolean enabled = target.getEnabled();
        if (enabled == null) {
            enabled = existing == null || existing.getEnabled() == null || existing.getEnabled();
        }
        target.setEnabled(enabled);

        Integer sortOrder = target.getSortOrder();
        if (sortOrder == null) {
            sortOrder = existing == null ? 0 : safeInt(existing.getSortOrder());
        }
        target.setSortOrder(sortOrder);

        Integer redeemedCount = existing == null ? target.getRedeemedCount() : existing.getRedeemedCount();
        target.setRedeemedCount(safeInt(redeemedCount));
    }

    private void validateItemType(MallItemType itemType, Long currentId) {
        if (!StringUtils.hasText(itemType.getTypeValue())) {
            throw new IllegalArgumentException("类型标识不能为空");
        }
        if (!itemType.getTypeValue().matches("^[a-z0-9_]+$")) {
            throw new IllegalArgumentException("类型标识仅支持小写字母、数字和下划线");
        }
        if (!StringUtils.hasText(itemType.getLabel())) {
            throw new IllegalArgumentException("类型名称不能为空");
        }
        QueryWrapper<MallItemType> duplicateWrapper = new QueryWrapper<>();
        duplicateWrapper.eq("type_value", itemType.getTypeValue());
        if (currentId != null) {
            duplicateWrapper.ne("id", currentId);
        }
        if (mallItemTypeMapper.selectCount(duplicateWrapper) > 0) {
            throw new IllegalArgumentException("商品类型标识已存在");
        }
    }

    private void normalizeItemType(MallItemType target, MallItemType existing) {
        target.setTypeValue(normalizeRequiredText(target.getTypeValue(), existing == null ? null : existing.getTypeValue()));
        target.setLabel(normalizeRequiredText(target.getLabel(), existing == null ? null : existing.getLabel()));
        Boolean enabled = target.getEnabled();
        if (enabled == null) {
            enabled = existing == null || existing.getEnabled() == null || existing.getEnabled();
        }
        target.setEnabled(enabled);

        Integer sortOrder = target.getSortOrder();
        if (sortOrder == null) {
            sortOrder = existing == null ? 0 : safeInt(existing.getSortOrder());
        }
        target.setSortOrder(sortOrder);
    }

    private List<MallItemType> listVisibleTypes() {
        return mallItemTypeMapper.selectList(new QueryWrapper<MallItemType>()
                .eq("enabled", true)
                .orderByAsc("sort_order")
                .orderByAsc("id"));
    }

    private List<MallItemType> listAllTypes() {
        return mallItemTypeMapper.selectList(new QueryWrapper<MallItemType>()
                .orderByAsc("sort_order")
                .orderByAsc("id"));
    }

    private MallItemType getItemType(String typeValue) {
        if (!StringUtils.hasText(typeValue)) {
            return null;
        }
        return first(mallItemTypeMapper, new QueryWrapper<MallItemType>()
                .eq("type_value", typeValue.trim())
                .orderByAsc("id"));
    }

    private Map<String, MallItemType> buildTypeMap(Collection<MallItemType> types) {
        return types.stream().collect(Collectors.toMap(MallItemType::getTypeValue, item -> item, (left, right) -> left, LinkedHashMap::new));
    }

    private long countVisibleItems() {
        List<MallItemType> enabledTypes = listVisibleTypes();
        if (enabledTypes.isEmpty()) {
            return 0;
        }
        return mallItemMapper.selectCount(new QueryWrapper<MallItem>()
                .eq("enabled", true)
                .in("type", enabledTypes.stream().map(MallItemType::getTypeValue).toList()));
    }

    private long countUserRedemptionsByStatus(Long userId, String status) {
        return mallRedemptionMapper.selectCount(new QueryWrapper<MallRedemption>()
                .eq("user_id", userId)
                .eq("status", status));
    }

    private long countUserActiveRedemptions(Long userId) {
        return mallRedemptionMapper.selectCount(new QueryWrapper<MallRedemption>()
                .eq("user_id", userId)
                .ne("status", REDEMPTION_STATUS_CANCELLED));
    }

    private long countUserRedemption(Long itemId, Long userId) {
        return mallRedemptionMapper.selectCount(new QueryWrapper<MallRedemption>()
                .eq("item_id", itemId)
                .eq("user_id", userId)
                .ne("status", REDEMPTION_STATUS_CANCELLED));
    }

    private Map<Long, Long> countUserRedemptionsByItem(Long userId) {
        return mallRedemptionMapper.selectList(new QueryWrapper<MallRedemption>()
                        .eq("user_id", userId)
                        .ne("status", REDEMPTION_STATUS_CANCELLED)
                        .select("item_id"))
                .stream()
                .collect(Collectors.groupingBy(MallRedemption::getItemId, Collectors.counting()));
    }

    private Map<String, Object> toItemTypeResponse(MallItemType itemType) {
        Map<String, Object> response = new HashMap<>();
        response.put("id", itemType.getId());
        response.put("value", itemType.getTypeValue());
        response.put("label", itemType.getLabel());
        response.put("enabled", itemType.getEnabled() == null || itemType.getEnabled());
        response.put("sortOrder", safeInt(itemType.getSortOrder()));
        return response;
    }

    private Map<String, Object> toItemResponse(MallItem item, MallItemType itemType, int currentPoints, Map<Long, Long> userRedemptionCountMap, LocalDateTime now) {
        String typeLabel = itemType == null ? item.getType() : itemType.getLabel();
        long userRedemptionCount = userRedemptionCountMap.getOrDefault(item.getId(), 0L);
        String unavailableReason = resolveUnavailableReason(item, currentPoints, userRedemptionCount, now);

        Map<String, Object> response = baseItemResponse(item, typeLabel);
        response.put("canRedeem", unavailableReason == null);
        response.put("exchangeState", unavailableReason == null ? "available" : mapUnavailableCode(item, currentPoints, userRedemptionCount, now));
        response.put("exchangeMessage", unavailableReason == null ? "可立即兑换" : unavailableReason);
        return response;
    }

    private Map<String, Object> toAdminItemResponse(MallItem item, MallItemType itemType, LocalDateTime now) {
        Map<String, Object> response = baseItemResponse(item, itemType == null ? item.getType() : itemType.getLabel());
        response.put("statusText", resolveItemWindowStatus(item, now));
        return response;
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

    private Map<String, Object> toRedemptionResponse(MallRedemption redemption, User user, MallItemType itemType, UserEntitlement entitlement) {
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

    private String resolveUnavailableReason(MallItem item, User user, long userRedemptionCount, LocalDateTime now) {
        return resolveUnavailableReason(item, user == null ? 0 : safeInt(user.getPoints()), userRedemptionCount, now);
    }

    private String resolveUnavailableReason(MallItem item, int currentPoints, long userRedemptionCount, LocalDateTime now) {
        if (!Boolean.TRUE.equals(item.getEnabled())) return "商品已下架";
        if (item.getAvailableFrom() != null && now.isBefore(item.getAvailableFrom())) return "兑换活动尚未开始";
        if (item.getAvailableUntil() != null && now.isAfter(item.getAvailableUntil())) return "兑换活动已结束";
        if (item.getStock() != null && item.getStock() <= 0) return "商品已售罄";
        if (item.getTotalLimit() != null && safeInt(item.getRedeemedCount()) >= item.getTotalLimit()) return "商品已达到总兑换上限";
        if (item.getPerUserLimit() != null && userRedemptionCount >= item.getPerUserLimit()) return "你已达到该商品的个人限兑次数";
        if (currentPoints > 0 && currentPoints < safeInt(item.getPrice())) return "积分不足";
        return null;
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
        if (REDEMPTION_STATUS_PENDING.equals(status)) return "待处理";
        if (REDEMPTION_STATUS_FULFILLED.equals(status)) return "已发放";
        if (REDEMPTION_STATUS_CANCELLED.equals(status)) return "已取消";
        return status;
    }

    private boolean isManualReview(MallItem item) {
        return item != null && DELIVERY_TYPE_MANUAL_REVIEW.equalsIgnoreCase(item.getDeliveryType());
    }

    private int normalizePage(Integer page) {
        return page == null || page < 1 ? 1 : page;
    }

    private int normalizeSize(Integer size) {
        return size == null || size < 1 ? 10 : size;
    }

    private int safeInt(Integer value) {
        return value == null ? 0 : value;
    }

    private String normalizeRequiredText(String value, String fallback) {
        String effective = value == null ? fallback : value;
        return effective == null ? null : effective.trim();
    }

    private String normalizeNullableText(String value) {
        if (value == null) {
            return null;
        }
        String normalized = value.trim();
        return normalized.isEmpty() ? null : normalized;
    }

    private String defaultText(String value, String fallback) {
        return StringUtils.hasText(value) ? value : fallback;
    }
}
