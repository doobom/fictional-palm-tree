// src/routes/user.js
import { Hono } from 'hono';
import { sendTgMessage } from '../utils/telegram.js';

const user = new Hono();

/**
 * 修改当前家长的个人资料 (包含昵称、头像、语言)
 */
user.put('/profile', async (c) => {
  const currentUser = c.get('user');
  const { nickName, avatar, locale } = await c.req.json();

  if (!currentUser.familyId) {
    return c.json({ success: false, errorCode: 'ERR_NEED_FAMILY', errorMessage: '尚未加入家庭' }, 400);
  }

  try {
    // 🌟 核心更新：将 locale 一并写入数据库
    const result = await c.env.DB.prepare(`
      UPDATE users 
      SET nick_name = ?, avatar = ?, locale = ?
      WHERE id = ? AND family_id = ?
    `).bind(
      nickName ? nickName.trim() : null, 
      avatar || '👤', 
      locale || 'zh-CN', // 默认语言
      currentUser.internalId, 
      currentUser.familyId
    ).run();

    if (result.meta.changes === 0) {
      return c.json({ success: false, errorCode: 'ERR_NOT_FOUND', errorMessage: 'User not found' }, 404);
    }

    return c.json({ success: true, message: 'Profile updated successfully' });
  } catch (e) {
    console.error(`[System Error] 修改个人资料失败. Error:`, e);
    return c.json({ success: false, errorCode: 'ERR_SYSTEM_ERROR', errorMessage: 'Failed to update profile' }, 500);
  }
});

/**
 * 主动退出当前家庭 (普通管理员/观察者)
 */
user.post('/leave', async (c) => {
  const currentUser = c.get('user');
  
  if (!currentUser.familyId) return c.json({ success: false, errorCode: 'ERR_NEED_FAMILY' }, 400);
  
  // 拦截超级管理员的退出操作
  if (currentUser.role === 'superadmin') {
    return c.json({ success: false, errorCode: 'ERR_FORBIDDEN', errorMessage: '超级管理员不能直接退出，请解散家庭或转移权限' }, 403);
  }

  try {
    // 将自己的 family_id 清空，角色重置为 viewer
    await c.env.DB.prepare(`
      UPDATE users SET family_id = NULL, role = 'viewer' WHERE id = ?
    `).bind(currentUser.internalId).run();
    
    return c.json({ success: true });
  } catch (e) {
    return c.json({ success: false, errorCode: 'ERR_SYSTEM_ERROR' }, 500);
  }
});

user.post('/feedback', async (c) => {
  const user = c.get('user');
  const { content } = await c.req.json();
  const rootAdminIds = (c.env.ROOT_ADMIN_TG_IDS || '').split(',');

  if (!content || !rootAdminIds.length) return c.json({ success: false }, 400);

  const message = `📩 <b>新反馈提交</b>\n\n` +
                  `来自家庭: <b>${user.familyId}</b>\n` +
                  `用户: <b>${user.nickName}</b> (${user.internalId})\n` +
                  `内容: \n<pre>${content}</pre>`;

  // 发送给系统管理员们
  for (const adminId of rootAdminIds) {
    await sendTgMessage(c.env.ROOT_BOT_TOKEN, adminId.trim(), message);
  }

  return c.json({ success: true });
});

export default user;