// src/utils/verify.js
/**
 * 身份校验工具逻辑
 * 适配 Cloudflare Workers (Web Crypto API)
 */

/**
 * 1. 校验 Telegram 初始化数据 (Mini App)
 * 逻辑：HMAC-SHA256(WebAppData, token) 作为 key，校验 initData
 */
export async function verifyTelegramData(initData, botToken) {
  if (!initData || !botToken) return null;

  const urlParams = new URLSearchParams(initData);
  const hash = urlParams.get('hash');
  urlParams.delete('hash');

  // 将参数按字典序排序并拼接
  const dataCheckString = Array.from(urlParams.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  const encoder = new TextEncoder();
  
  // 第一步：生成 secret_key = HMAC-SHA256("WebAppData", botToken)
  const baseKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode("WebAppData"),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const secretKeyBuffer = await crypto.subtle.sign("HMAC", baseKey, encoder.encode(botToken));

  // 第二步：使用 secret_key 校验 dataCheckString
  const signatureKey = await crypto.subtle.importKey(
    "raw",
    secretKeyBuffer,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"]
  );

  const isValid = await crypto.subtle.verify(
    "HMAC",
    signatureKey,
    hexToBuffer(hash),
    encoder.encode(dataCheckString)
  );

  if (!isValid) return null;

  // 返回解析后的用户信息
  try {
    return JSON.parse(urlParams.get('user'));
  } catch (e) {
    return { id: urlParams.get('id') }; 
  }
}

/**
 * 2. 校验飞书 (Lark) 签名
 * 逻辑：用于校验飞书卡片回调或事件回调
 */
export async function verifyFeishuSignature(timestamp, nonce, encryptKey, signature, body) {
  const encoder = new TextEncoder();
  // 拼接规则：timestamp + nonce + encryptKey + body
  const content = timestamp + nonce + encryptKey + body;
  
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(content),
    { name: "SHA-256" },
    false,
    ["digest"]
  );
  
  // 飞书通常使用 SHA256 直接摘要或 HMAC，此处以标准事件校验为例
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(content));
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  return hashHex === signature;
}

/**
 * 辅助工具：Hex 字符串转 ArrayBuffer
 */
function hexToBuffer(hex) {
  if (!hex) return new Uint8Array();
  const matches = hex.match(/[\da-f]{2}/gi);
  return new Uint8Array(matches.map(h => parseInt(h, 16))).buffer;
}