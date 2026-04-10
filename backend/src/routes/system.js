// src/routes/system.js
import { Hono } from 'hono';

const system = new Hono();


// 后端接收意见反馈的路由处理：

system.post('/feedback', async (c) => {
  const user = c.get('user');
  const { text } = await c.req.json();
  
  if (!text) return c.json({ success: false, errorMessage: '内容不能为空' }, 400);

  // 🌟 修复 4：获取逗号分割的管理员列表
  const adminIdsStr = c.env.ROOT_ADMIN_TG_IDS;
  if (!adminIdsStr) {
    console.error("未配置 ROOT_ADMIN_TG_IDS 环境变量！");
    return c.json({ success: false, errorMessage: '系统未配置管理员接收途径' }, 500);
  }

  // 按逗号分割，去掉两边空格，过滤掉空项
  const adminIds = adminIdsStr.split(',').map(id => id.trim()).filter(Boolean);
  const botToken = c.env.ROOT_BOT_TOKEN; 

  try {
    const message = `🔔 收到新反馈\n\n👤 用户: ${user.nick_name || user.id}\n🏠 家庭 ID: ${user.familyId}\n\n📝 内容：\n${text}`;

    // 🌟 循环发送给所有配置的管理员
    await Promise.all(adminIds.map(chatId => 
      fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: message
        })
      })
    ));

    return c.json({ success: true });
  } catch (error) {
    console.error('发送反馈失败', error);
    return c.json({ success: false, errorMessage: '反馈提交失败' }, 500);
  }
});

export default system;