// backend/src/queues/scoreHandler.js
import { nanoid } from 'nanoid';
import { sendTgMessage } from '../utils/telegram.js';

/**
 * 核心处理器：处理积分变动后的后续逻辑
 */
export async function handleScoreChangeTasks(data, env) {
  const { childId, familyId, points, operatorId } = data;

  // 1. 更新目标 (Goals) 进度
  await updateGoalsProgress(childId, familyId, env);

  // 2. 检查成就 (Achievements) 解锁
  await checkAchievements(childId, familyId, env);
}

/**
 * 任务 A：更新活跃目标的当前分数
 * 逻辑：重新计算该孩子自目标创建以来的有效积分总和
 */
async function updateGoalsProgress(childId, familyId, env) {
  // 获取该孩子所有处于 'active' 状态的目标
  const { results: activeGoals } = await env.DB.prepare(`
    SELECT id, target_points, name, created_at 
    FROM goals 
    WHERE child_id = ? AND family_id = ? AND status = 'active'
  `).bind(childId, familyId).all();

  for (const goal of activeGoals) {
    // 聚合该目标创建后的所有非撤销流水
    const stats = await env.DB.prepare(`
      SELECT SUM(points) as total FROM history 
      WHERE child_id = ? AND family_id = ? 
      AND created_at >= ? AND reverted = 0
    `).bind(childId, familyId, goal.created_at).first();

    const currentPoints = stats?.total || 0;
    const isCompleted = currentPoints >= goal.target_points;

    // 更新目标状态
    await env.DB.prepare(`
      UPDATE goals SET 
        current_points = ?, 
        status = ?, 
        updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).bind(currentPoints, isCompleted ? 'completed' : 'active', goal.id).run();

    // 如果刚完成，触发推送通知
    if (isCompleted) {
      await notifyAdmins(familyId, `🎉 目标达成！孩子完成了目标：【${goal.name}】`, env);
    }
  }
}

/**
 * 任务 B：成就系统检查 (规则引擎)
 * 逻辑：基于硬编码规则或动态配置检查解锁条件
 */
async function checkAchievements(childId, familyId, env) {
  // 定义成就规则
  const achievementRules = [
    { 
      key: 'first_score', 
      name: '开门红', 
      desc: '获得第一笔积分奖励',
      check: async () => true // 只要有流水记录即触发
    },
    { 
      key: 'score_1000', 
      name: '千金之子', 
      desc: '累计获得积分突破 1000',
      check: async () => {
        const res = await env.DB.prepare("SELECT score_gained FROM children WHERE id = ?").bind(childId).first();
        return (res?.score_gained || 0) >= 1000;
      }
    },
    { 
      key: 'streak_7', 
      name: '持之以恒', 
      desc: '连续 7 天获得加分',
      check: async () => {
        const { count } = await env.DB.prepare(`
          SELECT COUNT(DISTINCT date(created_at)) as count FROM history 
          WHERE child_id = ? AND points > 0 AND created_at >= date('now', '-7 days')
        `).bind(childId).first();
        return count >= 7;
      }
    }
  ];

  for (const rule of achievementRules) {
    // 1. 检查是否已经解锁过，避免重复触发
    const existing = await env.DB.prepare(`
      SELECT unlocked FROM achievements WHERE child_id = ? AND achievement_key = ?
    `).bind(childId, rule.key).first();

    if (existing?.unlocked) continue;

    // 2. 运行规则校验逻辑
    const isMet = await rule.check();
    
    if (isMet) {
      // 3. 记录解锁状态
      await env.DB.prepare(`
        INSERT INTO achievements (id, family_id, child_id, achievement_key, unlocked, unlocked_at)
        VALUES (?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
        ON CONFLICT(child_id, achievement_key) DO UPDATE SET unlocked = 1, unlocked_at = CURRENT_TIMESTAMP
      `).bind(nanoid(12), familyId, childId, rule.key).run();

      // 4. 发送成就解锁通知
      await notifyAdmins(familyId, `🏆 获得成就！孩子解锁了勋章：【${rule.name}】- ${rule.desc}`, env);
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