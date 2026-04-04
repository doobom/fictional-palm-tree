// src/routes/children.js
import { Hono } from 'hono';
import { nanoid, customAlphabet } from 'nanoid';

// 生成孩子专用的短绑定码 (例如 C-123456)
const generateChildCode = customAlphabet('1234567890', 6);

const children = new Hono();

/**
 * 1. 添加孩子 (仅限家长管理员)
 */
children.post('/add', async (c) => {
  const user = c.get('user');
  const { name, avatar, birthday } = await c.req.json();
  if (user.userType !== 'parent' || user.role === 'viewer') return c.json({ success: false, errorCode: 'ERR_FORBIDDEN' }, 403);
  if (!name) return c.json({ success: false, errorCode: 'ERR_MISSING_PARAMS' }, 400);

  const childId = nanoid(12);
  try {
    await c.env.DB.prepare(`INSERT INTO children (id, family_id, name, avatar, birthday) VALUES (?, ?, ?, ?, ?)`)
      .bind(childId, user.familyId, name.trim(), avatar || '👦', birthday || null).run();
    return c.json({ success: true, childId });
  } catch (e) { return c.json({ success: false, errorCode: 'ERR_SYSTEM_ERROR' }, 500); }
});

/**
 * 2. 获取家庭孩子列表
 */
children.get('/list', async (c) => {
  const user = c.get('user');
  
  try {
    const { results } = await c.env.DB.prepare(`
      SELECT 
        c.*,
        (SELECT COUNT(*) FROM auth_bindings b WHERE b.internal_id = c.id AND b.user_type = 'child') as is_bound
      FROM children c
      WHERE c.family_id = ?
    `).bind(user.familyId).all();

    return c.json({ success: true, data: results });
  } catch (e) {
    console.error(`[System Error] 获取孩子列表失败. Error:`, e);
    return c.json({ success: false, errorCode: 'ERR_SYSTEM_ERROR', errorMessage: 'Failed to fetch children' }, 500);
  }
});

/**
 * 3. 修改孩子信息 (前端调用 PUT /children/:id)
 */
children.put('/:id', async (c) => {
  const user = c.get('user');
  const childId = c.req.param('id');
  const { name, avatar, birthday } = await c.req.json();
  if (user.userType !== 'parent' || user.role === 'viewer') return c.json({ success: false, errorCode: 'ERR_FORBIDDEN' }, 403);

  if (!name) return c.json({ success: false, errorCode: 'ERR_MISSING_PARAMS' }, 400); // 🌟 新增拦截

  try {
    const result = await c.env.DB.prepare(`UPDATE children SET name = ?, avatar = ?, birthday = ? WHERE id = ? AND family_id = ?`)
      .bind(name.trim(), avatar || '👦', birthday || null, childId, user.familyId).run();
    if (result.meta.changes === 0) return c.json({ success: false, errorCode: 'ERR_NOT_FOUND' }, 404);
    return c.json({ success: true });
  } catch (e) { return c.json({ success: false, errorCode: 'ERR_SYSTEM_ERROR' }, 500); }
});

/**
 * 4. 生成孩子设备绑定码 (前端调用 POST /children/invite)
 */
children.post('/invite', async (c) => {
  const user = c.get('user');
  const { childId } = await c.req.json();

  if (user.userType !== 'parent' || user.role === 'viewer') {
    return c.json({ success: false, errorCode: 'ERR_FORBIDDEN', errorMessage: 'Insufficient permissions' }, 403);
  }

  if (!childId) {
    return c.json({ success: false, errorCode: 'ERR_MISSING_PARAMS', errorMessage: 'Missing childId' }, 400);
  }

  // 确认该孩子确实属于当前家庭
  const child = await c.env.DB.prepare(
    `SELECT id FROM children WHERE id = ? AND family_id = ?`
  ).bind(childId, user.familyId).first();

  if (!child) {
    return c.json({ success: false, errorCode: 'ERR_NOT_FOUND', errorMessage: 'Child not found' }, 404);
  }

  const code = `C-${generateChildCode()}`;
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15分钟有效期

  try {
    await c.env.DB.batch([
      // 删除旧码，保证唯一性
      c.env.DB.prepare(`DELETE FROM invitation_codes WHERE target_child_id = ?`).bind(childId),
      // 插入新码
      c.env.DB.prepare(`
        INSERT INTO invitation_codes (code, family_id, type, target_child_id, created_by, expires_at)
        VALUES (?, ?, 'child', ?, ?, ?)
      `).bind(code, user.familyId, childId, user.internalId, expiresAt)
    ]);

    // 返回 code 给前端
    return c.json({ success: true, code, expiresIn: '15 minutes' });
  } catch (e) {
    console.error(`[System Error] 生成绑定码写入失败. Error:`, e);
    return c.json({ success: false, errorCode: 'ERR_SYSTEM_ERROR', errorMessage: 'Failed to generate code' }, 500);
  }
});

/**
 * 5. 删除孩子及关联数据 (仅限家长管理员)
 */
children.delete('/:id', async (c) => {
  const user = c.get('user');
  const childId = c.req.param('id');

  // 权限拦截：必须是家长，且不能是观察者
  if (user.userType !== 'parent' || user.role === 'viewer') {
    return c.json({ success: false, errorCode: 'ERR_FORBIDDEN' }, 403);
  }

  try {
    // 🌟 核心安全逻辑：必须将相关的历史记录、兑换记录、账号绑定一并删除，保持数据库纯洁
    const stmts = [
      c.env.DB.prepare(`DELETE FROM history WHERE child_id = ?`).bind(childId),
      c.env.DB.prepare(`DELETE FROM redemptions WHERE child_id = ?`).bind(childId),
      c.env.DB.prepare(`DELETE FROM auth_bindings WHERE internal_id = ? AND user_type = 'child'`).bind(childId),
      // 最后删除孩子本身
      c.env.DB.prepare(`DELETE FROM children WHERE id = ? AND family_id = ?`).bind(childId, user.familyId)
    ];
    
    await c.env.DB.batch(stmts);

    return c.json({ success: true });
  } catch (e) {
    console.error(`[System Error] 删除孩子失败. Error:`, e);
    return c.json({ success: false, errorCode: 'ERR_SYSTEM_ERROR' }, 500);
  }
});

export default children;