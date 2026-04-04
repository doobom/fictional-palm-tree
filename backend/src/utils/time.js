// src/utils/time.js

/**
 * 将 IANA 时区 (如 'Asia/Shanghai') 转换为 SQLite 可用的偏移量 (如 '+08:00')
 * 用于解决 Cloudflare D1 默认使用 UTC 导致按天统计、每日限额重置时间错乱的问题。
 */
export function getSqliteTimezoneModifier(ianaTimezone = 'Asia/Shanghai') {
  try {
    const date = new Date();
    const utcDate = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
    const tzDate = new Date(date.toLocaleString('en-US', { timeZone: ianaTimezone }));
    const diffMinutes = (tzDate - utcDate) / 60000;
    
    const sign = diffMinutes >= 0 ? '+' : '-';
    const hours = String(Math.floor(Math.abs(diffMinutes) / 60)).padStart(2, '0');
    const minutes = String(Math.abs(diffMinutes) % 60).padStart(2, '0');
    return `${sign}${hours}:${minutes}`;
  } catch (e) {
    console.warn(`[System Warn] 时区转换失败，降级为 UTC. Timezone: ${ianaTimezone}`);
    return '+00:00';
  }
}