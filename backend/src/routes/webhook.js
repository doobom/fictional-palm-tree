// src/routes/webhook.js
import { Hono } from 'hono';
import { sendTgMessage, answerCallbackQuery, editMessageText } from '../utils/telegram.js';
import { getTenantAccessToken, sendLarkMessage } from '../utils/lark.js';
import { sendAlipayMessage } from '../utils/alipay.js';
import { t } from '../utils/i18n.js';
import { checkAchievementUnlock } from './achievements.js';

const webhook = new Hono();

/**
 * 🛡️ 核心防御校验器：Secret Token + 幂等性(防重放)
 */
async function checkTelegramSecurity(c, body) {
  const secretToken = c.req.header('X-Telegram-Bot-Api-Secret-Token');
  if (secretToken !== c.env.TG_WEBHOOK_SECRET) {
    console.warn(`[Security Warn] Webhook 密钥拦截! 收到: ${secretToken}`);
    return true; 
  }

  const updateId = body.update_id;
  if (!updateId) return false; 

  try {
    await c.env.DB.prepare(
      `INSERT INTO processed_updates (update_id) VALUES (?)`
    ).bind(updateId).run();
    return false; 
  } catch (err) {
    if (err.message.includes('UNIQUE constraint failed')) {
      console.log(`♻️ 拦截到重复的 Webhook 推送 (update_id: ${updateId})，已安全丢弃。`);
      return true; 
    }
    throw err; 
  }
}

// ==========================================
// 1. 超级管理员 Bot (Root Bot)
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
    if (text === '/stats') {
      const familiesCount = await c.env.DB.prepare(`SELECT COUNT(*) as c FROM families`).first('c');
      const usersCount = await c.env.DB.prepare(`SELECT COUNT(*) as c FROM users`).first('c');
      await sendTgMessage(c.env.ROOT_BOT_TOKEN, senderId, `📊 <b>系统大盘</b>\n\n🏠 家庭总数: ${familiesCount.c}\n👨‍👩‍👧 家长总数: ${usersCount.c}`);
    } 
    else if (text === '/setup') {
      await sendTgMessage(c.env.ROOT_BOT_TOKEN, senderId, `⏳ 正在初始化系统配置 (Webhook & 快捷菜单)...`);
      const baseUrl = new URL(c.req.url).origin;
      
      // 🌟 1. 一键设置 Webhook (带上安全密钥)
      await fetch(`https://api.telegram.org/bot${c.env.BOT_TOKEN}/setWebhook`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: `${baseUrl}/api/webhook/bot`, secret_token: c.env.TG_WEBHOOK_SECRET })
      });
      await fetch(`https://api.telegram.org/bot${c.env.ROOT_BOT_TOKEN}/setWebhook`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: `${baseUrl}/api/webhook/root-bot`, secret_token: c.env.TG_WEBHOOK_SECRET })
      });

      // 🌟 2. 一键设置快捷菜单 Commands
      const rootCommands = [
        { command: 'stats', description: '📊 查看系统运行大盘' },
        { command: 'setup', description: '⚙️ 重新初始化配置' },
        { command: 'help', description: '❓ 查看管理员帮助' }
      ];
      const userCommands = [
        { command: 'start', description: '🚀 打开家庭积分系统' },
        { command: 'help', description: '❓ 获取帮助指南' }
      ];

      // 写入 Root Bot 菜单
      await fetch(`https://api.telegram.org/bot${c.env.ROOT_BOT_TOKEN}/setMyCommands`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commands: rootCommands })
      });
      
      // 写入普通 Bot 菜单
      await fetch(`https://api.telegram.org/bot${c.env.BOT_TOKEN}/setMyCommands`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commands: userCommands })
      });

      await sendTgMessage(c.env.ROOT_BOT_TOKEN, senderId, `✅ <b>初始化配置成功！</b>\n🔗 基础域名: ${baseUrl}\n✨ Webhook 与快捷菜单已全部就绪，请重启 Telegram 客户端查看菜单变化。`);
    } 
    else if (text === '/help' || text === '/start') {
      await sendTgMessage(c.env.ROOT_BOT_TOKEN, senderId, `👑 <b>超级管理员控制台</b>\n\n/stats - 系统大盘\n/setup - 一键配置 Webhook 与菜单\n/help - 帮助`);
    }
  } catch (e) {
    console.error(`[System Error] Root Bot 指令执行失败. 指令: ${text}, Error:`, e);
    await sendTgMessage(c.env.ROOT_BOT_TOKEN, senderId, `❌ 系统错误: ${e.message}`);
  }

  return c.text('OK');
});

