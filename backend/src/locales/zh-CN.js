export default {
  bot: {
    unbound_greeting: "👋 <b>欢迎！</b>\n\n您似乎还未绑定家庭。请点击输入框旁边的 <b>Web App (Mini App)</b> 按钮进入系统完成注册或绑定。",
    bind_prompt: "🔗 请点击底部的 Web App 按钮，在小程序端完成设备绑定。",
    welcome_child: "🎉 <b>欢迎回来！</b>\n\n快点击 Web App 进去看看你的积分和可用奖品吧！",
    welcome_parent: "👨‍👩‍👧 <b>欢迎回来！</b>\n\n您可以随时在此接收审批通知，或点击 Web App 进入家长控制台。",
    request_handled: "该请求已被处理",
    approval_notice: '🔔 <b>审批提醒</b>\n\n👦 孩子: {childName}\n🎁 申请兑换: {rewardName}\n💎 消耗: {cost} {pointStr}\n💰 余额: {balance} {pointStr}',
    approved_success: '🎉 <b>兑换成功通知</b>\n\n👦 孩子: {childName}\n🎁 成功兑换: {rewardName} (消耗：{cost} {pointStr})',
    approved_toast: "✅ 已批准",
    rejected_toast: "❌ 已拒绝",
    result: "审批结果",
    btn_approve: '✅ 同意',
    btn_reject: '❌ 拒绝',
    
    // 🌟 新增飞书卡片专用词条
    lark_card_title: '🔔 积分兑换审批',
    lbl_child: '**👦 孩子:**\n',
    lbl_reward: '**🎁 申请兑换:**\n',
    lbl_cost: '**💎 消耗积分:**\n',
    lbl_balance: '**💰 剩余余额:**\n'
  },
  api: {
    ERR_UNAUTHORIZED: "登录已失效，请重新登录",
    ERR_FORBIDDEN: "操作被拒绝：权限不足",
    ERR_USER_NOT_FOUND: "未找到用户信息",
    ERR_NEED_FAMILY: "请先创建或加入一个家庭",
    ERR_NOT_FOUND: "找不到相关记录或资源",
    ERR_MISSING_PARAMS: "请求失败：参数不完整",
    ERR_SYSTEM_ERROR: "系统繁忙，请稍后再试",
    NETWORK_ERROR: "网络连接异常，请检查您的网络",
    ERR_INVITE_EXPIRED: "邀请码已过期",
    ERR_INVITE_INVALID: "邀请码无效，请检查后重试",
    ERR_INSUFFICIENT_POINTS: "积分不足 (剩 {{balance}}，需 {{cost}})",
    ERR_OUT_OF_STOCK: "奖品库存不足",
    ERR_DUPLICATE_RECORD: "记录已存在，请勿重复操作"
  },
  auth: {
    email_subject: "您的家庭积分管理系统登录验证码",
    email_greeting: "您好！",
    email_code_is: "您的登录验证码是",
    email_valid_time: "该验证码在 5 分钟内有效，请勿泄露给他人。",
    email_sent: "验证码已发送，请检查收件箱",
    login_success: "登录成功",
    join_success: "成功加入家庭！",
    bind_success: "设备绑定成功！"
  },
  defaultRules: [
    { name: '按时完成作业/任务', emoji: '📝', points: 10 },
    { name: '主动做家务 (收拾房间/洗碗)', emoji: '🧹', points: 5 },
    { name: '早睡早起作息规律', emoji: '☀️', points: 5 },
    { name: '电子产品玩超时', emoji: '📱', points: -10 },
    { name: '乱发脾气 / 不讲礼貌', emoji: '😠', points: -5 }
  ],
  ruleTemplates: {
    kindergarten: [
      { name: '自己乖乖吃饭', emoji: '🍚', points: 5 },
      { name: '自己收拾玩具', emoji: '🧸', points: 5 },
      { name: '按时睡觉不哭闹', emoji: '😴', points: 5 },
      { name: '乱丢东西 / 撒泼打滚', emoji: '😭', points: -5 }
    ],
    primary: [
      { name: '按时完成学校作业', emoji: '📚', points: 10 },
      { name: '阅读课外书 30 分钟', emoji: '📖', points: 10 },
      { name: '自己整理书包', emoji: '🎒', points: 5 },
      { name: '看电视/玩游戏超时', emoji: '📺', points: -10 }
    ],
    middle_high: [
      { name: '独立完成预习和复习', emoji: '🎯', points: 15 },
      { name: '参与家庭大扫除', emoji: '🧽', points: 10 },
      { name: '坚持体育锻炼 30 分钟', emoji: '🏃', points: 10 },
      { name: '晚归 / 严重违反家规', emoji: '⚠️', points: -20 }
    ]
  }
};