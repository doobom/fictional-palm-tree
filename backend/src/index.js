import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { platformAuth, requireAppUser } from './middlewares/auth.js';
import { FamilyManager } from './do/FamilyManager.js';

// 导入路由模块
import auth from './routes/auth.js';
import family from './routes/family.js';
import children from './routes/children.js';
import scores from './routes/scores.js';
import rewards from './routes/rewards.js';
import goals from './routes/goals.js';
import achievements from './routes/achievements.js';
import categories from './routes/categories.js';
import analytics from './routes/analytics.js';
import webhook from './routes/webhook.js';
import user from './routes/user.js';
import system from './routes/system.js'; // 🌟 新增系统路由模块

// 导入 Queue 处理器
import { handleScoreChangeTasks } from './queues/scoreHandler.js';
import { handleRedeemApproval } from './queues/rewardsHandler.js';

const app = new Hono();

// 1. 全局中间件
app.use('*', logger());

// 🌟 动态 CORS 中间件：支持多端环境跨域
app.use('*', async (c, next) => {
  // 从环境变量获取 ALLOWED_ORIGINS（支持逗号分隔的多个域名），默认放行 '*'
  const allowedOriginsStr = c.env?.ALLOWED_ORIGINS || '*';
  const allowedOrigins = allowedOriginsStr.split(',').map(s => s.trim()).filter(Boolean);

  const corsMiddleware = cors({
    origin: (origin) => {
      // 如果没有 origin (如服务端直接请求)、或者配置了通配符，或者在白名单内，则允许
      if (!origin || allowedOrigins.includes('*')) return '*';
      if (allowedOrigins.includes(origin)) return origin;
      // 默认回退到白名单的第一个，避免完全阻断导致浏览器拿不到 CORS 报错详情
      return allowedOrigins[0] || '*'; 
    },
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    // 🌟 确保我们在前端请求头中携带的自定义 Header 都在这里声明
    allowHeaders: ['Content-Type', 'Authorization', 'X-Telegram-Init-Data', 'X-Device-Token', 'X-Family-Id'],
    credentials: true,
  });

  return await corsMiddleware(c, next);
});

// 2. 身份验证中间件流水线
// platformAuth: 识别用户身份 (TG/JWT/Device)
// requireAppUser: 校验家庭成员资格 (基于 Header 中的 x-family-id)
app.use('/api/*', platformAuth);
app.use('/api/*', requireAppUser);

// 3. 路由注册
// 💡 提示：如果前端请求的是 /api/auth/create-family，请确保这里的挂载路径与前端一致
app.route('/api/auth', auth); // 之前是 '/auth'，建议统一加上 /api 前缀以匹配中间件规则
app.route('/api/family', family);
app.route('/api/children', children);
app.route('/api/scores', scores);
app.route('/api/rewards', rewards);
app.route('/api/goals', goals);
app.route('/api/achievements', achievements);
app.route('/api/categories', categories);
app.route('/api/analytics', analytics);
app.route('/api/user', user);
app.route('/api/system', system);
app.route('/webhook', webhook);

// 4. 健康检查与根路由
app.get('/', (c) => c.text('Family Points System API (Edge Edition)'));

// 重要：必须导出 Durable Object 类，Wrangler 才能识别
export { FamilyManager };

// 5. 导出 Worker 处理程序
export default {
  /**
   * 处理 HTTP 请求
   */
  fetch: app.fetch,

  /**
   * 处理异步队列任务 (Cloudflare Queues)
   */
  async queue(batch, env, ctx) {
    for (const msg of batch.messages) {
      try {
        const data = msg.body;
        console.log(`[Queue] Processing action: ${data.action}`);

        switch (data.action) {
          case 'CHECK_ACHIEVEMENTS':
            // 处理积分变动后的成就解锁、目标进度更新
            await handleScoreChangeTasks(data, env);
            break;
            
          case 'REDEEM_APPROVAL_REQUEST':
            // 处理兑换申请的推送通知
            await handleRedeemApproval(data, env);
            break;

          default:
            console.warn(`[Queue] Unknown action: ${data.action}`);
        }
        
        // 确认消息已成功处理
        msg.ack();
      } catch (error) {
        console.error(`[Queue Error] ID: ${msg.id}, Error:`, error);
        // 如果处理失败，根据策略重试
        msg.retry();
      }
    }
  },

  /**
   * 处理定时任务 (Cron Triggers)
   * 用于：清理过期邀请码、发送每日/每周进度总结
   */
  async scheduled(event, env, ctx) {
    console.log(`[Cron] Running scheduled task: ${event.cron}`);
    
    // 示例：每晚清理过期邀请码
    if (event.cron === "0 0 * * *") {
      ctx.waitUntil(
        env.DB.prepare("DELETE FROM invitation_codes WHERE expires_at < CURRENT_TIMESTAMP").run()
      );
    }
    
    // 后续可以增加周报推送逻辑
  }
};