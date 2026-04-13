// backend/src/queues/rewardsHandler.js
import { sendTgMessage, sendTgMessageWithKeyboard } from '../utils/telegram.js';
import { getTenantAccessToken, sendLarkMessage, sendLarkCard } from '../utils/lark.js';
import { sendAlipayMessage } from '../utils/alipay.js'; 
import { t } from '../utils/i18n.js'; // 🌟 引入多语言翻译工具

// 场景 A：处理需要审批的兑换申请
export async function handleRedeemApproval(data, env) {
  // 🌟 SQL 新增查询 u.locale
  const parents = await env.DB.prepare(`
    SELECT b.provider_uid, b.provider, u.locale 
    FROM auth_bindings b
    JOIN users u ON b.internal_id = u.id
    WHERE u.family_id = ? 
      AND b.user_type = 'parent' 
      AND u.role IN ('admin', 'superadmin')
  `).bind(data.familyId).all();

  if (!parents.results || parents.results.length === 0) return;

  // 预先获取飞书 Token
  const hasLark = parents.results.some(p => p.provider === 'feishu');
  let larkToken = null;
  if (hasLark && env.LARK_APP_ID && env.LARK_APP_SECRET) {
    larkToken = await getTenantAccessToken(env.LARK_APP_ID, env.LARK_APP_SECRET).catch(()=>null);
  }

  // 🌟 1. 组装个性化货币字符串
  const pointStr = `${data.pointEmoji || '🪙'}${data.pointName || '积分'}`;

  // 🌟 遍历每个家长，根据他们的 locale 动态发送消息
  const sendPromises = parents.results.map(parent => {
    const locale = parent.locale || 'zh-CN'; // 兜底中文
    
    // 获取翻译后的主文本
    const text = t('bot.approval_notice', locale, {
      childName: data.childName,
      rewardName: data.rewardName,
      cost: data.cost,
      balance: data.balance,
      pointStr: pointStr // 🌟 将个性化货币字符串传入翻译函数
    });

    switch (parent.provider) {
      case 'telegram':
        // 动态翻译 Telegram 的按钮
        const tgKeyboard = {
          inline_keyboard: [
            [
              { text: t('bot.btn_approve', locale), callback_data: `approve_${data.redemptionId}` },
              { text: t('bot.btn_reject', locale), callback_data: `reject_${data.redemptionId}` }
            ]
          ]
        };
        return sendTgMessageWithKeyboard(env.BOT_TOKEN, parent.provider_uid, text, tgKeyboard);
        
      case 'feishu':
        if (larkToken) {
          // 注意：你在 lark.js 里的 sendLarkCard 目前是写死的中文 JSON 卡片。
          // 理想做法是把卡片 JSON 的构建过程也搬到 i18n 字典里，或者在 lark.js 里接收多语言参数。
          // 这里暂时保持你原来的函数调用：
          return sendLarkCard(
            larkToken, 
            parent.provider_uid, 
            data.childName, 
            data.rewardName, 
            data.cost, 
            data.balance, 
            data.redemptionId, 
            locale // <-- 这里传进去
          );
        }
        break;
        
      case 'alipay':
        if (env.ALIPAY_APP_ID && env.ALIPAY_PRIVATE_KEY) {
          // 支付宝客服消息目前只发纯文本提示
          return sendAlipayMessage(env.ALIPAY_APP_ID, env.ALIPAY_PRIVATE_KEY, parent.provider_uid, text);
        }
        break;
    }
  });
  
  await Promise.allSettled(sendPromises);
}

// 场景 B：处理自动审批通过的通知
export async function handleRedeemAutoApproved(data, env) {
  // 🌟 SQL 新增查询 u.locale
  const parents = await env.DB.prepare(`
    SELECT b.provider_uid, b.provider, u.locale 
    FROM auth_bindings b
    JOIN users u ON b.internal_id = u.id
    WHERE u.family_id = ? AND b.user_type = 'parent'
  `).bind(data.familyId).all();

  if (!parents.results || parents.results.length === 0) return;

  const hasLark = parents.results.some(p => p.provider === 'feishu');
  let larkToken = null;
  if (hasLark && env.LARK_APP_ID && env.LARK_APP_SECRET) {
    larkToken = await getTenantAccessToken(env.LARK_APP_ID, env.LARK_APP_SECRET).catch(()=>null);
  }

  // 🌟 1. 组装个性化货币字符串
  const pointStr = `${data.pointEmoji || '🪙'}${data.pointName || '积分'}`;

  const sendPromises = parents.results.map(parent => {
    const locale = parent.locale || 'zh-CN';
    
    // 获取翻译后的自动兑换成功文本
    const text = t('bot.approved_success', locale, {
      childName: data.childName,
      rewardName: data.rewardName,
      cost: data.cost,
      pointStr: pointStr // 🌟 将个性化货币字符串传入翻译函数
    });

    switch (parent.provider) {
      case 'telegram':
        return sendTgMessage(env.BOT_TOKEN, parent.provider_uid, text);
      case 'feishu':
        if (larkToken) return sendLarkMessage(larkToken, parent.provider_uid, text);
        break;
      case 'alipay':
        if (env.ALIPAY_APP_ID && env.ALIPAY_PRIVATE_KEY) {
          return sendAlipayMessage(env.ALIPAY_APP_ID, env.ALIPAY_PRIVATE_KEY, parent.provider_uid, text);
        }
        break;
    }
  });
  
  await Promise.allSettled(sendPromises);
}