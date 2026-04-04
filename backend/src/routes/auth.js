// src/routes/auth.js
import { Hono } from 'hono';
import { nanoid } from 'nanoid';
import { sign } from 'hono/jwt'; 
import { DEFAULT_RULES } from '../constants.js'; 
import { rateLimiter } from '../middlewares/rateLimit.js';
import { t } from '../utils/i18n.js'; // 🌟 引入多语言翻译工具

const auth = new Hono();

// ==========================================
// 🌟 邮箱验证码登录模块
// ==========================================

/**
 * 1. 发送邮箱验证码 (OTP)
 */
auth.post('/email/send-code', 
  rateLimiter({
    keyPrefix: 'rl_email', 
    limit: 1,              
    window: 60,            
    identifier: 'ip',      
    errorCode: 'ERR_TOO_MANY_EMAILS'
  }), async (c) => {
  // 🌟 从请求体中提取 locale，默认兜底为 zh-CN
  const { email, locale = 'zh-CN' } = await c.req.json();
  
  if (!email || !email.includes('@')) {
    return c.json({ success: false, errorCode: 'ERR_MISSING_PARAMS', errorMessage: t('api.err_invalid_email', locale) }, 400);
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  await c.env.SYSTEM_KV.put(`otp:${email}`, otp, { expirationTtl: 300 });

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${c.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: `${c.env.RESEND_FROM_EMAIL}`, 
        to: [email],
        // 🌟 邮件主题和内容也支持多语言
        subject: t('auth.email_subject', locale),
        html: `
          <p>${t('auth.email_greeting', locale)}</p>
          <p>${t('auth.email_code_is', locale)}：<strong>${otp}</strong></p>
          <p>${t('auth.email_valid_time', locale)}</p>
        `
      })
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error(`[Email Send Error] Resend API 报错:`, errorText);
      return c.json({ success: false, errorCode: 'ERR_SYSTEM_ERROR', errorMessage: t('api.err_system_error', locale) }, 500);
    }

    return c.json({ success: true, message: t('auth.email_sent', locale) });
  } catch (e) {
    console.error(`[Email Send Error] 请求异常:`, e);
    return c.json({ success: false, errorCode: 'ERR_SYSTEM_ERROR', errorMessage: t('api.err_system_error', locale) }, 500);
  }
});

/**
 * 2. 校验验证码并颁发 JWT
 */
auth.post('/email/verify', async (c) => {
  const { email, code, locale = 'zh-CN' } = await c.req.json();
  
  if (!email || !code) {
    return c.json({ success: false, errorCode: 'ERR_MISSING_PARAMS', errorMessage: t('api.err_missing_params', locale) }, 400);
  }

  const storedCode = await c.env.SYSTEM_KV.get(`otp:${email}`);

  if (!storedCode || storedCode !== code) {
    console.warn(`[Auth Warn] 验证码错误或已过期. Email: ${email}`);
    return c.json({ success: false, errorCode: 'ERR_INVALID_CODE', errorMessage: t('api.err_invalid_code', locale) }, 400);
  }

  await c.env.SYSTEM_KV.delete(`otp:${email}`);

  const payload = {
    email: email,
    exp: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
    iat: Math.floor(Date.now() / 1000)
  };

  const token = await sign(payload, c.env.JWT_SECRET);

  return c.json({ 
    success: true, 
    token: token,
    message: t('auth.login_success', locale)
  });
});

/**
 * 1. 创建新家庭
 */
auth.post('/create-family', async (c) => {
  const platform = c.get('platform');
  const { familyName, nickName, locale = 'zh-CN', timezone = 'Asia/Shanghai' } = await c.req.json();

  if (!familyName || !nickName) {
    console.warn(`[Business Warn] 创建家庭失败: 参数不完整. UID: ${platform.providerUid}`);
    return c.json({ success: false, errorCode: 'ERR_MISSING_PARAMS', errorMessage: t('api.err_missing_params', locale) }, 400);
  }

  const existing = await c.env.DB.prepare(
    `SELECT id FROM auth_bindings WHERE provider = ? AND provider_uid = ?`
  ).bind(platform.provider, platform.providerUid).first();
  
  if (existing) {
    console.warn(`[Business Warn] 创建家庭失败: 账号已被绑定. UID: ${platform.providerUid}`);
    return c.json({ success: false, errorCode: 'ERR_ALREADY_BOUND', errorMessage: t('api.err_already_bound', locale) }, 400);
  }

  const familyId = nanoid(12);
  const userId = nanoid(12);
  const bindId = nanoid(12);

  const initialRules = DEFAULT_RULES[locale] || DEFAULT_RULES['zh-CN'];
  const ruleQueries = initialRules.common.map(rule => {
    return c.env.DB.prepare(`
      INSERT INTO rules (id, family_id, name, points, category, scope)
      VALUES (?, ?, ?, ?, ?, 'common')
    `).bind(nanoid(12), familyId, rule.name, rule.points, rule.category);
  });

  try {
    await c.env.DB.batch([
      c.env.DB.prepare(`INSERT INTO families (id, name, timezone) VALUES (?, ?, ?)`).bind(familyId, familyName.trim(), timezone),
      c.env.DB.prepare(`INSERT INTO users (id, family_id, role, nick_name, locale) VALUES (?, ?, 'superadmin', ?, ?)`).bind(userId, familyId, nickName.trim(), locale),
      c.env.DB.prepare(`INSERT INTO auth_bindings (id, internal_id, user_type, provider, provider_uid) VALUES (?, ?, 'parent', ?, ?)`).bind(bindId, userId, platform.provider, platform.providerUid),
      ...ruleQueries
    ]);
    return c.json({ success: true, familyId });
  } catch (e) {
    console.error(`[System Error] 创建家庭落库失败. Error:`, e);
    return c.json({ success: false, errorCode: 'ERR_SYSTEM_ERROR', errorMessage: t('api.err_system_error', locale) }, 500);
  }
});

