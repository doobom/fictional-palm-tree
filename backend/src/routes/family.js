// src/routes/family.js
import { Hono } from 'hono';
import { nanoid } from 'nanoid';

const family = new Hono();

/**
 * 1. 获取当前家庭的详细配置与成员列表
 * 逻辑：基于 Header 中的 x-family-id
 */
family.get('/config', async (c) => {
  const user = c.get('user');

  try {
    // A. 获取家庭基础配置
    const config = await c.env.DB.prepare(`
      SELECT * FROM families WHERE id = ?
    `).bind(user.familyId).first();

    // B. 获取家庭所有成员及其角色 (关联 users 表获取头像昵称)
    const { results: members } = await c.env.DB.prepare(`
      SELECT u.id, u.nick_name, u.avatar, m.role, m.joined_at
      FROM memberships m
      JOIN users u ON m.user_id = u.id
      WHERE m.family_id = ?
      ORDER BY m.joined_at ASC
    `).bind(user.familyId).all();

    return c.json({
      success: true,
      data: { config, members }
    });
  } catch (error) {
    console.error(`[DB Error] Fetch family config failed:`, error);
    return c.json({ success: false, errorCode: 'ERR_SYSTEM_ERROR' }, 500);
  }
});

/**
 * 2. 更新家庭配置 (仅限管理员)
 */
family.put('/config', async (c) => {
  const user = c.get('user');
  const body = await c.req.json();

  if (user.role !== 'admin' && user.role !== 'superadmin') {
    return c.json({ success: false, errorCode: 'ERR_FORBIDDEN' }, 403);
  }

  const { 
    name, avatar, timezone, 
    point_name, point_emoji, 
    push_enabled, push_time, push_options,
    instant_alert_enabled 
  } = body;

  try {
    await c.env.DB.prepare(`
      UPDATE families SET 
        name = COALESCE(?, name),
        avatar = COALESCE(?, avatar),
        timezone = COALESCE(?, timezone),
        point_name = COALESCE(?, point_name),
        point_emoji = COALESCE(?, point_emoji),
        push_enabled = COALESCE(?, push_enabled),
        push_time = COALESCE(?, push_time),
        push_options = COALESCE(?, push_options),
        instant_alert_enabled = COALESCE(?, instant_alert_enabled)
      WHERE id = ?
    `).bind(
      name, avatar, timezone, 
      point_name, point_emoji, 
      push_enabled, push_time, push_options,
      instant_alert_enabled, 
      user.familyId
    ).run();

    return c.json({ success: true });
  } catch (error) {
    return c.json({ success: false, errorCode: 'ERR_SYSTEM_ERROR' }, 500);
  }
});

/**
 * 3. 修改成员角色 (仅限超级管理员)
 * 逻辑：操作 memberships 表
 */
family.post('/members/role', async (c) => {
  const user = c.get('user');
  const { targetUserId, newRole } = await c.req.json();

  if (user.role !== 'superadmin') {
    return c.json({ success: false, errorCode: 'ERR_FORBIDDEN' }, 403);
  }

  // 防止修改自己的角色（避免把自己降权导致无人管理）
  if (targetUserId === user.id) {
    return c.json({ success: false, errorCode: 'ERR_CANNOT_SELF_MODIFY' }, 400);
  }

  try {
    await c.env.DB.prepare(`
      UPDATE memberships SET role = ? WHERE user_id = ? AND family_id = ?
    `).bind(newRole, targetUserId, user.familyId).run();

    return c.json({ success: true });
  } catch (error) {
    return c.json({ success: false, errorCode: 'ERR_SYSTEM_ERROR' }, 500);
  }
});

/**
 * 4. 移除家庭成员
 * 逻辑：删除 memberships 关联记录
 */
family.delete('/members/:userId', async (c) => {
  const user = c.get('user');
  const targetUserId = c.req.param('userId');

  if (user.role !== 'superadmin' && user.role !== 'admin') {
    return c.json({ success: false, errorCode: 'ERR_FORBIDDEN' }, 403);
  }

  try {
    // 检查目标角色，普通管理员不能移除超级管理员
    const target = await c.env.DB.prepare(`
      SELECT role FROM memberships WHERE user_id = ? AND family_id = ?
    `).bind(targetUserId, user.familyId).first();

    if (target?.role === 'superadmin' && user.role !== 'superadmin') {
      return c.json({ success: false, errorCode: 'ERR_FORBIDDEN' }, 403);
    }

    await c.env.DB.prepare(`
      DELETE FROM memberships WHERE user_id = ? AND family_id = ?
    `).bind(targetUserId, user.familyId).run();

    return c.json({ success: true });
  } catch (error) {
    return c.json({ success: false, errorCode: 'ERR_SYSTEM_ERROR' }, 500);
  }
});

/**
 * 5. 解散家庭 (仅限超级管理员)
 * 逻辑：级联删除会清理所有关联数据
 */
family.delete('/disband', async (c) => {
  const user = c.get('user');

  if (user.role !== 'superadmin') {
    return c.json({ success: false, errorCode: 'ERR_FORBIDDEN' }, 403);
  }

  try {
    await c.env.DB.prepare(`DELETE FROM families WHERE id = ?`).bind(user.familyId).run();
    return c.json({ success: true });
  } catch (error) {
    return c.json({ success: false, errorCode: 'ERR_SYSTEM_ERROR' }, 500);
  }
});

export default family;