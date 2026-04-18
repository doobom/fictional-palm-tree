// backend/src/routes/system.js
import { Hono } from 'hono';
import { notifyRootAdmins, sendTgDocument } from '../utils/telegram.js';

const system = new Hono();

// 1. 意见反馈接口
system.post('/feedback', async (c) => {
  const user = c.get('user');
  const { text } = await c.req.json();
  if (!text) return c.json({ success: false, errorMessage: '内容不能为空' }, 400);

  // 查找该用户的 Telegram ID
  const auth = await c.env.DB.prepare(`SELECT provider_uid FROM auth_bindings WHERE internal_id = ? AND provider = 'telegram'`).bind(user.id).first();
  const tgId = auth?.provider_uid || '未绑定TG';

  try {
    const message = `🔔 收到新反馈\n\n👤 用户: ${user.nick_name || user.id}\n🏠 家庭 ID: ${user.familyId}\n\n📝 内容：\n${text}\n\n👉 快捷回复: \`/reply ${tgId} 你的回复内容\``;
    
    // 调用封装好的方法发送给所有超管
    await notifyRootAdmins(message, c.env);
    
    return c.json({ success: true });
  } catch (error) {
    console.error('发送反馈失败', error);
    return c.json({ success: false, errorMessage: '反馈提交失败' }, 500);
  }
});

/**
 * 2. 🌟 导出家庭数据 (备份)
 */
system.get('/export', async (c) => {
  const user = c.get('user');
  const db = c.env.DB;
  const fId = user.familyId;

  try {
    // 聚合查询所有核心业务表
    const [children, rules, rewards, goals, routines, routineLogs, history, approvals] = await Promise.all([
      db.prepare('SELECT * FROM children WHERE family_id = ?').bind(fId).all(),
      db.prepare('SELECT * FROM rules WHERE family_id = ?').bind(fId).all(),
      db.prepare('SELECT * FROM rewards WHERE family_id = ?').bind(fId).all(),
      db.prepare('SELECT * FROM goals WHERE family_id = ?').bind(fId).all(),
      db.prepare('SELECT * FROM routines WHERE family_id = ?').bind(fId).all(),
      db.prepare('SELECT * FROM routine_logs WHERE family_id = ?').bind(fId).all(),
      db.prepare('SELECT * FROM history WHERE family_id = ?').bind(fId).all(),
      db.prepare('SELECT * FROM approvals WHERE family_id = ?').bind(fId).all(),
    ]);

    const backupData = {
      version: "1.0",
      timestamp: new Date().toISOString(),
      familyId: fId,
      data: {
        children: children.results,
        rules: rules.results,
        rewards: rewards.results,
        goals: goals.results,
        routines: routines.results,
        routine_logs: routineLogs.results,
        history: history.results,
        approvals: approvals.results
      }
    };
    return c.json({ success: true, data: backupData });
  } catch (e) {
    return c.json({ success: false, errorMessage: e.message }, 500);
  }
});
/**
 * 🌟 3. 新增：专门给 Telegram 环境用的导出接口
 * 直接将 JSON 备份文件发送到用户的 Telegram 聊天窗口
 */
