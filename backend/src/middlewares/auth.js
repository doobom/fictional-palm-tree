// src/middlewares/auth.js
import { verifyTelegramData } from '../utils/verify.js';
import { verify } from 'hono/jwt';

/**
 * 1. 绝对公开的路径：完全不需要验证身份（如支付回调、公开配置）
 */
const isPublicPath = (path) => {
  return path.includes('/webhook') || path.includes('/public');
};

/**
 * 2. 引导入驻路径：需要验证 TG/JWT 身份，但允许用户是“新用户”且“没有家庭”
 */
const isOnboardingPath = (path) => {
  return path.includes('/api/auth/create-family') || 
         path.includes('/api/auth/join-family') || 
         path.includes('/api/auth/register') || 
         path.includes('/api/auth/login');
};

/**
 * 第一关：平台鉴权 (Platform Identification)
 * 职责：解析并验证第三方身份真实性
 */
export const platformAuth = async (c, next) => {
  if (isPublicPath(c.req.path)) return await next();

  const authHeader = c.req.header('Authorization');
  const tgData = c.req.header('X-Telegram-Init-Data');
  const deviceToken = c.req.header('X-Device-Token');

  let provider = null;
  let providerUid = null;

  // 1. 验证签名并判定登录来源
  if (deviceToken) {
    provider = 'device';
    providerUid = deviceToken;
  } else if (tgData) {
    const tgUser = await verifyTelegramData(tgData, c.env.TELEGRAM_TOKEN);
    if (!tgUser) {
      return c.json({ success: false, errorCode: 'ERR_UNAUTHORIZED', errorMessage: '无效的 Telegram 签名' }, 401);
    }
    provider = 'telegram';
    providerUid = String(tgUser.id);
  } else if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.split(' ')[1];
      const payload = await verify(token, c.env.JWT_SECRET);
      provider = 'email'; 
      providerUid = payload.email || payload.uid;
    } catch (e) {
      return c.json({ success: false, errorCode: 'ERR_TOKEN_EXPIRED', errorMessage: '登录已过期，请重新进入' }, 401);
    }
  }

  // 纯 Web 环境且没有任何凭证时，直接拦截
  if (!provider) {
    return c.json({ success: false, errorCode: 'ERR_NO_CREDENTIALS', errorMessage: '未授权的访问' }, 401);
  }

  // 2. 查找账户绑定关系
  const binding = await c.env.DB.prepare(`
    SELECT internal_id, user_type FROM auth_bindings 
    WHERE provider = ? AND provider_uid = ?
  `).bind(provider, providerUid).first();

  if (!binding) {
    // 🌟 核心修复：如果是新用户在走创建/加入家庭流程，我们不能拦截！
    // 必须把解析到的身份注入上下文，防止控制器中读取 `auth.provider` 报错。
    if (isOnboardingPath(c.req.path)) {
      c.set('auth', { 
        isNewUser: true, 
        provider: provider, 
        providerUid: providerUid 
      });
      return await next();
    }
    
    // 如果是老用户请求业务接口，但数据库里没找到，返回 404 让前端跳转到引导页
    return c.json({ 
      success: false, 
      errorCode: 'ERR_USER_NOT_FOUND', 
      needRegister: true 
    }, 404);
  }

  // 3. 将已注册用户的身份存入上下文
  c.set('auth', {
    internalId: binding.internal_id,
    userType: binding.user_type,
    provider: provider,
    providerUid: providerUid
  });

  await next();
};

/**
 * 第二关：应用鉴权 (Application & Multi-tenant Context)
 * 职责：基于 x-family-id 确认用户在当前家庭的权限
 */
export const requireAppUser = async (c, next) => {
  // 🌟 核心修复：公开路径和入驻路径（此时还没家庭）直接放行
  if (isPublicPath(c.req.path) || isOnboardingPath(c.req.path)) return await next();

  const auth = c.get('auth');
  const targetFamilyId = c.req.header('x-family-id');

  // 特例放行：获取个人信息时如果没有传入 family-id，允许放行（用于初次加载家庭列表）
  if (!targetFamilyId && c.req.path.includes('/api/user/me')) {
    return await next();
  }

  if (!targetFamilyId) {
    return c.json({ success: false, errorCode: 'ERR_FAMILY_CONTEXT_MISSING', errorMessage: '请先选择一个家庭' }, 400);
  }

  try {
    let context = null;

    if (auth.userType === 'parent') {
      context = await c.env.DB.prepare(`
        SELECT m.role, f.timezone, f.point_name, f.point_emoji
        FROM memberships m
        JOIN families f ON m.family_id = f.id
        WHERE m.user_id = ? AND m.family_id = ?
      `).bind(auth.internalId, targetFamilyId).first();

    } else if (auth.userType === 'child') {
      context = await c.env.DB.prepare(`
        SELECT 'child' as role, f.timezone, f.point_name, f.point_emoji
        FROM children c
        JOIN families f ON c.family_id = f.id
        WHERE c.id = ? AND c.family_id = ?
      `).bind(auth.internalId, targetFamilyId).first();
    }

    if (!context) {
      return c.json({ success: false, errorCode: 'ERR_FORBIDDEN', errorMessage: '您不在该家庭成员名单中' }, 403);
    }

    // 设置业务用户信息上下文
    c.set('user', {
      id: auth.internalId,
      familyId: targetFamilyId,
      userType: auth.userType,
      role: context.role,
      timezone: context.timezone,
      currency: {
        name: context.point_name,
        emoji: context.point_emoji
      }
    });

    await next();
  } catch (error) {
    console.error(`[Auth Middleware Error]`, error);
    return c.json({ success: false, errorCode: 'ERR_SYSTEM_ERROR', errorMessage: '服务器繁忙，请稍后再试' }, 500);
  }
};