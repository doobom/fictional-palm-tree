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

    if (url.pathname === "/events") {
      return this.handleSSE(request);
    }
    if (url.pathname === "/adjust") {
      return this.handleAdjust(request);
    }
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

    const session = { writer, encoder };
    this.sessions.add(session);

    await writer.write(encoder.encode("retry: 10000\n\n"));
    await writer.write(encoder.encode(`data: ${JSON.stringify({ type: 'CONNECTED', timestamp: Date.now() })}\n\n`));

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
    const { childId, points, ruleId, familyId, operatorId, timezone, remark } = data;

    // 1. 每日限额校验逻辑
    if (ruleId) {
      // 从 D1 获取该规则的限制
      const rule = await this.env.DB.prepare(`SELECT daily_limit FROM rules WHERE id = ?`).bind(ruleId).first();
      const limit = rule?.daily_limit || 0;

      if (limit > 0) {
        const tz = timezone || 'Asia/Shanghai';
        const dateStr = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date());
        const limitKey = `limit:${childId}:${ruleId}:${dateStr}`;

        let currentUsage = (await this.state.storage.get(limitKey)) || 0;

        // 🛑 核心拦截：如果达到上限，直接拒绝
        if (currentUsage >= limit) {
          return new Response(JSON.stringify({ 
            success: false, 
            errorCode: 'ERR_DAILY_LIMIT_EXCEEDED',
            errorMessage: '已达每日限额' 
          }), { status: 403 });
        }

        // 更新 DO 内部计数器
        await this.state.storage.put(limitKey, currentUsage + 1);
      }
    }

    // 2. 异步持久化到数据库
    this.state.waitUntil(this.persistAndNotify({ ...data, historyId: crypto.randomUUID() }));

    // 🌟 3. 必须保留：实时广播给全家所有在线成员
    this.broadcast({
      type: "SCORE_UPDATED",
      payload: { childId, points, operatorId, timestamp: Date.now() }
    });

    return new Response(JSON.stringify({ success: true }), { 
      headers: { "Content-Type": "application/json" } 
    });
  }
  /**
   * 处理批量积分变动
   */
  async handleBatchAdjust(request) {
    const data = await request.json();
    // 🌟 将 description 改为 remark 接收
    const { childIds, points, familyId, operatorId, remark } = data;

    for (const childId of childIds) {
      this.state.waitUntil(this.persistAndNotify({
        childId, points, familyId, operatorId, remark,
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
      const stmts = [];

      // 🌟 1. 插入 history 表，使用 remark 字段
      stmts.push(
        this.env.DB.prepare(`
          INSERT INTO history (id, family_id, child_id, rule_id, points, operator_id, remark) 
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).bind(data.historyId, data.familyId, data.childId, data.ruleId || null, data.points, data.operatorId, data.remark || null)
      );

      // 🌟 2. 区分加分和扣分，更新 children 表
      if (data.points > 0) {
        stmts.push(
          this.env.DB.prepare(`
            UPDATE children SET score_gained = score_gained + ? WHERE id = ? AND family_id = ?
          `).bind(data.points, data.childId, data.familyId)
        );
      } else {
        stmts.push(
          this.env.DB.prepare(`
            UPDATE children SET score_spent = score_spent + ? WHERE id = ? AND family_id = ?
          `).bind(Math.abs(data.points), data.childId, data.familyId)
        );
      }

      // 执行 D1 事务更新
      await this.env.DB.batch(stmts);

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
        this.sessions.delete(session);
      }
    }
  }
}