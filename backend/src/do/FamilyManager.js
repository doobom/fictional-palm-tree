// backend/src/do/FamilyManager.js

export class FamilyManager {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    // 用于存储当前家庭所有成员的 SSE 连接会话
    this.sessions = new Set();
  }

  /**
   * 核心处理入口
   */
  async fetch(request) {
    const url = new URL(request.url);

    // 路由 1: 建立 SSE 连接 (Real-time Events)
    if (url.pathname === "/events") {
      return this.handleSSE(request);
    }

    // 路由 2: 处理原子积分调整 (Score Adjustment)
    if (url.pathname === "/adjust") {
      return this.handleAdjust(request);
    }

    // 路由 3: 批量积分调整 (Batch Adjustment)
    if (url.pathname === "/adjust-batch") {
      return this.handleBatchAdjust(request);
    }

    return new Response("Not Found", { status: 404 });
  }

  /**
   * 处理 SSE 长连接
   */
  async handleSSE(request) {
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();

    // 创建会话对象
    const session = { writer, encoder };
    this.sessions.add(session);

    // 发送初始连接成功信号和心跳配置
    await writer.write(encoder.encode("retry: 10000\n\n"));
    await writer.write(encoder.encode(`data: ${JSON.stringify({ type: 'CONNECTED', timestamp: Date.now() })}\n\n`));

    // 监听连接断开，清理会话
    request.signal.addEventListener("abort", () => {
      this.sessions.delete(session);
      writer.close();
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }

  /**
   * 处理单笔积分变动 (带每日限额检查)
   */
  async handleAdjust(request) {
    const data = await request.json();
    const { childId, points, ruleId, familyId, operatorId, timezone } = data;

    // 1. 基于用户时区计算“今天”的日期 Key，用于限额校验
    const localTime = new Date().toLocaleString("en-US", { timeZone: timezone });
    const todayStr = new Date(localTime).toISOString().split('T')[0];
    const limitKey = `limit:${childId}:${ruleId || 'manual'}:${todayStr}`;

    // 2. 从 DO 存储读取当前限额计数 (比 D1 快得多且保证原子性)
    let currentUsage = (await this.state.storage.get(limitKey)) || 0;

    // 3. 更新 DO 内部状态
    await this.state.storage.put(limitKey, currentUsage + 1);

    // 4. 异步持久化到 D1 并触发成就检查 (非阻塞响应)
    this.state.waitUntil(this.persistAndNotify({
      ...data,
      historyId: crypto.randomUUID()
    }));

    // 5. 实时广播给所有在线成员
    this.broadcast({
      type: "SCORE_UPDATED",
      payload: { childId, points, operatorId, timestamp: Date.now() }
    });

    return new Response(JSON.stringify({ 
      success: true, 
      newUsage: currentUsage + 1 
    }), { headers: { "Content-Type": "application/json" } });
  }

  /**
   * 处理批量积分变动
   */
  async handleBatchAdjust(request) {
    const data = await request.json();
    const { childIds, points, familyId, operatorId, description } = data;

    // 批量逻辑：循环处理并广播
    for (const childId of childIds) {
      this.state.waitUntil(this.persistAndNotify({
        childId, points, familyId, operatorId, description,
        historyId: crypto.randomUUID()
      }));
    }

    this.broadcast({
      type: "BATCH_SCORE_UPDATED",
      payload: { childIds, points, operatorId, timestamp: Date.now() }
    });

    return new Response(JSON.stringify({ success: true }), { 
      headers: { "Content-Type": "application/json" } 
    });
  }

  /**
   * 持久化到 D1 并发送 Queue 消息
   */
  async persistAndNotify(data) {
    try {
      // 执行 D1 事务更新
      await this.env.DB.batch([
        this.env.DB.prepare(`
          UPDATE children SET score_gained = score_gained + ? 
          WHERE id = ? AND family_id = ?
        `).bind(data.points, data.childId, data.familyId),
        this.env.DB.prepare(`
          INSERT INTO history (id, family_id, child_id, rule_id, points, operator_id, description) 
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).bind(data.historyId, data.familyId, data.childId, data.ruleId || null, data.points, data.operatorId, data.description || '')
      ]);

      // 发送到 Queue 进行成就和目标扫描
      if (this.env.SCORE_QUEUE) {
        await this.env.SCORE_QUEUE.send({
          action: 'CHECK_ACHIEVEMENTS',
          ...data
        });
      }
    } catch (e) {
      console.error(`[DO Persist Error] Family: ${data.familyId}`, e);
    }
  }

  /**
   * SSE 广播函数
   */
  broadcast(message) {
    const encoder = new TextEncoder();
    const data = encoder.encode(`data: ${JSON.stringify(message)}\n\n`);
    
    for (const session of this.sessions) {
      try {
        session.writer.write(data);
      } catch (e) {
        // 如果写入失败，说明连接已断开，移除会话
        this.sessions.delete(session);
      }
    }
  }
}