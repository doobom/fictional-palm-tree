// src/routes/auth.js
import { Hono } from 'hono';
import { nanoid } from 'nanoid';
import { sign } from 'hono/jwt';

const auth = new Hono();

/**
 * 1. 注册/创建新家庭 (Onboarding)
 * 逻辑：创建家庭 -> 创建/更新用户 -> 建立 superadmin 成员关系
 */
auth.post('/create-family', async (c) => {
  // 🌟 核心修复：从上下文获取 'auth' 而不是 'platform'
  const authData = c.get('auth'); 
  const { familyName, nickName, avatar } = await c.req.json();

  if (!familyName || !nickName) {
    return c.json({ success: false, errorCode: 'ERR_MISSING_PARAMS' }, 400);
  }

  // 安全校验：确保中间件成功传递了身份信息
  if (!authData || !authData.provider) {
    return c.json({ success: false, errorCode: 'ERR_UNAUTHORIZED', errorMessage: '未获取到有效的授权身份' }, 401);
  }

  const familyId = nanoid(10);
  const userId = nanoid(12);
  const membershipId = nanoid(12);
  const bindingId = nanoid(12);

  try {
    await c.env.DB.batch([
      // 创建家庭
      c.env.DB.prepare(`INSERT INTO families (id, name) VALUES (?, ?)`).bind(familyId, familyName),
      // 创建基础用户
      c.env.DB.prepare(`INSERT INTO users (id, nick_name, avatar) VALUES (?, ?, ?)`).bind(userId, nickName, avatar || '👤'),
      // 建立成员关系 (设置为超级管理员)
      c.env.DB.prepare(`INSERT INTO memberships (id, family_id, user_id, role) VALUES (?, ?, ?, 'superadmin')`)
        .bind(membershipId, familyId, userId),
      // 🌟 核心修复：使用 authData.provider
      c.env.DB.prepare(`INSERT INTO auth_bindings (id, internal_id, user_type, provider, provider_uid) VALUES (?, ?, 'parent', ?, ?)` )
        .bind(bindingId, userId, authData.provider, authData.providerUid)
    ]);

    return c.json({ success: true, familyId, userId });
  } catch (error) {
    console.error(`[Auth Error] Create family failed:`, error);
    return c.json({ success: false, errorCode: 'ERR_SYSTEM_ERROR' }, 500);
  }
});

/**
 * 2. 使用邀请码加入家庭
 * 逻辑：验证码有效性 -> 在 memberships 中建立关联
 */
auth.post('/join-family', async (c) => {
  // 🌟 核心修复：从上下文获取 'auth' 而不是 'platform'
  const authData = c.get('auth');
  const { inviteCode, nickName } = await c.req.json();

  if (!authData || !authData.provider) {
    return c.json({ success: false, errorCode: 'ERR_UNAUTHORIZED' }, 401);
  }

  // 1. 校验邀请码
  const invite = await c.env.DB.prepare(`
    SELECT * FROM invitation_codes WHERE code = ? AND expires_at > CURRENT_TIMESTAMP
  `).bind(inviteCode).first();

  if (!invite) {
    return c.json({ success: false, errorCode: 'ERR_INVALID_INVITE' }, 400);
  }

  // 2. 获取或创建内部 UserID (支持多平台识别)
  let userId;
  const existingBinding = await c.env.DB.prepare(`
    SELECT internal_id FROM auth_bindings WHERE provider = ? AND provider_uid = ?
  `).bind(authData.provider, authData.providerUid).first();

  if (existingBinding) {
    userId = existingBinding.internal_id;
  } else {
    userId = nanoid(12);
    // 如果是全新用户，先创建用户和绑定记录
    await c.env.DB.batch([
      c.env.DB.prepare(`INSERT INTO users (id, nick_name) VALUES (?, ?)`).bind(userId, nickName || '新成员'),
      // 🌟 核心修复：使用 authData.provider
      c.env.DB.prepare(`INSERT INTO auth_bindings (id, internal_id, user_type, provider, provider_uid) VALUES (?, ?, 'parent', ?, ?)` )
        .bind(nanoid(12), userId, authData.provider, authData.providerUid)
    ]);
  }

  // 3. 建立家庭成员关系
  try {
    await c.env.DB.prepare(`
      INSERT INTO memberships (id, family_id, user_id, role) 
      VALUES (?, ?, ?, ?)
      ON CONFLICT(family_id, user_id) DO NOTHING
    `).bind(nanoid(12), invite.family_id, userId, invite.type).run();

    return c.json({ success: true, familyId: invite.family_id });
  } catch (error) {
    console.error(`[Auth Error] Join family failed:`, error);
    return c.json({ success: false, errorCode: 'ERR_SYSTEM_ERROR' }, 500);
  }
});

