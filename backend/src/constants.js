// src/constants.js

export const TELEGRAM_API = "https://api.telegram.org/bot";
export const CONFIRMATION_TIMEOUT = 5 * 60; // 秒，用于 KV TTL
export const TIMEZONE = "Asia/Shanghai";
export const HISTORY_MAX_RECORDS = 1000; // 每个孩子最多保留记录数

// ── KV key 常量（DATA / CACHE / HISTORY）──
// 所有 KV 键名集中在此，避免散落各处的魔法字符串
export const KV = {
  CONFIG:               "config",
  SCORES:               "scores",
  ADMIN_IDS:            "adminIds",
  SUPER_ADMIN_ID:       "superAdminId",
  ADMIN_NICKS:          "adminNicks",
  GOALS:                "goals",
  ACHIEVEMENTS:         "achievements",
  ANALYTICS:            "analytics",
  RULES:                "rules",
  DAILY_SUMMARY_CONFIG: "dailySummaryConfig",
  APP_VERSION:          "appVersion",
  AUTH_CONFIG:          "authConfig",

  SYNC_VERSION:           "syncVersion",
  CONFIRM_PREFIX:         "confirm_",         
  DAILY_SUMMARY_SENT:     "dailySummarySent",  
  RATE_LIMIT_PREFIX:      "rl_",    
  REPLAY_PREFIX:          "rp_",    
  VIEWER_IDS:             "viewerIds",    
  CHILD_IDS:              "childIds",     
  
  REWARDS:                "rewards",      
  REWARD_LOG:             "rewardLog",    
  REWARD_PENDING:         "rewardPending",
  REWARD_CONFIG:          "rewardConfig", 
};

// ── 冷却与限流 ──
export const RATE_LIMIT_FAST_MS = 10_000;   // 10s：加减分等快速操作
export const RATE_LIMIT_SLOW_MS = 60_000;   // 60s：规则/孩子/目标/配置等管理操作
export const RATE_LIMIT_KV_TTL  = 300;      // 5分钟
export const REPLAY_TTL         = 3600;     // 防重放 nonce 存 1 小时
export const INIT_DATA_MAX_AGE  = 3600;     // initData auth_date 有效期 1 小时

// 兼容旧引用
export const RATE_LIMIT_FAST = 60;
export const RATE_LIMIT_SLOW = 120;
export const RATE_LIMIT_TTL  = 60;

// /api/history?all=1 返回上限
export const HISTORY_ALL_LIMIT = 200;

// ── 核心业务枚举 ──
export const ROLE = {
  ADMIN:  "admin",   // 管理员（家长）
  CHILD:  "child",   // 孩子账号
  VIEWER: "viewer",  // 只读白名单
  NONE:   "none",    // 未授权
};

export const CHILD_COLORS = [
  "🔴", "🔵", "🟢", "🟡", "🟠", "🟣", "⚫", "⚪",
];

export const DEFAULT_CONFIG = {
  children: {
    child1: { name: "大娃", color: "🔴" },
    child2: { name: "二娃", color: "🔵" },
  },
};

export const DEFAULT_SCORES = {
  child1: { gained: 0, spent: 0 },
  child2: { gained: 0, spent: 0 },
};

// ── 多语言支持配置 ──
export const SUPPORTED_LOCALES = ['zh-CN', 'en-US'];

