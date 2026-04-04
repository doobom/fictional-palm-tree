// src/routes/rewards.js
import { Hono } from 'hono';
import { nanoid } from 'nanoid';
import { rateLimiter } from '../middlewares/rateLimit.js';

const rewards = new Hono();

/**
 * 1. 兑换商品 (孩子发起)
 * 逻辑：越权校验 -> 获取奖品 -> 校验库存与余额 -> 判断是否需要审批 -> 数据库事务处理 -> 推送消息队列
 */
rewards.post('/redeem', 
  rateLimiter({
    keyPrefix: 'rl_redeem',
    limit: 3,              // 允许 3 次
    window: 60,            // 窗口期 60 秒
    identifier: 'user',    // 已经通过 requireAppUser 鉴权，按用户 ID 精准限流
    errorCode: 'ERR_TOO_FREQUENT_REDEEM'
  }), async (c) => {
  const user = c.get('user');
  const { rewardId } = await c.req.json();

  if (user.userType !== 'child') {
    console.warn(`[Business Warn] 越权操作: 非孩子账号尝试发起兑换. UserID: ${user.internalId}`);
    return c.json({ success: false, errorCode: 'ERR_FORBIDDEN', errorMessage: 'Only children can redeem rewards' }, 403);
  }

  // 1. 获取奖品详情
  const reward = await c.env.DB.prepare(
    `SELECT * FROM rewards WHERE id = ? AND family_id = ?`
  ).bind(rewardId, user.familyId).first();

  if (!reward) {
    return c.json({ success: false, errorCode: 'ERR_NOT_FOUND', errorMessage: 'Reward not found' }, 404);
  }
  
  if (reward.stock === 0) {
    console.warn(`[Business Warn] 兑换失败: 库存不足. RewardID: ${rewardId}`);
    return c.json({ success: false, errorCode: 'ERR_OUT_OF_STOCK', errorMessage: 'Out of stock' }, 400);
  }

  // 2. 校验余额与家庭配置 (JOIN 家庭表获取个性化配置与通知开关)
  const childData = await c.env.DB.prepare(`
    SELECT 
      c.score_gained, c.score_spent, c.name as child_name,
      f.instant_alert_enabled, f.point_name, f.point_emoji
    FROM children c
    JOIN families f ON c.family_id = f.id
    WHERE c.id = ?
  `).bind(user.internalId).first();
  
  const balance = childData.score_gained - childData.score_spent;

  if (balance < reward.cost) {
    console.warn(`[Business Warn] 兑换失败: 积分不足. Child: ${childData.child_name}, 余额: ${balance}, 需: ${reward.cost}`);
    return c.json({ 
      success: false, 
      errorCode: 'ERR_INSUFFICIENT_POINTS', 
      errorMessage: 'Insufficient points',
      errorParams: { balance, cost: reward.cost } 
    }, 400);
  }

  const redemptionId = nanoid(12);
  const snapshot = JSON.stringify({ name: reward.name, emoji: reward.emoji, cost: reward.cost });

  try {
    if (reward.require_approval) {
      // ==========================================
      // 流程 A：需要审批 (挂起状态)
      // ==========================================
      await c.env.DB.prepare(`
        INSERT INTO redemptions (id, family_id, child_id, reward_id, reward_snapshot, cost, status, operator_id)
        VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)
      `).bind(redemptionId, user.familyId, user.internalId, rewardId, snapshot, reward.cost, user.internalId).run();

      // 异步投递消息到队列 (触发家长端 Bot 审批通知卡片)
      if (c.env.MSG_QUEUE && childData.instant_alert_enabled) {
        c.executionCtx.waitUntil(
          c.env.MSG_QUEUE.send({
            type: 'REDEEM_APPROVAL_REQUEST',
            familyId: user.familyId,
            childId: user.internalId,
            childName: childData.child_name,
            redemptionId: redemptionId,
            rewardName: reward.name,
            cost: reward.cost,
            balance: balance,
            // 🌟 将个性化货币塞进队列，给 Bot 组装文案用
            pointName: childData.point_name || '积分',
            pointEmoji: childData.point_emoji || '🪙'
          })
        );
      }
      return c.json({ success: true, status: 'pending', message: '申请成功，已通知家长审批' });

    } else {
      // ==========================================
      // 流程 B：自动审批 (强一致性扣分与减库存)
      // ==========================================
      const dbResult = await c.env.DB.batch([
        c.env.DB.prepare(`
          INSERT INTO redemptions (id, family_id, child_id, reward_id, reward_snapshot, cost, status, operator_id, approved_by)
          VALUES (?, ?, ?, ?, ?, ?, 'approved', ?, 'SYSTEM')
        `).bind(redemptionId, user.familyId, user.internalId, rewardId, snapshot, reward.cost, user.internalId),
        
        c.env.DB.prepare(`UPDATE children SET score_spent = score_spent + ? WHERE id = ?`).bind(reward.cost, user.internalId),
        
        // 使用 "stock > 0" 条件更新，防止高并发导致超卖变成负数
        c.env.DB.prepare(`UPDATE rewards SET stock = stock - 1 WHERE id = ? AND stock > 0`).bind(rewardId)
      ]);

      // 检查最后一条更新的影响行数。如果原来有库存限制，但更新行数为 0，说明被瞬间抢空
      if (dbResult[2].meta.changes === 0 && reward.stock !== -1) {
         throw new Error('STOCK_DEPLETED');
      }

      // 异步投递消息到队列 (通知家长自动兑换成功)
      if (c.env.MSG_QUEUE && childData.instant_alert_enabled) {
        c.executionCtx.waitUntil(
          c.env.MSG_QUEUE.send({
            type: 'REDEEM_AUTO_APPROVED',
            familyId: user.familyId,
            childName: childData.child_name,
            rewardName: reward.name,
            cost: reward.cost,// 🌟 同样塞入个性化货币
            pointName: childData.point_name || '积分',
            pointEmoji: childData.point_emoji || '🪙'
          })
        );
      }
      return c.json({ success: true, status: 'approved' });
    }
  } catch (e) {
    if (e.message === 'STOCK_DEPLETED') {
      return c.json({ success: false, errorCode: 'ERR_OUT_OF_STOCK', errorMessage: 'Just sold out' }, 400);
    }
    console.error(`[System Error] 兑换事务执行失败. User: ${user.internalId}, Error:`, e);
    return c.json({ success: false, errorCode: 'ERR_SYSTEM_ERROR', errorMessage: 'System busy' }, 500);
  }
});

