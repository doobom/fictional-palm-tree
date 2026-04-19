// backend/src/routes/achievements.js
import { Hono } from 'hono';
import { nanoid } from 'nanoid';
import { ACHIEVEMENTS_META } from '../queues/scoreHandler.js'; // 🌟 直接复用元数据
import { sendTgMessage } from '../utils/telegram.js';

const achievements = new Hono();

// 🌟 1. 严格对齐 scoreHandler.js 中的 key，并设定目标阈值
const ACHIEVEMENT_RULES = {
  'first_blood': { target: 1 },
  'score_100': { target: 100 },
  'score_500': { target: 500 },
  'score_1000': { target: 1000 },
  'first_redeem': { target: 1 },
  'redeem_5': { target: 5 },
  'task_10': { target: 10 },
  'task_50': { target: 50 }
};

/**
 * 1. 获取成就墙与清除红点
 */
achievements.get('/', async (c) => {
  const user = c.get('user');
  const childId = c.req.query('childId');

  if (!childId) return c.json({ success: false, errorCode: 'ERR_MISSING_PARAMS' }, 400);

  try {
    await c.env.DB.prepare(`UPDATE children SET has_new_achievement = 0 WHERE id = ? AND family_id = ?`)
      .bind(childId, user.familyId).run();

    const { results } = await c.env.DB.prepare(`
      SELECT achievement_key, unlocked, progress, unlocked_at, is_manual, manual_name, manual_emoji
      FROM achievements WHERE child_id = ? AND family_id = ?
    `).bind(childId, user.familyId).all();

    const dbStateMap = new Map();
    results.forEach(r => dbStateMap.set(r.achievement_key, r));

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
    return c.json({ success: false, errorMessage: error.message }, 500);
  }
});

/**
 * 2. 手动颁发勋章
 */
achievements.post('/manual-issue', async (c) => {
  const user = c.get('user');
  const { childId, name, emoji } = await c.req.json();

  if (user.userType !== 'parent' || user.role === 'viewer') {
    return c.json({ success: false, errorCode: 'ERR_FORBIDDEN' }, 403);
  }

  try {
    const achievementId = crypto.randomUUID();
    const achievementKey = `manual_${Date.now()}`;

    await c.env.DB.prepare(`
      INSERT INTO achievements (id, family_id, child_id, achievement_key, unlocked, unlocked_at, is_manual, manual_name, manual_emoji)
      VALUES (?, ?, ?, ?, 1, CURRENT_TIMESTAMP, 1, ?, ?)
    `).bind(achievementId, user.familyId, childId, achievementKey, name, emoji).run();

    await c.env.DB.prepare(`UPDATE children SET has_new_achievement = 1 WHERE id = ?`).bind(childId).run();

    const doId = c.env.FAMILY_MANAGER.idFromName(user.familyId);
    const doObj = c.env.FAMILY_MANAGER.get(doId);
    await doObj.fetch(new Request(`http://do/internal/broadcast-achievement`, {
      method: 'POST',
      body: JSON.stringify({ childId, hasNew: true, achievements: [{ name, emoji, is_manual: true }] })
    }));

    c.executionCtx.waitUntil((async () => {
      const child = await c.env.DB.prepare(`SELECT name FROM children WHERE id = ?`).bind(childId).first();
      const family = await c.env.DB.prepare(`SELECT tg_group_id FROM families WHERE id = ?`).bind(user.familyId).first();
      
      if (family?.tg_group_id && c.env.BOT_TOKEN) {
        const msg = `🎖️ <b>荣誉颁发！</b>\n\n家长刚刚为 <b>${child.name}</b> 颁发了一枚专属勋章：\n\n${emoji} <b>${name}</b>\n\n棒棒哒，继续保持哦！✨`;
        await sendTgMessage(c.env.BOT_TOKEN, family.tg_group_id, msg);
      }
    })());

    return c.json({ success: true });
  } catch (e) {
    return c.json({ success: false, errorMessage: e.message }, 500);
  }
});

/**
 * 3. 获取成就墙 (用于内部调用)
 */
achievements.get('/:childId', async (c) => {
  const user = c.get('user');
  const childId = c.req.param('childId');
  if (!childId) return c.json({ success: false, errorCode: 'ERR_MISSING_PARAMS' }, 400);

  try {
    const { results } = await c.env.DB.prepare(`SELECT achievement_key, progress, unlocked, unlocked_at FROM achievements WHERE child_id = ? AND family_id = ?`).bind(childId, user.familyId).all();
    return c.json({ success: true, data: results });
  } catch (error) {
    return c.json({ success: false, errorCode: 'ERR_SYSTEM_ERROR' }, 500);
  }
});

