package com.excel.forum.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.excel.forum.entity.FormulaExplainRecord;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface FormulaExplainRecordMapper extends BaseMapper<FormulaExplainRecord> {
    @Select("""
            SELECT *
            FROM formula_explain_record
            WHERE formula_hash = #{formulaHash}
              AND locale = #{locale}
              AND detail_level = #{detailLevel}
              AND status = 'success'
              AND COALESCE(workbook_context, '') = COALESCE(#{workbookContext}, '')
              AND COALESCE(expected_result, '') = COALESCE(#{expectedResult}, '')
              AND COALESCE(error_message_input, '') = COALESCE(#{errorMessageInput}, '')
            ORDER BY create_time DESC, id DESC
            LIMIT 1
            """)
    FormulaExplainRecord selectSuccessfulCache(@Param("formulaHash") String formulaHash,
                                               @Param("locale") String locale,
                                               @Param("detailLevel") String detailLevel,
                                               @Param("workbookContext") String workbookContext,
                                               @Param("expectedResult") String expectedResult,
                                               @Param("errorMessageInput") String errorMessageInput,
                                               @Param("normalizedFormula") String normalizedFormula);
}
