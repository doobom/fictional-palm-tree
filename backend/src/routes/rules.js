// backend/src/routes/rules.js  (原 goals.js)
import { Hono } from 'hono';
import { nanoid } from 'nanoid';
import { getRulesTemplates } from '../locales/index.js';

const rules = new Hono(); // 🌟 变量名改为 rules

/**
 * 1. 获取规则列表 (增强版：支持统计特定孩子的今日使用次数)
 */
rules.get('/', async (c) => {
  const user = c.get('user');
  const childId = c.req.query('childId'); // 🌟 从 Query 参数获取 childId

  try {
    // 1. 获取家庭时区（默认上海）
    const family = await c.env.DB.prepare(`SELECT timezone FROM families WHERE id = ?`)
      .bind(user.familyId).first();
    const tz = family?.timezone || 'Asia/Shanghai';

    // 2. 计算该时区下的“今日零点”时间戳 (ISO 格式)
    // 简单处理：获取当前服务器时间，按时区偏移计算出当日起始字符串
    const now = new Date();
    const localDateStr = now.toLocaleDateString('sv-SE', { timeZone: tz }); // YYYY-MM-DD
    const dayStart = `${localDateStr}T00:00:00Z`; 

    let results;
    if (childId) {
      // 🌟 核心：联表查询 scores 统计该孩子今日针对每条 rule 的使用次数
      const query = await c.env.DB.prepare(`
        SELECT r.*, 
               (SELECT COUNT(*) FROM history h 
                WHERE h.rule_id = r.id 
                AND h.child_id = ? 
                AND h.created_at >= ?) as today_usage
        FROM rules r
        WHERE r.family_id = ? AND (r.child_id IS NULL OR r.child_id = ?)
        ORDER BY r.created_at DESC
      `).bind(childId, dayStart, user.familyId, childId).all();
      results = query.results;
    } else {
      const query = await c.env.DB.prepare(`
        SELECT * FROM rules WHERE family_id = ? ORDER BY created_at DESC
      `).bind(user.familyId).all();
      results = query.results;
    }

    return c.json({ success: true, data: results });
  } catch (error) {
    console.error(`[DB Error] Fetch rules failed:`, error.message);
    return c.json({ success: false, errorMessage: error.message }, 500);
  }
});

// 2. 获取模板
rules.get('/templates/all', async (c) => {
  const user = c.get('user');
  return c.json({ success: true, data: getRulesTemplates(user.locale || 'zh-CN') });
});

// 3. 批量导入
rules.post('/manage/batch-import', async (c) => {
  const user = c.get('user');
  const { childId, templates } = await c.req.json();
  const safeChildId = (childId && childId.trim() !== '') ? childId : null;
  try {
    const stmts = templates.map(t => {
      return c.env.DB.prepare(`
        INSERT INTO rules (id, family_id, name, emoji, points, child_id, status)
        VALUES (?, ?, ?, ?, ?, ?, 'active')
      `).bind(nanoid(10), user.familyId, t.name, t.emoji || '⭐', t.points, safeChildId);
    });
    await c.env.DB.batch(stmts);
    return c.json({ success: true });
  } catch (error) {
    return c.json({ success: false, errorCode: 'ERR_SYSTEM_ERROR' }, 500);
  }
});

// 4. 新增/更新 (Upsert)
/**
 * 4. 新增或更新规则/任务 (Upsert)
 */
rules.post('/manage/upsert', async (c) => {
  const user = c.get('user');
  // 🌟 接收前端传来的 dailyLimit
  const { id, name, emoji, points, childId, status, dailyLimit } = await c.req.json();

  if (user.role !== 'admin' && user.role !== 'superadmin') {
    return c.json({ success: false, errorCode: 'ERR_FORBIDDEN' }, 403);
  }

  if (!name || points === undefined) {
    return c.json({ success: false, errorCode: 'ERR_MISSING_PARAMS' }, 400);
  }

  const safeChildId = (childId && childId.trim() !== '') ? childId : null;
  // 🌟 安全转换 daily_limit，确保是数字，默认为 0（不限）
  const safeDailyLimit = parseInt(dailyLimit, 10) || 0;

  try {
    if (id) {
      await c.env.DB.prepare(`
        UPDATE rules 
        SET name = ?, emoji = ?, points = ?, child_id = ?, 
            status = COALESCE(?, status), daily_limit = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND family_id = ?
      `).bind(name, emoji || '⭐', points, safeChildId, status || 'active', safeDailyLimit, id, user.familyId).run();
      
      return c.json({ success: true, message: 'Updated successfully' });
    } else {
      const newId = nanoid(10);
      await c.env.DB.prepare(`
        INSERT INTO rules (id, family_id, name, emoji, points, child_id, status, daily_limit)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(newId, user.familyId, name, emoji || '⭐', points, safeChildId, status || 'active', safeDailyLimit).run();
      
      return c.json({ success: true, data: { id: newId } });
    }
  } catch (error) {
    console.error(`[DB Error] Upsert rule failed:`, error.message);
    return c.json({ success: false, errorCode: 'ERR_SYSTEM_ERROR', errorMessage: error.message }, 500);
  }
});

// 5. 删除
rules.delete('/manage/:id', async (c) => {
  const user = c.get('user');
  try {
    await c.env.DB.prepare(`DELETE FROM rules WHERE id = ? AND family_id = ?`).bind(c.req.param('id'), user.familyId).run();
    return c.json({ success: true });
  } catch (error) {
    return c.json({ success: false, errorCode: 'ERR_SYSTEM_ERROR' }, 500);
  }
});

export default rules;