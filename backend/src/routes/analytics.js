// src/routes/analytics.js
import { Hono } from 'hono';
import { getSqliteTimezoneModifier } from '../utils/time';

const analytics = new Hono();

/**
 * 获取最近 7 天的积分趋势 (赚取 vs 消费)
 */
analytics.get('/trend', async (c) => {
  const user = c.get('user');
  const childId = c.req.query('childId');
  const days = parseInt(c.req.query('days')) || 7;

  if (!childId) {
    return c.json({ success: false, errorCode: 'ERR_MISSING_PARAMS' }, 400);
  }

  try {
    // 1. 获取家庭时区，计算 SQLite 偏移量 (对齐你之前在 rules.js 里的逻辑)
    const family = await c.env.DB.prepare(`SELECT timezone FROM families WHERE id = ?`).bind(user.familyId).first();
    const tzName = family?.timezone || 'Asia/Shanghai';
    
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', { timeZone: tzName, timeZoneName: 'longOffset' });
    const offsetPart = formatter.formatToParts(now).find(p => p.type === 'timeZoneName')?.value || 'GMT+08:00';
    const sqliteOffset = offsetPart.replace('GMT', '');

    // 2. 核心 SQL：按日期分组，分别 SUM 正数和负数，严格排除已撤回的记录
    const query = `
      SELECT 
        date(created_at, ?) as date,
        SUM(CASE WHEN points > 0 THEN points ELSE 0 END) as earned,
        SUM(CASE WHEN points < 0 THEN ABS(points) ELSE 0 END) as spent
      FROM history
      WHERE family_id = ? 
        AND child_id = ? 
        AND is_revoked = 0 
        AND created_at >= datetime('now', ?, ?)
      GROUP BY date(created_at, ?)
      ORDER BY date ASC
    `;

    const dayModifier = `-${days} days`;
    const { results } = await c.env.DB.prepare(query)
      .bind(sqliteOffset, user.familyId, childId, sqliteOffset, dayModifier, sqliteOffset)
      .all();

    // 3. 补全最近 7 天的数据（防止某天没数据导致图表断层）
    const trendData = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dateStr = new Intl.DateTimeFormat('en-CA', { timeZone: tzName }).format(d); // YYYY-MM-DD
      
      const found = results.find(r => r.date === dateStr);
      trendData.push({
        date: dateStr.slice(5), // 只保留 MM-DD 方便在手机上显示
        earned: found ? found.earned : 0,
        spent: found ? found.spent : 0
      });
    }

    return c.json({ success: true, data: trendData });
  } catch (error) {
    console.error(`[DB Error] Fetch analytics trend failed:`, error.message);
    return c.json({ success: false, errorMessage: error.message }, 500);
  }
});

/**
 * 家庭全员对比统计
 */
analytics.get('/family-comparison', async (c) => {
  const user = c.get('user');
  const days = parseInt(c.req.query.days) || 7;

  try {
    const family = await c.env.DB.prepare(`SELECT timezone FROM families WHERE id = ?`).bind(user.familyId).first();
    const tzName = family?.timezone || 'Asia/Shanghai';
    
    // 动态计算时区偏移
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', { timeZone: tzName, timeZoneName: 'longOffset' });
    const offsetPart = formatter.formatToParts(now).find(p => p.type === 'timeZoneName')?.value || 'GMT+08:00';
    const sqliteOffset = offsetPart.replace('GMT', '');

    const dayModifier = `-${days} days`;

    // 🌟 SQL：按孩子分组查询最近 X 天的积分总和
    const query = `
      SELECT 
        c.id, c.name, c.avatar,
        SUM(CASE WHEN h.points > 0 THEN h.points ELSE 0 END) as total_earned,
        SUM(CASE WHEN h.points < 0 THEN ABS(h.points) ELSE 0 END) as total_spent,
        (SUM(CASE WHEN h.points > 0 THEN h.points ELSE 0 END) - SUM(CASE WHEN h.points < 0 THEN ABS(h.points) ELSE 0 END)) as net_score
      FROM children c
      LEFT JOIN history h ON c.id = h.child_id 
        AND h.is_revoked = 0 
        AND h.family_id = ? 
        AND h.created_at >= datetime('now', ?, ?)
      WHERE c.family_id = ?
      GROUP BY c.id
      ORDER BY net_score DESC
    `;

    const { results } = await c.env.DB.prepare(query)
      .bind(user.familyId, sqliteOffset, dayModifier, user.familyId)
      .all();

    return c.json({ success: true, data: results });
  } catch (error) {
    return c.json({ success: false, errorMessage: error.message }, 500);
  }
});
/**
 * 1. 孩子积分排行榜 (本周)
 */
