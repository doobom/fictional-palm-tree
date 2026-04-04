// src/index.js
import { Hono } from 'hono';
import { platformAuth, requireAppUser } from './middlewares/auth.js';

// 1. 引入所有路由模块
import authRoutes from './routes/auth.js';
import scoreRoutes from './routes/scores.js';
import rewardRoutes from './routes/rewards.js';
import childrenRoutes from './routes/children.js';
import goalRoutes from './routes/goals.js';
import achievementRoutes from './routes/achievements.js';
import analyticsRoutes from './routes/analytics.js';
import familyRoutes from './routes/family.js';
import webhookRoutes from './routes/webhook.js';
import user from './routes/user.js'; // 新增用户相关路由
import { sendTgMessage } from './utils/telegram.js';

// 2. 引入队列处理函数
import { handleRedeemApproval, handleRedeemAutoApproved } from './queues/rewardsHandler.js';

import categoriesRoutes from './routes/categories.js';

const app = new Hono();

// ==========================================
// 1. 全局跨域 (CORS) 与错误处理
// ==========================================
app.use('*', async (c, next) => {
  const allowedOrigins = (c.env.ALLOWED_ORIGINS || '').split(',');
  const origin = c.req.header('Origin') || '';
  const isAllowed = allowedOrigins.includes(origin);

  c.header('Access-Control-Allow-Origin', isAllowed ? origin : '');
  c.header('Vary', 'Origin');
  c.header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS, PUT, DELETE');
  c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Telegram-Init-Data');
  if (c.req.method === 'OPTIONS') return c.body(null, 204);
  await next();
});

app.onError((err, c) => {
  console.error(`[Global Error] 发生未捕获异常:`, err);
  return c.json({ 
    success: false, 
    errorCode: 'ERR_SYSTEM_ERROR', 
    errorMessage: 'Internal Server Error' 
  }, 500);
});

// ==========================================
// 2. 注册与绑定路由组 (🔓 仅需第一关: 平台鉴权)
// 这里只校验第三方 Token 是否合法，不校验是否已建家庭
// ==========================================
const authGroup = new Hono();
authGroup.use('/*', platformAuth);
authGroup.route('/', authRoutes); // 挂载 /create-family, /join-family, /bind-child

app.route('/api/auth', authGroup);

// ==========================================
// 3. 核心业务 API 组 (🔒 需第二关: 应用鉴权)
// 必须是已经注册/绑定过家庭的用户才能访问
// ==========================================
const apiGroup = new Hono();
apiGroup.use('/*', platformAuth, requireAppUser);

// 前端启动时调用的状态检测接口
// 前端启动时调用的状态检测接口 (负责组装完整的个人名片展示数据)
apiGroup.get('/me', async (c) => {
  const user = c.get('user'); // 这里只有 requireAppUser 给的基础字段 (internalId, familyId, userType 等)

  try {
    if (user.userType === 'parent') {
      // 🌟 如果是家长，联合查询 users 和 families 表获取头像和昵称
      const dbUser = await c.env.DB.prepare(`
        SELECT 
          u.nick_name, u.avatar as user_avatar, 
          f.name as family_name, f.avatar as family_avatar,
          f.timezone, f.push_enabled, f.push_time, f.push_options,
          f.point_name, f.point_emoji, f.instant_alert_enabled
        FROM users u
        LEFT JOIN families f ON u.family_id = f.id
        WHERE u.id = ?
      `).bind(user.internalId).first();

      if (dbUser) {
        return c.json({
          success: true,
          data: {
            ...user, // 保留基础字段 (userType 等，防止前端路由出错)
            nickName: dbUser.nick_name || '',
            userAvatar: dbUser.user_avatar || '👤',
            familyName: dbUser.family_name || '',
            familyAvatar: dbUser.family_avatar || '🏠',
            // 🌟 增加返回字段
            timezone: dbUser.timezone,
            push_enabled: dbUser.push_enabled,
            push_time: dbUser.push_time,
            push_options: dbUser.push_options,
            point_name: dbUser.point_name,
            point_emoji: dbUser.point_emoji,
            instant_alert_enabled: dbUser.instant_alert_enabled
          }
        });
      }
    } 
    else if (user.userType === 'child') {
      // 🌟 如果是孩子，查询 children 表获取孩子的头像和小名
      const dbChild = await c.env.DB.prepare(`
        SELECT name, avatar FROM children WHERE id = ?
      `).bind(user.internalId).first();

      if (dbChild) {
        return c.json({
          success: true,
          data: {
            ...user,
            nickName: dbChild.name || '',
            userAvatar: dbChild.avatar || '👦'
          }
        });
      }
    }

    // 兜底返回
    return c.json({ success: true, data: c.get('user') });

  } catch (error) {
    console.error(`[System Error] /me 接口查询资料失败:`, error);
    // 即使查询展示资料失败，也把核心鉴权数据返回，保证应用不卡死
    return c.json({ success: true, data: c.get('user') }); 
  }
});

