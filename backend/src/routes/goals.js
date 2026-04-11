import { Hono } from 'hono';
import { nanoid } from 'nanoid';
import { getGoalsTemplates } from '../locales/index.js';

const goals = new Hono();

/**
 * 1. 获取当前家庭的所有规则/任务
 */
goals.get('/', async (c) => {
  const user = c.get('user');

  try {
    const { results } = await c.env.DB.prepare(`
      SELECT * FROM goals 
      WHERE family_id = ? 
      ORDER BY created_at DESC
    `).bind(user.familyId).all();

    return c.json({ success: true, data: results });
  } catch (error) {
    console.error(`[DB Error] Fetch goals failed:`, error.message);
    return c.json({ success: false, errorCode: 'ERR_SYSTEM_ERROR', errorMessage: error.message }, 500);
  }
});

/**
 * 2. 新增或更新规则/任务 (Upsert)
 */
goals.post('/manage/upsert', async (c) => {
  const user = c.get('user');
  const { id, name, emoji, points, childId, status } = await c.req.json();

  // 只有管理员可以修改规则
  if (user.role !== 'admin' && user.role !== 'superadmin') {
    return c.json({ success: false, errorCode: 'ERR_FORBIDDEN' }, 403);
  }

  if (!name || points === undefined) {
    return c.json({ success: false, errorCode: 'ERR_MISSING_PARAMS' }, 400);
  }

  try {
    if (id) {
      // 更新现有规则
      await c.env.DB.prepare(`
        UPDATE goals 
        SET name = ?, emoji = ?, points = ?, child_id = ?, status = COALESCE(?, status), updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND family_id = ?
      `).bind(name, emoji || '⭐', points, childId || null, status || 'active', id, user.familyId).run();
      
      return c.json({ success: true, message: 'Updated successfully' });
    } else {
      // 创建新规则
      const newId = nanoid(10);
      await c.env.DB.prepare(`
        INSERT INTO goals (id, family_id, name, emoji, points, child_id, status)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(newId, user.familyId, name, emoji || '⭐', points, childId || null, status || 'active').run();
      
      return c.json({ success: true, data: { id: newId } });
    }
  } catch (error) {
    console.error(`[DB Error] Upsert goal failed:`, error.message);
    return c.json({ success: false, errorCode: 'ERR_SYSTEM_ERROR', errorMessage: error.message }, 500);
  }
});

/**
 * 3. 删除规则/任务
 */
goals.delete('/manage/:id', async (c) => {
  const user = c.get('user');
  const goalId = c.req.param('id');

  if (user.role !== 'admin' && user.role !== 'superadmin') {
    return c.json({ success: false, errorCode: 'ERR_FORBIDDEN' }, 403);
  }

  try {
    await c.env.DB.prepare(`
      DELETE FROM goals WHERE id = ? AND family_id = ?
    `).bind(goalId, user.familyId).run();

    return c.json({ success: true });
  } catch (error) {
    return c.json({ success: false, errorCode: 'ERR_SYSTEM_ERROR' }, 500);
  }
});

/**
 * 1. 获取孩子的目标列表
 * 增加逻辑：如果当前时间超过 deadline 且状态仍为 active，前端可显示为“已过期”
 */
goals.get('/list/:childId', async (c) => {
  const user = c.get('user');
  const childId = c.req.param('childId');
  
  try {
    const { results } = await c.env.DB.prepare(`
      SELECT *, 
        (CASE WHEN deadline IS NOT NULL AND deadline < CURRENT_TIMESTAMP AND status = 'active' THEN 1 ELSE 0 END) as is_expired
      FROM goals WHERE child_id = ? AND family_id = ? ORDER BY status ASC, created_at DESC
    `).bind(childId, user.familyId).all();
    return c.json({ success: true, data: results });
  } catch (e) {
    console.error(`[System Error] 获取目标列表失败. Error:`, e);
    return c.json({ success: false, errorCode: 'ERR_SYSTEM_ERROR', errorMessage: 'Failed to fetch goals' }, 500);
  }
});

// 1. 获取当前语言下的所有模板
goals.get('/templates/all', async (c) => {
  const user = c.get('user');
  const templates = getTemplates(user.locale || 'zh-CN');
  return c.json({ success: true, data: templates });
});

// 2. 批量导入模板
goals.post('/manage/batch-import', async (c) => {
  const user = c.get('user');
  const { childId, templates } = await c.req.json();

  if (user.role !== 'admin' && user.role !== 'superadmin') {
    return c.json({ success: false, errorCode: 'ERR_FORBIDDEN' }, 403);
  }

  try {
    const stmts = templates.map(t => {
      return c.env.DB.prepare(`
        INSERT INTO goals (id, family_id, name, emoji, points, child_id)
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind(nanoid(10), user.familyId, t.name, t.emoji, t.points, childId || null);
    });

    await c.env.DB.batch(stmts);
    return c.json({ success: true });
  } catch (error) {
    return c.json({ success: false, errorCode: 'ERR_SYSTEM_ERROR' }, 500);
  }
});

/**
 * 2. 家长添加新目标
 */
/*
goals.post('/add', async (c) => {
  const user = c.get('user');
  const { childId, name, type, targetPoints, deadline } = await c.req.json();

  if (user.userType !== 'parent' || user.role === 'viewer') {
    return c.json({ success: false, errorCode: 'ERR_FORBIDDEN', errorMessage: 'Insufficient permissions' }, 403);
  }

  try {
    const id = nanoid(12);
    await c.env.DB.prepare(`
      INSERT INTO goals (id, family_id, child_id, name, type, target_points, deadline)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(id, user.familyId, childId, name, type, targetPoints, deadline || null).run();
    return c.json({ success: true, id });
  } catch (e) {
    console.error(`[System Error] 添加目标失败. Error:`, e);
    return c.json({ success: false, errorCode: 'ERR_SYSTEM_ERROR', errorMessage: 'Failed to add goal' }, 500);
  }
});
*/
/**
 * 内部辅助函数：更新进度
 * 逻辑：仅更新未过期且激活中的目标
 */
export async function updateGoalProgress(db, familyId, childId, points) {
  if (points <= 0) return;

  await db.prepare(`
    UPDATE goals 
    SET current_points = current_points + ?,
        status = CASE WHEN (current_points + ?) >= target_points THEN 'completed' ELSE 'active' END,
        updated_at = CURRENT_TIMESTAMP
    WHERE child_id = ? 
      AND family_id = ? 
      AND status = 'active'
      AND (deadline IS NULL OR deadline > CURRENT_TIMESTAMP)
  `).bind(points, points, childId, familyId).run();
}

export default goals;