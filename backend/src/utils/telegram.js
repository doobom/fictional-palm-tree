// src/utils/telegram.js

/**
 * 发送普通文本消息
 */
export async function sendTgMessage(token, chatId, text) {
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: 'HTML'
      })
    });
    if (!res.ok) console.error(`[TG Send Error] ${chatId}:`, await res.text());
  } catch (e) {
    console.error(`[TG Fetch Error]:`, e);
  }
}

/**
 * 发送带内联按钮 (Inline Keyboard) 的消息
 */
export async function sendTgMessageWithKeyboard(token, chatId, text, replyMarkup) {
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: 'HTML',
        reply_markup: replyMarkup
      })
    });
    if (!res.ok) console.error(`[TG Send Keyboard Error] ${chatId}:`, await res.text());
  } catch (e) {
    console.error(`[TG Fetch Error]:`, e);
  }
}

/**
 * 响应内联按钮点击 (消除按钮上的转圈 loading 动画，并可弹出 Toast)
 */
export async function answerCallbackQuery(token, queryId, text, showAlert = false) {
  const url = `https://api.telegram.org/bot${token}/answerCallbackQuery`;
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      callback_query_id: queryId,
      text: text,
      show_alert: showAlert // 如果为 true，会在屏幕中间弹出一个强提醒对话框
    })
  });
}

/**
 * 🌟 编辑已发送的消息 (用于点击按钮后，把按钮隐藏掉，防止重复点击)
 */
export async function editMessageText(token, chatId, messageId, newText) {
  const url = `https://api.telegram.org/bot${token}/editMessageText`;
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      message_id: messageId,
      text: newText,
      parse_mode: 'HTML'
    })
  });
}

/**
 * 基础方法：向指定的 Telegram 聊天发送文档 (文件)
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
 * 业务方法：向系统超级管理员 (ROOT) 发送系统级通知
 */
export async function notifyRootAdmins(text, env) {
  const adminIdsStr = env.ROOT_ADMIN_TG_IDS;
  const botToken = env.ROOT_BOT_TOKEN;
  
  if (!adminIdsStr || !botToken) {
    console.warn("未配置 ROOT_ADMIN_TG_IDS 或 ROOT_BOT_TOKEN，跳过发送系统通知");
    return;
  }

  // 按逗号分割，过滤掉空项
  const adminIds = adminIdsStr.split(',').map(id => id.trim()).filter(Boolean);
  
  // 并发发送给所有配置的管理员，就算其中一个发送失败，也不影响其他管理员接收
  await Promise.all(
    adminIds.map(chatId => 
      sendTgMessage(chatId, text, botToken).catch(err => console.error(`[TG 通知失败] ChatID: ${chatId}`, err))
    )
  );
}