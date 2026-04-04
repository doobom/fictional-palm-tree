-- ==========================================
-- 1. 租户与核心实体表 (纯粹的业务实体，不含任何第三方账号信息)
-- ==========================================

-- 家庭表 (租户)
CREATE TABLE IF NOT EXISTS families (
  id TEXT PRIMARY KEY,             -- 内部全局唯一 ID (推荐 NanoID)
  name TEXT NOT NULL,              -- 家庭名称，例如 "李家"
  timezone TEXT DEFAULT 'Asia/Shanghai', -- 🌟 新增时区
  -- invite_code TEXT UNIQUE,         -- ★ 新增：家庭专属邀请码 (例如 6位大写字母+数字)
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 家长/管理员表
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,             -- 内部全局唯一 ID (NanoID)
  family_id TEXT NOT NULL,         
  role TEXT DEFAULT 'admin',       -- 'superadmin', 'admin', 'viewer'
  nick_name TEXT,                  -- 昵称，如 "爸爸", "妈妈"
  locale TEXT DEFAULT 'zh-CN',       -- 语言环境，默认中文
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE
);

-- 给用户表和家庭表增加头像字段 (存 Emoji)
ALTER TABLE users ADD COLUMN avatar TEXT DEFAULT '👤';
ALTER TABLE families ADD COLUMN avatar TEXT DEFAULT '🏠';

-- 增加推送开关 (0: 关闭, 1: 开启) 和 推送时间 (格式 "HH:mm")
ALTER TABLE families ADD COLUMN push_enabled BOOLEAN DEFAULT 0;
ALTER TABLE families ADD COLUMN push_time TEXT DEFAULT '20:00';

-- 增加推送配置字段，默认全选
ALTER TABLE families ADD COLUMN push_options TEXT DEFAULT '["summary","pending","expiring"]';

-- 1. 积分个性化
ALTER TABLE families ADD COLUMN point_name TEXT DEFAULT 'Coins';
ALTER TABLE families ADD COLUMN point_emoji TEXT DEFAULT '🪙';

-- 2. 即时通知开关 (0: 关闭, 1: 开启)
ALTER TABLE families ADD COLUMN instant_alert_enabled BOOLEAN DEFAULT 1;

-- 孩子表
CREATE TABLE IF NOT EXISTS children (
  id TEXT PRIMARY KEY,             -- 内部全局唯一 ID (NanoID)
  family_id TEXT NOT NULL,
  name TEXT NOT NULL,
  color TEXT DEFAULT '🟢',
  gender TEXT,
  birthday DATE,
  score_gained INTEGER DEFAULT 0,  
  score_spent INTEGER DEFAULT 0,   
  locale TEXT DEFAULT 'zh-CN',       -- 语言环境，默认中文
  avatar TEXT,                    -- 孩子头像 URL
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE
);


-- 邀请码 / 绑定码 统一管理表
CREATE TABLE IF NOT EXISTS invitation_codes (
  code TEXT PRIMARY KEY,              -- 邀请码 (如 'A8X92B' 或 'C-1234')
  family_id TEXT NOT NULL,
  type TEXT NOT NULL,                 -- 类型: 'admin', 'viewer', 'child'
  target_child_id TEXT,               -- ★ 仅当 type='child' 时有值，记录要绑定的具体孩子 ID
  created_by TEXT,                    -- 是哪个家长(users.id)生成的
  expires_at DATETIME,                -- ★ 过期时间 (增强安全性)
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE,
  FOREIGN KEY (target_child_id) REFERENCES children(id) ON DELETE CASCADE
);

-- ==========================================
-- 2. 万能账号绑定表 (🌟 多平台接入的核心)
-- ==========================================

CREATE TABLE IF NOT EXISTS auth_bindings (
  id TEXT PRIMARY KEY,
  internal_id TEXT NOT NULL,       -- 对应 users.id 或 children.id
  user_type TEXT NOT NULL,         -- 'parent' 或 'child'
  provider TEXT NOT NULL,          -- 平台: 'telegram', 'feishu', 'wechat', 'alipay'
  provider_uid TEXT NOT NULL,      -- 第三方平台给的 openid/uid (如 TG 的 user_id)
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  -- 联合唯一：同一个第三方账号只能绑定一个内部实体
  UNIQUE(provider, provider_uid)
);

-- 登录与关联查询加速
CREATE INDEX IF NOT EXISTS idx_auth_login ON auth_bindings(provider, provider_uid);
CREATE INDEX IF NOT EXISTS idx_auth_internal ON auth_bindings(internal_id);

-- ==========================================
-- 3. 积分与规则体系
-- ==========================================

