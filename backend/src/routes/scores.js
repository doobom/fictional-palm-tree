import { Hono } from 'hono';

const scores = new Hono();

/**
 * 1. 核心接口：变动分数 (加分或扣分)
 * 逻辑：转发给 Durable Object 处理
 */
scores.post('/adjust', async (c) => {
  const user = c.get('user'); // 来自 requireAppUser 中间件
  const body = await c.req.json();

  // 权限校验：仅家长可操作
  if (user.userType !== 'parent' || user.role === 'viewer') {
    return c.json({ 
      success: false, 
      errorCode: 'ERR_FORBIDDEN', 
      errorMessage: 'Insufficient permissions' 
    }, 403);
  }

  // 参数基本校验
  if (!body.childId || typeof body.points !== 'number') {
    return c.json({ success: false, errorCode: 'ERR_MISSING_PARAMS' }, 400);
  }

  // 获取该家庭对应的 Durable Object 实例
  // idFromName 确保同一个 familyId 永远映射到同一个 DO 实例
  const id = c.env.FAMILY_MANAGER.idFromName(user.familyId);
  const doObj = c.env.FAMILY_MANAGER.get(id);

  // 构造转发请求：将业务参数、用户信息和时区一并传给 DO
  const doResponse = await doObj.fetch(new Request(`${new URL(c.req.url).origin}/adjust`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...body,
      familyId: user.familyId,
      operatorId: user.id,
      timezone: user.timezone
    })
  }));

  // 直接透传 DO 的处理结果
  return doResponse;
});

/**
 * 2. 实时连接接口 (SSE)
 * 逻辑：前端通过 EventSource 连接此处，Worker 转发给 DO 保持长连接
 */
scores.get('/realtime', async (c) => {
  const user = c.get('user');
  
  const id = c.env.FAMILY_MANAGER.idFromName(user.familyId);
  const doObj = c.env.FAMILY_MANAGER.get(id);

  // 转发给 DO 的 /events 路径，建立 SSE 流
  return doObj.fetch(new Request(`${new URL(c.req.url).origin}/events`, {
    headers: c.req.header() 
  }));
});

/**
 * 3. 历史记录查询
 * 逻辑：历史记录属于持久化数据，直接查询 D1 即可，无需经过 DO
 */
scores.get('/history', async (c) => {
  const user = c.get('user');
  const childId = c.req.query('childId');
  const limit = Math.min(parseInt(c.req.query('limit')) || 20, 100);

  let query = `
    SELECT h.*, u.nick_name as operator_name, r.name as rule_name
    FROM history h
    LEFT JOIN users u ON h.operator_id = u.id
    LEFT JOIN rules r ON h.rule_id = r.id
    WHERE h.family_id = ?
  `;
  const params = [user.familyId];

  if (childId) {
    query += ` AND h.child_id = ? `;
    params.push(childId);
  }
  
  query += ` ORDER BY h.created_at DESC LIMIT ? `;
  params.push(limit);

  try {
    const { results } = await c.env.DB.prepare(query).bind(...params).all();
    return c.json({ success: true, data: results });
  } catch (e) {
    console.error(`[DB Error] Fetch history failed:`, e);
    return c.json({ success: false, errorCode: 'ERR_SYSTEM_ERROR' }, 500);
  }
});

/**
 * 4. 批量操作接口
 * 逻辑：循环调用 DO 转发，或者在 DO 中实现专门的批量接口
 */
scores.post('/batch', async (c) => {
  const user = c.get('user');
  const { childIds, pointsDelta, remark } = await c.req.json();

  if (user.userType !== 'parent' || user.role === 'viewer') {
    return c.json({ success: false, errorCode: 'ERR_FORBIDDEN' }, 403);
  }

  const id = c.env.FAMILY_MANAGER.idFromName(user.familyId);
  const doObj = c.env.FAMILY_MANAGER.get(id);

  // 为保证原子性，建议将整个批量数组发给 DO
  const doResponse = await doObj.fetch(new Request(`${new URL(c.req.url).origin}/adjust-batch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      childIds,
      points: pointsDelta,
      description: remark,
      familyId: user.familyId,
      operatorId: user.id,
      timezone: user.timezone
    })
  }));

  return doResponse;
});

export default scores;
