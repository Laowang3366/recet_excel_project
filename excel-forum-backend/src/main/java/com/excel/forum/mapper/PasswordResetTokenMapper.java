package com.excel.forum.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.excel.forum.entity.PasswordResetToken;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface PasswordResetTokenMapper extends BaseMapper<PasswordResetToken> {
}
