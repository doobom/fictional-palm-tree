// src/routes/family.js
import { Hono } from 'hono';
import { customAlphabet } from 'nanoid';
import { sendTgMessage } from '../utils/telegram.js';

const family = new Hono();
const generateFamilyCode = customAlphabet('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', 6);

// 1. 修改家庭资料 (名称、时区、推送)
family.put('/profile', async (c) => {
  const user = c.get('user');
  const { 
    name, avatar, timezone, pushEnabled, pushTime, pushOptions,
    pointName, pointEmoji, instantAlertEnabled // 🌟 新增字段
  } = await c.req.json();
  if (user.role !== 'superadmin') return c.json({ success: false, errorCode: 'ERR_FORBIDDEN' }, 403);

  if (!name) return c.json({ success: false, errorCode: 'ERR_MISSING_PARAMS' }, 400); // 🌟 新增拦截

  try {
    await c.env.DB.prepare(`
    UPDATE families 
    SET name = ?, avatar = ?, timezone = ?, push_enabled = ?, push_time = ?, push_options = ?,
        point_name = ?, point_emoji = ?, instant_alert_enabled = ?
    WHERE id = ?
  `).bind(
    name.trim(), avatar, timezone, pushEnabled ? 1 : 0, pushTime, JSON.stringify(pushOptions),
    pointName || '积分', pointEmoji || '🪙', instantAlertEnabled ? 1 : 0,
    user.familyId
  ).run();
    return c.json({ success: true });
  } catch (e) { return c.json({ success: false, errorCode: 'ERR_SYSTEM_ERROR' }, 500); }
});

/**
 * 1. 生成家长/管理员的加入邀请码 (前端调用 POST /family/invite)
 */
family.post('/invite', async (c) => {
  const user = c.get('user');
  
  if (user.role !== 'superadmin' && user.role !== 'admin') {
    return c.json({ success: false, errorCode: 'ERR_FORBIDDEN', errorMessage: 'Only admins can generate invites' }, 403);
  }

  const code = generateFamilyCode();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24小时有效期

  try {
    await c.env.DB.prepare(`
      INSERT INTO invitation_codes (code, family_id, type, created_by, expires_at)
      VALUES (?, ?, 'admin', ?, ?)
    `).bind(code, user.familyId, user.internalId, expiresAt).run();

    return c.json({ success: true, code, expiresIn: '24 hours' });
  } catch (e) {
    console.error(`[System Error] 生成家庭邀请码落库失败. Error:`, e);
    return c.json({ success: false, errorCode: 'ERR_SYSTEM_ERROR', errorMessage: 'Failed to generate invite' }, 500);
  }
});


/**
 * 3. 获取家庭积分规则
 */
family.get('/rules', async (c) => {
  const user = c.get('user');
  const { results } = await c.env.DB.prepare(
    `SELECT * FROM rules WHERE family_id = ? ORDER BY points DESC`
  ).bind(user.familyId).all();
  return c.json({ success: true, data: results });
});

// 🌟 2. 新增：测试推送接口
family.post('/test-push', async (c) => {
  const user = c.get('user');

  try {
    const { results: admins } = await c.env.DB.prepare(`
      SELECT b.provider_uid 
      FROM auth_bindings b
      JOIN users u ON b.internal_id = u.id
      WHERE u.family_id = ? AND b.provider = 'telegram' AND u.role IN ('superadmin', 'admin')
    `).bind(user.familyId).all();

    if (!admins || admins.length === 0) {
      return c.json({ success: false, errorMessage: '未找到绑定 Telegram 的管理员账号' }, 400);
    }

    // 🌟 使用 HTML 标签 <b> 替代 Markdown
    const testMessage = `
🤖 <b>家庭积分系统 - 测试推送</b>

这是一条测试消息！您的每日小结推送配置已生效。
时间到达您设置的推送时间后，系统将自动为您发送真实的家庭动态简报。
    `;

    // 🌟 直接复用工具函数发送
    for (const admin of admins) {
      await sendTgMessage(c.env.TELEGRAM_TOKEN, admin.provider_uid, testMessage);
    }

    return c.json({ success: true });
  } catch (error) {
    console.error('Test push error:', error);
    return c.json({ success: false, errorCode: 'ERR_SYSTEM_ERROR' }, 500);
  }
});

// ==========================================
// 🌟 成员管理模块
// ==========================================