/**
 * 2. 加入已有家庭
 */
auth.post('/join-family', async (c) => {
  const platform = c.get('platform');
  const { inviteCode, nickName, locale = 'zh-CN' } = await c.req.json();

  if (!inviteCode || !nickName) {
    return c.json({ success: false, errorCode: 'ERR_MISSING_PARAMS', errorMessage: t('api.err_missing_params', locale) }, 400);
  }

  const existing = await c.env.DB.prepare(`SELECT id FROM auth_bindings WHERE provider = ? AND provider_uid = ?`).bind(platform.provider, platform.providerUid).first();
  if (existing) {
    return c.json({ success: false, errorCode: 'ERR_ALREADY_BOUND', errorMessage: t('api.err_already_bound', locale) }, 400);
  }

  const invite = await c.env.DB.prepare(`
    SELECT family_id, type FROM invitation_codes 
    WHERE code = ? AND type != 'child' AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
  `).bind(inviteCode).first();

  if (!invite) {
    return c.json({ success: false, errorCode: 'ERR_INVALID_CODE', errorMessage: t('api.err_invalid_code', locale) }, 400);
  }

  const userId = nanoid(12);
  const bindId = nanoid(12);

  try {
    await c.env.DB.batch([
      c.env.DB.prepare(`INSERT INTO users (id, family_id, role, nick_name, locale) VALUES (?, ?, ?, ?, ?)`).bind(userId, invite.family_id, invite.type, nickName.trim(), locale),
      c.env.DB.prepare(`INSERT INTO auth_bindings (id, internal_id, user_type, provider, provider_uid) VALUES (?, ?, 'parent', ?, ?)`).bind(bindId, userId, platform.provider, platform.providerUid),
      c.env.DB.prepare(`DELETE FROM invitation_codes WHERE code = ?`).bind(inviteCode)
    ]);
    return c.json({ success: true, message: t('auth.join_success', locale) });
  } catch (e) {
    return c.json({ success: false, errorCode: 'ERR_SYSTEM_ERROR', errorMessage: t('api.err_system_error', locale) }, 500);
  }
});

/**
 * 3. 孩子绑定专属设备
 */
auth.post('/bind-child', async (c) => {
  const platform = c.get('platform');
  const { inviteCode, locale = 'zh-CN' } = await c.req.json();

  if (!inviteCode) {
    return c.json({ success: false, errorCode: 'ERR_MISSING_PARAMS', errorMessage: t('api.err_missing_params', locale) }, 400);
  }

  const existing = await c.env.DB.prepare(`SELECT id FROM auth_bindings WHERE provider = ? AND provider_uid = ?`).bind(platform.provider, platform.providerUid).first();
  if (existing) {
    return c.json({ success: false, errorCode: 'ERR_ALREADY_BOUND', errorMessage: t('api.err_already_bound', locale) }, 400);
  }

  const invite = await c.env.DB.prepare(`
    SELECT target_child_id, family_id FROM invitation_codes 
    WHERE code = ? AND type = 'child' AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
  `).bind(inviteCode).first();

  if (!invite) {
    return c.json({ success: false, errorCode: 'ERR_INVALID_CODE', errorMessage: t('api.err_invalid_code', locale) }, 400);
  }

  const bindId = nanoid(12);

  try {
    await c.env.DB.batch([
      c.env.DB.prepare(`
        INSERT INTO auth_bindings (id, internal_id, user_type, provider, provider_uid) 
        VALUES (?, ?, 'child', ?, ?)
      `).bind(bindId, invite.target_child_id, platform.provider, platform.providerUid),
      c.env.DB.prepare(`DELETE FROM invitation_codes WHERE code = ?`).bind(inviteCode)
    ]);
    return c.json({ success: true, message: t('auth.bind_success', locale) });
  } catch (e) {
    return c.json({ success: false, errorCode: 'ERR_SYSTEM_ERROR', errorMessage: t('api.err_system_error', locale) }, 500);
  }
});

export default auth;