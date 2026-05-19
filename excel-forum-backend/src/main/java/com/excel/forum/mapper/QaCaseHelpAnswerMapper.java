package com.excel.forum.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.excel.forum.entity.QaCaseHelpAnswer;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;
import java.util.Map;

@Mapper
public interface QaCaseHelpAnswerMapper extends BaseMapper<QaCaseHelpAnswer> {
    @Select("""
            <script>
            SELECT case_id AS caseId, COUNT(*) AS answerCount
            FROM qa_case_help_answer
            WHERE case_id IN
            <foreach collection="caseIds" item="caseId" open="(" separator="," close=")">
                #{caseId}
            </foreach>
            GROUP BY case_id
            </script>
            """)
    List<Map<String, Object>> countByCaseIds(@Param("caseIds") List<Long> caseIds);
}
