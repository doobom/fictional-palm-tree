// src/middlewares/auth.js
import { verifyTelegramData, verifyFeishuData } from '../utils/verify.js';
import { verify } from 'hono/jwt'; // 🌟 引入 Hono 内置的 JWT 校验工具

// 🌟 架构优化：提取统一的白名单检查函数
const isWhiteListed = (path) => {
  return path.includes('/email/send-code') || 
         path.includes('/email/verify') || 
         path.includes('/webhook');
};

/**
 * 第一关：平台鉴权 (验证第三方身份真实性 或 验证 JWT)
 */
export const platformAuth = async (c, next) => {
  // 1. 遇到白名单，直接放行并中断当前中间件的拦截
  if (isWhiteListed(c.req.path)) {
    return await next(); 
  }
  
  // 🌟 新增：提取 JWT Token
  const authHeader = c.req.header('Authorization');
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

  const tgData = c.req.header('X-Telegram-Init-Data');
  const fsToken = c.req.header('X-Feishu-Token');

  let provider = null;
  let providerUid = null;
  let providerName = null;

  // 流程 A：优先校验 JWT (邮箱登录用户)
  if (token) {
    try {
      // 校验 Token 是否被篡改或过期
      const decodedPayload = await verify(token, c.env.JWT_SECRET);
      provider = 'email';
      providerUid = decodedPayload.email;
      providerName = decodedPayload.email.split('@')[0]; // 取邮箱前缀作为默认昵称
    } catch (e) {
      console.warn(`[Auth Warn] JWT 校验失败或已过期. IP: ${c.req.header('cf-connecting-ip')}`);
      return c.json({ success: false, errorCode: 'ERR_UNAUTHORIZED', errorMessage: 'Invalid or expired token' }, 401);
    }
  } 
  // 流程 B：校验 Telegram
  else if (tgData) {
    const tgUser = await verifyTelegramData(tgData, c.env.TELEGRAM_TOKEN);
    if (!tgUser) {
      return c.json({ success: false, errorCode: 'ERR_UNAUTHORIZED', errorMessage: 'Telegram signature invalid' }, 401);
    }
    provider = 'telegram';
    providerUid = String(tgUser.id);
    providerName = tgUser.first_name || 'TG User';
  } 
  // 流程 C：校验飞书
  else if (fsToken) {
    const fsUser = await verifyFeishuData(fsToken, c.env.FEISHU_SECRET);
    if (!fsUser) return c.json({ success: false, errorCode: 'ERR_UNAUTHORIZED', errorMessage: 'Feishu token invalid' }, 401);
    provider = 'feishu';
    providerUid = String(fsUser.open_id);
    providerName = fsUser.name;
  } 
  // 兜底：无任何有效凭证
  else {
    return c.json({ success: false, errorCode: 'ERR_UNAUTHORIZED', errorMessage: 'Missing authentication credentials' }, 401);
  }

  // 存入上下文，完美衔接你原本的 auth_bindings 逻辑！
  c.set('platform', { provider, providerUid, providerName });
  await next();
};

/**
 * 第二关：应用鉴权 (确认是否已绑定家庭)
 * ⚠️ 这个函数保持不变！因为它完全依赖第一关传递的 c.get('platform')
 */
export const requireAppUser = async (c, next) => {
  // 🌟 核心修复：第二关同样必须给白名单开绿灯！
  // 阻止 Webhook 继续往下走去读取 undefined 的 payload
  if (isWhiteListed(c.req.path)) {
    return await next(); 
  }

  const platform = c.get('platform');
  try {
    const dbRecord = await c.env.DB.prepare(`
      SELECT 
        b.internal_id, b.user_type, COALESCE(u.family_id, ch.family_id) AS family_id,
        u.role AS parent_role, ch.name AS child_name, COALESCE(u.locale, ch.locale, 'zh-CN') AS locale, f.timezone
      FROM auth_bindings b
      LEFT JOIN users u ON b.internal_id = u.id AND b.user_type = 'parent'
      LEFT JOIN children ch ON b.internal_id = ch.id AND b.user_type = 'child'
      LEFT JOIN families f ON COALESCE(u.family_id, ch.family_id) = f.id
      WHERE b.provider = ? AND b.provider_uid = ?
    `).bind(platform.provider, platform.providerUid).first();

    if (!dbRecord) {
      return c.json({ success: false, errorCode: 'ERR_USER_NOT_FOUND', errorMessage: 'User not registered.', needRegister: true }, 404);
    }

    c.set('user', {
      internalId: dbRecord.internal_id, familyId: dbRecord.family_id, userType: dbRecord.user_type,     
      role: dbRecord.parent_role || 'none', childName: dbRecord.child_name || null,
      locale: dbRecord.locale, timezone: dbRecord.timezone 
    });
    await next();
  } catch (error) {
    console.error(`[Auth Error] 数据库查询失败:`, error);
    return c.json({ success: false, errorCode: 'ERR_SYSTEM_ERROR', errorMessage: 'Internal Server Error' }, 500);
  }
};