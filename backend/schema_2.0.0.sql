-- ==========================================
-- 1. 核心实体表 (多租户 M:N 架构)
-- ==========================================

-- 用户表 (家长/管理员主体)
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,             -- NanoID
  nick_name TEXT,                  -- 默认昵称
  avatar TEXT DEFAULT '👤',        -- 默认头像 Emoji
  locale TEXT DEFAULT 'zh-CN',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 家庭表 (租户主体)
CREATE TABLE IF NOT EXISTS families (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  avatar TEXT DEFAULT '🏠',
  timezone TEXT DEFAULT 'Asia/Shanghai',
  point_name TEXT DEFAULT 'Coins',
  point_emoji TEXT DEFAULT '🪙',
  push_enabled BOOLEAN DEFAULT 0,
  push_time TEXT DEFAULT '20:00',
  push_options TEXT DEFAULT '["summary","pending","expiring"]',
  instant_alert_enabled BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 成员关系表 (实现一个用户属于多个家庭)
CREATE TABLE IF NOT EXISTS memberships (
  id TEXT PRIMARY KEY,
  family_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT DEFAULT 'admin',       -- 'superadmin', 'admin', 'viewer'
  joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(family_id, user_id)
);

-- 孩子表 (属于特定家庭)
CREATE TABLE IF NOT EXISTS children (
  id TEXT PRIMARY KEY,
  family_id TEXT NOT NULL,
  name TEXT NOT NULL,
  avatar TEXT DEFAULT '👦',
  score_gained INTEGER DEFAULT 0,  
  score_spent INTEGER DEFAULT 0,   
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE
);

-- 增加孩子表的 birthday 字段，类型改为 TEXT 以适应不同格式的日期输入（如 "2015-06-01" 或 "2015/06/01"）
ALTER TABLE children ADD COLUMN birthday TEXT;

-- ==========================================
-- 2. 鉴权与绑定表
-- ==========================================

CREATE TABLE IF NOT EXISTS auth_bindings (
  id TEXT PRIMARY KEY,
  internal_id TEXT NOT NULL,       -- 指向 users.id 或 children.id
  user_type TEXT NOT NULL,         -- 'parent' 或 'child'
  provider TEXT NOT NULL,          -- 'telegram', 'wechat', 'email', 'device'
  provider_uid TEXT NOT NULL,      -- 第三方 ID 或 设备唯一标识
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(provider, provider_uid)
);

-- 邀请码管理
CREATE TABLE IF NOT EXISTS invitation_codes (
  code TEXT PRIMARY KEY,
  family_id TEXT NOT NULL,
  type TEXT NOT NULL,               -- 'admin', 'child'
  target_child_id TEXT,             -- 仅 child 类型使用
  expires_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE
);

-- ==========================================
-- 3. 业务逻辑表 (积分、规则、奖励)
-- ==========================================

CREATE TABLE IF NOT EXISTS rules (
  id TEXT PRIMARY KEY,
  family_id TEXT NOT NULL,
  name TEXT NOT NULL,
  emoji TEXT DEFAULT '⭐',             -- 🌟 新增：规则的图标
  points INTEGER NOT NULL,
  daily_limit INTEGER DEFAULT 0,
  child_id TEXT,                       -- 🌟 新增：适用的专属孩子ID (NULL表示所有人通用)
  status TEXT DEFAULT 'active',        -- 🌟 新增：规则状态 (active / inactive)
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, -- 🌟 新增：更新时间
  FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE,
  FOREIGN KEY (child_id) REFERENCES children(id) ON DELETE CASCADE  -- 🌟 新增：关联孩子的级联删除
);

-- 建议加上索引，因为查询特定孩子的有效规则是非常高频的操作
CREATE INDEX IF NOT EXISTS idx_rules_child_status ON rules(child_id, status);

-- 积分流水表：记录每一次积分变动的详细日志，方便后续查询和统计
CREATE TABLE history (
  id TEXT PRIMARY KEY,
  family_id TEXT NOT NULL,
  child_id TEXT NOT NULL,
  rule_id TEXT,
  points INTEGER NOT NULL,
  operator_id TEXT,
  remark TEXT,                                      
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE,
  FOREIGN KEY (child_id) REFERENCES children(id) ON DELETE CASCADE,
  FOREIGN KEY (rule_id) REFERENCES rules(id) ON DELETE SET NULL  -- 🌟 新增的外键约束
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
  category_id TEXT,                 -- 可选的分类关联
  description TEXT,
  require_approval BOOLEAN DEFAULT 0, -- 商品独立审批开关
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  is_deleted BOOLEAN DEFAULT 0,        -- 软删除标记
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

-- 6. 分类体系 (新功能)
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  family_id TEXT NOT NULL,
  name TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);


-- 1. 加速前端拉取商品列表 (过滤已删除商品)
CREATE INDEX IF NOT EXISTS idx_rewards_family_deleted ON rewards(family_id, is_deleted);

-- 2. 加速按分类筛选商品
CREATE INDEX IF NOT EXISTS idx_rewards_category ON rewards(family_id, category_id);

-- 3. 加速分类列表的排序返回
CREATE INDEX IF NOT EXISTS idx_categories_family_sort ON categories(family_id, sort_order);

-- 4. 给分类表添加一个 emoji 字段，方便前端展示时有个小图标
ALTER TABLE categories ADD COLUMN emoji TEXT DEFAULT '🏷️';

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
