// src/utils/alipay.js

/**
 * 支付宝发送客服消息/生活号消息
 * 注意：实际生产环境中，支付宝接口请求必须携带基于应用私钥的 RSA2 签名 (sign)。
 * 这里提供标准 API 请求的结构骨架。
 */
export async function sendAlipayMessage(appId, privateKey, alipayUserId, text) {
  // 支付宝网关地址
  const gatewayUrl = 'https://openapi.alipay.com/gateway.do';
  
  // 构造基础公共请求参数
  const params = new URLSearchParams({
    app_id: appId,
    method: 'alipay.open.message.custom.send', // 单发客服消息接口
    format: 'JSON',
    charset: 'utf-8',
    sign_type: 'RSA2',
    timestamp: new Date().toISOString().replace('T', ' ').split('.')[0],
    version: '1.0',
    biz_content: JSON.stringify({
      to_user_id: alipayUserId, // 用户的支付宝 2088 开头的 UserID
      msg_type: 'text',
      text: {
        content: text
      }
    })
  });

  // ⚠️ 核心注意：在 Cloudflare Workers 中，你需要使用 Web Crypto API (crypto.subtle) 
  // 对 params 按照字母排序后进行 RSA-SHA256 签名，并追加到 params 中：
  // params.append('sign', generatedSignature);
  // 为了代码简洁，这里的签名过程省略，实际接入时可引入相关轻量级加密库。

  try {
    const res = await fetch(`${gatewayUrl}?${params.toString()}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
    
    const data = await res.json();
    if (data.alipay_open_message_custom_send_response.code !== '10000') {
      console.error(`[Alipay Send Error]`, data);
    }
  } catch (e) {
    console.error(`[Alipay Fetch Error]`, e);
  }
}