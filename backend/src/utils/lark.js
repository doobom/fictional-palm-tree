// src/utils/lark.js
import { t } from './i18n.js';

/**
 * 获取飞书的 Tenant Access Token
 */
export async function getTenantAccessToken(appId, appSecret) {
  const url = 'https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal';
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ app_id: appId, app_secret: appSecret })
  });
  const data = await res.json();
  if (data.code !== 0) throw new Error(`获取飞书 Token 失败: ${data.msg}`);
  return data.tenant_access_token;
}

/**
 * 发送普通文本消息
 * (纯文本的多语言在业务层 rewardsHandler.js 中已经翻译好了，这里直接发送)
 */
export async function sendLarkMessage(token, openId, text) {
  const url = 'https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=open_id';
  await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      receive_id: openId,
      msg_type: 'text',
      content: JSON.stringify({ text: text })
    })
  });
}

/**
 * 🌟 发送交互式审批卡片 (支持多语言动态构建)
 */
export async function sendLarkCard(token, openId, childName, rewardName, cost, balance, redemptionId, locale = 'zh-CN') {
  const url = 'https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=open_id';
  
  // 飞书的富文本卡片 JSON 结构，使用 t() 函数动态获取多语言文本
  const cardContent = {
    config: { wide_screen_mode: true },
    header: {
      title: { tag: "plain_text", content: t('bot.lark_card_title', locale) },
      template: "blue"
    },
    elements: [
      {
        tag: "div",
        fields: [
          { is_short: true, text: { tag: "lark_md", content: `${t('bot.lbl_child', locale)}${childName}` } },
          { is_short: true, text: { tag: "lark_md", content: `${t('bot.lbl_reward', locale)}${rewardName}` } },
          { is_short: true, text: { tag: "lark_md", content: `${t('bot.lbl_cost', locale)}${cost}` } },
          { is_short: true, text: { tag: "lark_md", content: `${t('bot.lbl_balance', locale)}${balance}` } }
        ]
      },
      { tag: "hr" },
      {
        tag: "action",
        actions: [
          {
            tag: "button",
            text: { tag: "plain_text", content: t('bot.btn_approve', locale) },
            type: "primary",
            value: { action: "approve", redemptionId: redemptionId }
          },
          {
            tag: "button",
            text: { tag: "plain_text", content: t('bot.btn_reject', locale) },
            type: "danger",
            value: { action: "reject", redemptionId: redemptionId }
          }
        ]
      }
    ]
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        receive_id: openId,
        msg_type: 'interactive',
        content: JSON.stringify(cardContent)
      })
    });
    
    const data = await res.json();
    if (data.code !== 0) console.error(`[Lark Send Card Error]`, data);
  } catch (e) {
    console.error(`[Lark Fetch Error]`, e);
  }
}