analytics.get('/ranking/weekly', async (c) => {
  const user = c.get('user');
  // 假设 user.timezone 已经在 auth.js 中查出并挂载，如果没有则默认上海
  const tzModifier = getSqliteTimezoneModifier(user.timezone || 'Asia/Shanghai');

  try {
    // 🌟 核心修改：在 SQLite 中加上 tzModifier 修正当地时间
    const query = `
      SELECT 
        c.id as child_id,
        c.name,
        c.avatar,
        COALESCE(SUM(h.points), 0) as weekly_points
      FROM children c
      LEFT JOIN history h ON c.id = h.child_id 
        AND h.type = 'plus' 
        AND h.reverted = 0
        -- 'weekday 0' 是周日。这里将 created_at 转换为当地时间后再对比
        AND datetime(h.created_at, ?) >= date('now', ?, 'weekday 0', '-6 days')
      WHERE c.family_id = ?
      GROUP BY c.id
      ORDER BY weekly_points DESC
    `;

    const { results } = await c.env.DB.prepare(query)
      .bind(tzModifier, tzModifier, user.familyId)
      .all();

    return c.json({ success: true, data: results });
  } catch (error) {
    console.error(`[System Error] 获取本周排行榜失败. Family: ${user.familyId}, Error:`, error);
    return c.json({ success: false, errorCode: 'ERR_SYSTEM_ERROR', errorMessage: 'Failed to fetch weekly ranking' }, 500);
  }
});

/**
 * 2. 积分趋势统计 (近 7 天)
 */
analytics.get('/trends/7days', async (c) => {
  const user = c.get('user');
  const tzModifier = getSqliteTimezoneModifier(user.timezone || 'Asia/Shanghai');

  try {
    // 🌟 核心修改：按修正后的当地时间进行 GROUP BY 分组
    const query = `
      SELECT 
        log_date,
        SUM(gained) as total_gained,
        SUM(spent) as total_spent
      FROM (
        SELECT 
          date(created_at, ?) as log_date, 
          points as gained, 
          0 as spent 
        FROM history 
        WHERE family_id = ? AND type = 'plus' AND reverted = 0
          AND datetime(created_at, ?) >= date('now', ?, '-7 days')
        
        UNION ALL
        
        SELECT 
          date(created_at, ?) as log_date, 
          0 as gained, 
          cost as spent 
        FROM redemptions 
        WHERE family_id = ? AND status = 'approved'
          AND datetime(created_at, ?) >= date('now', ?, '-7 days')
      )
      GROUP BY log_date
      ORDER BY log_date ASC
    `;

    const { results } = await c.env.DB.prepare(query)
      .bind(
        tzModifier, user.familyId, tzModifier, tzModifier, 
        tzModifier, user.familyId, tzModifier, tzModifier
      )
      .all();

    return c.json({ success: true, data: results });
  } catch (error) {
    console.error(`[System Error] 获取 7 天趋势失败. Family: ${user.familyId}, Error:`, error);
    return c.json({ success: false, errorCode: 'ERR_SYSTEM_ERROR', errorMessage: 'Failed to fetch trends' }, 500);
  }
});

/**
 * 3. 规则触发分布
 */
analytics.get('/rules/distribution', async (c) => {
  const user = c.get('user');

  try {
    const query = `
      SELECT 
        r.id as rule_id,
        r.emoji,
        COUNT(h.id) as trigger_count,
        SUM(h.points) as total_points
      FROM history h
      JOIN rules r ON h.rule_id = r.id
      WHERE h.family_id = ? AND h.reverted = 0
      GROUP BY h.rule_id
      ORDER BY trigger_count DESC
      LIMIT 10
    `;

    const { results } = await c.env.DB.prepare(query).bind(user.familyId).all();
    
    // 注意：这里的 r.name 被我去掉了，建议在 rules 表里存多语言 key，
    // 或者前端拿到 rule_id 后自行匹配本地配置的名称
    return c.json({ success: true, data: results });
  } catch (error) {
    console.error(`[System Error] 获取规则分布失败. Family: ${user.familyId}, Error:`, error);
    return c.json({ success: false, errorCode: 'ERR_SYSTEM_ERROR', errorMessage: 'Failed to fetch rules distribution' }, 500);
  }
});

export default analytics;