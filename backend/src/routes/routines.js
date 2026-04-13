// backend/src/routes/routines.js
import { Hono } from 'hono';
import { nanoid } from 'nanoid';

const routines = new Hono();

/**
 * 1. 获取任务列表与今日打卡记录
 */
routines.get('/', async (c) => {
  const user = c.get('user');
  const childId = c.req.query('childId'); 
  const dateStr = c.req.query('dateStr'); 

  try {
    // 🌟 修复：排除状态为 deleted 的软删除任务
    const { results: routinesList } = await c.env.DB.prepare(`
      SELECT * FROM routines WHERE family_id = ? AND status != 'deleted'
    `).bind(user.familyId).all();

    let logs = [];
    if (childId && dateStr) {
      const res = await c.env.DB.prepare(`
        SELECT routine_id, status FROM routine_logs 
        WHERE family_id = ? AND child_id = ? AND date_str = ?
      `).bind(user.familyId, childId, dateStr).all();
      logs = res.results;
    } else if (dateStr) {
      // 🌟 新增：如果家长没传 childId，就拉取全家今天的记录，供代打卡看板使用
      const res = await c.env.DB.prepare(`
        SELECT routine_id, child_id, status FROM routine_logs 
        WHERE family_id = ? AND date_str = ?
      `).bind(user.familyId, dateStr).all();
      logs = res.results;
    }

    return c.json({ success: true, data: { routines: routinesList, logs } });
  } catch (e) {
    return c.json({ success: false, errorMessage: e.message }, 500);
  }
});
/**
 * 2. 家长管理：新增/修改常规任务
 */
routines.post('/manage/upsert', async (c) => {
  const user = c.get('user');
  if (user.role === 'viewer') return c.json({ success: false }, 403);

  const { id, childId, name, emoji, points, frequency, repeatDays, autoApprove } = await c.req.json();
  const routineId = id || nanoid(12);

  try {
    await c.env.DB.prepare(`
      INSERT INTO routines (id, family_id, child_id, name, emoji, points, frequency, repeat_days, auto_approve, status)
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, 'active')
      ON CONFLICT(id) DO UPDATE SET
        child_id = ?3, name = ?4, emoji = ?5, points = ?6, frequency = ?7, repeat_days = ?8, auto_approve = ?9
      WHERE family_id = ?2
    `).bind(
      routineId, user.familyId, childId || null, name, emoji || '✅', points, 
      frequency || 'daily', JSON.stringify(repeatDays || []), autoApprove ? 1 : 0
    ).run();
    return c.json({ success: true });
  } catch (e) {
    return c.json({ success: false, errorMessage: e.message }, 500);
  }
});

/**
 * 3. 孩子打卡 (核心双轨制逻辑)
 */
routines.post('/checkin', async (c) => {
  const user = c.get('user');
  const { routineId, childId, dateStr } = await c.req.json();
  const targetChildId = user.userType === 'child' ? user.id : childId;

  try {
    const routine = await c.env.DB.prepare(`SELECT * FROM routines WHERE id = ? AND family_id = ?`).bind(routineId, user.familyId).first();
    if (!routine) return c.json({ success: false, errorMessage: '任务不存在' }, 400);

    // 双轨制判断
    const logStatus = routine.auto_approve ? 'completed' : 'pending';

    // 1. 写入打卡记录 (利用 UNIQUE 约束防重复)
    try {
      await c.env.DB.prepare(`
        INSERT INTO routine_logs (id, family_id, routine_id, child_id, date_str, status)
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind(nanoid(12), user.familyId, routineId, targetChildId, dateStr, logStatus).run();
    } catch (dbErr) {
      return c.json({ success: false, errorMessage: '今天已经打过卡啦！' }, 400);
    }

    // 2. 根据自动/手动模式分流
    if (routine.auto_approve) {
      // 模式 A：自动发分，调起 DO
      const doId = c.env.FAMILY_MANAGER.idFromName(user.familyId);
      const doObj = c.env.FAMILY_MANAGER.get(doId);
      const host = c.req.header('host') || 'localhost';
      const protocol = host.includes('localhost') ? 'http' : 'https';
      
      await doObj.fetch(new Request(`${protocol}://${host}/api/scores/adjust`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          familyId: user.familyId, childId: targetChildId, 
          points: routine.points, operatorId: targetChildId,
          remark: `完成日常：${routine.name}` 
        })
      }));
    } else {
      // 模式 B：手动审批，推入 approvals 表
      await c.env.DB.prepare(`
        INSERT INTO approvals (id, family_id, child_id, type, rule_id, title, evidence_text, requested_points, status)
        VALUES (?, ?, ?, 'task', ?, ?, ?, ?, 'pending')
      `).bind(nanoid(12), user.familyId, targetChildId, routineId, routine.name, '已打卡，等待家长确认', routine.points).run();
    }

    return c.json({ success: true, data: { status: logStatus } });
  } catch (e) {
    return c.json({ success: false, errorMessage: e.message }, 500);
  }
});

// 🌟 新增：软删除常规任务
routines.delete('/manage/:id', async (c) => {
  const user = c.get('user');
  if (user.role === 'viewer') return c.json({ success: false }, 403);
  const id = c.req.param('id');

  try {
    // 软删除，保留流水历史
    await c.env.DB.prepare(`UPDATE routines SET status = 'deleted' WHERE id = ? AND family_id = ?`).bind(id, user.familyId).run();
    return c.json({ success: true });
  } catch (e) {
    return c.json({ success: false, errorMessage: e.message }, 500);
  }
});

// 🌟 新增：家长代打卡 (直接完成并发分)
routines.post('/admin-checkin', async (c) => {
  const user = c.get('user');
  if (user.role === 'viewer') return c.json({ success: false }, 403);
  
  const { routineId, childId, dateStr } = await c.req.json();

  try {
    const routine = await c.env.DB.prepare(`SELECT * FROM routines WHERE id = ?`).bind(routineId).first();
    if (!routine) return c.json({ success: false }, 400);

    // 1. 写入/更新状态为 completed (利用 D1 的 UPSERT 机制)
    await c.env.DB.prepare(`
      INSERT INTO routine_logs (id, family_id, routine_id, child_id, date_str, status)
      VALUES (?, ?, ?, ?, ?, 'completed')
      ON CONFLICT(routine_id, child_id, date_str) DO UPDATE SET status = 'completed'
    `).bind(nanoid(12), user.familyId, routineId, childId, dateStr).run();

    // 2. 触发 DO 队列加分
    const doId = c.env.FAMILY_MANAGER.idFromName(user.familyId);
    const doObj = c.env.FAMILY_MANAGER.get(doId);
    await doObj.fetch(new Request(`http://do/adjust`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        familyId: user.familyId, childId, points: routine.points, operatorId: user.id,
        remark: `家长代打卡：${routine.name}` 
      })
    }));

    return c.json({ success: true });
  } catch (e) {
    return c.json({ success: false, errorMessage: e.message }, 500);
  }
});

export default routines;