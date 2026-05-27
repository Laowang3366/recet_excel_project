package com.excel.forum.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.excel.forum.entity.AiAssistantCallLog;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Mapper
public interface AiAssistantCallLogMapper extends BaseMapper<AiAssistantCallLog> {
    @Select("""
            <script>
            SELECT
                COUNT(*) AS totalCalls,
                COALESCE(SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END), 0) AS successCalls,
                COALESCE(SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END), 0) AS failedCalls,
                COALESCE(SUM(CASE WHEN fallback_used = 1 THEN 1 ELSE 0 END), 0) AS fallbackCalls,
                COUNT(DISTINCT user_id) AS activeUsers,
                COALESCE(ROUND(AVG(latency_ms)), 0) AS avgLatencyMs,
                MAX(create_time) AS lastCallTime
            FROM ai_assistant_call_log
            <where>
                <if test="startTime != null">create_time &gt;= #{startTime}</if>
                <if test="endTime != null">AND create_time &lt; #{endTime}</if>
            </where>
            </script>
            """)
    Map<String, Object> selectOverview(@Param("startTime") LocalDateTime startTime,
                                       @Param("endTime") LocalDateTime endTime);

    @Select("""
            <script>
            SELECT COUNT(*) FROM (
                SELECT l.user_id
                FROM ai_assistant_call_log l
                LEFT JOIN `user` u ON u.id = l.user_id
                <where>
                <if test="startTime != null">l.create_time &gt;= #{startTime}</if>
                <if test="endTime != null">AND l.create_time &lt; #{endTime}</if>
                <if test="keyword != null and keyword != ''">
                    AND (
                        u.username LIKE CONCAT('%', #{keyword}, '%')
                        OR u.email LIKE CONCAT('%', #{keyword}, '%')
                        OR l.question_summary LIKE CONCAT('%', #{keyword}, '%')
                    )
                </if>
                </where>
                GROUP BY l.user_id
            ) t
            </script>
            """)
    Long countUserStats(@Param("startTime") LocalDateTime startTime,
                        @Param("endTime") LocalDateTime endTime,
                        @Param("keyword") String keyword);

    @Select("""
            <script>
            SELECT
                l.user_id AS userId,
                COALESCE(u.username, CONCAT('用户#', l.user_id)) AS username,
                COALESCE(u.email, '') AS email,
                COUNT(*) AS totalCalls,
                COALESCE(SUM(CASE WHEN l.success = 1 THEN 1 ELSE 0 END), 0) AS successCalls,
                COALESCE(SUM(CASE WHEN l.success = 0 THEN 1 ELSE 0 END), 0) AS failedCalls,
                COALESCE(SUM(CASE WHEN l.fallback_used = 1 THEN 1 ELSE 0 END), 0) AS fallbackCalls,
                COALESCE(ROUND(AVG(l.latency_ms)), 0) AS avgLatencyMs,
                MAX(l.create_time) AS lastCallTime
            FROM ai_assistant_call_log l
            LEFT JOIN `user` u ON u.id = l.user_id
            <where>
                <if test="startTime != null">l.create_time &gt;= #{startTime}</if>
                <if test="endTime != null">AND l.create_time &lt; #{endTime}</if>
                <if test="keyword != null and keyword != ''">
                    AND (
                        u.username LIKE CONCAT('%', #{keyword}, '%')
                        OR u.email LIKE CONCAT('%', #{keyword}, '%')
                        OR l.question_summary LIKE CONCAT('%', #{keyword}, '%')
                    )
                </if>
            </where>
            GROUP BY l.user_id, u.username, u.email
            ORDER BY totalCalls DESC, lastCallTime DESC
            LIMIT #{offset}, #{size}
            </script>
            """)
    List<Map<String, Object>> selectUserStats(@Param("startTime") LocalDateTime startTime,
                                              @Param("endTime") LocalDateTime endTime,
                                              @Param("keyword") String keyword,
                                              @Param("offset") long offset,
                                              @Param("size") long size);

    @Select("""
            SELECT
                u.id AS userId,
                COALESCE(u.username, CONCAT('用户#', u.id)) AS username,
                COALESCE(u.email, '') AS email,
                COALESCE(u.avatar, '') AS avatar,
                COALESCE(u.level, 1) AS level,
                COALESCE(u.points, 0) AS points
            FROM `user` u
            WHERE u.id = #{userId}
            """)
    Map<String, Object> selectUserProfile(@Param("userId") Long userId);

    @Select("""
            <script>
            SELECT
                COUNT(*) AS totalCalls,
                COALESCE(SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END), 0) AS successCalls,
                COALESCE(SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END), 0) AS failedCalls,
                COALESCE(SUM(CASE WHEN fallback_used = 1 THEN 1 ELSE 0 END), 0) AS fallbackCalls,
                COALESCE(ROUND(AVG(latency_ms)), 0) AS avgLatencyMs,
                MAX(create_time) AS lastCallTime
            FROM ai_assistant_call_log
            <where>
                user_id = #{userId}
                <if test="startTime != null">AND create_time &gt;= #{startTime}</if>
                <if test="endTime != null">AND create_time &lt; #{endTime}</if>
            </where>
            </script>
            """)
    Map<String, Object> selectUserSummary(@Param("startTime") LocalDateTime startTime,
                                          @Param("endTime") LocalDateTime endTime,
                                          @Param("userId") Long userId);

