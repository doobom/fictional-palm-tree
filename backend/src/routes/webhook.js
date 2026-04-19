// backend/src/routes/webhook.js
import { Hono } from 'hono';
import { 
  sendTgMessage, 
  sendTgMessageWithKeyboard, 
  editTgMessageText, 
  answerTgCallback,
  deleteTgMessage,
  sendTgDocument
} from '../utils/telegram.js';
import { getTenantAccessToken, sendLarkMessage } from '../utils/lark.js';
import { sendAlipayMessage } from '../utils/alipay.js';
import { t } from '../utils/i18n.js';
import { checkAchievementUnlock } from './achievements.js';
import { generateDailyReport } from '../utils/report.js';

const webhook = new Hono();

/**
 * 🛡️ 核心防御校验器：Secret Token + 幂等性(防重放)
 */
async function checkTelegramSecurity(c, body) {
  const secretToken = c.req.header('X-Telegram-Bot-Api-Secret-Token');
  if (secretToken !== c.env.TG_WEBHOOK_SECRET) return true; 

  const updateId = body.update_id;
  if (!updateId) return false; 
  try {
    await c.env.DB.prepare(`INSERT INTO processed_updates (update_id) VALUES (?)`).bind(updateId).run();
    return false; 
  } catch (err) {
    return true; // 拦截重复推送
  }
}

