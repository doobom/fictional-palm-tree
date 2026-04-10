// backend/src/routes/children.js
import { Hono } from 'hono';
import { nanoid } from 'nanoid';

const children = new Hono();

/**
 * 1. 获取当前家庭的所有孩子列表
 */
children.get('/', async (c) => {
  const user = c.get('user'); 
  
  try {
    // 🌟 核心修复：加入 birthday 字段，并使用 COALESCE 防止 NULL 值计算报错
    const { results } = await c.env.DB.prepare(`
      SELECT id, name, avatar, birthday, score_gained, score_spent, 
             (COALESCE(score_gained, 0) - COALESCE(score_spent, 0)) as balance, 
             created_at
      FROM children 
      WHERE family_id = ?
      ORDER BY created_at ASC
    `).bind(user.familyId).all();

    return c.json({ success: true, data: results });
  } catch (error) {
    console.error(`[DB Error] Fetch children failed:`, error.message);
    return c.json({ success: false, errorCode: 'ERR_SYSTEM_ERROR', errorMessage: error.message }, 500);
  }
});

/**
 * 2. 添加新孩子
 */
children.post('/', async (c) => {
  const user = c.get('user');
  const { name, avatar, birthday } = await c.req.json();

  if (user.role !== 'admin' && user.role !== 'superadmin') {
    return c.json({ success: false, errorCode: 'ERR_FORBIDDEN' }, 403);
  }

  if (!name) {
    return c.json({ success: false, errorCode: 'ERR_MISSING_PARAMS' }, 400);
  }

  const childId = nanoid(10);

  try {
    // 🌟 确保插入时包含 birthday
    await c.env.DB.prepare(`
      INSERT INTO children (id, family_id, name, avatar, birthday, score_gained, score_spent)
      VALUES (?, ?, ?, ?, ?, 0, 0)
    `).bind(childId, user.familyId, name, avatar || '👦', birthday || null).run();

    return c.json({ success: true, data: { id: childId, name, avatar, birthday, balance: 0 } });
  } catch (error) {
    console.error(`[DB Error] Add child failed:`, error.message);
    return c.json({ success: false, errorCode: 'ERR_SYSTEM_ERROR', errorMessage: error.message }, 500);
  }
});

/**
 * 3. 获取特定孩子详情 (含成就统计等)
 */
children.get('/:id', async (c) => {
  const user = c.get('user');
  const childId = c.req.param('id');

  try {
    const child = await c.env.DB.prepare(`
      SELECT id, name, avatar, birthday, score_gained, score_spent, 
             (COALESCE(score_gained, 0) - COALESCE(score_spent, 0)) as balance, 
             created_at
      FROM children 
      WHERE id = ? AND family_id = ?
    `).bind(childId, user.familyId).first();

    if (!child) {
      return c.json({ success: false, errorCode: 'ERR_NOT_FOUND' }, 404);
    }

    // 同时获取该孩子的成就统计
    const { achCount } = await c.env.DB.prepare(`
      SELECT COUNT(*) as achCount FROM achievements WHERE child_id = ? AND unlocked = 1
    `).bind(childId).first();

    return c.json({ 
      success: true, 
      data: { ...child, achievementCount: achCount || 0 } 
    });
  } catch (error) {
    console.error(`[DB Error] Fetch child detail failed:`, error.message);
    return c.json({ success: false, errorCode: 'ERR_SYSTEM_ERROR', errorMessage: error.message }, 500);
  }
});

/**
 * 4. 修改孩子信息
 */
children.put('/:id', async (c) => {
  const user = c.get('user');
  const childId = c.req.param('id');
  const { name, avatar, birthday } = await c.req.json();

  if (user.role !== 'admin' && user.role !== 'superadmin') {
    return c.json({ success: false, errorCode: 'ERR_FORBIDDEN' }, 403);
  }

  try {
    // 🌟 更新时加入 birthday 字段
    const result = await c.env.DB.prepare(`
      UPDATE children 
      SET name = COALESCE(?, name), 
          avatar = COALESCE(?, avatar),
          birthday = COALESCE(?, birthday)
      WHERE id = ? AND family_id = ?
    `).bind(name, avatar, birthday || null, childId, user.familyId).run();

    if (result.meta.changes === 0) {
      return c.json({ success: false, errorCode: 'ERR_NOT_FOUND' }, 404);
    }

    return c.json({ success: true });
  } catch (error) {
    console.error(`[DB Error] Update child failed:`, error.message);
    return c.json({ success: false, errorCode: 'ERR_SYSTEM_ERROR', errorMessage: error.message }, 500);
  }
});

/**
 * 5. 删除孩子 (级联删除由数据库 FOREIGN KEY 保证)
 */
children.delete('/:id', async (c) => {
  const user = c.get('user');
  const childId = c.req.param('id');

  if (user.role !== 'superadmin') {
    return c.json({ success: false, errorCode: 'ERR_FORBIDDEN', errorMessage: 'Only superadmin can delete children' }, 403);
  }

  try {
    await c.env.DB.prepare(`
      DELETE FROM children WHERE id = ? AND family_id = ?
    `).bind(childId, user.familyId).run();

    return c.json({ success: true });
  } catch (error) {
    return c.json({ success: false, errorCode: 'ERR_SYSTEM_ERROR' }, 500);
  }
});

export default children;