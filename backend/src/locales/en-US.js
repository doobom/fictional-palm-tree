export default {
  bot: {
    unbound_greeting: "👋 <b>Welcome!</b>\n\nIt seems you haven't bound a family yet. Please click the <b>Web App</b> button near the input field to register or bind your account.",
    bind_prompt: "🔗 Please complete the binding process inside the Web App.",
    welcome_child: "🎉 <b>Welcome back!</b>\n\nOpen the Web App to check your points and rewards!",
    welcome_parent: "👨‍👩‍👧 <b>Welcome back!</b>\n\nYou can approve requests here or open the Web App to manage your family.",
    request_handled: "This request has already been handled.",
    approval_notice: '🔔 <b>Approval Request</b>\n\n👦 Child: {childName}\n🎁 Reward: {rewardName}\n💎 Cost: {cost} {pointStr}\n💰 Balance: {balance} {pointStr}',
    approved_success: '🎉 <b>Redemption Successful</b>\n\n👦 Child: {childName}\n🎁 Reward: {rewardName} (Cost: {cost} {pointStr})',
    approved_toast: "✅ Approved",
    rejected_toast: "❌ Rejected",
    result: "Result",
    btn_approve: '✅ Approve',
    btn_reject: '❌ Reject',
    
    // 🌟 新增飞书卡片专用词条
    lark_card_title: '🔔 Redemption Approval',
    lbl_child: '**👦 Child:**\n',
    lbl_reward: '**🎁 Reward:**\n',
    lbl_cost: '**💎 Cost:**\n',
    lbl_balance: '**💰 Balance:**\n'
  },
  api: {
    ERR_UNAUTHORIZED: "Session expired, please login again",
    ERR_FORBIDDEN: "Permission denied",
    ERR_USER_NOT_FOUND: "User profile not found",
    ERR_NEED_FAMILY: "Please create or join a family first",
    ERR_NOT_FOUND: "Resource or record not found",
    ERR_MISSING_PARAMS: "Request failed: missing parameters",
    ERR_SYSTEM_ERROR: "System busy, please try again later",
    NETWORK_ERROR: "Network error, please check your connection",
    ERR_INVITE_EXPIRED: "Invite code has expired",
    ERR_INVITE_INVALID: "Invalid invite code",
    ERR_INSUFFICIENT_POINTS: "Insufficient points (Balance: {{balance}}, Required: {{cost}})",
    ERR_OUT_OF_STOCK: "Out of stock",
    ERR_DUPLICATE_RECORD: "Record already exists"
  },
  auth: {
    email_subject: "Your Family Points System Login Code",
    email_greeting: "Hello!",
    email_code_is: "Your login code is",
    email_valid_time: "This code is valid for 5 minutes. Please do not share it.",
    email_sent: "Verification code sent, please check your inbox.",
    login_success: "Login successful",
    join_success: "Successfully joined the family!",
    bind_success: "Device successfully bound!"
  }
};