// ==========================================
// 2. 普通用户 Bot (Telegram)
// ==========================================
webhook.post('/telegram', async (c) => {
  const body = await c.req.json();

  if (await checkTelegramSecurity(c, body)) return c.json({ ok: true });

  console.log(`[Telegram Webhook] Received update:`, JSON.stringify(body));

  const botToken = c.env.BOT_TOKEN;

  // 🛡️ 维护模式拦截器 (Maintenance Shield)
  try {
    const isMaint = await c.env.DB.prepare(`SELECT value FROM system_kv WHERE key = 'maintenance'`).first('value');
    if (isMaint === '1') {
      if (body.callback_query) {
        await answerTgCallback(body.callback_query.id, '🚧 系统停机维护中，请稍后再试', true, botToken);
      } else if (body.message && body.message.chat) {
        await sendTgMessage(botToken, body.message.chat.id, `🚧 <b>系统正在进行维护升级中</b>\n\n预计很快恢复，请您耐心等待。`);
      }
      return c.json({ ok: true });
    }
  } catch(e) {
    // 忽略表不存在的错误
  }
  
  // 处理按钮回调 (Callback Query)
  if (body.callback_query) {
    const cb = body.callback_query;
    const data = cb.data; 
    const messageId = cb.message.message_id;
    const chatId = cb.message.chat.id;

    console.log('收到回调数据：', data);

    if (data.startsWith('a:') || data.startsWith('r:')) {
      const action = data.startsWith('a:') ? 'approve' : 'reject';
      const approvalId = data.slice(2);

      try {
        const approval = await c.env.DB.prepare(`SELECT * FROM approvals WHERE id = ?`).bind(approvalId).first();
        if (!approval) return await answerTgCallback(cb.id, '⚠️ 记录不存在', true, botToken);
        if (approval.status !== 'pending') {
          await answerTgCallback(cb.id, '已被处理过', false, botToken);
          return await editTgMessageText(chatId, messageId, cb.message.text + `\n\n(状态：已处理)`, botToken);
        }

        if (action === 'approve') {
          let points = approval.requested_points;
          if (approval.type === 'reward') {
            points = -Math.abs(points);
            if (approval.reward_id) {
              await c.env.DB.prepare(`UPDATE rewards SET stock = stock - 1 WHERE id = ? AND stock > 0`).bind(approval.reward_id).run();
            }
          } else {
            points = Math.abs(points);
            if (approval.rule_id) {
              await c.env.DB.prepare(`UPDATE routine_logs SET status = 'completed' WHERE routine_id = ? AND child_id = ? AND status = 'pending'`).bind(approval.rule_id, approval.child_id).run();
            }
          }

          // 触发 DO 执行精准发分
          const doId = c.env.FAMILY_MANAGER.idFromName(approval.family_id);
          const doObj = c.env.FAMILY_MANAGER.get(doId);
          await doObj.fetch(new Request(`http://do/adjust`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              familyId: approval.family_id, childId: approval.child_id, points,
              operatorId: `tg_${cb.from.id}`,
              remark: approval.type === 'reward' ? `兑换：${approval.title}` : `任务：${approval.title}` 
            })
          }));

          await c.env.DB.prepare(`UPDATE approvals SET status = 'approved', updated_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(approvalId).run();
          await answerTgCallback(cb.id, '✅ 已通过', false, botToken);
          await editTgMessageText(chatId, messageId, cb.message.text + `\n\n✅ <b>已由 ${cb.from.first_name || '家长'} 同意</b>`, botToken);

        } else {
          // 驳回逻辑
          await c.env.DB.prepare(`UPDATE approvals SET status = 'rejected', updated_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(approvalId).run();
          await answerTgCallback(cb.id, '❌ 已驳回', false, botToken);
          await editTgMessageText(chatId, messageId, cb.message.text + `\n\n❌ <b>已被 ${cb.from.first_name || '家长'} 驳回</b>`, botToken);
        }
      } catch (err) {
        console.error('[Webhook Process Error]', err);
        await answerTgCallback(cb.id, '❌ 系统处理出错', true, botToken);
      }
    }

    // --- 🌟 处理 1: 快捷奖惩回调 (op:) ---
    if (data.startsWith('op:')) {
      const [_, type, pointsStr, childId, remark] = data.split(':');
      const points = type === 'r' ? parseInt(pointsStr) : -parseInt(pointsStr);
      
      try {
        const child = await c.env.DB.prepare(`SELECT name, family_id FROM children WHERE id = ?`).bind(childId).first();
        if (!child) return await answerTgCallback(cb.id, '❌ 找不到孩子', true, botToken);

        // 触发 DO 执行
        const doId = c.env.FAMILY_MANAGER.idFromName(child.family_id);
        const doObj = c.env.FAMILY_MANAGER.get(doId);
        await doObj.fetch(new Request(`http://do/adjust`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            familyId: child.family_id, childId: childId, points: points,
            operatorId: `tg_${cb.from.id}`, remark: `[快捷奖惩] ${remark}` 
          })
        }));

        const resultText = type === 'r' ? `🎉 成功奖励了 ${child.name} ${pointsStr} 分！` : `⚖️ 已扣除 ${child.name} ${pointsStr} 分。`;
        await answerTgCallback(cb.id, resultText, false, botToken);
        await editTgMessageText(chatId, messageId, `✅ <b>操作成功</b>\n\n${resultText}\n理由：${remark}`, botToken);
      } catch (err) {
        await answerTgCallback(cb.id, '❌ 发分失败', true, botToken);
      }
    }

    // --- 🌟 处理 2: 互动打卡回调 (tk:) ---
    if (data.startsWith('tk:')) {
      const routineId = data.split(':')[1];
      const todayStr = new Date(Date.now() + 8 * 3600 * 1000).toISOString().split('T')[0];

      try {
        const auth = await c.env.DB.prepare(`SELECT internal_id FROM auth_bindings WHERE provider = 'telegram' AND provider_uid = ?`).bind(String(cb.from.id)).first();
        const routine = await c.env.DB.prepare(`SELECT * FROM routines WHERE id = ?`).bind(routineId).first();
        
        if (!auth || !routine) return await answerTgCallback(cb.id, '❌ 任务不存在或未绑定', true, botToken);

        // 判断是否需要审批
        if (routine.auto_approve) {
          // 直接打卡发分
          const doId = c.env.FAMILY_MANAGER.idFromName(routine.family_id);
          const doObj = c.env.FAMILY_MANAGER.get(doId);
          await doObj.fetch(new Request(`http://do/adjust`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              familyId: routine.family_id, childId: auth.internal_id, 
              points: routine.points, ruleId: routine.id, remark: `打卡：${routine.name}` 
            })
          }));
          await c.env.DB.prepare(`INSERT INTO routine_logs (id, family_id, routine_id, child_id, date_str, status) VALUES (?,?,?,?,?,'completed')`).bind(nanoid(), routine.family_id, routineId, auth.internal_id, todayStr).run();
          
          await answerTgCallback(cb.id, '✅ 打卡成功，积分已到账！', false, botToken);
          await editTgMessageText(chatId, messageId, `✨ <b>打卡成功！</b>\n\n你已完成：${routine.emoji || ''} ${routine.name}\n获得积分：+${routine.points}`, botToken);
        } else {
          // 提交审批
          const approvalId = nanoid(12);
          await c.env.DB.prepare(`INSERT INTO approvals (id, family_id, child_id, rule_id, title, requested_points, status) VALUES (?,?,?,?,?,?,'pending')`).bind(approvalId, routine.family_id, auth.internal_id, routineId, `打卡：${routine.name}`, routine.points).run();
          
          await answerTgCallback(cb.id, '📝 已提交审批', false, botToken);
          await editTgMessageText(chatId, messageId, `⏳ <b>已提交审批</b>\n\n任务：${routine.name}\n待家长确认后即可发分！`, botToken);
          // 这里可以额外触发一条发给家长的带按钮的消息，逻辑同 approvals.post
        }
      } catch (err) {
        await answerTgCallback(cb.id, '❌ 打卡失败', true, botToken);
      }
    }

    // --- 🌟 处理 3: 撤销记录回调 (un:) 优化版 ---
    if (data.startsWith('un:')) {
      const historyId = data.split(':')[1];
      console.log(`[Undo Attempt] historyId=${historyId} by user ${cb.from.id} (${cb.from.first_name})`);
      try {
        const history = await c.env.DB.prepare(`SELECT * FROM history WHERE id = ? AND is_revoked = 0`).bind(historyId).first();
        console.log(`[Undo] Fetched history record:`, history);
        if (!history) {
          return await answerTgCallback(cb.id, '❌ 记录不存在或已超时', true, botToken);
        }

        // 1. 执行反向积分操作
        const doId = c.env.FAMILY_MANAGER.idFromName(history.family_id);
        const doObj = c.env.FAMILY_MANAGER.get(doId);
        await doObj.fetch(new Request(`http://do/adjust`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            familyId: history.family_id, 
            childId: history.child_id, 
            points: -history.points, 
            operatorId: `tg_${cb.from.id}`, 
            remark: `[撤销操作] ${history.remark}` 
          })
        }));
        console.log(`[Undo] DO adjustment completed for historyId=${historyId}`);
        // 2. 更新数据库状态
        await c.env.DB.prepare(`UPDATE history SET is_revoked = 1 WHERE id = ?`).bind(historyId).run();

        // 3. 重点：显眼的反馈
        const successText = `✅ <b>撤销成功</b>\n\n已成功撤回：${history.points > 0 ? '+' : ''}${history.points} 🪙\n原由：${history.remark}\n操作人：${cb.from.first_name}`;
        
        // 顶部弹窗（设为 true 会变成需要点击确认的对话框，更显眼）
        await answerTgCallback(cb.id, '✅ 撤销成功！', false, botToken);
        
        // 修改原消息内容并清空按钮
        await editTgMessageText(chatId, messageId, successText, botToken);
        
      } catch (err) {
        console.error('[Undo Error]', err);
        await answerTgCallback(cb.id, '❌ 撤销失败，请稍后重试', true, botToken);
      }
    }

    // --- 🌟 处理 4: 亲情转账回调 (tr:) ---
    if (data.startsWith('tr:')) {
      const [_, amountStr, targetChildId] = data.split(':');
      const amount = parseInt(amountStr);

      try {
        // 校验发送者是谁
        const auth = await c.env.DB.prepare(`SELECT internal_id FROM auth_bindings WHERE provider = 'telegram' AND provider_uid = ?`).bind(String(cb.from.id)).first();
        if (!auth) return await answerTgCallback(cb.id, '❌ 身份校验失败', true, botToken);
        
        const senderChildId = auth.internal_id;
        const sender = await c.env.DB.prepare(`SELECT name, (score_gained - score_spent) as balance, family_id FROM children WHERE id = ?`).bind(senderChildId).first();
        const receiver = await c.env.DB.prepare(`SELECT name FROM children WHERE id = ?`).bind(targetChildId).first();

        // 二次校验余额（防止多端并发点击超售）
        if (!sender || sender.balance < amount) return await answerTgCallback(cb.id, '❌ 你的余额不足啦', true, botToken);

        const doId = c.env.FAMILY_MANAGER.idFromName(sender.family_id);
        const doObj = c.env.FAMILY_MANAGER.get(doId);

        // 第 1 步：DO 扣除发送者积分
        await doObj.fetch(new Request(`http://do/adjust`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            familyId: sender.family_id, childId: senderChildId, points: -amount,
            operatorId: `tg_${cb.from.id}`, remark: `转账给 ${receiver.name}` 
          })
        }));

        // 第 2 步：DO 增加接收者积分
        await doObj.fetch(new Request(`http://do/adjust`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            familyId: sender.family_id, childId: targetChildId, points: amount,
            operatorId: `tg_${cb.from.id}`, remark: `收到 ${sender.name} 的转账` 
          })
        }));

        await answerTgCallback(cb.id, '✅ 转账成功！', false, botToken);
        await editTgMessageText(chatId, messageId, `💖 <b>亲情互助成功</b>\n\n🎉 <b>${sender.name}</b> 大方地送给了 <b>${receiver.name}</b> <b>${amount}</b> 分！\n相亲相爱一家人~`, botToken);
      } catch (err) {
        await answerTgCallback(cb.id, '❌ 系统繁忙，转账失败', true, botToken);
      }
    }

    // --- 🌟 处理 5: 提醒回调 (nd:) ---
    if (data.startsWith('nd:')) {
      const childId = data.split(':')[1];
      try {
        const child = await c.env.DB.prepare(`SELECT name, family_id FROM children WHERE id = ?`).bind(childId).first();
        const family = await c.env.DB.prepare(`SELECT tg_group_id FROM families WHERE id = ?`).bind(child.family_id).first();
        
        if (!family || !family.tg_group_id) {
           return await answerTgCallback(cb.id, '❌ 必须绑定家庭群组后才能发送群提醒', true, botToken);
        }

        const msg = `🔔 <b>嘀嘀！爱的提醒</b>\n\n👦 <b>${child.name}</b>，家长正在呼叫你！\n快去系统里看看有没有遗漏的打卡任务或待办事项吧~ 🚀`;
        
        // 关键：将消息发送到家庭群组
        await sendTgMessage(botToken, family.tg_group_id, msg);
        
        await answerTgCallback(cb.id, `✅ 提醒已成功发送到群里！`, false, botToken);
        await editTgMessageText(chatId, messageId, `✅ <b>提醒发送成功</b>\n\n已成功在家庭群组内呼叫 ${child.name}。`, botToken);
      } catch (err) {
        await answerTgCallback(cb.id, '❌ 提醒失败', true, botToken);
      }
    }

    return c.json({ ok: true });
  }

  const msg = body.message;
  if (!msg || !msg.text) return c.json({ ok: true });

  const text = msg.text.trim();
  const chatId = msg.chat.id;
  const senderId = String(msg.from.id);
  const chatType = msg.chat.type;
  const command = text.split('@')[0].split(' ')[0];
  const baseUrl = new URL(c.req.url).origin;

  console.log(`[Telegram Webhook] Received command: ${command} from chat ${chatId} (type: ${chatType})`);

  // --- 处理指令 (Message) ---
  try {
    // 功能 A：/start 引导进入 Mini App
    if (command === '/start') {
      const welcomeText = `<b>🌟 欢迎来到家庭积分系统！</b>\n\n在这里，你可以轻松管理家务、兑换奖励并见证成长。\n\n点击下方按钮立即开启之旅：`;
      let keyboard;
      if (chatType === 'private') {
       // 私聊环境：使用原生的无缝 WebApp 弹窗
        keyboard = [[{ 
          text: "🚀 打开 Mini App", 
          web_app: { url: c.env.FRONTEND_URL } 
        }]];
      } else {
        // 群组环境：使用普通 URL 跳转绕过 Telegram 的群组限制
        // 最佳实践：这里也可以填你在 BotFather 设置的 Direct App Link，如 https://t.me/your_bot/app
        keyboard = [[{ 
          text: "🚀 进入系统", 
          url: c.env.TG_DIRECT_URL
        }]];
      }
      await sendTgMessageWithKeyboard(chatId, welcomeText, keyboard, botToken);
    }

    // 功能 B：/bindgroup 绑定家庭群组
    else if (command === '/bindgroup') {
      // 校验发送者身份 (必须是系统内的管理员)
      // 1. 通过 auth_bindings 找到 Telegram ID 对应的 internal_id (即 users.id)
      // 2. 通过 memberships 表关联该用户所属的家庭，并校验角色
      const adminMember = await c.env.DB.prepare(`
        SELECT m.family_id 
        FROM auth_bindings ab
        JOIN memberships m ON ab.internal_id = m.user_id 
        WHERE ab.provider = 'telegram' 
          AND ab.provider_uid = ? 
          AND ab.user_type = 'parent' 
          AND m.role IN ('admin', 'superadmin')
      `).bind(senderId).first();

      if (!adminMember) {
        return await sendTgMessage(botToken, chatId, `❌ <b>绑定失败</b>\n你的 Telegram 账号未绑定系统管理员身份，或未加入任何家庭。`);
      }

      // 执行绑定 (更新 families 表)
      await c.env.DB.prepare(`UPDATE families SET tg_group_id = ? WHERE id = ?`)
        .bind(String(chatId), adminMember.family_id).run();

      await sendTgMessage(botToken, chatId, `✅ <b>群组绑定成功！</b>\n从此以后，该家庭的所有审批申请和日常打卡通知都将发送到本群。`);
    }

    // --- 🌟 功能 1: /balance 快捷查分 (支持自定义图标与头像) ---
    else if (command === '/balance' || command === '/coins') {
      // 1. 获取身份绑定信息
      const auth = await c.env.DB.prepare(`
        SELECT internal_id, user_type FROM auth_bindings 
        WHERE provider = 'telegram' AND provider_uid = ?
      `).bind(senderId).first();

      if (!auth) {
        return await sendTgMessage(botToken, chatId, `⚠️ <b>未绑定身份</b>\n请先在 Web 网页端登录并完成 Telegram 绑定。`);
      }

      // 2. 获取家庭配置 (获取自定义积分图标)
      let family;
      if (auth.user_type === 'parent') {
        family = await c.env.DB.prepare(`
          SELECT f.id, f.point_emoji FROM families f
          JOIN memberships m ON f.id = m.family_id
          WHERE m.user_id = ? LIMIT 1
        `).bind(auth.internal_id).first();
      } else {
        family = await c.env.DB.prepare(`
          SELECT f.id, f.point_emoji FROM families f
          JOIN children c ON f.id = c.family_id
          WHERE c.id = ? LIMIT 1
        `).bind(auth.internal_id).first();
      }

      if (!family) return;
      const pEmoji = family.point_emoji || '🪙'; // 兜底使用金币

      // 3. 执行分值与头像查询
      if (auth.user_type === 'parent') {
        // 家长模式：列出全家孩子
        const children = await c.env.DB.prepare(`
          SELECT name, avatar, (score_gained - score_spent) AS points 
          FROM children WHERE family_id = ?
        `).bind(family.id).all();

        if (children.results.length === 0) {
          return await sendTgMessage(botToken, chatId, `📊 <b>家庭积分榜单</b>\n\n家里目前还没有添加孩子哦~`);
        }

        let respText = `📊 <b>家庭积分榜单</b>\n\n`;
        children.results.forEach(child => {
          // 🌟 使用数据库中的头像和积分图标
          respText += `${child.avatar || '👦'} ${child.name}：${child.points} ${pEmoji}\n`;
        });
        await sendTgMessage(botToken, chatId, respText);

      } else {
        // 孩子模式：展示个人余额
        const child = await c.env.DB.prepare(`
          SELECT name, avatar, (score_gained - score_spent) AS points 
          FROM children WHERE id = ?
        `).bind(auth.internal_id).first();
        
        // 🌟 使用数据库中的头像和积分图标
        const childAvatar = child.avatar || '👦';
        await sendTgMessage(botToken, chatId, `${childAvatar} <b>${child.name}</b>，你当前的余额为：\n✨ <b>${child.points}</b> ${pEmoji}`);
      }
    }

    // --- 🌟 功能 2 (升级版): /pending 互动式一键批阅 ---
    else if (command === '/pending') {
      const adminMember = await c.env.DB.prepare(`
        SELECT m.family_id FROM auth_bindings ab
        JOIN memberships m ON ab.internal_id = m.user_id 
        WHERE ab.provider = 'telegram' AND ab.provider_uid = ? AND m.role IN ('admin', 'superadmin')
      `).bind(senderId).first();

      if (!adminMember) return;

      // 🌟 获取详细数据，包含 ID 以便构造独立按钮
      const pendings = await c.env.DB.prepare(`
        SELECT a.id, a.title, a.requested_points, a.type, a.evidence_text, c.name as child_name 
        FROM approvals a JOIN children c ON a.child_id = c.id
        WHERE a.family_id = ? AND a.status = 'pending' LIMIT 5
      `).bind(adminMember.family_id).all();

      if (pendings.results.length === 0) {
        return await sendTgMessage(botToken, chatId, `✅ <b>当前没有待处理的审批。</b>\n又是轻松的一天！`);
      }

      await sendTgMessage(botToken, chatId, `📝 <b>为您拉取最近的 ${pendings.results.length} 个待办任务：</b>\n(请在下方卡片直接批阅)`);

      // 🌟 为每一个待办单独发送一张带按钮的卡片
      for (const p of pendings.results) {
        const isReward = p.type === 'reward';
        const actionText = isReward ? '申请兑换商品' : '提交了任务凭证';
        const pointsSign = isReward ? '-' : '+';
        let msgText = `🔔 <b>待办审批</b>\n\n👤 <b>成员：</b>${p.child_name}\n📝 <b>动作：</b>${actionText}\n📌 <b>内容：</b>${p.title}\n💰 <b>分值：</b>${pointsSign}${p.requested_points}\n`;
        if (p.evidence_text) msgText += `💬 <b>留言：</b>${p.evidence_text}`;

        const keyboard = [[
          { text: '✅ 同意', callback_data: `a:${p.id}` },
          { text: '❌ 驳回', callback_data: `r:${p.id}` }
        ]];
        // 延时 100ms 防止 TG API 限流
        await new Promise(resolve => setTimeout(resolve, 100));
        await sendTgMessageWithKeyboard(chatId, msgText, keyboard, botToken);
      }
      return c.json({ ok: true });
    }

    // --- 🌟 功能 3: /history 最近积分流水 (同步自定义图标) ---
    else if (command === '/history') {
      const auth = await c.env.DB.prepare(`
        SELECT internal_id, user_type FROM auth_bindings 
        WHERE provider = 'telegram' AND provider_uid = ?
      `).bind(senderId).first();

      if (!auth) return await sendTgMessage(botToken, chatId, `⚠️ 请先在 Web 端登录并绑定 Telegram。`);

      // 获取家庭 ID 和自定义图标
      let family;
      if (auth.user_type === 'parent') {
        family = await c.env.DB.prepare(`
          SELECT f.id, f.point_emoji FROM families f
          JOIN memberships m ON f.id = m.family_id
          WHERE m.user_id = ? LIMIT 1
        `).bind(auth.internal_id).first();
      } else {
        family = await c.env.DB.prepare(`
          SELECT f.id, f.point_emoji FROM families f
          JOIN children c ON f.id = c.family_id
          WHERE c.id = ? LIMIT 1
        `).bind(auth.internal_id).first();
      }

      if (!family) return;
      const pEmoji = family.point_emoji || '🪙';

      let query = `
        SELECT c.name, h.points, h.remark, h.created_at 
        FROM history h 
        JOIN children c ON h.child_id = c.id 
        WHERE h.family_id = ?
      `;
      let params = [family.id];

      if (auth.user_type === 'child') {
        query += ` AND h.child_id = ?`;
        params.push(auth.internal_id);
      }
      query += ` ORDER BY h.created_at DESC LIMIT 5`;

      const histories = await c.env.DB.prepare(query).bind(...params).all();

      if (histories.results.length === 0) {
        return await sendTgMessage(botToken, chatId, `📝 <b>近期没有积分变动记录。</b>`);
      }

      let respText = `📜 <b>最近积分流水 (最新 5 条)</b>\n\n`;
      histories.results.forEach(h => {
        const sign = h.points > 0 ? '+' : '';
        const dateStr = h.created_at.substring(5, 16).replace('T', ' ');
        // 🌟 使用自定义积分图标
        respText += `[${dateStr}] <b>${h.name}</b> ${sign}${h.points} ${pEmoji}\n  ↳ <i>${h.remark || '系统调整'}</i>\n`;
      });
      await sendTgMessage(botToken, chatId, respText);
    }

    // --- 🌟 功能 4: /goals 当前进度追踪 (同步自定义图标) ---
    else if (command === '/goals') {
      const auth = await c.env.DB.prepare(`
        SELECT internal_id, user_type FROM auth_bindings 
        WHERE provider = 'telegram' AND provider_uid = ?
      `).bind(senderId).first();

      if (!auth) return await sendTgMessage(botToken, chatId, `⚠️ 请先在 Web 端登录并绑定 Telegram。`);

      let family;
      if (auth.user_type === 'parent') {
        family = await c.env.DB.prepare(`
          SELECT f.id, f.point_emoji FROM families f
          JOIN memberships m ON f.id = m.family_id
          WHERE m.user_id = ? LIMIT 1
        `).bind(auth.internal_id).first();
      } else {
        family = await c.env.DB.prepare(`
          SELECT f.id, f.point_emoji FROM families f
          JOIN children c ON f.id = c.family_id
          WHERE c.id = ? LIMIT 1
        `).bind(auth.internal_id).first();
      }

      if (!family) return;
      const pEmoji = family.point_emoji || '🪙';

      let query = `
        SELECT c.name as child_name, g.name as goal_name, g.emoji, g.current_points, g.target_points 
        FROM goals g 
        JOIN children c ON g.child_id = c.id 
        WHERE g.family_id = ? AND g.status = 'active'
      `;
      let params = [family.id];

      if (auth.user_type === 'child') {
        query += ` AND g.child_id = ?`;
        params.push(auth.internal_id);
      }

      const activeGoals = await c.env.DB.prepare(query).bind(...params).all();

      if (activeGoals.results.length === 0) {
        return await sendTgMessage(botToken, chatId, `🎯 <b>当前没有进行中的目标。</b>`);
      }

      let respText = `🎯 <b>心愿进度追踪</b>\n\n`;
      activeGoals.results.forEach(g => {
        const percent = Math.min(100, Math.floor((g.current_points / g.target_points) * 100));
        const filled = Math.floor(percent / 10);
        const bar = '■'.repeat(filled) + '□'.repeat(10 - filled);
        
        respText += `${g.emoji || '🎯'} <b>${g.child_name}</b>：${g.goal_name}\n`;
        respText += `进度: [${bar}] ${percent}%\n`;
        // 🌟 使用自定义积分图标
        respText += `(${g.current_points} / ${g.target_points} ${pEmoji})\n\n`;
      });

      let keyboard;
      if (chatType === 'private') {
       // 私聊环境：使用原生的无缝 WebApp 弹窗
        keyboard = [[{ 
          text: "🚀 去设定新目标", 
          web_app: { url: c.env.FRONTEND_URL } 
        }]];
      } else {
        // 群组环境：使用普通 URL 跳转绕过 Telegram 的群组限制
        // 最佳实践：这里也可以填你在 BotFather 设置的 Direct App Link，如 https://t.me/your_bot/app
        keyboard = [[{ 
          text: "🚀 去设定新目标", 
          url: c.env.TG_DIRECT_URL
        }]];
      }

      await sendTgMessageWithKeyboard(chatId, respText, keyboard, botToken);
      // await sendTgMessage(botToken, chatId, respText);
    }

    // --- 🌟 功能 5: /shop 心愿商店 (精选列表) ---
    else if (command === '/shop' || command === '/store') {
      const auth = await c.env.DB.prepare(`SELECT internal_id, user_type FROM auth_bindings WHERE provider = 'telegram' AND provider_uid = ?`).bind(senderId).first();
      if (!auth) return await sendTgMessage(botToken, chatId, `⚠️ 请先在 Web 端登录并绑定 Telegram。`);

      let familyId = auth.user_type === 'parent' 
        ? (await c.env.DB.prepare(`SELECT family_id FROM memberships WHERE user_id = ? LIMIT 1`).bind(auth.internal_id).first())?.family_id
        : (await c.env.DB.prepare(`SELECT family_id FROM children WHERE id = ? LIMIT 1`).bind(auth.internal_id).first())?.family_id;
      if (!familyId) return;

      const family = await c.env.DB.prepare(`SELECT point_emoji FROM families WHERE id = ?`).bind(familyId).first();
      const pEmoji = family?.point_emoji || '🪙';

      // 获取库存不为0，且未被软删除的前 5 个最便宜的商品
      const rewards = await c.env.DB.prepare(`
        SELECT name, emoji, cost, stock 
        FROM rewards 
        WHERE family_id = ? AND is_deleted = 0 AND stock != 0 
        ORDER BY cost ASC LIMIT 5
      `).bind(familyId).all();

      if (rewards.results.length === 0) {
        return await sendTgMessage(botToken, chatId, `🎁 <b>心愿商店</b>\n\n商店目前空空如也，快去 Web 端上架一些奖励吧！`);
      }

      let respText = `🎁 <b>心愿商店橱窗</b>\n\n`;
      rewards.results.forEach((r, idx) => {
        const stockText = r.stock === -1 ? '无限' : `剩 ${r.stock}`;
        respText += `${idx + 1}. ${r.emoji || '🎁'} <b>${r.name}</b> \n    💰 价格: ${r.cost} ${pEmoji} (库存: ${stockText})\n\n`;
      });

      const keyboard = chatType === 'private'
        ? [[{ text: "🚀 前往兑换", web_app: { url: `${c.env.FRONTEND_URL}/rewards` } }]]
        : [[{ text: "🚀 前往兑换", url: c.env.TG_DIRECT_URL }]];
      
      await sendTgMessageWithKeyboard(chatId, respText, keyboard, botToken);
    }

    // --- 🌟 功能 6: /daily 今日打卡与待办概况 ---
    else if (command === '/daily' || command === '/todo') {
      const auth = await c.env.DB.prepare(`SELECT internal_id, user_type FROM auth_bindings WHERE provider = 'telegram' AND provider_uid = ?`).bind(senderId).first();
      if (!auth) return await sendTgMessage(botToken, chatId, `⚠️ 请先绑定 Telegram。`);

      // 简单获取北京时间 (东八区) 的今天的 YYYY-MM-DD 字符串
      const todayStr = new Date(Date.now() + 8 * 3600 * 1000).toISOString().split('T')[0];

      if (auth.user_type === 'parent') {
        const familyId = (await c.env.DB.prepare(`SELECT family_id FROM memberships WHERE user_id = ? LIMIT 1`).bind(auth.internal_id).first())?.family_id;
        
        const logs = await c.env.DB.prepare(`
          SELECT c.name, COUNT(rl.id) as count 
          FROM children c
          LEFT JOIN routine_logs rl ON c.id = rl.child_id AND rl.date_str = ? AND rl.status = 'completed'
          WHERE c.family_id = ?
          GROUP BY c.id
        `).bind(todayStr, familyId).all();
        
        let respText = `📅 <b>今日打卡概况 (${todayStr})</b>\n\n`;
        logs.results.forEach(l => { respText += `👦 <b>${l.name}</b>：今日已打卡 ${l.count} 项\n`; });
        
        const keyboard = chatType === 'private' ? [[{ text: "👉 督促孩子打卡", web_app: { url: c.env.FRONTEND_URL } }]] : [[{ text: "👉 督促孩子打卡", url: c.env.TG_DIRECT_URL }]];
        await sendTgMessageWithKeyboard(chatId, respText, keyboard, botToken);

      } else {
        // 孩子查询：展示具体完成情况
        const child = await c.env.DB.prepare(`SELECT id, family_id, name FROM children WHERE id = ?`).bind(auth.internal_id).first();
        const activeRoutines = await c.env.DB.prepare(`SELECT id, name, emoji, points FROM routines WHERE family_id = ? AND (child_id = ? OR child_id IS NULL) AND status = 'active'`).bind(child.family_id, child.id).all();
        const completedLogs = await c.env.DB.prepare(`SELECT routine_id FROM routine_logs WHERE child_id = ? AND date_str = ? AND status = 'completed'`).bind(child.id, todayStr).all();
        const completedIds = new Set(completedLogs.results.map(r => r.routine_id));
        
        let respText = `📅 <b>${child.name} 的今日待办</b>\n\n`;
        let allDone = true;
        activeRoutines.results.forEach(r => {
          if (completedIds.has(r.id)) {
            respText += `✅ ~${r.emoji || '✨'} ${r.name}~\n`; // 完成划线效果
          } else {
            respText += `⬜ ${r.emoji || '✨'} <b>${r.name}</b> (+${r.points})\n`;
            allDone = false;
          }
        });
        if (activeRoutines.results.length === 0) respText += "今天还没有安排任务哦~";
        else if (allDone) respText += "\n🎉 太棒了，今天的任务全部完成了！";
        
        await sendTgMessage(botToken, chatId, respText);
      }
    }

    // --- 🌟 功能 7: /invite 一键生成管理员邀请码 ---
    else if (command === '/invite') {
      const auth = await c.env.DB.prepare(`SELECT internal_id, user_type FROM auth_bindings WHERE provider = 'telegram' AND provider_uid = ?`).bind(senderId).first();
      if (!auth || auth.user_type !== 'parent') {
        return await sendTgMessage(botToken, chatId, `❌ <b>权限不足</b>\n仅系统管理员可生成邀请码。`);
      }

      const adminCheck = await c.env.DB.prepare(`SELECT family_id, role FROM memberships WHERE user_id = ?`).bind(auth.internal_id).first();
      if (!adminCheck || !['admin', 'superadmin'].includes(adminCheck.role)) {
        return await sendTgMessage(botToken, chatId, `❌ <b>权限不足</b>\n您当前的家庭角色无法生成邀请码。`);
      }

      // 核心：生成 6 位大写随机邀请码，有效期 24 小时 (SQLite datetime 函数)
      const code = crypto.randomUUID().split('-')[0].substring(0, 6).toUpperCase();
      await c.env.DB.prepare(`
        INSERT INTO invitation_codes (code, family_id, type, expires_at) 
        VALUES (?, ?, 'admin', datetime('now', '+1 day'))
      `).bind(code, adminCheck.family_id).run();

      const inviteText = `🎉 **家庭邀请函**\n\n欢迎加入我们的积分管理系统！请复制下方邀请码并在网页端登录：\n\n🔑 邀请码：\`${code}\`\n\n*(点击代码即可复制，此邀请码将在 24 小时后失效)*\n\n👉 登录链接：${c.env.FRONTEND_URL}`;
      await sendTgMessage(botToken, chatId, inviteText);
    }

    // --- 🌟 功能 8: /reward & /deduct 快捷奖惩 ---
    else if (command === '/reward' || command === '/deduct') {
      const auth = await c.env.DB.prepare(`SELECT internal_id, user_type FROM auth_bindings WHERE provider = 'telegram' AND provider_uid = ?`).bind(senderId).first();
      if (!auth || auth.user_type !== 'parent') return await sendTgMessage(botToken, chatId, `❌ <b>权限不足</b>\n仅家长可进行奖惩操作。`);

      const parts = text.split(/\s+/);
      const points = parseInt(parts[1]);
      const remark = parts.slice(2).join(' ') || (command === '/reward' ? '表现优秀' : '违规扣分');

      if (isNaN(points) || points <= 0) {
        return await sendTgMessage(botToken, chatId, `⚠️ <b>格式错误</b>\n请输入：<code>${command} [分数] [理由]</code>\n例如：<code>/reward 10 帮做家务</code>`);
      }

      const familyId = (await c.env.DB.prepare(`SELECT m.family_id FROM memberships m WHERE m.user_id = ? LIMIT 1`).bind(auth.internal_id).first())?.family_id;
      const children = await c.env.DB.prepare(`SELECT id, name, avatar FROM children WHERE family_id = ?`).bind(familyId).all();

      if (children.results.length === 0) return await sendTgMessage(botToken, chatId, `🏙️ <b>操作失败</b>\n家里还没有添加孩子哦。`);

      const action = command === '/reward' ? '奖励' : '扣除';
      const type = command === '/reward' ? 'r' : 'd';
      
      // 构造选孩子按钮 (callback_data 格式: op:类型:分数:孩子ID:理由)
      const keyboard = children.results.map(child => ([{
        text: `${child.avatar || '👦'} ${child.name}`,
        callback_data: `op:${type}:${points}:${child.id}:${remark.substring(0, 20)}`
      }]));

      await sendTgMessageWithKeyboard(chatId, `⚖️ <b>快捷奖惩确认</b>\n\n准备给孩子 ${action} <b>${points}</b> 分\n理由：${remark}\n\n请选择操作对象：`, keyboard, botToken);
    }

    // --- 🌟 功能 9: /tasks 互动打卡清单 ---
    else if (command === '/tasks') {
      const auth = await c.env.DB.prepare(`SELECT internal_id, user_type FROM auth_bindings WHERE provider = 'telegram' AND provider_uid = ?`).bind(senderId).first();
      if (!auth || auth.user_type !== 'child') return await sendTgMessage(botToken, chatId, `👦 <b>此功能仅限孩子使用</b>\n家长请使用 /daily 查看概况。`);

      const child = await c.env.DB.prepare(`SELECT id, family_id, name FROM children WHERE id = ?`).bind(auth.internal_id).first();
      const todayStr = new Date(Date.now() + 8 * 3600 * 1000).toISOString().split('T')[0];

      // 查询未完成的日常任务
      const routines = await c.env.DB.prepare(`
        SELECT r.id, r.name, r.emoji, r.points FROM routines r
        LEFT JOIN routine_logs rl ON r.id = rl.routine_id AND rl.child_id = ? AND rl.date_str = ?
        WHERE r.family_id = ? AND (r.child_id = ? OR r.child_id IS NULL) AND r.status = 'active' AND rl.id IS NULL
      `).bind(child.id, todayStr, child.family_id, child.id).all();

      if (routines.results.length === 0) return await sendTgMessage(botToken, chatId, `🎉 <b>太棒了！</b>\n你今天的任务已经全部打卡完成了！`);

      let respText = `📅 <b>今日待办打卡</b>\n\n请点击下方按钮快速打卡：`;
      const keyboard = routines.results.map(r => ([{
        text: `✅ 打卡：${r.emoji || ''} ${r.name} (+${r.points})`,
        callback_data: `tk:${r.id}`
      }]));

      await sendTgMessageWithKeyboard(chatId, respText, keyboard, botToken);
    }

    // --- 🌟 功能 10: /rank 家庭荣誉榜 ---
    else if (command === '/rank') {
      const auth = await c.env.DB.prepare(`SELECT internal_id, user_type FROM auth_bindings WHERE provider = 'telegram' AND provider_uid = ?`).bind(senderId).first();
      if (!auth) return;

      const userId = auth.internal_id;
      const family = await c.env.DB.prepare(`
        SELECT f.id, f.point_emoji FROM families f
        JOIN ${auth.user_type === 'parent' ? 'memberships m ON f.id = m.family_id' : 'children c ON f.id = c.family_id'}
        WHERE ${auth.user_type === 'parent' ? 'm.user_id' : 'c.id'} = ? LIMIT 1
      `).bind(userId).first();

      const pEmoji = family?.point_emoji || '🪙';
      const children = await c.env.DB.prepare(`
        SELECT name, avatar, score_gained, (score_gained - score_spent) as balance 
        FROM children WHERE family_id = ? ORDER BY score_gained DESC
      `).bind(family.id).all();

      if (children.results.length === 0) return;

      let respText = `🏆 <b>家庭荣誉榜</b>\n\n<b>🥇 勤奋榜 (总成就)</b>\n`;
      children.results.forEach((c, i) => {
        const medal = i === 0 ? '🥇' : (i === 1 ? '🥈' : (i === 2 ? '🥉' : '👤'));
        respText += `${medal} ${c.avatar || ''}${c.name}：${c.score_gained} ${pEmoji}\n`;
      });

      respText += `\n<b>💰 财富榜 (当前余额)</b>\n`;
      const balanceRank = [...children.results].sort((a, b) => b.balance - a.balance);
      balanceRank.forEach((c, i) => {
        respText += `${i === 0 ? '👑' : '💎'} ${c.avatar || ''}${c.name}：${c.balance} ${pEmoji}\n`;
      });

      await sendTgMessage(botToken, chatId, respText);
    }

    // --- 🌟 功能 11: /undo 撤销最近操作 (家长专属) ---
    else if (command === '/undo') {
      const auth = await c.env.DB.prepare(`SELECT internal_id, user_type FROM auth_bindings WHERE provider = 'telegram' AND provider_uid = ?`).bind(senderId).first();
      if (!auth || auth.user_type !== 'parent') return await sendTgMessage(botToken, chatId, `❌ <b>仅限家长使用撤销功能</b>`);

      const familyId = (await c.env.DB.prepare(`SELECT family_id FROM memberships WHERE user_id = ? LIMIT 1`).bind(auth.internal_id).first())?.family_id;
      if (!familyId) return;

      // 查找该家庭最近 3 条没有被撤销的积分记录
      const histories = await c.env.DB.prepare(`
        SELECT h.id, c.name, h.points, h.remark, h.created_at 
        FROM history h JOIN children c ON h.child_id = c.id 
        WHERE h.family_id = ? 
          AND h.is_revoked = 0 
          AND h.created_at >= datetime('now', '-30 minutes') 
        ORDER BY h.created_at DESC LIMIT 3
      `).bind(familyId).all();

      if (histories.results.length === 0) return await sendTgMessage(botToken, chatId, `✅ 最近没有可以撤销的操作。`);

      let respText = `↩️ <b>撤销操作</b>\n\n请选择你要撤销的记录：`;
      const keyboard = histories.results.map(h => {
        const sign = h.points > 0 ? '+' : '';
        const shortRemark = (h.remark || '系统调整').substring(0, 10);
        return [{
          text: `撤销：${h.name} ${sign}${h.points} (${shortRemark})`,
          callback_data: `un:${h.id}`
        }];
        console.log('撤销按钮数据：', `un:${h.id}`);
      });

      await sendTgMessageWithKeyboard(chatId, respText, keyboard, botToken);
    }

    // --- 🌟 功能 12: /transfer 亲情互助转账 (孩子专属) ---
    else if (command === '/transfer') {
      const auth = await c.env.DB.prepare(`SELECT internal_id, user_type FROM auth_bindings WHERE provider = 'telegram' AND provider_uid = ?`).bind(senderId).first();
      if (!auth || auth.user_type !== 'child') return await sendTgMessage(botToken, chatId, `👦 <b>此功能仅限孩子使用</b>\n家长如果想扣分，请使用 /deduct 命令。`);

      const parts = text.split(/\s+/);
      const amount = parseInt(parts[1]);

      if (isNaN(amount) || amount <= 0) {
        return await sendTgMessage(botToken, chatId, `⚠️ <b>格式错误</b>\n请输入：<code>/transfer [分数]</code>\n例如：<code>/transfer 10</code>`);
      }

      const senderChild = await c.env.DB.prepare(`SELECT id, family_id, name, (score_gained - score_spent) as balance FROM children WHERE id = ?`).bind(auth.internal_id).first();
      
      if (senderChild.balance < amount) {
        return await sendTgMessage(botToken, chatId, `❌ <b>余额不足</b>\n你当前只有 ${senderChild.balance} 分，无法转出 ${amount} 分哦！`);
      }

      // 查找兄弟姐妹
      const siblings = await c.env.DB.prepare(`SELECT id, name, avatar FROM children WHERE family_id = ? AND id != ?`).bind(senderChild.family_id, senderChild.id).all();

      if (siblings.results.length === 0) {
        return await sendTgMessage(botToken, chatId, `🏠 <b>转账失败</b>\n家里目前只有你一个孩子哦，无法进行转账。`);
      }

      const family = await c.env.DB.prepare(`SELECT point_emoji FROM families WHERE id = ?`).bind(senderChild.family_id).first();
      const pEmoji = family?.point_emoji || '🪙';

      let respText = `💸 <b>亲情互助转账</b>\n\n准备转出：<b>${amount}</b> ${pEmoji}\n你的余额：${senderChild.balance} ${pEmoji}\n\n请选择你要送给谁：`;
      const keyboard = siblings.results.map(sib => ([{
        text: `🎁 送给 ${sib.avatar || ''}${sib.name}`,
        // 回调数据：tr:转账金额:接收者ID
        callback_data: `tr:${amount}:${sib.id}`
      }]));

      await sendTgMessageWithKeyboard(chatId, respText, keyboard, botToken);
    }

    // --- 🌟 功能 13: /medals 个人荣誉与勋章墙 ---
    else if (command === '/medals') {
      const auth = await c.env.DB.prepare(`SELECT internal_id, user_type FROM auth_bindings WHERE provider = 'telegram' AND provider_uid = ?`).bind(senderId).first();
      if (!auth) return;

      const familyId = auth.user_type === 'parent' 
        ? (await c.env.DB.prepare(`SELECT family_id FROM memberships WHERE user_id = ? LIMIT 1`).bind(auth.internal_id).first())?.family_id
        : (await c.env.DB.prepare(`SELECT family_id FROM children WHERE id = ? LIMIT 1`).bind(auth.internal_id).first())?.family_id;

      let query = `
        SELECT c.name as child_name, c.avatar, a.achievement_key, a.is_manual, a.manual_name, a.manual_emoji 
        FROM achievements a JOIN children c ON a.child_id = c.id 
        WHERE a.family_id = ? AND a.unlocked = 1
      `;
      let params = [familyId];

      if (auth.user_type === 'child') {
        query += ` AND a.child_id = ?`;
        params.push(auth.internal_id);
      }

      const medals = await c.env.DB.prepare(query).bind(...params).all();

      if (medals.results.length === 0) {
        return await sendTgMessage(botToken, chatId, `🎖️ <b>荣誉墙</b>\n\n目前还没有解锁任何勋章，继续加油哦！`);
      }

      // 将勋章按孩子进行分组
      const medalsByChild = {};
      medals.results.forEach(m => {
        if (!medalsByChild[m.child_name]) medalsByChild[m.child_name] = { avatar: m.avatar, items: [] };
        // 内置系统勋章的简单映射展示，如果想更丰富可以在这里完善字典
        const medalName = m.is_manual ? m.manual_name : (m.achievement_key || '隐藏成就');
        const medalEmoji = m.is_manual ? m.manual_emoji : '🏅';
        medalsByChild[m.child_name].items.push(`${medalEmoji} ${medalName}`);
      });

      let respText = `🎖️ <b>家庭荣誉勋章墙</b>\n\n`;
      for (const [childName, data] of Object.entries(medalsByChild)) {
        respText += `${data.avatar || '👦'} <b>${childName}的勋章：</b>\n`;
        data.items.forEach(item => respText += `  ${item}\n`);
        respText += `\n`;
      }

      await sendTgMessage(botToken, chatId, respText.trim());
    }

    // --- 🌟 功能 14: /wish 孩子的专属许愿池 ---
    else if (command === '/wish') {
      const auth = await c.env.DB.prepare(`SELECT internal_id, user_type FROM auth_bindings WHERE provider = 'telegram' AND provider_uid = ?`).bind(senderId).first();
      if (!auth || auth.user_type !== 'child') return await sendTgMessage(botToken, chatId, `👦 <b>许愿池仅限孩子使用哦！</b>\n家长请根据孩子的许愿在系统中设置奖励。`);

      const wishContent = text.replace('/wish', '').trim();
      if (!wishContent) return await sendTgMessage(botToken, chatId, `⚠️ <b>格式错误</b>\n请输入：<code>/wish [你想要的奖励]</code>\n例如：<code>/wish 周末去游乐园</code>`);

      const child = await c.env.DB.prepare(`SELECT name, family_id FROM children WHERE id = ?`).bind(auth.internal_id).first();
      const family = await c.env.DB.prepare(`SELECT tg_group_id FROM families WHERE id = ?`).bind(child.family_id).first();

      const msgText = `🌠 <b>许愿池有新动态！</b>\n\n👦 <b>${child.name}</b> 抛下一枚硬币，大声许愿：\n✨ <b>“${wishContent}”</b>\n\n👨‍👩‍👧 家长们，快去系统里把它设为目标 (Goal) 或上架到商店吧！`;
      
      const keyboard = chatType === 'private'
        ? [[{ text: "🚀 前往心愿单设置", web_app: { url: c.env.FRONTEND_URL } }]]
        : [[{ text: "🚀 前往心愿单设置", url: c.env.TG_DIRECT_URL }]];

      // 智能分发：如果绑了群就发群里，让全家都看到；否则发在当前聊天
      const targetChatId = family?.tg_group_id || chatId;
      await sendTgMessageWithKeyboard(targetChatId, msgText, keyboard, botToken);
      
      if (targetChatId !== chatId) {
         await sendTgMessage(botToken, chatId, `✅ 你的心愿已经成功发送给家长啦，耐心等待回音吧！`);
      }
    }

// --- 🌟 功能 15: /report 自动生成的今日家庭日报 ---
    else if (command === '/report') {
      const auth = await c.env.DB.prepare(`SELECT internal_id, user_type FROM auth_bindings WHERE provider = 'telegram' AND provider_uid = ?`).bind(senderId).first();
      if (!auth || auth.user_type !== 'parent') return await sendTgMessage(botToken, chatId, `❌ 仅限家长生成家庭日报。`);

      const familyId = (await c.env.DB.prepare(`SELECT family_id FROM memberships WHERE user_id = ? LIMIT 1`).bind(auth.internal_id).first())?.family_id;
      if (!familyId) return;

      // 🌟 核心优化：直接调用公共函数
      const respText = await generateDailyReport(c.env.DB, familyId, "📰 <b>【今日家庭日报】</b>");
      await sendTgMessage(botToken, chatId, respText);
    }

    // --- 🌟 功能 16: /streak 习惯连胜追踪 ---
    else if (command === '/streak') {
      const auth = await c.env.DB.prepare(`SELECT internal_id, user_type FROM auth_bindings WHERE provider = 'telegram' AND provider_uid = ?`).bind(senderId).first();
      if (!auth) return;

      const familyId = auth.user_type === 'parent' 
        ? (await c.env.DB.prepare(`SELECT family_id FROM memberships WHERE user_id = ? LIMIT 1`).bind(auth.internal_id).first())?.family_id
        : (await c.env.DB.prepare(`SELECT family_id FROM children WHERE id = ? LIMIT 1`).bind(auth.internal_id).first())?.family_id;
      if (!familyId) return;

      let childrenQuery = `SELECT id, name, avatar FROM children WHERE family_id = ?`;
      let params = [familyId];
      if (auth.user_type === 'child') {
        childrenQuery += ` AND id = ?`;
        params.push(auth.internal_id);
      }
      const children = await c.env.DB.prepare(childrenQuery).bind(...params).all();

      const today = new Date(Date.now() + 8 * 3600 * 1000);
      const todayStr = today.toISOString().split('T')[0];
      const yesterday = new Date(today.getTime() - 24 * 3600 * 1000);
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      let respText = `🔥 <b>打卡连胜榜</b>\n\n`;
      for (const child of children.results) {
        // 获取孩子最近的所有打卡日期
        const logs = await c.env.DB.prepare(`SELECT DISTINCT date_str FROM routine_logs WHERE child_id = ? AND status = 'completed' ORDER BY date_str DESC LIMIT 30`).bind(child.id).all();
        const dates = logs.results.map(r => r.date_str);
        
        let streak = 0;
        let currentDate = new Date(today);
        let dateToCheck = todayStr;
        
        // 核心算法：如果今天还没打卡，那就看看昨天打没打卡，允许容错
        if (!dates.includes(todayStr) && dates.includes(yesterdayStr)) {
            dateToCheck = yesterdayStr;
            currentDate = new Date(yesterday);
        }
        
        if (dates.includes(dateToCheck)) {
            streak = 1;
            while(true) {
                currentDate = new Date(currentDate.getTime() - 24 * 3600 * 1000);
                const prevStr = currentDate.toISOString().split('T')[0];
                if (dates.includes(prevStr)) streak++;
                else break; // 连胜中断
            }
        }
        const emoji = streak >= 3 ? '🔥' : (streak > 0 ? '🌱' : '💤');
        respText += `${child.avatar || '👦'} <b>${child.name}</b>：当前连胜 <b>${streak}</b> 天 ${emoji}\n`;
      }
      await sendTgMessage(botToken, chatId, respText);
    }

    // --- 🌟 功能 17: /nudge 爱的提醒 (家长专属) ---
    else if (command === '/nudge') {
      const auth = await c.env.DB.prepare(`SELECT internal_id, user_type FROM auth_bindings WHERE provider = 'telegram' AND provider_uid = ?`).bind(senderId).first();
      if (!auth || auth.user_type !== 'parent') return await sendTgMessage(botToken, chatId, `❌ <b>权限不足</b>\n“爱的提醒”是家长专属技能哦！`);

      const familyId = (await c.env.DB.prepare(`SELECT family_id FROM memberships WHERE user_id = ? LIMIT 1`).bind(auth.internal_id).first())?.family_id;
      const children = await c.env.DB.prepare(`SELECT id, name, avatar FROM children WHERE family_id = ?`).bind(familyId).all();

      let respText = `🔔 <b>爱的提醒</b>\n\n你想戳一戳哪个孩子，提醒 Ta 去做任务呢？`;
      const keyboard = children.results.map(c => ([{
        text: `👉 戳一下 ${c.avatar || ''} ${c.name}`,
        callback_data: `nd:${c.id}`
      }]));

      await sendTgMessageWithKeyboard(chatId, respText, keyboard, botToken);
    }

    // --- 🌟 功能 18: /stats 个人财报分析 ---
    else if (command === '/stats') {
      const auth = await c.env.DB.prepare(`SELECT internal_id, user_type FROM auth_bindings WHERE provider = 'telegram' AND provider_uid = ?`).bind(senderId).first();
      if (!auth) return;

      const familyId = auth.user_type === 'parent' 
        ? (await c.env.DB.prepare(`SELECT family_id FROM memberships WHERE user_id = ? LIMIT 1`).bind(auth.internal_id).first())?.family_id
        : (await c.env.DB.prepare(`SELECT family_id FROM children WHERE id = ? LIMIT 1`).bind(auth.internal_id).first())?.family_id;

      let childrenQuery = `SELECT id, name, avatar FROM children WHERE family_id = ?`;
      let params = [familyId];
      if (auth.user_type === 'child') {
        childrenQuery += ` AND id = ?`;
        params.push(auth.internal_id);
      }
      const children = await c.env.DB.prepare(childrenQuery).bind(...params).all();
      
      let respText = `📊 <b>本周（最近7天）财报分析</b>\n\n`;
      
      for (const child of children.results) {
         // 统计本周主要收入项 (前 2 名)
         const incomes = await c.env.DB.prepare(`
           SELECT remark, SUM(points) as total FROM history 
           WHERE child_id = ? AND points > 0 AND is_revoked = 0 AND created_at >= datetime('now', '-7 days')
           GROUP BY remark ORDER BY total DESC LIMIT 2
         `).bind(child.id).all();

         // 统计本周主要支出项 (前 2 名)
         const expenses = await c.env.DB.prepare(`
           SELECT remark, SUM(ABS(points)) as total FROM history 
           WHERE child_id = ? AND points < 0 AND is_revoked = 0 AND created_at >= datetime('now', '-7 days')
           GROUP BY remark ORDER BY total DESC LIMIT 2
         `).bind(child.id).all();

         respText += `${child.avatar || '👦'} <b>${child.name} 的流水特征</b>\n`;
         if (incomes.results.length === 0 && expenses.results.length === 0) {
            respText += `  └ 本周佛系躺平，暂无交易记录 💤\n\n`;
            continue;
         }

         if (incomes.results.length > 0) {
             respText += `  🟢 主要赚钱方式:\n`;
             incomes.results.forEach(i => {
                const remarkClean = (i.remark || '系统发分').replace('[快捷奖惩] ', '').replace('任务：', '').substring(0, 15);
                respText += `    └ ${remarkClean}: +${i.total} 分\n`;
             });
         }
         if (expenses.results.length > 0) {
             respText += `  🔴 剁手花钱流向:\n`;
             expenses.results.forEach(e => {
                const remarkClean = (e.remark || '系统扣分').replace('[快捷奖惩] ', '').replace('兑换：', '').substring(0, 15);
                respText += `    └ ${remarkClean}: -${e.total} 分\n`;
             });
         }
         respText += `\n`;
      }
      await sendTgMessage(botToken, chatId, respText.trim());
    }

    // --- 🌟 功能 19: /push_test 测试定时推送机制 ---
    else if (command === '/push_test') {
      const auth = await c.env.DB.prepare(`SELECT internal_id, user_type FROM auth_bindings WHERE provider = 'telegram' AND provider_uid = ?`).bind(senderId).first();
      if (!auth || auth.user_type !== 'parent') return await sendTgMessage(botToken, chatId, `❌ <b>权限不足</b>\n仅家长可使用推送测试。`);

      const family = await c.env.DB.prepare(`
        SELECT f.id, f.tg_group_id, f.push_enabled, f.push_time 
        FROM families f JOIN memberships m ON f.id = m.family_id 
        WHERE m.user_id = ? LIMIT 1
      `).bind(auth.internal_id).first();

      if (!family) return;

      // 🌟 核心优化：直接调用公共函数
      const respText = await generateDailyReport(c.env.DB, family.id, "🔧 <b>【推送测试】晚间家庭日报</b>");

      // 🌟 模拟路由逻辑：优先群组，否则私聊
      let targetChatId = family.tg_group_id;
      let targetName = "家庭群组";
      
      if (!targetChatId) {
        targetChatId = chatId;
        targetName = "当前私聊";
      }

      if (String(targetChatId) !== String(chatId)) {
         await sendTgMessage(botToken, chatId, `✅ <b>触发成功</b>\n\n当前的定时推送状态：<b>${family.push_enabled ? '已开启' : '已关闭'}</b>\n设定的定时时间：<b>${family.push_time || '未设置'}</b>\n\n测试日报已发送至 <b>${targetName}</b>，请前往查看！`);
      }

      await sendTgMessage(botToken, targetChatId, respText);
    }

    // --- 🌟 替换原有的 /help 使用说明书 ---
    else if (command === '/help') {
      const isPrivate = chatType === 'private';
      const webAppBtn = isPrivate 
        ? { text: "🚀 开启系统", web_app: { url: c.env.FRONTEND_URL } } 
        : { text: "🚀 进入系统", url: c.env.TG_DIRECT_URL }; 

      const helpText = `
🤖 <b>家庭积分管家指南</b>

📊 <b>日常查询</b>
/balance 或 /coins - 查看可用余额
/pending - 查看待审批的任务
/history - 查看最近积分流水
/goals - 查看进行中的心愿进度
/shop - 🎁 逛逛心愿商店橱窗
/daily - 📅 今日打卡与待办概况
/rank - 🏆 家庭荣誉榜单
/medals - 🎖️ 个人荣誉与勋章墙
/stats - 📈 个人财报分析
/streak - 🔥 打卡连胜追踪

🫶🏼 <b>孩子专属</b>
/tasks - 📋 孩子专用打卡清单
/transfer [分数] - 💸 孩子专用亲情转账
/wish [愿望内容] - 🌠 孩子专属许愿池

👨🏼‍🔧 <b>家长专属</b>
/reward [分数] [理由] - 快捷奖励孩子
/deduct [分数] [理由] - 快捷扣除孩子积分
/undo - ↩️ 家长专用撤销最近操作
/report - 📰 自动生成今日家庭日报
/nudge - 🔔 爱的提醒，戳一戳孩子去做任务

⚙️ <b>管理设置</b>
/invite - (管理员) 一键生成家人邀请码
/bindgroup - (仅限群组) 绑定当前通知群
/push_test - (家长) 测试定时推送功能
/start - 唤起主程序面板

快点击下方按钮，开始您的积分之旅吧！✨
      `;
      await sendTgMessageWithKeyboard(chatId, helpText.trim(), [[webAppBtn]], botToken);
    }


  }catch (e) {
    console.error(`[Telegram Command Error]`, e);
  }

  // ================= 指令结束 =================

  return c.json({ ok: true });
});

