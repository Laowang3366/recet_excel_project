package com.excel.forum.service.impl;

import com.excel.forum.entity.PointsRecord;
import com.excel.forum.entity.User;
import com.excel.forum.mapper.PointsRecordMapper;
import com.excel.forum.mapper.UserMapper;
import com.excel.forum.service.SecurityAbuseMonitor;
import com.excel.forum.service.UserService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PointsRecordServiceImplTest {
    @Mock
    private UserService userService;
    @Mock
    private UserMapper userMapper;
    @Mock
    private PointsRecordMapper pointsRecordMapper;
    @Mock
    private SecurityAbuseMonitor securityAbuseMonitor;

    @Test
    void addTaskPointsRecordUsesIdempotencyKeyAndAtomicPointUpdate() {
        PointsRecordServiceImpl service = new PointsRecordServiceImpl(userService, userMapper, securityAbuseMonitor);
        ReflectionTestUtils.setField(service, "baseMapper", pointsRecordMapper);

        User user = new User();
        user.setId(7L);
        user.setPoints(100);
        when(userService.getById(7L)).thenReturn(user);
        when(pointsRecordMapper.insert(any(PointsRecord.class))).thenReturn(1);
        when(userMapper.addPoints(7L, 15)).thenReturn(1);

        boolean granted = service.addTaskPointsRecord(
                7L,
                null,
                "题目首通奖励",
                "practice_question_pass",
                9L,
                null,
                15,
                "首次完成题目"
        );

        assertThat(granted).isTrue();
        ArgumentCaptor<PointsRecord> recordCaptor = ArgumentCaptor.forClass(PointsRecord.class);
        verify(pointsRecordMapper).insert(recordCaptor.capture());
        assertThat(recordCaptor.getValue().getIdempotencyKey())
                .isEqualTo("points:7:practice_question_pass:9:none");
        assertThat(recordCaptor.getValue().getBalance()).isEqualTo(115);
        verify(userMapper).addPoints(7L, 15);
    }

    @Test
    void addTaskPointsRecordIncludesDateInIdempotencyKey() {
        PointsRecordServiceImpl service = new PointsRecordServiceImpl(userService, userMapper, securityAbuseMonitor);
        ReflectionTestUtils.setField(service, "baseMapper", pointsRecordMapper);

        User user = new User();
        user.setId(7L);
        user.setPoints(100);
        when(userService.getById(7L)).thenReturn(user);
        when(pointsRecordMapper.insert(any(PointsRecord.class))).thenReturn(1);
        when(userMapper.addPoints(7L, 5)).thenReturn(1);

        boolean granted = service.addTaskPointsRecord(
                7L,
                null,
                "限时任务",
                "weekly_campaign",
                3L,
                LocalDate.of(2026, 5, 21),
                5,
                "完成限时任务"
        );

        assertThat(granted).isTrue();
        ArgumentCaptor<PointsRecord> recordCaptor = ArgumentCaptor.forClass(PointsRecord.class);
        verify(pointsRecordMapper).insert(recordCaptor.capture());
        assertThat(recordCaptor.getValue().getIdempotencyKey())
                .isEqualTo("points:7:weekly_campaign:3:20260521");
    }

    @Test
    void addTaskPointsRecordSkipsDuplicateRewardWithoutAddingPoints() {
        PointsRecordServiceImpl service = new PointsRecordServiceImpl(userService, userMapper, securityAbuseMonitor);
        ReflectionTestUtils.setField(service, "baseMapper", pointsRecordMapper);

        User user = new User();
        user.setId(7L);
        user.setPoints(100);
        when(userService.getById(7L)).thenReturn(user);
        when(pointsRecordMapper.insert(any(PointsRecord.class))).thenThrow(new DuplicateKeyException("duplicate"));

        boolean granted = service.addTaskPointsRecord(
                7L,
                null,
                "题目首通奖励",
                "practice_question_pass",
                9L,
                null,
                15,
                "首次完成题目"
        );

        assertThat(granted).isFalse();
        verify(userMapper, never()).addPoints(any(), anyInt());
        verify(securityAbuseMonitor).recordRewardIdempotencyCollision("points:7:practice_question_pass:9:none");
    }
}
