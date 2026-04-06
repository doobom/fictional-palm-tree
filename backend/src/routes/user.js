// src/routes/user.js
import { Hono } from 'hono';

const user = new Hono();

/**
 * 1. 获取当前用户详尽资料 (核心接口)
 * 职责：返回用户信息、所属家庭列表、以及各家庭中的角色
 */
user.get('/me', async (c) => {
  const auth = c.get('auth'); // 来自 platformAuth 中间件的 internalId

  try {
    // A. 查询基础用户信息
    const dbUser = await c.env.DB.prepare(`
      SELECT id, nick_name, avatar, locale FROM users WHERE id = ?
    `).bind(auth.internalId).first();

    if (!dbUser) {
      return c.json({ success: false, errorCode: 'ERR_USER_NOT_FOUND' }, 404);
    }

    // B. 查询该用户所属的所有家庭及其角色 (M:N 关系)
    const { results: families } = await c.env.DB.prepare(`
      SELECT f.id, f.name, f.avatar, f.timezone, m.role,
             f.point_name, f.point_emoji
      FROM memberships m
      JOIN families f ON m.family_id = f.id
      WHERE m.user_id = ?
    `).bind(auth.internalId).all();

    // C. 查询当前账户绑定的所有平台 (用于多平台同步展示)
    const { results: bindings } = await c.env.DB.prepare(`
      SELECT provider, created_at FROM auth_bindings WHERE internal_id = ?
    `).bind(auth.internalId).all();

    return c.json({
      success: true,
      data: {
        user: dbUser,
        families: families || [],
        bindings: bindings || [],
        userType: auth.userType
      }
    });
  } catch (error) {
    console.error(`[DB Error] /me failed:`, error);
    return c.json({ success: false, errorCode: 'ERR_SYSTEM_ERROR' }, 500);
  }
});

/**
 * 2. 更新个人全局资料
 */
user.put('/profile', async (c) => {
  const auth = c.get('auth');
  const { nickName, avatar, locale } = await c.req.json();

  try {
    await c.env.DB.prepare(`
      UPDATE users 
      SET nick_name = COALESCE(?, nick_name), 
          avatar = COALESCE(?, avatar),
          locale = COALESCE(?, locale)
      WHERE id = ?
    `).bind(nickName, avatar, locale, auth.internalId).run();

    return c.json({ success: true });
  } catch (error) {
    return c.json({ success: false, errorCode: 'ERR_SYSTEM_ERROR' }, 500);
  }
});

/**
 * 3. 解绑特定平台
 * 注意：必须保留至少一个绑定方式，否则账户将无法登录
 */
user.delete('/bindings/:provider', async (c) => {
  const auth = c.get('auth');
  const providerToRemove = c.req.param('provider');

  try {
    // 检查剩余绑定数量
    const { count } = await c.env.DB.prepare(`
      SELECT COUNT(*) as count FROM auth_bindings WHERE internal_id = ?
    `).bind(auth.internalId).first();

    if (count <= 1) {
      return c.json({ 
        success: false, 
        errorCode: 'ERR_LAST_BINDING', 
        errorMessage: 'Cannot remove the last login method' 
      }, 400);
    }

    await c.env.DB.prepare(`
      DELETE FROM auth_bindings WHERE internal_id = ? AND provider = ?
    `).bind(auth.internalId, providerToRemove).run();

    return c.json({ success: true });
  } catch (error) {
    return c.json({ success: false, errorCode: 'ERR_SYSTEM_ERROR' }, 500);
  }
});

/**
 * 4. 退出特定家庭
 * 逻辑：删除 memberships 中的记录。如果是最后的超级管理员，需提示无法退出。
 */
user.post('/leave-family', async (c) => {
  const auth = c.get('auth');
  const { familyId } = await c.req.json();

  if (!familyId) return c.json({ success: false, errorCode: 'ERR_MISSING_PARAMS' }, 400);

  try {
    // 检查是否是该家庭唯一的超级管理员
    const { role } = await c.env.DB.prepare(`
      SELECT role FROM memberships WHERE user_id = ? AND family_id = ?
    `).bind(auth.internalId, familyId).first() || {};

    if (role === 'superadmin') {
      const { adminCount } = await c.env.DB.prepare(`
        SELECT COUNT(*) as adminCount FROM memberships WHERE family_id = ? AND role = 'superadmin'
      `).bind(familyId).first();
      
      if (adminCount <= 1) {
        return c.json({ 
          success: false, 
          errorCode: 'ERR_SOLE_SUPERADMIN', 
          errorMessage: 'As the sole superadmin, you must disband the family or transfer ownership first' 
        }, 400);
      }
    }

    await c.env.DB.prepare(`
      DELETE FROM memberships WHERE user_id = ? AND family_id = ?
    `).bind(auth.internalId, familyId).run();

    return c.json({ success: true });
  } catch (error) {
    return c.json({ success: false, errorCode: 'ERR_SYSTEM_ERROR' }, 500);
  }
});

export default user;