// backend/src/routes/goals.js
import { Hono } from 'hono';
import { nanoid } from 'nanoid';

const goals = new Hono();

/**
 * 1. 获取目标列表 (自动根据角色过滤)
 */
goals.get('/', async (c) => {
  const user = c.get('user');
  const childId = user.userType === 'child' ? user.id : c.req.query('childId');

  if (!childId) return c.json({ success: false, errorMessage: '缺少参数' }, 400);

  try {
    const { results } = await c.env.DB.prepare(`
      SELECT * FROM goals 
      WHERE family_id = ? AND child_id = ? 
      ORDER BY 
        CASE status 
          WHEN 'pending' THEN 1
          WHEN 'active' THEN 2 
          WHEN 'completed' THEN 3 
          WHEN 'paused' THEN 4 
          ELSE 5 
        END, created_at DESC
    `).bind(user.familyId, childId).all();

    return c.json({ success: true, data: results });
  } catch (e) {
    return c.json({ success: false, errorMessage: e.message }, 500);
  }
});

/**
 * 2. 创建新目标 (增加验证)
 */
goals.post('/', async (c) => {
  const user = c.get('user');
  const { childId, name, target_points, emoji } = await c.req.json();

  // 验证：孩子只能给自己创建
  const targetChildId = user.userType === 'child' ? user.id : childId;
  
  try {
    // 验证：每个孩子最多拥有 10 个未兑换的目标
    const { count } = await c.env.DB.prepare(
      `SELECT COUNT(*) as count FROM goals WHERE child_id = ? AND status != 'redeemed'`
    ).bind(targetChildId).first();
    
    if (count >= 10) return c.json({ success: false, errorMessage: '心愿单太满啦，先完成一些吧！' }, 400);
    if (target_points <= 0) return c.json({ success: false, errorMessage: '分值必须大于 0' }, 400);

    const activeGoal = await c.env.DB.prepare(`SELECT id FROM goals WHERE child_id = ? AND status = 'active'`).bind(targetChildId).first();
    const status = activeGoal ? 'paused' : 'active';
    const id = nanoid(12);

    await c.env.DB.prepare(`
      INSERT INTO goals (id, family_id, child_id, name, type, target_points, current_points, status, emoji)
      VALUES (?, ?, ?, ?, 'wish', ?, 0, ?, ?)
    `).bind(id, user.familyId, targetChildId, name, target_points, status, emoji || '🎯').run();

    return c.json({ success: true, data: { id, status } });
  } catch (e) {
    return c.json({ success: false, errorMessage: e.message }, 500);
  }
});

/**
 * 3. 切换目标状态 (排他性激活：一次只能有一个 active)
 */
goals.put('/activate', async (c) => {
  const user = c.get('user');
  const { childId, goalId } = await c.req.json();
  const targetChildId = user.userType === 'child' ? user.id : childId;

  try {
    await c.env.DB.batch([
      c.env.DB.prepare(`UPDATE goals SET status = 'paused' WHERE child_id = ? AND status IN ('active', 'completed')`).bind(targetChildId),
      c.env.DB.prepare(`UPDATE goals SET status = 'active' WHERE id = ? AND child_id = ?`).bind(goalId, targetChildId)
    ]);
    return c.json({ success: true });
  } catch (e) {
    return c.json({ success: false, errorMessage: e.message }, 500);
  }
});

/**
 * 4. 兑换目标 (扣分)
 */
goals.post('/redeem', async (c) => {
  const user = c.get('user');
  const { childId, goalId } = await c.req.json();

  try {
    const goal = await c.env.DB.prepare(`SELECT * FROM goals WHERE id = ? AND child_id = ?`).bind(goalId, childId).first();
    if (!goal || goal.current_points < goal.target_points) {
      return c.json({ success: false, errorMessage: '目标未达成或不存在' }, 400);
    }

    // 1. 调用 DO 的 adjust 接口进行标准扣分 (自带防并发、记流水、SSE广播)
    const doId = c.env.FAMILY_MANAGER.idFromName(user.familyId);
    const doObj = c.env.FAMILY_MANAGER.get(doId);
    
    // 构造内部请求
    const host = c.req.header('host') || 'localhost';
    const protocol = host.includes('localhost') ? 'http' : 'https';
    
    const doRes = await doObj.fetch(new Request(`${protocol}://${host}/adjust`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        familyId: user.familyId, 
        childId, 
        points: -goal.target_points, // 扣除目标分值
        operatorId: user.id,
        remark: `实现愿望：${goal.name}` 
      })
    }));

    if (!doRes.ok) throw new Error('扣分失败');

    // 2. 将目标标记为已兑换
    await c.env.DB.prepare(`UPDATE goals SET status = 'redeemed', updated_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(goalId).run();

    return c.json({ success: true });
  } catch (e) {
    return c.json({ success: false, errorMessage: e.message }, 500);
  }
});
/**
 * 5. 孩子申请兑换 (新接口)
 */
goals.post('/request-redemption', async (c) => {
  const user = c.get('user');
  const { goalId } = await c.req.json();

  try {
    const goal = await c.env.DB.prepare(`SELECT * FROM goals WHERE id = ? AND child_id = ?`).bind(goalId, user.id).first();
    if (!goal || goal.status !== 'completed') return c.json({ success: false, errorMessage: '未达成或状态不对' }, 400);

    await c.env.DB.prepare(`UPDATE goals SET status = 'pending', updated_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(goalId).run();

    // 🌟 发送通知给家长 (可以接入 TG 机器人)
    // sendTgMessage(user.familyId, `🔔 孩子申请兑换心愿：【${goal.name}】，快去审批吧！`);

    return c.json({ success: true });
  } catch (e) {
    return c.json({ success: false, errorMessage: e.message }, 500);
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