// 挂载各模块业务
apiGroup.route('/children', childrenRoutes);
apiGroup.route('/scores', scoreRoutes);
apiGroup.route('/rewards', rewardRoutes);
apiGroup.route('/goals', goalRoutes);
apiGroup.route('/achievements', achievementRoutes);
apiGroup.route('/analytics', analyticsRoutes);
apiGroup.route('/family', familyRoutes);
apiGroup.route('/user', user); // 新增用户相关接口
apiGroup.route('/categories', categoriesRoutes); // 新增分类接口

app.route('/api', apiGroup);

// ==========================================
// 4. Webhook 路由组 (🤖 机器人交互接收端)
// 内部自己做白名单和鉴权，不使用 requireAppUser
// ==========================================
app.route('/api/webhook', webhookRoutes);


// ==========================================
// 5. Cloudflare Worker 统一导出 (HTTP & Queue)
// ==========================================
export default {
  // 处理常规 HTTP 请求 (交由 Hono 引擎)
  fetch: app.fetch,

  // 处理异步消息队列 (Cloudflare 自动触发)
  async queue(batch, env, ctx) {
    for (const msg of batch.messages) {
      try {
        const data = msg.body;

        switch (data.type) {
          case 'REDEEM_APPROVAL_REQUEST':
            await handleRedeemApproval(data, env);
            break;
            
          case 'REDEEM_AUTO_APPROVED':
            await handleRedeemAutoApproved(data, env);
            break;
            
          // 如果未来增加了目标的完成推送，可以在这里加 case 'GOAL_COMPLETED'
          default:
            console.warn(`[Queue Warn] 收到未知的消息类型:`, data.type);
        }

        // 成功处理后，显式确认消息，从队列中移除
        msg.ack();
      } catch (error) {
        console.error(`[Queue Error] 队列消息处理失败. MessageBody:`, msg.body, `Error:`, error);
        // 如果处理失败，让这条消息稍后重试投递
        msg.retry();
      }
    }
  },

  // ==========================================
  // 5. Cloudflare Worker 统一导出 (HTTP, Queue & Cron)
  // ==========================================
  async scheduled(event, env, ctx) {
    // 1. 获取当前 UTC 时间
    const nowUtc = new Date();
    const utcHours = nowUtc.getUTCHours();
    const utcMinutes = nowUtc.getUTCMinutes();

    console.log(`[Cron] 任务启动 | 当前 UTC 时间: ${utcHours}:${utcMinutes}`);

    // ---------------------------------------------------------
    // 任务 A：每日定时清理 (原 2:00 AM 清理任务)
    // ---------------------------------------------------------
    // 只有在 UTC 02:00 的那两分钟内执行（防止 Cron 偏差，加个判断）
    if (utcHours === 2 && utcMinutes === 0) {
      console.log(`[Cron] 开始执行每日数据库清理...`);
      ctx.waitUntil((async () => {
        try {
          const result = await env.DB.prepare(`
            DELETE FROM processed_updates 
            WHERE created_at <= datetime('now', '-2 days')
          `).run();

          // 🌟 2. 新增：清理过期的邀请码 (包括家庭邀请码和孩子绑定码)
          // 因为生成代码时用的是 .toISOString()，SQLite 可以直接与 datetime('now') 比对
          const resultCodes = await env.DB.prepare(`
            DELETE FROM invitation_codes 
            WHERE expires_at <= datetime('now')
          `).run();

          console.log(`[Cron] 清理成功！共删除记录: ${result.meta.changes}`);
        } catch (err) {
          console.error(`[Cron] 清理失败:`, err);
        }
      })());
    }

    // ---------------------------------------------------------
    // 任务 B：每日小结推送 (每分钟扫描)
    // ---------------------------------------------------------
    ctx.waitUntil((async () => {
      try {
        // 1. 找出所有开启了推送的家庭
        const { results: families } = await env.DB.prepare(`
          SELECT id, name, timezone, push_time, push_options, point_name, point_emoji 
          FROM families 
          WHERE push_enabled = 1
        `).all();

        for (const family of families) {
          // 2. 计算该家庭所在时区的当前时间
          // 使用 Intl 转换时区，这是 CF Workers 支持的标准做法
          const familyLocalTime = new Date(new Date().toLocaleString("en-US", { timeZone: family.timezone }));
          const localH = String(familyLocalTime.getHours()).padStart(2, '0');
          const localM = String(familyLocalTime.getMinutes()).padStart(2, '0');
          const currentTimeStr = `${localH}:${localM}`;

          // 3. 匹配推送时间 (例如 "20:00" === "20:00")
          if (currentTimeStr === family.push_time) {
            console.log(`[Push] 命中推送时间！家庭: ${family.name} (${family.id})`);
            
            // 🌟 这里执行发送推送的逻辑 (见下方的建议实现)
            await sendDailySummary(family, env);
          }
        }
      } catch (err) {
        console.error(`[Cron] 推送扫描失败:`, err);
      }
    })());
  }
};

