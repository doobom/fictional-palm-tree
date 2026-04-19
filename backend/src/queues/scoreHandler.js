// backend/src/queues/scoreHandler.js
import { nanoid } from 'nanoid';
import { sendTgMessage } from '../utils/telegram.js';
import { checkAchievementUnlock } from '../routes/achievements.js'; // 🌟 新增引入

/**
 * 核心处理器：处理积分变动后的后续逻辑
 */
/*
export async function handleScoreChangeTasks(data, env) {
  const { childId, familyId, points, operatorId } = data;

  // 1. 更新目标 (Goals) 进度
  await updateGoalsProgress(childId, familyId, env);

  // 2. 检查成就 (Achievements) 解锁
  await checkAchievements(childId, familyId, env);
}
*/
// ⚠️ 注意：还需要在 handleScoreChangeTasks 中修改传参
export async function handleScoreChangeTasks(data, env) {
  const { childId, familyId } = data;

  // 🌟 修改：把完整的 data 传给目标更新函数，因为它需要 data.points
  await updateGoalsProgress(data, env); 

  // 2. 检查成就解锁
  //await checkAchievements(childId, familyId, env);
  // 🌟 注意：成就检查放在目标更新后，因为有些成就可能依赖于目标达成的分数变化
  await checkAchievementUnlock(env.DB, env, familyId, childId);
}
// 🌟 1. 抽离出一个纯元数据字典，专门给前端展示成就墙用
export const ACHIEVEMENTS_META = [
  // 1. 财富里程碑 (累积赚取)
  { key: 'first_blood', name: '破壳而出', emoji: '🐣', desc: '完成第一次积分赚取' },
  { key: 'score_100', name: '百星王者', emoji: '🌟', desc: '累计获得 100 积分' },
  { key: 'score_1000', name: '千分大佬', emoji: '👑', desc: '累计获得 1000 积分' },
  
  // 2. 消费与理财 (累积消费)
  { key: 'first_spend', name: '小小理财家', emoji: '👛', desc: '完成第一次心愿兑换' },
  { key: 'spend_500', name: '挥金如土', emoji: '🛍️', desc: '累计消费 500 积分' },

  // 3. 勤奋达人 (完成任务次数)
  { key: 'task_10', name: '初出茅庐', emoji: '🎯', desc: '累计完成 10 次加分任务' },
  { key: 'task_50', name: '勤劳小蜜蜂', emoji: '🐝', desc: '累计完成 50 次加分任务' },

  // 4. 自律与坚持 (连续天数)
  { key: 'streak_3', name: '良好开端', emoji: '🌱', desc: '连续 3 天获得积分' },
  { key: 'streak_7', name: '持之以恒', emoji: '🔥', desc: '连续 7 天获得积分' },
  { key: 'streak_21', name: '习惯养成', emoji: '🏆', desc: '连续 21 天获得积分，真棒！' },

  // 5. 隐藏惊喜 (单次触发)
  { key: 'big_win', name: '盆满钵满', emoji: '🐳', desc: '单次任务获得超过 30 积分' }
];
/**
 * 任务 A：增量更新活跃目标的当前分数
 * 逻辑：只对 status = 'active' 的目标累加加分项
 */
// backend/src/queues/scoreHandler.js

async function updateGoalsProgress(data, env) {
  const { childId, points, familyId, isUndo } = data;

  // 1. 🌟 精准过滤：只处理正常的加分，以及“对加分项的撤回”
  if (!isUndo && points <= 0) return; // 正常的惩罚扣分，不影响攒愿望
  if (isUndo && points >= 0) return;  // 撤回了惩罚，也不影响攒愿望

  try {
    // 2. 查找最近活跃的目标 (包含 active 和刚刚 completed 还没兑换的)
    const goal = await env.DB.prepare(`
      SELECT id, name, current_points, target_points, status 
      FROM goals 
      WHERE child_id = ? AND status IN ('active', 'completed')
      ORDER BY updated_at DESC LIMIT 1
    `).bind(childId).first();

    if (!goal) return;

    // 3. 计算新分数 (最低为0，最高为目标分)
    const newPoints = Math.max(0, Math.min(goal.current_points + points, goal.target_points));
    let newStatus = goal.status;
    let shouldBroadcast = false;

    // 🌟 状态翻转逻辑：
    if (newPoints >= goal.target_points && goal.status === 'active') {
      newStatus = 'completed'; // 达成目标
      shouldBroadcast = true;
    } else if (newPoints < goal.target_points && goal.status === 'completed') {
      newStatus = 'active'; // 撤回导致分数跌落，取消达成状态
    }

    // 4. 更新数据库
    await env.DB.prepare(`
      UPDATE goals 
      SET current_points = ?, status = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).bind(newPoints, newStatus, goal.id).run();

    // 5. 🌟 愿望达成专属广播！不再借用成就接口
    if (shouldBroadcast) {
      await notifyAdmins(familyId, `🎉 目标达成！孩子完成了目标：【${goal.name}】`, env);
      const doId = env.FAMILY_MANAGER.idFromName(familyId);
      const doObj = env.FAMILY_MANAGER.get(doId);
      await doObj.fetch(new Request(`http://do/internal/broadcast-goal`, {
         method: 'POST',
         body: JSON.stringify({ childId, goalName: goal.name })
      }));
    }
  } catch (error) {
    console.error('[Queue Error] Update goals failed:', error);
  }
}

/**
 * 任务 B：成就系统检查 (规则引擎)
 * 逻辑：基于硬编码规则或动态配置检查解锁条件
 */