CREATE TABLE IF NOT EXISTS rules (
  id TEXT PRIMARY KEY,
  family_id TEXT NOT NULL,
  name TEXT NOT NULL,
  points INTEGER NOT NULL,         -- 正数加分，负数扣分
  category TEXT DEFAULT 'custom',
  scope TEXT DEFAULT 'common',     -- 'common' 或 具体的 child_id
  daily_limit INTEGER DEFAULT 0,   -- 每日触发上限 (0 表示无限制)
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS history (
  id TEXT PRIMARY KEY,
  family_id TEXT NOT NULL,
  child_id TEXT NOT NULL,
  rule_id TEXT,                    -- 关联具体规则 (用于判断 daily_limit)
  type TEXT NOT NULL,              -- 'plus' 或 'minus'
  points INTEGER NOT NULL,
  description TEXT,
  channel TEXT DEFAULT 'bot',      
  operator_id TEXT,                -- 谁操作的 (对应 users.id)
  reverted BOOLEAN DEFAULT 0,      
  revert_of TEXT,                  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE,
  FOREIGN KEY (child_id) REFERENCES children(id) ON DELETE CASCADE,
  FOREIGN KEY (rule_id) REFERENCES rules(id) ON DELETE SET NULL, 
  FOREIGN KEY (operator_id) REFERENCES users(id) ON DELETE SET NULL
);

-- 加速统计和每日限额查询
CREATE INDEX IF NOT EXISTS idx_history_daily_limit ON history(child_id, rule_id, created_at);
CREATE INDEX IF NOT EXISTS idx_history_family_time ON history(family_id, created_at DESC);

-- ==========================================
-- 4. 兑换商品体系
-- ==========================================

CREATE TABLE IF NOT EXISTS rewards (
  id TEXT PRIMARY KEY,
  family_id TEXT NOT NULL,
  name TEXT NOT NULL,
  emoji TEXT DEFAULT '🎁',
  cost INTEGER NOT NULL,
  stock INTEGER DEFAULT -1,        -- -1 = 无限
  description TEXT,
  require_approval BOOLEAN DEFAULT 0, -- 商品独立审批开关
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS redemptions (
  id TEXT PRIMARY KEY,
  family_id TEXT NOT NULL,
  child_id TEXT NOT NULL,
  reward_id TEXT,                  
  reward_snapshot TEXT,            -- 存入商品快照，防改价/删除
  cost INTEGER NOT NULL,
  status TEXT DEFAULT 'pending',   -- 'pending', 'approved', 'rejected'
  operator_id TEXT,                -- 谁申请的
  approved_by TEXT,                -- 谁审批的
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE,
  FOREIGN KEY (child_id) REFERENCES children(id) ON DELETE CASCADE
);

-- ==========================================
-- 5. 目标与成就体系
-- ==========================================

-- 目标系统：家长为孩子设定的任务（如：本周获得100分奖励去游乐场）
CREATE TABLE IF NOT EXISTS goals (
id TEXT PRIMARY KEY,
  family_id TEXT NOT NULL,
  child_id TEXT NOT NULL,
  name TEXT NOT NULL,             -- 目标名称，如“周末去吃大餐”
  type TEXT NOT NULL,             -- 'weekly' (每周重置) 或 'total' (累计达到)
  target_points INTEGER NOT NULL, -- 目标分数
  current_points INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active',   -- 'active', 'completed'
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  deadline DATETIME,
  FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE,
  FOREIGN KEY (child_id) REFERENCES children(id) ON DELETE CASCADE
);

-- 成就系统：系统自动记录的勋章
CREATE TABLE IF NOT EXISTS achievements (
  id TEXT PRIMARY KEY,
  family_id TEXT NOT NULL,
  child_id TEXT NOT NULL,
  achievement_key TEXT NOT NULL,  -- 唯一标识，如 'streak_7', 'first_100_points'
  progress INTEGER DEFAULT 0,     -- 进度 (0-100)
  unlocked INTEGER DEFAULT 0,     -- 0: 未解锁, 1: 已解锁
  unlocked_at DATETIME,
  UNIQUE(child_id, achievement_key), -- 同一个孩子同一个成就只能有一条记录
  FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE,
  -- PRIMARY KEY (child_id, achievement_key),  -- 也可以用联合主键替代单独的 id 字段 -- 与 主键冲突，改为 UNIQUE 索引
  FOREIGN KEY (child_id) REFERENCES children(id) ON DELETE CASCADE
);

-- goals 表中获取孩子的活跃目标非常高频
CREATE INDEX IF NOT EXISTS idx_goals_child_status ON goals(child_id, status);

-- achievements 表获取孩子的成就墙
CREATE INDEX IF NOT EXISTS idx_achievements_child ON achievements(child_id);

-- invitation_codes 校验过期和匹配
CREATE INDEX IF NOT EXISTS idx_invite_code ON invitation_codes(code);

-- 建表语句：记录已经处理过的 update_id
CREATE TABLE IF NOT EXISTS processed_updates (
  update_id INTEGER PRIMARY KEY,
  processed_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 可选：为了防止这张表无限膨胀，我们只关心最近的防重放。
-- 以后你可以写个定时任务（Cron Trigger）定期删除 7 天前的记录。

-- ========================================== 1.2.4 新增功能
-- 6. 分类体系 (新功能)
-- 1. 创建分类表
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  family_id TEXT NOT NULL,
  name TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. 给现有的商品表增加关联字段
ALTER TABLE rewards ADD COLUMN category_id TEXT;

-- 3. 给现有的商品表增加软删除标记字段
ALTER TABLE rewards ADD COLUMN is_deleted BOOLEAN DEFAULT 0;

-- 1. 加速前端拉取商品列表 (过滤已删除商品)
CREATE INDEX IF NOT EXISTS idx_rewards_family_deleted ON rewards(family_id, is_deleted);

-- 2. 加速按分类筛选商品
CREATE INDEX IF NOT EXISTS idx_rewards_category ON rewards(family_id, category_id);

-- 3. 加速分类列表的排序返回
CREATE INDEX IF NOT EXISTS idx_categories_family_sort ON categories(family_id, sort_order);

-- =========================================== 