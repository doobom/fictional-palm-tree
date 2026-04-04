// src/utils/verify.js
import { INIT_DATA_MAX_AGE } from '../constants.js';

export async function verifyTelegramData(initData, botToken) {
  if (!initData) return null;
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get("hash");
    if (!hash) return null;
    params.delete("hash");

    const dataCheckString = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join("\n");

    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      "raw", encoder.encode("WebAppData"),
      { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
    );
    const secretKey = await crypto.subtle.sign("HMAC", keyMaterial, encoder.encode(botToken));
    const verifyKey = await crypto.subtle.importKey(
      "raw", secretKey,
      { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
    );
    const signature = await crypto.subtle.sign("HMAC", verifyKey, encoder.encode(dataCheckString));
    const computedHash = Array.from(new Uint8Array(signature))
      .map(b => b.toString(16).padStart(2, "0")).join("");

    if (computedHash !== hash) return null;

    // 🌟 优化：使用绝对值，防止时钟超前/回拨导致的校验失效
    const authDate = parseInt(params.get("auth_date") || "0");
    const nowTs = Math.floor(Date.now() / 1000);
    if (Math.abs(nowTs - authDate) > INIT_DATA_MAX_AGE) {
      console.warn(`[Verify Warn] Telegram initData 已过期. authDate: ${authDate}, now: ${nowTs}`);
      return null;
    }

    const userStr = params.get("user");
    return userStr ? JSON.parse(userStr) : null;
  } catch (e) {
    console.error("[System Error] Telegram verify error:", e);
    return null;
  }
}

// 预留给飞书的校验逻辑
export async function verifyFeishuData(token, appSecret) {
  // 飞书的 JWT 解码或 API 校验逻辑...
  return null; 
}