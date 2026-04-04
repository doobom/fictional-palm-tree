// src/routes/achievements.js
import { Hono } from 'hono';
import { nanoid } from 'nanoid';

const achievements = new Hono();

// 成就定义配置 (🌟 多语言改造：移除 hardcode 的中文 name，只保留核心判定规则)
// 前端拿到 achievement_key 后，自己使用 i18n 翻译名称和描述
const ACHIEVEMENT_RULES = {
  'first_plus': { target: 1 },
  'points_100': { target: 100 },
  'points_1000': { target: 1000 },
  'redeem_first': { target: 1 }
};

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