async function checkAchievements(childId, familyId, env) {
  console.log(`[Achievement] 开始检测孩子: ${childId}, 家庭: ${familyId}`);
  // ==========================================
  // 1. 提前拉取该孩子的所有聚合数据 (性能优化)
  // ==========================================
  const childStats = await env.DB.prepare(`
    SELECT score_gained, score_spent, 
           (SELECT COUNT(*) FROM history WHERE child_id = ? AND points > 0 AND is_revoked = 0) as task_count
    FROM children WHERE id = ?
  `).bind(childId, childId).first();

  if (!childStats) return;

  // 查询最近 25 天的活跃日期（用于计算连续打卡）
  // 假设服务器时区为东八区，可根据实际家庭 timezone 调整
  const { results: activeDates } = await env.DB.prepare(`
    SELECT DISTINCT date(created_at, '+08:00') as d 
    FROM history 
    WHERE child_id = ? AND points > 0 AND is_revoked = 0
    ORDER BY d DESC LIMIT 25
  `).bind(childId).all();

  // 计算当前连续打卡天数 (JS 逻辑实现，比 SQL 更准更轻量)
  let currentStreak = 0;
  const today = new Date();
  const dateStrings = activeDates.map(r => r.d);
  
  for (let i = 0; i < 25; i++) {
    const checkDate = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
    const checkStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' }).format(checkDate);
    // 如果今天是 0 天，但昨天有记录，streak 依然可以连上
    if (i === 0 && !dateStrings.includes(checkStr)) continue; 
    if (dateStrings.includes(checkStr)) {
      currentStreak++;
    } else {
      break; // 一旦断开就停止计算
    }
  }

  // ==========================================
  // 2. 动态校验规则引擎
  // ==========================================
  const achievementRules = [
    // 里程碑
    { key: 'first_blood', check: async () => childStats.score_gained > 0 },
    { key: 'score_100',   check: async () => childStats.score_gained >= 100 },
    { key: 'score_1000',  check: async () => childStats.score_gained >= 1000 },
    
    // 消费类
    { key: 'first_spend', check: async () => childStats.score_spent > 0 },
    { key: 'spend_500',   check: async () => childStats.score_spent >= 500 },

    // 勤奋类
    { key: 'task_10',     check: async () => childStats.task_count >= 10 },
    { key: 'task_50',     check: async () => childStats.task_count >= 50 },

    // 连续打卡类
    { key: 'streak_3',    check: async () => currentStreak >= 3 },
    { key: 'streak_7',    check: async () => currentStreak >= 7 },
    { key: 'streak_21',   check: async () => currentStreak >= 21 },

    // 特殊触发类 (去数据库查有没有单笔大额)
    { key: 'big_win',     check: async () => {
        const big = await env.DB.prepare(`SELECT 1 FROM history WHERE child_id = ? AND points >= 30 AND is_revoked = 0 LIMIT 1`).bind(childId).first();
        return !!big;
    }}
  ];

  // ==========================================
  // 3. 循环校验并入库广播 (复用你原本完美的逻辑)
  // ==========================================
  for (const rule of achievementRules) {
    const existing = await env.DB.prepare(`SELECT unlocked FROM achievements WHERE child_id = ? AND achievement_key = ?`).bind(childId, rule.key).first();
    if (existing?.unlocked === 1) continue; 

    const isMet = await rule.check();
    
    if (isMet) {
      // 写入数据库
      await env.DB.prepare(`
        INSERT INTO achievements (id, family_id, child_id, achievement_key, unlocked, progress, unlocked_at)
        VALUES (?, ?, ?, ?, 1, 100, CURRENT_TIMESTAMP)
        ON CONFLICT(child_id, achievement_key) DO UPDATE SET unlocked = 1, progress = 100, unlocked_at = CURRENT_TIMESTAMP
      `).bind(nanoid(12), familyId, childId, rule.key).run();

      // 通知家长与红点逻辑
      await env.DB.prepare(`UPDATE children SET has_new_achievement = 1 WHERE id = ?`).bind(childId).run();
      // 发送 TG 通知
      await notifyAdmins(familyId, `🏆 获得成就！孩子解锁了勋章：【${rule.name}】- ${rule.desc}`, env);

      // 向 DO 广播 (触发你的前端动效)
      try {
        const doId = env.FAMILY_MANAGER.idFromName(familyId);
        const doObj = env.FAMILY_MANAGER.get(doId);
        const meta = ACHIEVEMENTS_META.find(m => m.key === rule.key) || rule; 
        
        await doObj.fetch(new Request(`http://do/internal/broadcast-achievement`, {
           method: 'POST',
           body: JSON.stringify({ 
             childId, 
             hasNew: true,
             achievements: [{ key: rule.key, name: meta.name, emoji: meta.emoji, desc: meta.desc }] 
           })
        }));
      } catch (err) {
        console.error('[DO Broadcast Error]', err);
      }
    }
  }
}
/**
 * 辅助：通知该家庭的所有管理员 (TG 渠道)
 */
async function notifyAdmins(familyId, message, env) {
  try {
    const { results: admins } = await env.DB.prepare(`
      SELECT b.provider_uid FROM auth_bindings b
      JOIN memberships m ON b.internal_id = m.user_id
      WHERE m.family_id = ? AND b.provider = 'telegram' AND m.role IN ('admin', 'superadmin')
    `).bind(familyId).all();

    for (const admin of admins) {
      await sendTgMessage(env.TELEGRAM_TOKEN, admin.provider_uid, message);
    }
  } catch (error) {
    console.error(`[Notify Error] Family: ${familyId}`, error);
  }
}