package com.excel.forum.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.UpdateWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.excel.forum.entity.User;
import com.excel.forum.mapper.UserMapper;
import com.excel.forum.service.UserService;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class UserServiceImpl extends ServiceImpl<UserMapper, User> implements UserService {
    @Override
    public User findByUsername(String username) {
        return getOne(new QueryWrapper<User>().eq("username", username));
    }

    @Override
    public User findByEmail(String email) {
        return getOne(new QueryWrapper<User>().eq("email", email));
    }

    @Override
    public void setOnline(Long userId) {
        User user = new User();
        user.setId(userId);
        user.setIsOnline(true);
        LocalDateTime now = LocalDateTime.now();
        user.setLastActiveTime(now);
        user.setLastLoginTime(now);
        updateById(user);
    }

    @Override
    public void setOffline(Long userId) {
        User user = new User();
        user.setId(userId);
        user.setIsOnline(false);
        updateById(user);
    }

    @Override
    public void updateActiveTime(Long userId) {
        User user = new User();
        user.setId(userId);
        user.setIsOnline(true);
        user.setLastActiveTime(LocalDateTime.now());
        updateById(user);
    }

    @Override
    public List<User> getOnlineUsers(int limit) {
        QueryWrapper<User> queryWrapper = new QueryWrapper<>();
        queryWrapper.eq("is_online", true)
                   .orderByDesc("last_active_time");
        Page<User> page = new Page<>(1, limit);
        List<User> users = page(page, queryWrapper).getRecords();
        users.forEach(user -> user.setPassword(null));
        return users;
    }

    @Override
    public int getOnlineUserCount() {
        QueryWrapper<User> queryWrapper = new QueryWrapper<>();
        queryWrapper.eq("is_online", true);
        return (int) count(queryWrapper);
    }

    @Override
    public void cleanInactiveUsers() {
        LocalDateTime threshold = LocalDateTime.now().minusMinutes(15);
        UpdateWrapper<User> updateWrapper = new UpdateWrapper<>();
        updateWrapper.set("is_online", false)
                    .eq("is_online", true)
                    .lt("last_active_time", threshold);
        update(updateWrapper);
    }
}
