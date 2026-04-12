// src/routes/achievements.js
import { Hono } from 'hono';
import { nanoid } from 'nanoid';
import { ACHIEVEMENTS_META } from '../queues/scoreHandler.js';

const achievements = new Hono();

// 成就定义配置 (🌟 多语言改造：移除 hardcode 的中文 name，只保留核心判定规则)
// 前端拿到 achievement_key 后，自己使用 i18n 翻译名称和描述
const ACHIEVEMENT_RULES = {
  'first_plus': { target: 1 },
  'points_100': { target: 100 },
  'points_1000': { target: 1000 },
  'redeem_first': { target: 1 }
};

achievements.get('/', async (c) => {
  const user = c.get('user');
  const childId = c.req.query('childId');

  if (!childId) {
    return c.json({ success: false, errorCode: 'ERR_MISSING_PARAMS' }, 400);
  }

  try {
    // 🌟 A. 物理清除数据库中的红点标记
    await c.env.DB.prepare(`UPDATE children SET has_new_achievement = 0 WHERE id = ? AND family_id = ?`)
      .bind(childId, user.familyId).run();

    // B. 查询成就记录
    const { results } = await c.env.DB.prepare(`
      SELECT achievement_key, unlocked, progress, unlocked_at, is_manual, manual_name, manual_emoji
      FROM achievements WHERE child_id = ? AND family_id = ?
    `).bind(childId, user.familyId).all();

    const dbStateMap = new Map();
    results.forEach(r => dbStateMap.set(r.achievement_key, r));

    // 将预设字典和你数据库里的状态合并
    const data = ACHIEVEMENTS_META.map(meta => {
      const dbInfo = dbStateMap.get(meta.key);
      return {
        ...meta,
        unlocked: dbInfo ? dbInfo.unlocked === 1 : false,
        progress: dbInfo ? dbInfo.progress : 0,
        unlocked_at: dbInfo ? dbInfo.unlocked_at : null
      };
    });

    return c.json({ success: true, data });
  } catch (error) {
    console.error(`[DB Error] Fetch achievements failed:`, error.message);
    return c.json({ success: false, errorMessage: error.message }, 500);
  }
});
/**
 * 2. 手动颁发勋章：严格权限隔离
 */
achievements.post('/manual-issue', async (c) => {
  const user = c.get('user');
  const { childId, name, emoji } = await c.req.json();

  // 🌟 权限隔离：仅允许非 viewer 角色的家长操作
  if (user.userType !== 'parent' || user.role === 'viewer') {
    return c.json({ success: false, errorCode: 'ERR_FORBIDDEN' }, 403);
  }

  try {
    const achievementId = crypto.randomUUID();
    const achievementKey = `manual_${Date.now()}`;

    // A. 写入成就表
    await c.env.DB.prepare(`
      INSERT INTO achievements (id, family_id, child_id, achievement_key, unlocked, unlocked_at, is_manual, manual_name, manual_emoji)
      VALUES (?, ?, ?, ?, 1, CURRENT_TIMESTAMP, 1, ?, ?)
    `).bind(achievementId, user.familyId, childId, achievementKey, name, emoji).run();

    // 🌟 B. 标记红点
    await c.env.DB.prepare(`UPDATE children SET has_new_achievement = 1 WHERE id = ?`).bind(childId).run();

    // C. 通过 DO 实时通知全家
    const doId = c.env.FAMILY_MANAGER.idFromName(user.familyId);
    const doObj = c.env.FAMILY_MANAGER.get(doId);
    await doObj.fetch(new Request(`${new URL(c.req.url).origin}/internal/broadcast-achievement`, {
      method: 'POST',
      body: JSON.stringify({ 
        childId, 
        hasNew: true, // 告知前端需要显示红点
        achievements: [{ name, emoji, is_manual: true }] 
      })
    }));

    return c.json({ success: true });
  } catch (e) {
    return c.json({ success: false, errorMessage: e.message }, 500);
  }
});
/**
 * 1. 获取成就墙
 * GET /api/achievements/:childId
 */
achievements.get('/:childId', async (c) => {
  const user = c.get('user');
  const childId = c.req.param('childId');

  if (!childId) {
    console.warn(`[Business Warn] 获取成就墙失败: 缺少 childId. User: ${user.internalId}`);
    return c.json({ success: false, errorCode: 'ERR_MISSING_PARAMS', errorMessage: 'Missing childId' }, 400);
  }

  try {
    const { results } = await c.env.DB.prepare(`
      SELECT achievement_key, progress, unlocked, unlocked_at 
      FROM achievements 
      WHERE child_id = ? AND family_id = ?
    `).bind(childId, user.familyId).all();

    return c.json({ success: true, data: results });
  } catch (error) {
    console.error(`[System Error] 获取成就墙数据库查询失败. Family: ${user.familyId}, Error:`, error);
    return c.json({ success: false, errorCode: 'ERR_SYSTEM_ERROR', errorMessage: 'Failed to fetch achievements' }, 500);
  }
});

/**
 * 内部辅助函数：检查并更新成就 (通常被 scores.js 或 rewards.js 异步调用)
 * 注意：这是内部函数，不返回 HTTP Response，但需要记录日志
 */
export async function checkAchievementUnlock(db, familyId, childId) {
  try {
    const child = await db.prepare(`
      SELECT score_gained, 
      (SELECT COUNT(*) FROM redemptions WHERE child_id = ? AND status = 'approved') as redeem_count
      FROM children WHERE id = ?
    `).bind(childId, childId).first();

    if (!child) return;

    const stats = {
      'first_plus': child.score_gained >= 1 ? 1 : 0,
      'points_100': child.score_gained,
      'points_1000': child.score_gained,
      'redeem_first': child.redeem_count
    };

    for (const [key, currentVal] of Object.entries(stats)) {
      const rule = ACHIEVEMENT_RULES[key];
      if (!rule) continue;

      const progress = Math.min(Math.floor((currentVal / rule.target) * 100), 100);
      const isUnlocked = progress >= 100 ? 1 : 0;
      
      await db.prepare(`
        INSERT INTO achievements (id, family_id, child_id, achievement_key, progress, unlocked, unlocked_at)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, CASE WHEN ?6 = 1 THEN CURRENT_TIMESTAMP ELSE NULL END)
        ON CONFLICT(child_id, achievement_key) DO UPDATE SET
          progress = MAX(progress, excluded.progress),
          unlocked = CASE WHEN unlocked = 1 THEN 1 ELSE excluded.unlocked END,
          unlocked_at = CASE WHEN unlocked = 0 AND excluded.unlocked = 1 THEN CURRENT_TIMESTAMP ELSE unlocked_at END
      `).bind(nanoid(12), familyId, childId, key, progress, isUnlocked).run();
    }
  } catch (error) {
    // 异步任务失败不影响主流程，但必须在 Worker 日志里留下痕迹
    console.error(`[System Error] 异步检查成就解锁失败. Child: ${childId}, Error:`, error);
  }
}

export default achievements;