system.post('/export-telegram', async (c) => {
  const user = c.get('user');
  const { tgUserId } = await c.req.json();
  if (!tgUserId) return c.json({ success: false, errorMessage: '缺少 Telegram User ID' }, 400);

  const db = c.env.DB;
  const fId = user.familyId;

  try {
    const [children, rules, rewards, goals, routines, routineLogs, history, approvals] = await Promise.all([
      db.prepare('SELECT * FROM children WHERE family_id = ?').bind(fId).all(),
      db.prepare('SELECT * FROM rules WHERE family_id = ?').bind(fId).all(),
      db.prepare('SELECT * FROM rewards WHERE family_id = ?').bind(fId).all(),
      db.prepare('SELECT * FROM goals WHERE family_id = ?').bind(fId).all(),
      db.prepare('SELECT * FROM routines WHERE family_id = ?').bind(fId).all(),
      db.prepare('SELECT * FROM routine_logs WHERE family_id = ?').bind(fId).all(),
      db.prepare('SELECT * FROM history WHERE family_id = ?').bind(fId).all(),
      db.prepare('SELECT * FROM approvals WHERE family_id = ?').bind(fId).all(),
    ]);

    const backupData = {
      version: "1.0",
      timestamp: new Date().toISOString(),
      familyId: fId,
      data: {
        children: children.results, rules: rules.results, rewards: rewards.results,
        goals: goals.results, routines: routines.results, routine_logs: routineLogs.results,
        history: history.results, approvals: approvals.results
      }
    };

    const jsonStr = JSON.stringify(backupData, null, 2);
    const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const fileName = `FamilyPoints_backup_${fId}_${dateStr}.json`;
    const caption = '📦 您的家庭积分系统数据备份已经生成！\n您可以妥善保存此文件，随时在设置中上传恢复。';
    
    // 将字符串转换为 Blob
    const blob = new Blob([jsonStr], { type: 'application/json' });

    // 🌟 调用封装好的方法直接发送文件
    await sendTgDocument(tgUserId, blob, fileName, caption, c.env.BOT_TOKEN);

    return c.json({ success: true });
  } catch (e) {
    console.error('Export to TG Error:', e);
    return c.json({ success: false, errorMessage: e.message }, 500);
  }
});

/**
 * 4. 🌟 导入并覆盖恢复家庭数据
 */
system.post('/import', async (c) => {
  const user = c.get('user');
  // 安全拦截：只有超管/管理员能恢复数据
  if (user.role !== 'admin' && user.role !== 'superadmin') {
    return c.json({ success: false, errorMessage: '权限不足' }, 403);
  }

  const { backupData } = await c.req.json();
  if (!backupData || !backupData.data) return c.json({ success: false, errorMessage: '无效的备份数据' }, 400);

  const db = c.env.DB;
  const fId = user.familyId;

  try {
    // 1. 准备 Delete 语句（清理现有数据）
    const deleteStmts = [
      db.prepare('DELETE FROM approvals WHERE family_id = ?').bind(fId),
      db.prepare('DELETE FROM routine_logs WHERE family_id = ?').bind(fId),
      db.prepare('DELETE FROM routines WHERE family_id = ?').bind(fId),
      db.prepare('DELETE FROM history WHERE family_id = ?').bind(fId),
      db.prepare('DELETE FROM goals WHERE family_id = ?').bind(fId),
      db.prepare('DELETE FROM rewards WHERE family_id = ?').bind(fId),
      db.prepare('DELETE FROM rules WHERE family_id = ?').bind(fId),
      db.prepare('DELETE FROM children WHERE family_id = ?').bind(fId)
    ];

    // 2. 准备 Insert 语句
    const insertStmts = [];
    const buildInsert = (table, rows) => {
      for (const row of rows) {
        row.family_id = fId; // 强制替换为当前操作家庭的ID，防止跨家庭污染
        const keys = Object.keys(row);
        const values = Object.values(row);
        const placeholders = keys.map(() => '?').join(', ');
        insertStmts.push(db.prepare(`INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`).bind(...values));
      }
    };

    const data = backupData.data;
    if (data.children) buildInsert('children', data.children);
    if (data.rules) buildInsert('rules', data.rules);
    if (data.rewards) buildInsert('rewards', data.rewards);
    if (data.goals) buildInsert('goals', data.goals);
    if (data.routines) buildInsert('routines', data.routines);
    if (data.routine_logs) buildInsert('routine_logs', data.routine_logs);
    if (data.history) buildInsert('history', data.history);
    if (data.approvals) buildInsert('approvals', data.approvals);

    // 3. 🌟 分块执行事务 (防止触碰 D1 单次 batch 最多 100 条的限制)
    const allStmts = [...deleteStmts, ...insertStmts];
    const MAX_BATCH = 80;
    
    for (let i = 0; i < allStmts.length; i += MAX_BATCH) {
      await db.batch(allStmts.slice(i, i + MAX_BATCH));
    }

    return c.json({ success: true });
  } catch (e) {
    return c.json({ success: false, errorMessage: `数据恢复失败: ${e.message}` }, 500);
  }
});

export default system;