// ==========================================
// 3. 飞书机器人 Webhook (Lark)
// ==========================================
webhook.post('/lark-bot', async (c) => {
  const body = await c.req.json();

  if (body.type === 'url_verification') return c.json({ challenge: body.challenge });

  if (body.action && body.action.value) {
    const actionVal = body.action.value;
    const openId = body.open_id;

    const userRecord = await c.env.DB.prepare(`
      SELECT b.internal_id, b.user_type, u.role, u.locale
      FROM auth_bindings b
      LEFT JOIN users u ON b.internal_id = u.id AND b.user_type = 'parent'
      WHERE b.provider = 'feishu' AND b.provider_uid = ?
    `).bind(openId).first();

    const locale = userRecord?.locale || 'zh-CN';

    if (!userRecord || userRecord.user_type !== 'parent' || userRecord.role === 'viewer') {
      console.warn(`[Business Warn] 飞书越权审批尝试. OpenID: ${openId}`);
      return c.json({ toast: { type: "error", content: t('api.err_unauthorized', locale) } });
    }

    const redemptionId = actionVal.redemptionId;
    const isApprove = actionVal.action === 'approve';
    const record = await c.env.DB.prepare(`SELECT * FROM redemptions WHERE id = ? AND status = 'pending'`).bind(redemptionId).first();
    
    if (!record) return c.json({ toast: { type: "warning", content: t('bot.request_handled', locale) } });

    try {
      if (isApprove) {
        await c.env.DB.batch([
          c.env.DB.prepare(`UPDATE redemptions SET status = 'approved', approved_by = ? WHERE id = ?`).bind(userRecord.internal_id, redemptionId),
          c.env.DB.prepare(`UPDATE children SET score_spent = score_spent + ? WHERE id = ?`).bind(record.cost, record.child_id),
          c.env.DB.prepare(`UPDATE rewards SET stock = stock - 1 WHERE id = ? AND stock > 0`).bind(record.reward_id)
        ]);
        c.executionCtx.waitUntil(checkAchievementUnlock(c.env.DB, c.env, userRecord.family_id, record.child_id));
      } else {
        await c.env.DB.prepare(`UPDATE redemptions SET status = 'rejected', approved_by = ? WHERE id = ?`).bind(userRecord.internal_id, redemptionId).run();
      }

      const statusText = isApprove ? t('bot.approved_toast', locale) : t('bot.rejected_toast', locale);
      return c.json({
        config: { wide_screen_mode: true },
        header: { title: { tag: "plain_text", content: t('bot.result', locale) }, template: isApprove ? "green" : "red" },
        elements: [{ tag: "div", text: { tag: "lark_md", content: `**${t('bot.result', locale)}:** ${statusText}` } }]
      });
    } catch (e) {
      console.error(`[System Error] 飞书审批处理失败. Error:`, e);
      return c.json({ toast: { type: "error", content: t('api.err_system_error', locale) } });
    }
  }

  return c.json({ code: 0 });
});

