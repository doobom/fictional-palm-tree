// backend/src/utils/report.js

export async function generateDailyReport(db, familyId, title) {
  // 获取东八区当前日期
  const date = new Date(Date.now() + 8 * 3600 * 1000);
  const todayStr = date.toISOString().split('T')[0];

  // 1. 统计今日打卡项
  const logs = await db.prepare(`
    SELECT c.name, COUNT(rl.id) as count 
    FROM children c LEFT JOIN routine_logs rl ON c.id = rl.child_id AND rl.date_str = ? AND rl.status = 'completed'
    WHERE c.family_id = ? GROUP BY c.id
  `).bind(todayStr, familyId).all();

  // 2. 统计今日得分
  const gains = await db.prepare(`
    SELECT c.name, SUM(h.points) as total 
    FROM children c LEFT JOIN history h ON c.id = h.child_id AND date(h.created_at, '+8 hours') = ? AND h.points > 0 AND h.is_revoked = 0
    WHERE c.family_id = ? GROUP BY c.id
  `).bind(todayStr, familyId).all();

  // 3. 待办数量
  const pendingCount = await db.prepare(`
    SELECT COUNT(*) as c FROM approvals 
    WHERE family_id = ? AND status = 'pending'
  `).bind(familyId).first('c') || 0;

  // 4. 组装并返回文本
  let respText = `${title} (${todayStr})\n\n`;
  respText += `<b>📈 今日得分与任务：</b>\n`;
  logs.results.forEach((l, i) => {
    const gain = gains.results[i]?.total || 0;
    respText += `👦 <b>${l.name}</b>：赚取 ${gain} 分，完成 ${l.count} 项打卡\n`;
  });

  respText += `\n<b>📝 待办审批概况：</b>\n`;
  respText += pendingCount > 0 
    ? `有 <b>${pendingCount}</b> 个任务正在等您批阅！\n👉 请发送 /pending 快捷处理。` 
    : `全部清空，完美的一天！辛苦啦！`;

  return respText;
}