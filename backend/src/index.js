import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { platformAuth, requireAppUser } from './middlewares/auth.js';
import { FamilyManager } from './do/FamilyManager.js';
import { sendTgMessage } from './utils/telegram.js';
import { generateDailyReport } from './utils/report.js';

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
import rules from './routes/rules.js';
import approvals from './routes/approvals.js'; // 🌟 新增审批相关路由
import routines from './routes/routines.js'; // 🌟 新增常规任务路由

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
app.route('/api/auth', auth); // 🌟 认证相关路由
app.route('/api/family', family); // 🌟 家庭相关路由
app.route('/api/children', children); // 🌟 儿童成员相关路由
app.route('/api/scores', scores); // 🌟 积分相关路由
app.route('/api/rewards', rewards); // 🌟 奖励相关路由
app.route('/api/goals', goals); // 🌟 目标相关路由
app.route('/api/achievements', achievements); // 🌟 成就相关路由
app.route('/api/categories', categories); // 🌟 分类相关路由
app.route('/api/analytics', analytics); // 🌟 分析相关路由
app.route('/api/user', user); // 🌟 用户相关接口
app.route('/api/system', system); // 🌟 系统相关接口
app.route('/api/rules', rules); // 🌟 规则管理路由
app.route('/api/approvals', approvals); // 🌟 审批相关路由
app.route('/api/routines', routines); // 🌟 常规任务路由
app.route('/api/webhook', webhook); // 🌟 BOT's Webhook 路由

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
    console.log(`[Queue] 收到 ${batch.messages.length} 条消息`);
    
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
    
    ctx.waitUntil(handleScheduledPush(env));
  }
};

/**
 * 🌟 核心推送逻辑：检查当前时间，并为符合条件的家庭生成日报
 * 路由逻辑：优先发送至绑定的群组；若未绑定，则发送给所有管理员私聊。
 */
async function handleScheduledPush(env) {
  if (!env.BOT_TOKEN || !env.DB) return;

  // 1. 获取东八区时间 (HH:mm)
  const date = new Date(Date.now() + 8 * 3600 * 1000);
  const hh = String(date.getUTCHours()).padStart(2, '0');
  const mm = String(date.getUTCMinutes()).padStart(2, '0');
  const currentTime = `${hh}:${mm}`; 

  try {
    // 2. 查找开启了推送且时间吻合的所有家庭 (不再限制必须有 tg_group_id)
    const families = await env.DB.prepare(`
      SELECT id, tg_group_id 
      FROM families 
      WHERE push_enabled = 1 AND push_time = ?
    `).bind(currentTime).all();

    if (!families || families.results.length === 0) return;

    const todayStr = date.toISOString().split('T')[0];

    for (const family of families.results) {
      const familyId = family.id;

      // 1. 确定推送目标 ID 列表
      let targetChatIds = [];
      if (family.tg_group_id) {
        targetChatIds.push(family.tg_group_id);
      } else {
        const admins = await env.DB.prepare(`
          SELECT ab.provider_uid 
          FROM memberships m 
          JOIN auth_bindings ab ON m.user_id = ab.internal_id 
          WHERE m.family_id = ? AND m.role IN ('admin', 'superadmin') AND ab.provider = 'telegram'
        `).bind(familyId).all();
        targetChatIds = admins.results.map(a => a.provider_uid);
      }

      if (targetChatIds.length === 0) continue;

      // 🌟 2. 核心优化：直接调用公共函数获取内容
      const respText = await generateDailyReport(env.DB, familyId, "🌙 <b>【晚间家庭日报】</b>");

      // 3. 遍历发送给所有目标
      for (const chatId of targetChatIds) {
        await sendTgMessage(env.BOT_TOKEN, chatId, respText);
      }
    }
  } catch (err) {
    console.error('[Cron Push Error]', err);
  }
}