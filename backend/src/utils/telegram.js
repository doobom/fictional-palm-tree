// backend/src/utils/telegram.js

/**
 * 1. 发送普通文本消息
 */
export async function sendTgMessage(token, chatId, text) {
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: text, parse_mode: 'HTML' })
    });
    if (!res.ok) console.error(`[TG Send Error] ${chatId}:`, await res.text());

    return await res.json();
  } catch (e) {
    console.error(`[TG Fetch Error]:`, e);
  }
}

/**
 * 2. 核心：发送带有内联按钮 (Inline Keyboard) 的消息
 */
export async function sendTgMessageWithKeyboard(chatId, text, inlineKeyboard, botToken) {
  if (!botToken) throw new Error("Bot token 未配置");
  const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      chat_id: chatId, 
      text,
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: inlineKeyboard }
    })
  });
  if (!res.ok) throw new Error(`TG 发送带按钮消息失败: ${await res.text()}`);
  return res.json();
}

/**
 * 3. 核心：修改已有消息的文字内容 (审批后去掉按钮)
 */
export async function editTgMessageText(chatId, messageId, newText, botToken) {
  const url = `https://api.telegram.org/bot${botToken}/editMessageText`;
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      message_id: messageId,
      text: newText,
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: [] } // 传空数组清除按钮
    })
  });
}

/**
 * 4. 核心：响应 Callback Query (停止按钮上的加载转圈)
 */
export async function answerTgCallback(callbackQueryId, text, showAlert, botToken) {
  await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ callback_query_id: callbackQueryId, text, show_alert: showAlert })
  });
}

/**
 * 5. 发送文档 (用于数据备份)
 */
export async function sendTgDocument(chatId, fileBlob, fileName, caption, botToken) {
  if (!botToken) throw new Error("Bot token 未配置");
  const formData = new FormData();
  formData.append('chat_id', chatId);
  formData.append('document', fileBlob, fileName);
  if (caption) formData.append('caption', caption);

  const res = await fetch(`https://api.telegram.org/bot${botToken}/sendDocument`, {
    method: 'POST',
    body: formData
  });
  if (!res.ok) throw new Error(`TG 发送文档失败: ${await res.text()}`);
  return res.json();
}

/**
 * 🌟 新增：删除指定消息
 */
export async function deleteTgMessage(chatId, messageId, botToken) {
  const url = `https://api.telegram.org/bot${botToken}/deleteMessage`;
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, message_id: messageId })
    });
  } catch (e) {
    console.error(`[TG Delete Error]:`, e);
  }
}

/**
 * 6. 向系统超级管理员发送系统级通知 (使用 ROOT_BOT_TOKEN)
 */
export async function notifyRootAdmins(text, env) {
  const adminIdsStr = env.ROOT_ADMIN_TG_IDS;
  const botToken = env.ROOT_BOT_TOKEN;
  if (!adminIdsStr || !botToken) return;

  const adminIds = adminIdsStr.split(',').map(id => id.trim()).filter(Boolean);
  await Promise.all(
    adminIds.map(chatId => 
      sendTgMessage(botToken, chatId, text)
    )
  );
}