// ==========================================
// 4. 支付宝 Webhook
// ==========================================
webhook.post('/alipay-bot', async (c) => {
  const body = await c.req.parseBody();
  const bizContent = body.biz_content ? JSON.parse(body.biz_content) : null;
  if (!bizContent) return c.text('success');

  // ... 支付宝处理逻辑
  return c.text('success'); 
});

// ==========================================
// 5. 超级管理员 Bot (Root Bot)
// ==========================================
webhook.post('/root-bot', async (c) => {
  const body = await c.req.json();
  
  const shouldIntercept = await checkTelegramSecurity(c, body);
  if (shouldIntercept) return c.text('OK', 200); 

  const msg = body.message;
  if (!msg || !msg.from) return c.text('OK');

  const senderId = String(msg.from.id);
  const text = msg.text || '';
  const rootIds = (c.env.ROOT_ADMIN_TG_IDS || '').split(',');

  if (!rootIds.includes(senderId)) {
    console.warn(`[Security Warn] Root Bot 拦截到未授权访问. TG_UID: ${senderId}, 尝试指令: ${text}`);
    return c.text('Unauthorized', 403);
  }

  try {
    const command = text.split(' ')[0];
    if (command === '/stats') {
      const familiesCount = await c.env.DB.prepare(`SELECT COUNT(*) as c FROM families`).first('c') || 0;
      const usersCount = await c.env.DB.prepare(`SELECT COUNT(*) as c FROM users`).first('c') || 0;
      await sendTgMessage(c.env.ROOT_BOT_TOKEN, senderId, `📊 <b>系统大盘</b>\n\n🏠 家庭总数: ${familiesCount}\n👨‍👩‍👧 家长总数: ${usersCount}`);
    } 
    else if (command === '/setup') {
      // 🌟 1. 发送并记录初始化消息
      const setupMsgRes = await sendTgMessage(c.env.ROOT_BOT_TOKEN, senderId, `⏳ 正在初始化系统配置 (Webhook & 快捷菜单)...`);
      const setupMsgId = setupMsgRes?.result?.message_id;
      const baseUrl = new URL(c.req.url).origin;
      
      // 🌟 1. 一键设置 Webhook (带上安全密钥)
      await fetch(`https://api.telegram.org/bot${c.env.BOT_TOKEN}/setWebhook`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: `${baseUrl}/api/webhook/telegram`, secret_token: c.env.TG_WEBHOOK_SECRET })
      });
      await fetch(`https://api.telegram.org/bot${c.env.ROOT_BOT_TOKEN}/setWebhook`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: `${baseUrl}/api/webhook/root-bot`, secret_token: c.env.TG_WEBHOOK_SECRET })
      });

      // 🌟 2. 一键设置快捷菜单 Commands
      const rootCommands = [
        { command: 'stats', description: '📊 查看系统运行大盘' },
        { command: 'broadcast', description: '📢 发送全站公告' },
        { command: 'reply', description: '💬 回复用户消息' },
        { command: 'inspect', description: '🔍 诊断家庭健康状况' },
        { command: 'maintenance', description: '🔧 启停维护模式' },
        { command: 'setup', description: '⚙️ 重新初始化配置' },
        { command: 'backup', description: '📦 导出系统数据' },
        { command: 'help', description: '❓ 查看管理员帮助' }
      ];
      const userCommands = [
        { command: 'start', description: '🚀 打开家庭积分系统' },
        { command: 'balance', description: '💰 快捷查分' },
        { command: 'pending', description: '📝 待办审批查询' },
        { command: 'history', description: '📜 最近积分流水' },
        { command: 'goals', description: '🎯 当前目标追踪' },
        { command: 'shop', description: '🎁 心愿商店橱窗' },
        { command: 'streak', description: '🔥 打卡连胜追踪' },
        { command: 'stats', description: '📈 个人财报分析' },
        { command: 'tasks', description: '📋 孩子专用打卡清单' },
        { command: 'transfer', description: '💸 孩子专用亲情转账' },
        { command: 'wish', description: '🌠 孩子专属许愿池' },
        { command: 'rank', description: '🏆 家庭荣誉榜单' },
        { command: 'medals', description: '🎖️ 个人荣誉与勋章墙' },
        { command: 'daily', description: '📅 今日打卡与待办概况' },
        { command: 'reward', description: '🎁 快捷奖励孩子' },
        { command: 'deduct', description: '❌ 快捷扣除孩子积分' },
        { command: 'undo', description: '↩️ 家长专用撤销最近操作' },
        { command: 'report', description: '📰 自动生成今日家庭日报' },
        { command: 'nudge', description: '🔔 爱的提醒，戳一戳孩子去做任务' },
        { command: 'invite', description: '(管理员) 🔑 生成管理员邀请码' },
        { command: 'bindgroup', description: '(仅限群组) 🔗 绑定当前群组到家庭' },
        { command: 'push_test', description: '(家长) 🔧 测试定时推送功能' },
        { command: 'help', description: '❓ 获取帮助' }
      ];

      await Promise.all([
        fetch(`https://api.telegram.org/bot${c.env.ROOT_BOT_TOKEN}/setMyCommands`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ commands: rootCommands })
        }),
        fetch(`https://api.telegram.org/bot${c.env.BOT_TOKEN}/setMyCommands`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ commands: userCommands })
        })
      ]);

      // 🌟 2. 删除“正在初始化”的消息
      if (setupMsgId) {
        await deleteTgMessage(senderId, setupMsgId, c.env.ROOT_BOT_TOKEN);
      }

      await sendTgMessage(c.env.ROOT_BOT_TOKEN, senderId, `✅ <b>初始化配置成功！</b>\n🔗 基础域名: ${baseUrl}\n✨ Webhook 与快捷菜单已全部就绪，请重启 Telegram 客户端查看菜单变化。`);
    } 
    // --- 🌟 功能 3: /backup 一键导出系统数据 (Root 专属) ---
    else if (command === '/backup') {
      const tgMsgRes = await sendTgMessage(c.env.ROOT_BOT_TOKEN, senderId, `📦 正在生成全站核心数据备份...`);
      const tgMsgId = tgMsgRes?.result?.message_id;
      // 聚合查询 (示例：查询所有家庭和成员数)
      const data = {
        timestamp: new Date().toISOString(),
        stats: {
          families: await c.env.DB.prepare(`SELECT * FROM families`).all().then(r => r.results),
          users: await c.env.DB.prepare(`SELECT * FROM users`).all().then(r => r.results)
        }
      };

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });

      if (tgMsgId) {
        await deleteTgMessage(senderId, tgMsgId, c.env.ROOT_BOT_TOKEN);
      }
      await sendTgDocument(senderId, blob, `System_Full_Backup_${Date.now()}.json`, "🔐 全站核心结构备份", c.env.ROOT_BOT_TOKEN);
    }

    // --- 🌟 功能 4: /broadcast 全站公告 ---
    else if (command === '/broadcast') {
      const broadcastContent = text.replace('/broadcast', '').trim();
      if (!broadcastContent) return await sendTgMessage(c.env.ROOT_BOT_TOKEN, senderId, `⚠️ 请输入广播内容，例如：/broadcast 系统维护通知`);

      const families = await c.env.DB.prepare(`SELECT tg_group_id FROM families WHERE tg_group_id IS NOT NULL`).all();
      
      let successCount = 0;
      for (const f of families.results) {
        try {
          await sendTgMessage(c.env.BOT_TOKEN, f.tg_group_id, `📢 <b>系统重要公告</b>\n\n${broadcastContent}`);
          successCount++;
        } catch (e) {}
      }
      await sendTgMessage(c.env.ROOT_BOT_TOKEN, senderId, `✅ 广播发送完毕！\n成功送达 ${successCount} 个家庭群组。`);
    }

    // --- 🌟 高级功能 1: /reply 客服系统闭环 ---
    else if (command === '/reply') {
      const parts = text.split(/\s+/);
      const targetUid = parts[1];
      const replyContent = parts.slice(2).join(' ');
      
      if (!targetUid || !replyContent) {
        return await sendTgMessage(c.env.ROOT_BOT_TOKEN, senderId, `⚠️ <b>格式错误</b>\n请输入：<code>/reply [用户Telegram_ID] [回复内容]</code>`);
      }

      try {
        // 🌟 重点：使用普通业务 Bot 的 Token 发送给用户，让用户感觉是系统在回复
        await sendTgMessage(c.env.BOT_TOKEN, targetUid, `👨‍💻 <b>管理员回复您的反馈：</b>\n\n${replyContent}`);
        await sendTgMessage(c.env.ROOT_BOT_TOKEN, senderId, `✅ 成功回复给用户 ${targetUid}。`);
      } catch (err) {
        await sendTgMessage(c.env.ROOT_BOT_TOKEN, senderId, `❌ 回复失败，该用户可能未激活机器人。`);
      }
    }

    // --- 🌟 高级功能 2: /inspect 租户健康诊断 ---
    else if (command === '/inspect') {
      const targetId = text.split(/\s+/)[1];
      if (!targetId) return await sendTgMessage(c.env.ROOT_BOT_TOKEN, senderId, `⚠️ 请输入家庭 ID，例如：<code>/inspect fam_xxx</code>`);

      const family = await c.env.DB.prepare(`SELECT * FROM families WHERE id = ?`).bind(targetId).first();
      if (!family) return await sendTgMessage(c.env.ROOT_BOT_TOKEN, senderId, `❌ 找不到该家庭。`);

      const users = await c.env.DB.prepare(`SELECT COUNT(*) as c FROM memberships WHERE family_id = ?`).bind(targetId).first('c') || 0;
      const children = await c.env.DB.prepare(`SELECT COUNT(*) as c FROM children WHERE family_id = ?`).bind(targetId).first('c') || 0;
      const pendings = await c.env.DB.prepare(`SELECT COUNT(*) as c FROM approvals WHERE family_id = ? AND status = 'pending'`).bind(targetId).first('c') || 0;

      const report = `🔍 <b>家庭诊断透视</b>\n\n🏠 <b>名称</b>: ${family.avatar || ''} ${family.name}\n🆔 <b>ID</b>: <code>${family.id}</code>\n👥 <b>成员</b>: ${users} 位家长, ${children} 名孩子\n🔗 <b>绑群</b>: ${family.tg_group_id ? `已绑定 (${family.tg_group_id})` : '未绑定'}\n⏰ <b>推送</b>: ${family.push_enabled ? `开启 (${family.push_time})` : '关闭'}\n⚠️ <b>积压审批</b>: ${pendings} 个待办`;
      await sendTgMessage(c.env.ROOT_BOT_TOKEN, senderId, report);
    }

    // --- 🌟 高级功能 3: /maintenance 维护模式启停 ---
    else if (command === '/maintenance') {
      const action = text.split(/\s+/)[1];
      
      // 动态创建系统配置表（如果不存在的话）
      await c.env.DB.prepare(`CREATE TABLE IF NOT EXISTS system_kv (key TEXT PRIMARY KEY, value TEXT)`).run();

      if (action === 'on') {
        await c.env.DB.prepare(`INSERT INTO system_kv (key, value) VALUES ('maintenance', '1') ON CONFLICT(key) DO UPDATE SET value = '1'`).run();
        await sendTgMessage(c.env.ROOT_BOT_TOKEN, senderId, `🚧 <b>维护模式已开启！</b>\n业务 Bot 将拦截所有普通用户请求。`);
      } else if (action === 'off') {
        await c.env.DB.prepare(`INSERT INTO system_kv (key, value) VALUES ('maintenance', '0') ON CONFLICT(key) DO UPDATE SET value = '0'`).run();
        await sendTgMessage(c.env.ROOT_BOT_TOKEN, senderId, `✅ <b>维护模式已关闭！</b>\n系统已恢复正常响应。`);
      } else {
        const status = await c.env.DB.prepare(`SELECT value FROM system_kv WHERE key = 'maintenance'`).first('value');
        await sendTgMessage(c.env.ROOT_BOT_TOKEN, senderId, `当前状态: ${status === '1' ? '🚧 维护中 (拦截请求)' : '✅ 正常运行'}\n\n开启: <code>/maintenance on</code>\n关闭: <code>/maintenance off</code>`);
      }
    }

    else if (text === '/help' || text === '/start') {
      await sendTgMessage(c.env.ROOT_BOT_TOKEN, senderId, `
👑 <b>超级管理员控制台</b>

/stats - 系统大盘
/broadcast [内容] - 发送全站公告
/reply [用户TG_ID] [内容] - 回复用户反馈
/inspect [家庭ID] - 诊断家庭健康状况
/maintenance [on/off] - 启停维护模式
/backup - 导出全站核心数据备份
/setup - 一键配置 Webhook 与菜单
/help - 帮助
      `);
    }
  } catch (e) {
    console.error(`[System Error] Root Bot 指令执行失败. 指令: ${text}, Error:`, e);
    await sendTgMessage(c.env.ROOT_BOT_TOKEN, senderId, `❌ 系统错误: ${e.message}`);
  }

  return c.text('OK');
});

export default webhook;