/**
 * 3. 绑定新平台 (多平台关联核心)
 */
auth.post('/bind-platform', async (c) => {
  const user = c.get('user'); // 此处不需要改，正常走 requireAppUser 的 user
  const { newProvider, newProviderUid, signature } = await c.req.json();
  
  try {
    await c.env.DB.prepare(`
      INSERT INTO auth_bindings (id, internal_id, user_type, provider, provider_uid)
      VALUES (?, ?, ?, ?, ?)
    `).bind(nanoid(12), user.id, user.userType, newProvider, newProviderUid).run();

    return c.json({ success: true });
  } catch (error) {
    return c.json({ success: false, errorCode: 'ERR_ALREADY_BOUND' }, 400);
  }
});

/**
 * 4. 生成邀请链接/码 (增加复用逻辑与垃圾清理)
 */
auth.post('/generate-invite', async (c) => {
  const user = c.get('user');
  if (user.role !== 'admin' && user.role !== 'superadmin') {
    return c.json({ success: false, errorCode: 'ERR_FORBIDDEN' }, 403);
  }

  const { type, childId } = await c.req.json(); 
  const botUsername = c.env.BOT_USERNAME || 'FamilyPointsBot';

  try {
    // 🌟 1. 顺手清理：删除该家庭下所有已经过期的废弃邀请码
    await c.env.DB.prepare(`
      DELETE FROM invitation_codes WHERE family_id = ? AND expires_at <= CURRENT_TIMESTAMP
    `).bind(user.familyId).run();

    // 🌟 2. 查找复用：看看是否已经有存在且未过期的对应邀请码
    let existingCode;
    if (type === 'child' && childId) {
      existingCode = await c.env.DB.prepare(`
        SELECT code FROM invitation_codes 
        WHERE family_id = ? AND type = 'child' AND target_child_id = ? AND expires_at > CURRENT_TIMESTAMP
      `).bind(user.familyId, childId).first();
    } else {
      existingCode = await c.env.DB.prepare(`
        SELECT code FROM invitation_codes 
        WHERE family_id = ? AND type = ? AND target_child_id IS NULL AND expires_at > CURRENT_TIMESTAMP
      `).bind(user.familyId, type || 'admin').first();
    }

    // 如果有有效的，直接复用返回
    if (existingCode) {
      const code = existingCode.code;
      const inviteLink = `https://t.me/${botUsername}/app?startapp=${code}`;
      return c.json({ 
        success: true, code, inviteLink,
        message: `🏠 邀请您加入家庭！\n邀请码：${code}\n直接点击加入：${inviteLink}`
      });
    }

    // 🌟 3. 生成全新：如果没有有效的，生成新的 7 天有效期凭证
    const code = nanoid(8).toUpperCase();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    await c.env.DB.prepare(`
      INSERT INTO invitation_codes (code, family_id, type, target_child_id, expires_at)
      VALUES (?, ?, ?, ?, ?)
    `).bind(code, user.familyId, type || 'admin', childId || null, expiresAt).run();

    const inviteLink = `https://t.me/${botUsername}/app?startapp=${code}`;

    return c.json({ 
      success: true, code, inviteLink,
      message: `🏠 邀请您加入家庭！\n邀请码：${code}\n直接点击加入：${inviteLink}`
    });
  } catch (error) {
    console.error(`[Auth Error] Generate invite failed:`, error);
    return c.json({ success: false, errorCode: 'ERR_SYSTEM_ERROR' }, 500);
  }
});

export default auth;