// 1. 获取家庭成员列表
family.get('/members', async (c) => {
  const user = c.get('user');
  if (user.role !== 'superadmin') return c.json({ success: false, errorCode: 'ERR_FORBIDDEN' }, 403);

  try {
    const { results } = await c.env.DB.prepare(`
      SELECT u.id, u.nick_name, u.avatar, u.role, b.provider_uid 
      FROM users u
      LEFT JOIN auth_bindings b ON u.id = b.internal_id
      WHERE u.family_id = ?
    `).bind(user.familyId).all();
    return c.json({ success: true, data: results });
  } catch (e) { return c.json({ success: false, errorCode: 'ERR_SYSTEM_ERROR' }, 500); }
});

// 2. 修改成员权限
family.put('/members/:id/role', async (c) => {
  const user = c.get('user');
  const targetId = c.req.param('id');
  const { role } = await c.req.json();
  
  if (user.role !== 'superadmin') return c.json({ success: false, errorCode: 'ERR_FORBIDDEN' }, 403);
  if (targetId === user.internalId) return c.json({ success: false, errorMessage: '不能修改自己的权限' }, 400);
  if (!['superadmin', 'admin', 'viewer'].includes(role)) return c.json({ success: false, errorCode: 'ERR_MISSING_PARAMS' }, 400);

  try {
    await c.env.DB.prepare(`UPDATE users SET role = ? WHERE id = ? AND family_id = ?`).bind(role, targetId, user.familyId).run();
    return c.json({ success: true });
  } catch (e) { return c.json({ success: false, errorCode: 'ERR_SYSTEM_ERROR' }, 500); }
});

// 3. 踢出成员 (解除家庭绑定)
family.delete('/members/:id', async (c) => {
  const user = c.get('user');
  const targetId = c.req.param('id');
  
  if (user.role !== 'superadmin') return c.json({ success: false, errorCode: 'ERR_FORBIDDEN' }, 403);
  if (targetId === user.internalId) return c.json({ success: false, errorMessage: '不能踢出自己' }, 400);

  try {
    // 将被踢出者的 family_id 设为 null，角色重置为 viewer，防止越权
    await c.env.DB.prepare(`UPDATE users SET family_id = NULL, role = 'viewer' WHERE id = ? AND family_id = ?`).bind(targetId, user.familyId).run();
    return c.json({ success: true });
  } catch (e) { return c.json({ success: false, errorCode: 'ERR_SYSTEM_ERROR' }, 500); }
});

// ==========================================
// 🌟 数据与备份模块
// ==========================================

// 1. 导出冷备份 (JSON)
family.get('/export', async (c) => {
  const user = c.get('user');
  if (user.role !== 'superadmin') return c.json({ success: false, errorCode: 'ERR_FORBIDDEN' }, 403);

  try {
    const familyId = user.familyId;
    const db = c.env.DB;

    // 并发获取当前家庭的所有核心业务数据
    const [children, rules, rewards, history, redemptions] = await Promise.all([
      db.prepare(`SELECT * FROM children WHERE family_id = ?`).bind(familyId).all(),
      db.prepare(`SELECT * FROM rules WHERE family_id = ?`).bind(familyId).all(),
      db.prepare(`SELECT * FROM rewards WHERE family_id = ?`).bind(familyId).all(),
      // 历史记录通过 child_id 关联查询
      db.prepare(`SELECT h.* FROM history h JOIN children c ON h.child_id = c.id WHERE c.family_id = ?`).bind(familyId).all(),
      db.prepare(`SELECT * FROM redemptions WHERE family_id = ?`).bind(familyId).all(),
    ]);

    const backupData = {
      version: 1,
      export_date: new Date().toISOString(),
      family_id: familyId,
      data: {
        children: children.results,
        rules: rules.results,
        rewards: rewards.results,
        history: history.results,
        redemptions: redemptions.results
      }
    };

    return c.json({ success: true, data: backupData });
  } catch (e) {
    console.error('Export Error:', e);
    return c.json({ success: false, errorCode: 'ERR_SYSTEM_ERROR' }, 500);
  }
});

