/**
 * 全局业务常量定义
 * 用于统一管理系统状态、权限、平台及错误码
 */

// 1. 用户角色定义 (针对 memberships 表)
export const USER_ROLES = {
  SUPERADMIN: 'superadmin', // 家庭创建者：拥有最高权限（解散家庭、成员管理、配置修改）
  ADMIN: 'admin',           // 管理员（家长）：可进行积分操作、规则管理、奖励审批
  VIEWER: 'viewer',         // 观察者：仅可查看积分数据和历史记录，无权修改
  CHILD: 'child'            // 孩子主体：仅能查看个人积分、成就和发起兑换申请
};

// 2. 身份认证平台 (针对 auth_bindings 表)
export const AUTH_PROVIDERS = {
  TELEGRAM: 'telegram',     // Telegram Mini App 接入
  WECHAT: 'wechat',         // 微信小程序接入
  LARK: 'feishu',           // 飞书/Lark 接入
  EMAIL: 'email',           // 邮箱 + JWT 登录
  DEVICE: 'device'          // 孩子端特定设备长效绑定 Token
};

// 3. 积分变动类型
export const SCORE_TYPES = {
  PLUS: 'plus',             // 加分
  MINUS: 'minus'            // 扣分/回退
};

// 4. 兑换申请状态 (针对 redemptions 表)
export const REDEEM_STATUS = {
  PENDING: 'pending',       // 待审批
  APPROVED: 'approved',     // 已通过 (由管理员手动或规则自动触发)
  REJECTED: 'rejected',     // 已拒绝
  COMPLETED: 'completed'    // 已发放/已核销
};

// 5. 目标与成就状态 (针对 goals/achievements 表)
export const GOAL_STATUS = {
  ACTIVE: 'active',         // 进行中
  COMPLETED: 'completed',   // 已达成
  EXPIRED: 'expired'        // 已过期 (针对限时目标)
};

// 6. 异步队列动作类型 (Cloudflare Queues)
export const QUEUE_ACTIONS = {
  CHECK_ACHIEVEMENTS: 'CHECK_ACHIEVEMENTS', // 积分变动后触发成就与目标扫描
  REDEEM_NOTIFY: 'REDEEM_APPROVAL_REQUEST',  // 兑换申请推送通知
  AUTO_APPROVE: 'REDEEM_AUTO_APPROVED'       // 自动审批成功通知
};

// 7. Durable Object 交互内部指令
export const DO_COMMANDS = {
  ADJUST_SCORE: '/adjust',         // 单笔积分变动
  BATCH_ADJUST: '/adjust-batch',   // 批量积分变动
  GET_EVENTS: '/events'            // SSE 实时事件流
};

// 8. 默认配置与展示兜底
export const DEFAULT_CONFIG = {
  TIMEZONE: 'Asia/Shanghai',
  LOCALE: 'zh-CN',
  POINT_NAME: '积分',
  POINT_EMOJI: '🪙',
  AVATAR_USER: '👤',
  AVATAR_FAMILY: '🏠',
  AVATAR_CHILD: '👦'
};

// 9. 全局错误码 (需与 errorCode.md 保持同步)
export const ERROR_CODES = {
  // 鉴权类
  UNAUTHORIZED: 'ERR_UNAUTHORIZED',
  FORBIDDEN: 'ERR_FORBIDDEN',
  USER_NOT_FOUND: 'ERR_USER_NOT_FOUND',
  FAMILY_CONTEXT_MISSING: 'ERR_FAMILY_CONTEXT_MISSING',
  
  // 业务类
  DAILY_LIMIT: 'ERR_DAILY_LIMIT_REACHED',
  INSUFFICIENT_POINTS: 'ERR_INSUFFICIENT_POINTS',
  INVALID_INVITE: 'ERR_INVALID_INVITE',
  ALREADY_BOUND: 'ERR_ALREADY_BOUND',
  
  // 系统类
  NOT_FOUND: 'ERR_NOT_FOUND',
  SYSTEM_ERROR: 'ERR_SYSTEM_ERROR'
};