/**
 * 2. 审批操作 (通常供前端 Web App 家长管理后台调用，Bot 端有专门的 webhook 处理)
 */
rewards.post('/approve', async (c) => {
  const user = c.get('user');
  const { redemptionId, action } = await c.req.json(); // action: 'approved' | 'rejected'

  if (user.role !== 'admin' && user.role !== 'superadmin') {
    console.warn(`[Business Warn] 越权操作: 尝试审批兑换. UserID: ${user.internalId}`);
    return c.json({ success: false, errorCode: 'ERR_FORBIDDEN', errorMessage: 'Insufficient permissions' }, 403);
  }

  const record = await c.env.DB.prepare(
    `SELECT * FROM redemptions WHERE id = ? AND family_id = ? AND status = 'pending'`
  ).bind(redemptionId, user.familyId).first();

  if (!record) {
    return c.json({ success: false, errorCode: 'ERR_NOT_FOUND', errorMessage: 'Pending record not found' }, 404);
  }

  try {
    if (action === 'rejected') {
      await c.env.DB.prepare(
        `UPDATE redemptions SET status = 'rejected', approved_by = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
      ).bind(user.internalId, redemptionId).run();
      
    } else {
      await c.env.DB.batch([
        c.env.DB.prepare(`UPDATE redemptions SET status = 'approved', approved_by = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(user.internalId, redemptionId),
        c.env.DB.prepare(`UPDATE children SET score_spent = score_spent + ? WHERE id = ?`).bind(record.cost, record.child_id),
        c.env.DB.prepare(`UPDATE rewards SET stock = stock - 1 WHERE id = ? AND stock > 0`).bind(record.reward_id)
      ]);
      
      // 注意：成就解锁 (checkAchievementUnlock) 在这里的 Web 接口暂时不强制引入，
      // 因为前端审批的情况相对较少，主要在 Bot 内流转。如果需要，也可以补上。
    }
    return c.json({ success: true });
  } catch (e) {
    console.error(`[System Error] Web端审批事务执行失败. RedemptionID: ${redemptionId}, Error:`, e);
    return c.json({ success: false, errorCode: 'ERR_SYSTEM_ERROR', errorMessage: 'Approval failed' }, 500);
  }
});

/**
 * 3. 奖品管理 (家长端增删改查商品)
 */
// ====== 修改：2. 奖品管理 Upsert (兼容 category_id 和 is_deleted) ======
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
    return c.json({ success: false, errorCode: 'ERR_SYSTEM_ERROR' }, 500);
  }
});