async function sendDailySummary(family, env) {
  const options = JSON.parse(family.push_options || '[]');
  
  // 🌟 组装当前家庭的自定义货币
  const pointStr = `${family.point_emoji || '🪙'}${family.point_name || '积分'}`;

  // 🌟 使用 HTML 标签 <b> 替代 Markdown 的 *
  let message = `🏠 <b>${family.name} - 每日简报</b> \n\n`;

  // 1. 获取所有管理员
  const { results: admins } = await env.DB.prepare(`
    SELECT b.provider_uid FROM auth_bindings b
    JOIN users u ON b.internal_id = u.id
    WHERE u.family_id = ? AND u.role IN ('superadmin', 'admin') AND b.provider = 'telegram'
  `).bind(family.id).all();

  if (admins.length === 0) return;

  // 2. 根据用户勾选的选项查询数据
  if (options.includes('summary')) {
    const stats = await env.DB.prepare(`
      SELECT c.name, SUM(CASE WHEN h.type='plus' THEN h.points ELSE 0 END) as gained
      FROM children c
      LEFT JOIN history h ON c.id = h.child_id AND h.created_at >= date('now', 'start of day')
      WHERE c.family_id = ? GROUP BY c.id
    `).bind(family.id).all();
    
    message += `📊 <b>今日积分动态：</b>\n`;
    stats.results.forEach(s => {
      message += `${s.name}: +${s.gained || 0} ${pointStr}\n`;
    });
    message += `\n`;
  }

  if (options.includes('pending')) {
    const { count } = await env.DB.prepare(`
      SELECT COUNT(*) as count FROM redemptions WHERE family_id = ? AND status = 'pending'
    `).bind(family.id).first();
    if (count > 0) message += `🔔 <b>待处理审批：</b> ${count} 条\n`;
  }

  // 3. 🌟 直接复用 telegram.js 中的方法发送
  for (const admin of admins) {
    await sendTgMessage(env.TELEGRAM_TOKEN, admin.provider_uid, message);
  }
}