// ==========================================
// 2. 普通用户 Bot (Telegram)
// ==========================================
webhook.post('/bot', async (c) => {
  const body = await c.req.json();
  
  const shouldIntercept = await checkTelegramSecurity(c, body);
  if (shouldIntercept) return c.text('OK', 200); 

  let tgUid, text, callbackData, callbackQueryId, messageId;
  
  if (body.message) {
    tgUid = String(body.message.from.id);
    text = body.message.text || '';
  } else if (body.callback_query) {
    tgUid = String(body.callback_query.from.id);
    callbackData = body.callback_query.data;
    callbackQueryId = body.callback_query.id;
    messageId = body.callback_query.message.message_id;
  } else {
    return c.text('OK');
  }

  const userRecord = await c.env.DB.prepare(`
    SELECT 
      b.internal_id, b.user_type, u.role, u.family_id,
      COALESCE(u.locale, ch.locale, 'zh-CN') AS locale
    FROM auth_bindings b
    LEFT JOIN users u ON b.internal_id = u.id AND b.user_type = 'parent'
    LEFT JOIN children ch ON b.internal_id = ch.id AND b.user_type = 'child'
    WHERE b.provider = 'telegram' AND b.provider_uid = ?
  `).bind(tgUid).first();

  const locale = userRecord?.locale || 'zh-CN';

  if (!userRecord) {
    console.info(`[Bot Info] 未绑定用户访问 Telegram Bot. UID: ${tgUid}`);
    const replyText = text.startsWith('/bind ') 
      ? t('bot.bind_prompt', locale) 
      : t('bot.unbound_greeting', locale);
    await sendTgMessage(c.env.BOT_TOKEN, tgUid, replyText);
    return c.text('OK');
  }

  if (callbackData) {
    if (userRecord.user_type !== 'parent' || userRecord.role === 'viewer') {
       console.warn(`[Business Warn] 越权审批尝试. UID: ${tgUid}, 角色: ${userRecord?.role}`);
       await answerCallbackQuery(c.env.BOT_TOKEN, callbackQueryId, t('api.err_unauthorized', locale), true);
       return c.text('OK');
    }

    const isApprove = callbackData.startsWith('approve_');
    const isReject = callbackData.startsWith('reject_');
    let redemptionId = ''; 

    if (isApprove || isReject) {
      redemptionId = callbackData.split('_')[1];
      const record = await c.env.DB.prepare(`SELECT * FROM redemptions WHERE id = ? AND status = 'pending'`).bind(redemptionId).first();
      
      if (!record) {
        await answerCallbackQuery(c.env.BOT_TOKEN, callbackQueryId, t('bot.request_handled', locale));
        await editMessageText(c.env.BOT_TOKEN, tgUid, messageId, `~~${t('bot.request_handled', locale)}~~`);
        return c.text('OK');
      }

      try {
        if (isApprove) {
          await c.env.DB.batch([
            c.env.DB.prepare(`UPDATE redemptions SET status = 'approved', approved_by = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(userRecord.internal_id, redemptionId),
            c.env.DB.prepare(`UPDATE children SET score_spent = score_spent + ? WHERE id = ?`).bind(record.cost, record.child_id),
            c.env.DB.prepare(`UPDATE rewards SET stock = stock - 1 WHERE id = ? AND stock > 0`).bind(record.reward_id)
          ]);

          c.executionCtx.waitUntil(checkAchievementUnlock(c.env.DB, userRecord.family_id, record.child_id));
        } else {
          await c.env.DB.prepare(`UPDATE redemptions SET status = 'rejected', approved_by = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(userRecord.internal_id, redemptionId).run();
        }

        const statusText = isApprove ? t('bot.approved_toast', locale) : t('bot.rejected_toast', locale);
        await answerCallbackQuery(c.env.BOT_TOKEN, callbackQueryId, statusText);
        
        const originalText = body.callback_query.message.text;
        await editMessageText(c.env.BOT_TOKEN, tgUid, messageId, `${originalText}\n\n👉 <b>${t('bot.result', locale)}</b>: ${statusText}`);
      } catch (e) {
        console.error(`[System Error] TG Bot 审批处理失败. RedemptionID: ${redemptionId}, Error:`, e);
        await answerCallbackQuery(c.env.BOT_TOKEN, callbackQueryId, t('api.err_system_error', locale), true);
      }
    }
    return c.text('OK');
  }

  try {
    if (text === '/start' || text === '/help') {
      const replyKey = userRecord.user_type === 'child' ? 'bot.welcome_child' : 'bot.welcome_parent';
      await sendTgMessage(c.env.BOT_TOKEN, tgUid, t(replyKey, locale));
    }
  } catch (e) {
    console.error(`[System Error] TG Bot 文本处理失败. UID: ${tgUid}, Error:`, e);
  }

  return c.text('OK');
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
        c.executionCtx.waitUntil(checkAchievementUnlock(c.env.DB, userRecord.family_id, record.child_id));
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

export default webhook;