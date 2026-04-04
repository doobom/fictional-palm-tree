// src/routes/scores.js
import { Hono } from 'hono';
import { nanoid } from 'nanoid';
import { getSqliteTimezoneModifier } from '../utils/time.js';

const scores = new Hono();

/**
 * 核心接口：变动分数 (加分或扣分)
 */
scores.post('/adjust', async (c) => {
  const user = c.get('user'); 
  const { childId, points, ruleId, description } = await c.req.json();

  if (user.userType !== 'parent' || user.role === 'viewer') {
    console.warn(`[Business Warn] 越权操作: 尝试修改分数. UserID: ${user.internalId}`);
    return c.json({ success: false, errorCode: 'ERR_FORBIDDEN', errorMessage: 'Insufficient permissions' }, 403);
  }

  if (!childId || typeof points !== 'number') {
    return c.json({ success: false, errorCode: 'ERR_MISSING_PARAMS', errorMessage: 'Invalid parameters' }, 400);
  }

  // 检查规则限制 (Daily Limit)
  if (ruleId) {
    const rule = await c.env.DB.prepare(
      `SELECT * FROM rules WHERE id = ? AND family_id = ?`
    ).bind(ruleId, user.familyId).first();

    if (rule && rule.daily_limit > 0) {
      // 🌟 核心修复：带上家庭时区偏移，确保“今天”是指当地时间的今天
      const tzModifier = getSqliteTimezoneModifier(user.timezone);
      
      const todayCount = await c.env.DB.prepare(`
        SELECT COUNT(*) as count FROM history 
        WHERE child_id = ? AND rule_id = ? 
        AND datetime(created_at, ?) >= date('now', ?)
        AND reverted = 0
      `).bind(childId, ruleId, tzModifier, tzModifier).first('count');

      if (todayCount >= rule.daily_limit) {
        console.warn(`[Business Warn] 加分失败: 触及每日限额. ChildID: ${childId}, RuleID: ${ruleId}`);
        return c.json({ 
          success: false, 
          errorCode: 'ERR_DAILY_LIMIT_REACHED', 
          errorMessage: 'Daily limit reached',
          errorParams: { limit: rule.daily_limit } 
        }, 400);
      }
    }
  }

  const historyId = nanoid(12);
  const type = points >= 0 ? 'plus' : 'minus';

  try {
    await c.env.DB.batch([
      c.env.DB.prepare(`UPDATE children SET score_gained = score_gained + ? WHERE id = ? AND family_id = ?`).bind(points, childId, user.familyId),
      c.env.DB.prepare(`
        INSERT INTO history (id, family_id, child_id, rule_id, type, points, description, operator_id) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(historyId, user.familyId, childId, ruleId || null, type, points, description || '', user.internalId)
    ]);

    return c.json({ success: true, historyId, currentPoints: points });
  } catch (error) {
    console.error(`[System Error] 变动分数写入失败. Family: ${user.familyId}, Error:`, error);
    return c.json({ success: false, errorCode: 'ERR_SYSTEM_ERROR', errorMessage: 'Failed to adjust score' }, 500);
  }
});

/**
 * 接口：获取历史记录
 */
scores.get('/history', async (c) => {
  const user = c.get('user');
  const childId = c.req.query('childId');
  const limit = parseInt(c.req.query('limit')) || 20;

  let query = `
    SELECT h.*, u.nick_name as operator_name, r.name as rule_name
    FROM history h
    LEFT JOIN users u ON h.operator_id = u.id
    LEFT JOIN rules r ON h.rule_id = r.id
    WHERE h.family_id = ?
  `;
  const params = [user.familyId];

  if (childId) {
    query += ` AND h.child_id = ? `;
    params.push(childId);
  }
  query += ` ORDER BY h.created_at DESC LIMIT ? `;
  params.push(limit);

  try {
    const { results } = await c.env.DB.prepare(query).bind(...params).all();
    return c.json({ success: true, data: results });
  } catch (e) {
    console.error(`[System Error] 获取流水失败. Family: ${user.familyId}, Error:`, e);
    return c.json({ success: false, errorCode: 'ERR_SYSTEM_ERROR', errorMessage: 'Failed to fetch history' }, 500);
  }
});

/**
 * 接口：撤回操作 (Revert)
 */
scores.post('/revert', async (c) => {
  const user = c.get('user');
  const { historyId } = await c.req.json();

  if (user.role !== 'admin' && user.role !== 'superadmin') {
    return c.json({ success: false, errorCode: 'ERR_FORBIDDEN', errorMessage: 'Insufficient permissions' }, 403);
  }

  const record = await c.env.DB.prepare(`SELECT * FROM history WHERE id = ? AND family_id = ? AND reverted = 0`).bind(historyId, user.familyId).first();

  if (!record) {
    console.warn(`[Business Warn] 撤销失败: 记录不存在或已撤销. HistoryID: ${historyId}`);
    return c.json({ success: false, errorCode: 'ERR_NOT_FOUND', errorMessage: 'Record not found or already reverted' }, 404);
  }

  try {
    await c.env.DB.batch([
      c.env.DB.prepare(`UPDATE history SET reverted = 1 WHERE id = ?`).bind(historyId),
      c.env.DB.prepare(`UPDATE children SET score_gained = score_gained - ? WHERE id = ?`).bind(record.points, record.child_id)
    ]);
    return c.json({ success: true });
  } catch (e) {
    console.error(`[System Error] 撤销分数事务失败. HistoryID: ${historyId}, Error:`, e);
    return c.json({ success: false, errorCode: 'ERR_SYSTEM_ERROR', errorMessage: 'Failed to revert score' }, 500);
  }
});

// 在 src/routes/scores.js 中追加以下路由：

/**
 * 🌟 新增：批量给所有/部分孩子加减分
 */
scores.post('/batch', async (c) => {
  const user = c.get('user');
  const { childIds, pointsDelta, remark } = await c.req.json();

  if (user.userType !== 'parent' || user.role === 'viewer') {
    return c.json({ success: false, errorCode: 'ERR_FORBIDDEN' }, 403);
  }

  if (!Array.isArray(childIds) || childIds.length === 0 || typeof pointsDelta !== 'number') {
    return c.json({ success: false, errorCode: 'ERR_MISSING_PARAMS' }, 400);
  }

  const type = pointsDelta >= 0 ? 'plus' : 'minus';
  const stmts = [];

  for (const childId of childIds) {
    const historyId = nanoid(12);
    // 1. 更新孩子表 (直接加减分数)
    stmts.push(c.env.DB.prepare(`
      UPDATE children SET score_gained = score_gained + ? WHERE id = ? AND family_id = ?
    `).bind(pointsDelta, childId, user.familyId));
    
    // 2. 写入流水记录 (remark 作为 description 存入)
    stmts.push(c.env.DB.prepare(`
      INSERT INTO history (id, family_id, child_id, type, points, description, operator_id) 
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(historyId, user.familyId, childId, type, pointsDelta, remark || '', user.internalId));
  }

  try {
    await c.env.DB.batch(stmts);
    
    // 获取最新的积分状态返回给前端刷新 UI
    const { results } = await c.env.DB.prepare(`
      SELECT id, (score_gained - score_spent) as newTotalPoints 
      FROM children WHERE family_id = ?
    `).bind(user.familyId).all();

    const updatedData = results.filter(child => childIds.includes(child.id));
    return c.json({ success: true, data: updatedData });
  } catch (error) {
    console.error(`[System Error] 批量加减分事务失败:`, error);
    return c.json({ success: false, errorCode: 'ERR_SYSTEM_ERROR' }, 500);
  }
});

export default scores;