    @Select("""
            <script>
            SELECT COUNT(*)
            FROM ai_assistant_call_log
            <where>
                user_id = #{userId}
                <if test="startTime != null">AND create_time &gt;= #{startTime}</if>
                <if test="endTime != null">AND create_time &lt; #{endTime}</if>
            </where>
            </script>
            """)
    Long countUserCallRecords(@Param("startTime") LocalDateTime startTime,
                              @Param("endTime") LocalDateTime endTime,
                              @Param("userId") Long userId);

    @Select("""
            <script>
            SELECT
                id,
                create_time AS time,
                COALESCE(NULLIF(question_summary, ''), CASE
                    WHEN tool_type = 'formula_explain' THEN '公式解释'
                    ELSE 'AI 助手对话'
                END) AS questionSummary,
                model,
                latency_ms AS latencyMs,
                success,
                fallback_used AS fallbackUsed,
                error_message AS errorMessage,
                CASE
                    WHEN LOWER(COALESCE(error_message, '')) LIKE '%timeout%' OR COALESCE(error_message, '') LIKE '%超时%' THEN 'timeout'
                    WHEN LOWER(COALESCE(error_message, '')) LIKE '%rate%' OR LOWER(COALESCE(error_message, '')) LIKE '%429%' OR COALESCE(error_message, '') LIKE '%限流%' THEN 'rate_limit'
                    WHEN LOWER(COALESCE(error_message, '')) LIKE '%auth%' OR LOWER(COALESCE(error_message, '')) LIKE '%401%' OR LOWER(COALESCE(error_message, '')) LIKE '%403%' OR LOWER(COALESCE(error_message, '')) LIKE '%key%' OR COALESCE(error_message, '') LIKE '%认证%' THEN 'auth'
                    WHEN LOWER(COALESCE(error_message, '')) LIKE '%model%' OR COALESCE(error_message, '') LIKE '%模型%' THEN 'model'
                    ELSE 'other'
                END AS errorReason
            FROM ai_assistant_call_log
            <where>
                user_id = #{userId}
                <if test="startTime != null">AND create_time &gt;= #{startTime}</if>
                <if test="endTime != null">AND create_time &lt; #{endTime}</if>
            </where>
            ORDER BY create_time DESC, id DESC
            LIMIT #{offset}, #{size}
            </script>
            """)
    List<Map<String, Object>> selectUserCallRecords(@Param("startTime") LocalDateTime startTime,
                                                    @Param("endTime") LocalDateTime endTime,
                                                    @Param("userId") Long userId,
                                                    @Param("offset") long offset,
                                                    @Param("size") long size);

    @Select("""
            <script>
            SELECT
                id,
                create_time AS time,
                tool_type AS toolType,
                COALESCE(NULLIF(question_summary, ''), CASE
                    WHEN tool_type = 'formula_explain' THEN '公式解释'
                    ELSE 'AI 助手对话'
                END) AS questionSummary,
                model,
                latency_ms AS latencyMs,
                success,
                fallback_used AS fallbackUsed,
                error_message AS errorMessage,
                request_preview AS requestPreview,
                response_preview AS responsePreview
            FROM ai_assistant_call_log
            <where>
                user_id = #{userId}
                <if test="startTime != null">AND create_time &gt;= #{startTime}</if>
                <if test="endTime != null">AND create_time &lt; #{endTime}</if>
            </where>
            ORDER BY create_time DESC, id DESC
            LIMIT #{offset}, #{size}
            </script>
            """)
    List<Map<String, Object>> selectUserRawLogs(@Param("startTime") LocalDateTime startTime,
                                                @Param("endTime") LocalDateTime endTime,
                                                @Param("userId") Long userId,
                                                @Param("offset") long offset,
                                                @Param("size") long size);

    @Select("""
            <script>
            SELECT reason, COUNT(*) AS count
            FROM (
                SELECT
                    CASE
                        WHEN LOWER(COALESCE(error_message, '')) LIKE '%timeout%' OR COALESCE(error_message, '') LIKE '%超时%' THEN 'timeout'
                        WHEN LOWER(COALESCE(error_message, '')) LIKE '%rate%' OR LOWER(COALESCE(error_message, '')) LIKE '%429%' OR COALESCE(error_message, '') LIKE '%限流%' THEN 'rate_limit'
                        WHEN LOWER(COALESCE(error_message, '')) LIKE '%auth%' OR LOWER(COALESCE(error_message, '')) LIKE '%401%' OR LOWER(COALESCE(error_message, '')) LIKE '%403%' OR LOWER(COALESCE(error_message, '')) LIKE '%key%' OR COALESCE(error_message, '') LIKE '%认证%' THEN 'auth'
                        WHEN LOWER(COALESCE(error_message, '')) LIKE '%model%' OR COALESCE(error_message, '') LIKE '%模型%' THEN 'model'
                        ELSE 'other'
                    END AS reason
                FROM ai_assistant_call_log
                <where>
                    success = 0
                    <if test="userId != null">AND user_id = #{userId}</if>
                    <if test="startTime != null">AND create_time &gt;= #{startTime}</if>
                    <if test="endTime != null">AND create_time &lt; #{endTime}</if>
                </where>
            ) t
            GROUP BY reason
            ORDER BY count DESC
            </script>
            """)
    List<Map<String, Object>> selectFailureReasons(@Param("startTime") LocalDateTime startTime,
                                                   @Param("endTime") LocalDateTime endTime,
                                                   @Param("userId") Long userId);
}
