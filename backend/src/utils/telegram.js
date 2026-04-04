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