// ====== 🌟 新增：3. 软删除商品 ======
rewards.delete('/manage/:id', async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  if (user.role === 'viewer') return c.json({ success: false, errorCode: 'ERR_FORBIDDEN' }, 403);
  
  try {
    await c.env.DB.prepare(`
      UPDATE rewards SET is_deleted = 1 WHERE id = ? AND family_id = ?
    `).bind(id, user.familyId).run();
    return c.json({ success: true });
  } catch (e) {
    return c.json({ success: false, errorCode: 'ERR_SYSTEM_ERROR' }, 500);
  }
});

// ====== 🌟 新增：4. 管理员代兑换 (扣库存 + 状态流转) ======
rewards.post('/admin-redeem', async (c) => {
  const user = c.get('user');
  const { childId, rewardId, remark, status = 'pending' } = await c.req.json(); // 状态由前端传：待发放 (pending) 或 已发放 (approved)

  if (user.userType !== 'parent' || user.role === 'viewer') {
    return c.json({ success: false, errorCode: 'ERR_FORBIDDEN' }, 403);
  }

  // 校验商品和库存
  const reward = await c.env.DB.prepare(`
    SELECT * FROM rewards WHERE id = ? AND family_id = ? AND (is_deleted IS NULL OR is_deleted = 0)
  `).bind(rewardId, user.familyId).first();
  
  if (!reward) return c.json({ success: false, errorCode: 'ERR_NOT_FOUND' }, 404);
  if (reward.stock === 0) return c.json({ success: false, errorCode: 'ERR_OUT_OF_STOCK' }, 400);

  // 校验孩子积分
  const childData = await c.env.DB.prepare(`
    SELECT score_gained, score_spent FROM children WHERE id = ? AND family_id = ?
  `).bind(childId, user.familyId).first();
  if (!childData) return c.json({ success: false, errorCode: 'ERR_NOT_FOUND' }, 404);

  const balance = childData.score_gained - childData.score_spent;
  if (balance < reward.cost) return c.json({ success: false, errorCode: 'ERR_INSUFFICIENT_POINTS' }, 400);

  const redemptionId = nanoid(12);
  // 将备注信息巧妙地塞进快照中，前端可以展示
  const snapshot = JSON.stringify({ name: reward.name, emoji: reward.emoji, cost: reward.cost, remark: remark || '' });

  try {
    await c.env.DB.batch([
      // 1. 生成兑换记录
      c.env.DB.prepare(`
        INSERT INTO redemptions (id, family_id, child_id, reward_id, reward_snapshot, cost, status, operator_id, approved_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(redemptionId, user.familyId, childId, rewardId, snapshot, reward.cost, status, user.internalId, user.internalId),
      // 2. 扣减孩子积分
      c.env.DB.prepare(`UPDATE children SET score_spent = score_spent + ? WHERE id = ?`).bind(reward.cost, childId),
      // 3. 扣减库存（防超卖）
      c.env.DB.prepare(`UPDATE rewards SET stock = stock - 1 WHERE id = ? AND stock > 0`).bind(rewardId)
    ]);

    const newStock = reward.stock === -1 ? -1 : reward.stock - 1;
    return c.json({ 
      success: true, 
      data: { historyId: redemptionId, status, newTotalPoints: balance - reward.cost, newStock }
    });
  } catch (e) {
    console.error(`[System Error] 管理员代兑换失败:`, e);
    return c.json({ success: false, errorCode: 'ERR_SYSTEM_ERROR' }, 500);
  }
});

/**
 * 获取家庭的奖品列表
 */
// ====== 修改：1. 获取家庭的奖品列表 (支持分类、搜索、屏蔽软删除) ======
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
    return c.json({ success: false, errorCode: 'ERR_SYSTEM_ERROR' }, 500);
  }
});

/**
 * 获取家长需要审批的兑换请求
 */
rewards.get('/pending', async (c) => {
  const user = c.get('user');
  try {
    const { results } = await c.env.DB.prepare(`
      SELECT r.*, c.name as child_name, c.avatar 
      FROM redemptions r 
      JOIN children c ON r.child_id = c.id 
      WHERE r.family_id = ? AND r.status = 'pending' 
      ORDER BY r.created_at DESC
    `).bind(user.familyId).all();
    return c.json({ success: true, data: results });
  } catch (e) {
    return c.json({ success: false, errorCode: 'ERR_SYSTEM_ERROR' }, 500);
  }
});

export default rewards;