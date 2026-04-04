// src/middlewares/rateLimit.js

/**
 * 通用 KV 限流中间件工厂函数
 * @param {Object} options 配置项
 * @param {string} options.keyPrefix - KV 键名前缀 (如 'rl_email')
 * @param {number} options.limit - 窗口期内允许的最大请求次数
 * @param {number} options.window - 窗口期/冷却时间 (秒)。⚠️ 注意：Cloudflare KV 的 TTL 最小值为 60 秒
 * @param {string} options.identifier - 限流维度：'ip' (按IP限流) 或 'user' (按用户内部ID限流)
 * @param {string} options.errorCode - 触发限流时返回的错误码
 */
export const rateLimiter = ({
  keyPrefix = 'rl',
  limit = 1,
  window = 60,
  identifier = 'ip',
  errorCode = 'ERR_RATE_LIMIT_EXCEEDED'
}) => {
  return async (c, next) => {
    // 1. 获取唯一标识符
    let id = 'unknown';
    
    if (identifier === 'user') {
      // 依赖 requireAppUser 中间件先执行，将 user 挂载到上下文
      const user = c.get('user');
      if (user && user.internalId) {
        id = user.internalId;
      } else {
        // 如果没取到 user（比如没登录），降级使用 IP
        id = c.req.header('cf-connecting-ip') || 'fallback-ip';
      }
    } else if (identifier === 'ip') {
      // Cloudflare Workers 原生支持获取真实客户端 IP
      id = c.req.header('cf-connecting-ip') || 'fallback-ip';
    }

    const kvKey = `${keyPrefix}:${id}`;

    try {
      // 2. 从 KV 读取当前计数
      // 这里如果你的 KV 绑定的不叫 SYSTEM_KV，请修改为你实际的绑定名称
      const currentData = await c.env.SYSTEM_KV.get(kvKey);
      let count = currentData ? parseInt(currentData, 10) : 0;

      // 3. 判断是否超限
      if (count >= limit) {
        console.warn(`[Security Warn] 触发限流防御. 策略: ${keyPrefix}, 标识: ${id}, 阈值: ${limit}次/${window}秒`);
        return c.json({
          success: false,
          errorCode: errorCode,
          errorMessage: 'Too many requests',
          errorParams: { limit, window }
        }, 429); // 429 Too Many Requests 是标准的 HTTP 限流状态码
      }

      // 4. 计数器 +1，并写入 KV
      count += 1;
      
      // 写入 KV，并设置过期时间 (TTL)
      // 首次请求设置 TTL，后续请求复用（由于 KV API 限制，这里每次 put 会重置 TTL，变成滑动窗口，对防御更有效）
      await c.env.SYSTEM_KV.put(kvKey, count.toString(), { expirationTtl: Math.max(window, 60) });

      // 5. 放行请求
      await next();
      
    } catch (error) {
      // KV 服务如果偶尔波动，不应该阻塞正常业务流转（降级放行）
      console.error(`[System Error] 限流器 KV 读取异常，执行降级放行. Error:`, error);
      await next();
    }
  };
};