/**
 * 🌟 核心辅助函数：检查并更新成就
 */
export async function checkAchievementUnlock(db, env, familyId, childId) {
  try {
    // 🌟 2. 修复 SQL：补充获取 routine_logs 的完成次数 (task_count)
    const child = await db.prepare(`
      SELECT name, score_gained, 
      (SELECT COUNT(*) FROM redemptions WHERE child_id = ? AND status = 'approved') as redeem_count,
      (SELECT COUNT(*) FROM routine_logs WHERE child_id = ? AND status = 'completed') as task_count
      FROM children WHERE id = ?
    `).bind(childId, childId, childId).first();

    if (!child) return;

    const existing = await db.prepare(`SELECT achievement_key FROM achievements WHERE child_id = ? AND unlocked = 1`).bind(childId).all();
    const alreadyUnlockedKeys = new Set(existing.results.map(r => r.achievement_key));

    // 🌟 3. 严格映射到全新的规则 key
    const stats = {
      'first_blood': child.score_gained >= 1 ? 1 : 0,
      'score_100': child.score_gained,
      'score_500': child.score_gained,
      'score_1000': child.score_gained,
      'first_redeem': child.redeem_count,
      'redeem_5': child.redeem_count,
      'task_10': child.task_count,
      'task_50': child.task_count
    };

    const newlyUnlockedKeys = [];

    for (const [key, currentVal] of Object.entries(stats)) {
      const rule = ACHIEVEMENT_RULES[key];
      if (!rule) continue;

      const progress = Math.min(Math.floor((currentVal / rule.target) * 100), 100);
      const isUnlocked = progress >= 100 ? 1 : 0;
      
      if (isUnlocked === 1 && !alreadyUnlockedKeys.has(key)) {
        newlyUnlockedKeys.push(key);
      }
      
      await db.prepare(`
        INSERT INTO achievements (id, family_id, child_id, achievement_key, progress, unlocked, unlocked_at)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, CASE WHEN ?6 = 1 THEN CURRENT_TIMESTAMP ELSE NULL END)
        ON CONFLICT(child_id, achievement_key) DO UPDATE SET
          progress = MAX(progress, excluded.progress),
          unlocked = CASE WHEN unlocked = 1 THEN 1 ELSE excluded.unlocked END,
          unlocked_at = CASE WHEN unlocked = 0 AND excluded.unlocked = 1 THEN CURRENT_TIMESTAMP ELSE unlocked_at END
      `).bind(nanoid(12), familyId, childId, key, progress, isUnlocked).run();
    }

    if (newlyUnlockedKeys.length > 0) {
      await db.prepare(`UPDATE children SET has_new_achievement = 1 WHERE id = ?`).bind(childId).run();

      if (env.FAMILY_MANAGER) {
        const doId = env.FAMILY_MANAGER.idFromName(familyId);
        const doObj = env.FAMILY_MANAGER.get(doId);
        await doObj.fetch(new Request(`http://do/internal/broadcast-achievement`, {
          method: 'POST',
          body: JSON.stringify({ childId, hasNew: true })
        }));
      }

      if (env.BOT_TOKEN) {
        const family = await db.prepare(`SELECT tg_group_id FROM families WHERE id = ?`).bind(familyId).first();
        if (family?.tg_group_id) {
          // 🌟 4. 直接提取 ACHIEVEMENTS_META 中的 Emoji 和中文描述
          const unlockedNames = newlyUnlockedKeys.map(k => {
            const meta = ACHIEVEMENTS_META.find(m => m.key === k);
            return meta ? `${meta.emoji} <b>${meta.name}</b> - ${meta.desc}` : k;
          }).join('\n✨ ');

          const msg = `🎉 <b>解锁系统新成就！</b>\n\n👦 <b>${child.name}</b> 的努力得到了回报，刚刚达成了：\n\n✨ ${unlockedNames}\n\n快去系统里查看点亮的勋章吧！🏅`;
          await sendTgMessage(env.BOT_TOKEN, family.tg_group_id, msg);
        }
      }
    }

  } catch (error) {
    console.error(`[System Error] 异步检查成就解锁失败. Child: ${childId}, Error:`, error);
  }
}

export default achievements;