// 2. 导入恢复备份 (毁灭性覆盖)
family.post('/import', async (c) => {
  const user = c.get('user');
  if (user.role !== 'superadmin') return c.json({ success: false, errorCode: 'ERR_FORBIDDEN' }, 403);

  const { backup } = await c.req.json();
  if (!backup || backup.version !== 1 || !backup.data) {
    return c.json({ success: false, errorMessage: '无效的备份文件格式' }, 400);
  }

  const familyId = user.familyId;
  const d = backup.data;
  const stmts = []; // 收集所有 SQL 语句，通过 batch 批量执行保障性能

  try {
    // --- Step 1: 清理当前家庭的旧数据 (顺序很重要，先删子表) ---
    stmts.push(c.env.DB.prepare(`DELETE FROM redemptions WHERE family_id = ?`).bind(familyId));
    stmts.push(c.env.DB.prepare(`DELETE FROM history WHERE child_id IN (SELECT id FROM children WHERE family_id = ?)`).bind(familyId));
    stmts.push(c.env.DB.prepare(`DELETE FROM rewards WHERE family_id = ?`).bind(familyId));
    stmts.push(c.env.DB.prepare(`DELETE FROM rules WHERE family_id = ?`).bind(familyId));
    stmts.push(c.env.DB.prepare(`DELETE FROM children WHERE family_id = ?`).bind(familyId));

    // --- Step 2: 恢复新数据 ---
    // 恢复孩子
    for (const c of (d.children || [])) {
      stmts.push(c.env.DB.prepare(`INSERT INTO children (id, family_id, name, avatar, score_gained, score_spent, birthday) VALUES (?, ?, ?, ?, ?, ?, ?)`).bind(c.id, familyId, c.name, c.avatar, c.score_gained, c.score_spent, c.birthday));
    }
    // 恢复规则
    for (const r of (d.rules || [])) {
      stmts.push(c.env.DB.prepare(`INSERT INTO rules (id, family_id, type, points, name, emoji) VALUES (?, ?, ?, ?, ?, ?)`).bind(r.id, familyId, r.type, r.points, r.name, r.emoji));
    }
    // 恢复奖品
    for (const rw of (d.rewards || [])) {
      stmts.push(c.env.DB.prepare(`INSERT INTO rewards (id, family_id, name, emoji, cost, stock, require_approval) VALUES (?, ?, ?, ?, ?, ?, ?)`).bind(rw.id, familyId, rw.name, rw.emoji, rw.cost, rw.stock, rw.require_approval));
    }
    // 恢复历史记录
    for (const h of (d.history || [])) {
      stmts.push(c.env.DB.prepare(`INSERT INTO history (id, child_id, type, points, description, created_at) VALUES (?, ?, ?, ?, ?, ?)`).bind(h.id, h.child_id, h.type, h.points, h.description, h.created_at));
    }
    // 恢复兑换记录
    for (const rd of (d.redemptions || [])) {
      stmts.push(c.env.DB.prepare(`INSERT INTO redemptions (id, family_id, child_id, reward_id, cost, status, reward_snapshot, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).bind(rd.id, familyId, rd.child_id, rd.reward_id, rd.cost, rd.status, rd.reward_snapshot, rd.created_at));
    }

    // --- Step 3: 切片执行 (突破 Cloudflare D1 每次 batch 最大 100 条语句的限制) ---
    const chunkSize = 80; 
    for (let i = 0; i < stmts.length; i += chunkSize) {
      await c.env.DB.batch(stmts.slice(i, i + chunkSize));
    }

    return c.json({ success: true });
  } catch (e) {
    console.error('Import Error:', e);
    return c.json({ success: false, errorCode: 'ERR_SYSTEM_ERROR', errorMessage: '恢复过程中发生错误' }, 500);
  }
});

/**
 * 🌟 极高危操作：解散家庭 (彻底删除家庭及所有关联数据)
 */
family.delete('/disband', async (c) => {
  const user = c.get('user');
  if (user.role !== 'superadmin') return c.json({ success: false, errorCode: 'ERR_FORBIDDEN' }, 403);

  try {
    const familyId = user.familyId;
    
    // 必须使用 batch 事务，保证要么全删，要么全不删 (避免产生孤儿数据)
    const stmts = [
      c.env.DB.prepare(`DELETE FROM redemptions WHERE family_id = ?`).bind(familyId),
      c.env.DB.prepare(`DELETE FROM history WHERE child_id IN (SELECT id FROM children WHERE family_id = ?)`).bind(familyId),
      c.env.DB.prepare(`DELETE FROM rewards WHERE family_id = ?`).bind(familyId),
      c.env.DB.prepare(`DELETE FROM rules WHERE family_id = ?`).bind(familyId),
      c.env.DB.prepare(`DELETE FROM children WHERE family_id = ?`).bind(familyId),
      // 将该家庭所有的家长踢出 (解除绑定)
      c.env.DB.prepare(`UPDATE users SET family_id = NULL, role = 'viewer' WHERE family_id = ?`).bind(familyId),
      // 最后删除家庭本身
      c.env.DB.prepare(`DELETE FROM families WHERE id = ?`).bind(familyId)
    ];

    await c.env.DB.batch(stmts);
    return c.json({ success: true });
  } catch (e) {
    console.error(`[System Error] 解散家庭失败:`, e);
    return c.json({ success: false, errorCode: 'ERR_SYSTEM_ERROR' }, 500);
  }
});

export default family;