import { Hono } from 'hono';
import { nanoid } from 'nanoid';

const goals = new Hono();

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

/**
 * 2. 家长添加新目标
 */
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