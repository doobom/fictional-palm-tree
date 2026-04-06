// src/routes/children.js
import { Hono } from 'hono';
import { nanoid } from 'nanoid';

const children = new Hono();

/**
 * 1. 获取当前家庭的所有孩子列表
 * 逻辑：基于 Header 中的 x-family-id 进行过滤
 */
children.get('/', async (c) => {
  const user = c.get('user'); // 来自 requireAppUser 中间件
  
  try {
    const { results } = await c.env.DB.prepare(`
      SELECT id, name, avatar, score_gained, score_spent, 
             (score_gained - score_spent) as balance, created_at
      FROM children 
      WHERE family_id = ?
      ORDER BY created_at ASC
    `).bind(user.familyId).all();

    return c.json({ success: true, data: results });
  } catch (error) {
    console.error(`[DB Error] Fetch children failed:`, error);
    return c.json({ success: false, errorCode: 'ERR_SYSTEM_ERROR' }, 500);
  }
});

/**
 * 2. 添加新孩子
 */
children.post('/', async (c) => {
  const user = c.get('user');
  const { name, avatar } = await c.req.json();

  if (user.role !== 'admin' && user.role !== 'superadmin') {
    return c.json({ success: false, errorCode: 'ERR_FORBIDDEN' }, 403);
  }

  if (!name) {
    return c.json({ success: false, errorCode: 'ERR_MISSING_PARAMS' }, 400);
  }

  const childId = nanoid(10);

  try {
    await c.env.DB.prepare(`
      INSERT INTO children (id, family_id, name, avatar)
      VALUES (?, ?, ?, ?)
    `).bind(childId, user.familyId, name, avatar || '👦').run();

    return c.json({ success: true, data: { id: childId, name } });
  } catch (error) {
    return c.json({ success: false, errorCode: 'ERR_SYSTEM_ERROR' }, 500);
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
      SELECT * FROM children WHERE id = ? AND family_id = ?
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
    return c.json({ success: false, errorCode: 'ERR_SYSTEM_ERROR' }, 500);
  }
});

/**
 * 4. 修改孩子信息
 */
children.put('/:id', async (c) => {
  const user = c.get('user');
  const childId = c.req.param('id');
  const { name, avatar } = await c.req.json();

  if (user.role !== 'admin' && user.role !== 'superadmin') {
    return c.json({ success: false, errorCode: 'ERR_FORBIDDEN' }, 403);
  }

  try {
    const result = await c.env.DB.prepare(`
      UPDATE children SET name = COALESCE(?, name), avatar = COALESCE(?, avatar)
      WHERE id = ? AND family_id = ?
    `).bind(name, avatar, childId, user.familyId).run();

    if (result.meta.changes === 0) {
      return c.json({ success: false, errorCode: 'ERR_NOT_FOUND' }, 404);
    }

    return c.json({ success: true });
  } catch (error) {
    return c.json({ success: false, errorCode: 'ERR_SYSTEM_ERROR' }, 500);
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