// ── 多语言默认积分规则 ──
export const DEFAULT_RULES = {
  'zh-CN': {
    common: [
      // 🧹 家务
      { id: "dr_c01", name: "自己整理玩具",     points:  2, category: "chore",    scope: "common" },
      { id: "dr_c02", name: "饭前摆碗筷",       points:  1, category: "chore",    scope: "common" },
      { id: "dr_c03", name: "饭后帮忙收碗",     points:  2, category: "chore",    scope: "common" },
      { id: "dr_c04", name: "扫地或拖地",       points:  3, category: "chore",    scope: "common" },
      // ⭐ 好行为
      { id: "dr_b01", name: "主动问好或说谢谢", points:  1, category: "behavior", scope: "common" },
      { id: "dr_b02", name: "帮助兄弟姐妹",     points:  3, category: "behavior", scope: "common" },
      { id: "dr_b03", name: "主动承认错误",     points:  3, category: "behavior", scope: "common" },
      { id: "dr_b04", name: "安静等待不吵闹",   points:  2, category: "behavior", scope: "common" },
      // 🚫 违规
      { id: "dr_v01", name: "打人或推人",       points: -3, category: "violation", scope: "common" },
      { id: "dr_v02", name: "说谎",             points: -5, category: "violation", scope: "common" },
      { id: "dr_v03", name: "乱扔东西",         points: -2, category: "violation", scope: "common" },
    ],
    children: {
      child1: [ // 小学生专属
        { id: "dr_p01", name: "按时完成作业",     points:  3, category: "homework",  scope: "child1" },
        { id: "dr_p02", name: "作业全对或满分",   points:  5, category: "homework",  scope: "child1" },
        { id: "dr_p03", name: "主动预习或复习",   points:  4, category: "homework",  scope: "child1" },
        { id: "dr_p04", name: "课外阅读30分钟",   points:  3, category: "homework",  scope: "child1" },
        { id: "dr_p05", name: "考试成绩进步",     points:  8, category: "behavior",  scope: "child1" },
        { id: "dr_p06", name: "忘带作业或文具",   points: -2, category: "violation", scope: "child1" },
        { id: "dr_p07", name: "上课不认真听讲",   points: -3, category: "violation", scope: "child1" },
      ],
      child2: [ // 幼儿园专属
        { id: "dr_k01", name: "自己穿衣服",       points:  2, category: "chore",    scope: "child2" },
        { id: "dr_k02", name: "自己穿鞋",         points:  1, category: "chore",    scope: "child2" },
        { id: "dr_k03", name: "午睡乖乖睡着",     points:  2, category: "behavior", scope: "child2" },
        { id: "dr_k04", name: "不挑食吃完饭",     points:  3, category: "behavior", scope: "child2" },
        { id: "dr_k05", name: "自己刷牙洗脸",     points:  2, category: "behavior", scope: "child2" },
        { id: "dr_k06", name: "乱发脾气哭闹",     points: -2, category: "violation", scope: "child2" },
        { id: "dr_k07", name: "不午睡乱跑",       points: -2, category: "violation", scope: "child2" },
      ],
    },
  },
  'en-US': {
    common: [
      // 🧹 Chores
      { id: "dr_c01", name: "Clean up toys",              points:  2, category: "chore",    scope: "common" },
      { id: "dr_c02", name: "Set table before meals",     points:  1, category: "chore",    scope: "common" },
      { id: "dr_c03", name: "Clear table after meals",    points:  2, category: "chore",    scope: "common" },
      { id: "dr_c04", name: "Sweep or mop the floor",     points:  3, category: "chore",    scope: "common" },
      // ⭐ Good Behaviors
      { id: "dr_b01", name: "Say hello or thank you",     points:  1, category: "behavior", scope: "common" },
      { id: "dr_b02", name: "Help siblings",              points:  3, category: "behavior", scope: "common" },
      { id: "dr_b03", name: "Admit mistakes honestly",    points:  3, category: "behavior", scope: "common" },
      { id: "dr_b04", name: "Wait quietly/patiently",     points:  2, category: "behavior", scope: "common" },
      // 🚫 Violations
      { id: "dr_v01", name: "Hitting or pushing",         points: -3, category: "violation", scope: "common" },
      { id: "dr_v02", name: "Lying",                      points: -5, category: "violation", scope: "common" },
      { id: "dr_v03", name: "Throwing things around",     points: -2, category: "violation", scope: "common" },
    ],
    children: {
      child1: [ // Primary School
        { id: "dr_p01", name: "Finish homework on time",  points:  3, category: "homework",  scope: "child1" },
        { id: "dr_p02", name: "Perfect homework score",   points:  5, category: "homework",  scope: "child1" },
        { id: "dr_p03", name: "Preview/Review lessons",   points:  4, category: "homework",  scope: "child1" },
        { id: "dr_p04", name: "Read for 30 minutes",      points:  3, category: "homework",  scope: "child1" },
        { id: "dr_p05", name: "Improve test scores",      points:  8, category: "behavior",  scope: "child1" },
        { id: "dr_p06", name: "Forgot homework/supplies", points: -2, category: "violation", scope: "child1" },
        { id: "dr_p07", name: "Not paying attention",     points: -3, category: "violation", scope: "child1" },
      ],
      child2: [ // Kindergarten
        { id: "dr_k01", name: "Dress oneself",            points:  2, category: "chore",    scope: "child2" },
        { id: "dr_k02", name: "Put on shoes",             points:  1, category: "chore",    scope: "child2" },
        { id: "dr_k03", name: "Sleep nicely during nap",  points:  2, category: "behavior", scope: "child2" },
        { id: "dr_k04", name: "Finish meal (no picky)",   points:  3, category: "behavior", scope: "child2" },
        { id: "dr_k05", name: "Brush teeth & wash face",  points:  2, category: "behavior", scope: "child2" },
        { id: "dr_k06", name: "Throw tantrums/crying",    points: -2, category: "violation", scope: "child2" },
        { id: "dr_k07", name: "Running around at nap",    points: -2, category: "violation", scope: "child2" },
      ],
    },
  }
};