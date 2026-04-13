// backend/src/routes/rewards.js
import { Hono } from 'hono';
import { nanoid } from 'nanoid';

const rewards = new Hono();

/**
 * 1. 获取家庭的奖品列表 (支持分类、搜索、屏蔽软删除)
 */
rewards.get('/list', async (c) => {
  const user = c.get('user');
  const categoryId = c.req.query('categoryId');
  const keyword = c.req.query('keyword');

  let query = `SELECT * FROM rewards WHERE family_id = ? AND (is_deleted IS NULL OR is_deleted = 0)`;
  const params = [user.familyId];

  if (categoryId) {
    query += ` AND category_id = ?`;
    params.push(categoryId);
  }
  if (keyword) {
    query += ` AND name LIKE ?`;
    params.push(`%${keyword}%`);
  }
  query += ` ORDER BY cost ASC`;

  try {
    const { results } = await c.env.DB.prepare(query).bind(...params).all();
    return c.json({ success: true, data: results });
  } catch (e) {
    return c.json({ success: false, errorMessage: e.message }, 500);
  }
});

/**
 * 2. 奖品管理 Upsert (家长上架/编辑商品)
 */
rewards.post('/manage/upsert', async (c) => {
  const user = c.get('user');
  const data = await c.req.json();
  if (user.role === 'viewer') return c.json({ success: false, errorCode: 'ERR_FORBIDDEN' }, 403);

  const id = data.id || nanoid(8); 
  try {
    await c.env.DB.prepare(`
      INSERT INTO rewards (id, family_id, name, emoji, cost, stock, description, require_approval, category_id, is_deleted)
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, 0)
      ON CONFLICT(id) DO UPDATE SET
        name = ?3, emoji = ?4, cost = ?5, stock = ?6, description = ?7, require_approval = ?8, category_id = ?9
      WHERE rewards.family_id = ?2 
    `).bind(
      id, user.familyId, data.name, data.emoji || '🎁', data.cost, 
      data.stock ?? -1, data.description || '', data.require_approval ? 1 : 0, data.categoryId || null
    ).run();
    return c.json({ success: true, id });
  } catch (e) {
    return c.json({ success: false, errorMessage: e.message }, 500);
  }
});

/**
 * 3. 软删除商品
 */
rewards.delete('/manage/:id', async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  if (user.role === 'viewer') return c.json({ success: false, errorCode: 'ERR_FORBIDDEN' }, 403);
  
  try {
    await c.env.DB.prepare(`UPDATE rewards SET is_deleted = 1 WHERE id = ? AND family_id = ?`).bind(id, user.familyId).run();
    return c.json({ success: true });
  } catch (e) {
    return c.json({ success: false, errorMessage: e.message }, 500);
  }
});

/**
 * 4. 管理员直接兑换 (扣库存 + DO触发扣分广播)
 */
rewards.post('/admin-redeem', async (c) => {
  const user = c.get('user');
  const { childId, rewardId } = await c.req.json();

  if (user.role === 'viewer') return c.json({ success: false, errorCode: 'ERR_FORBIDDEN' }, 403);

  try {
    const reward = await c.env.DB.prepare(`SELECT * FROM rewards WHERE id = ? AND family_id = ?`).bind(rewardId, user.familyId).first();
    if (!reward) return c.json({ success: false, errorCode: 'ERR_NOT_FOUND' }, 404);
    if (reward.stock === 0) return c.json({ success: false, errorMessage: '库存不足' }, 400);

    // 1. 扣减库存（防超卖）
    await c.env.DB.prepare(`UPDATE rewards SET stock = stock - 1 WHERE id = ? AND stock > 0`).bind(rewardId).run();

    // 2. 触发 DO 走正规的扣分和通知流
    const doId = c.env.FAMILY_MANAGER.idFromName(user.familyId);
    const doObj = c.env.FAMILY_MANAGER.get(doId);
    
    const doRes = await doObj.fetch(new Request(`http://do/adjust`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        familyId: user.familyId, 
        childId, 
        points: -reward.cost,
        operatorId: user.id,
        remark: `家长操作兑换：${reward.name}` 
      })
    }));

    if (!doRes.ok) {
      const errText = await doRes.text();
      console.error('[DO Error]', errText);
      throw new Error('发分事务执行失败');
    }

    return c.json({ success: true });
  } catch (e) {
    return c.json({ success: false, errorMessage: e.message }, 500);
  }
});

export default rewards;