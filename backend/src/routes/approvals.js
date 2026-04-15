// backend/src/routes/approvals.js
import { Hono } from 'hono';
import { nanoid } from 'nanoid';
// import { sendTgMessage } from '../utils/telegram.js'; // 确保你的通知模块正确引入

const approvals = new Hono();

/**
 * 1. 上传凭证图片到 R2
 */
approvals.post('/upload', async (c) => {
  const user = c.get('user');
  if (!c.env.BUCKET) return c.json({ success: false, errorMessage: 'R2 存储未配置' }, 500);
  
  try {
    const body = await c.req.parseBody();
    const file = body['file'];
    if (!file) return c.json({ success: false, errorMessage: '未找到文件' }, 400);

    const ext = file.name.split('.').pop() || 'jpg';
    const fileName = `evidence/${user.familyId}/${Date.now()}_${nanoid(6)}.${ext}`;
    
    await c.env.BUCKET.put(fileName, await file.arrayBuffer(), {
      httpMetadata: { contentType: file.type }
    });

    const publicUrl = `${c.env.R2_PUBLIC_URL}/${fileName}`;
    return c.json({ success: true, data: { url: publicUrl } });
  } catch (e) {
    return c.json({ success: false, errorMessage: e.message }, 500);
  }
});

/**
 * 2. 孩子提交申请 (兼容任务和商品)
 */
approvals.post('/', async (c) => {
  const user = c.get('user');
  const { childId, type = 'task', ruleId, rewardId, title, evidenceText, evidenceImage, requestedPoints } = await c.req.json();
  const targetChildId = user.userType === 'child' ? user.id : childId;
  const botToken = c.env.BOT_TOKEN; // 🌟 使用业务机器人 Token

  try {
    const id = nanoid(12);
    await c.env.DB.prepare(`
      INSERT INTO approvals (id, family_id, child_id, type, rule_id, reward_id, title, evidence_text, evidence_image, requested_points, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
    `).bind(id, user.familyId, targetChildId, type, ruleId || null, rewardId || null, title, evidenceText || '', evidenceImage || null, Math.abs(requestedPoints)).run();

    // 🌟 发送 Telegram 审批通知逻辑
    if (botToken) {
      try {
        const family = await c.env.DB.prepare(`SELECT tg_group_id FROM families WHERE id = ?`).bind(user.familyId).first();
        const admins = await c.env.DB.prepare(`
          SELECT u.telegram_id FROM users u
          JOIN family_members fm ON u.id = fm.user_id
          WHERE fm.family_id = ? AND fm.role IN ('admin', 'superadmin') AND u.telegram_id IS NOT NULL
        `).bind(user.familyId).all();

        const child = await c.env.DB.prepare('SELECT name FROM children WHERE id = ?').bind(targetChildId).first();
        const childName = child?.name || '孩子';

        const pointsSign = type === 'reward' ? '-' : '+';
        const actionType = type === 'reward' ? '申请兑换商品' : '提交了任务凭证';
        let msgText = `🔔 <b>新的审批请求</b>\n\n👤 <b>成员：</b>${childName}\n📝 <b>动作：</b>${actionType}\n📌 <b>内容：</b>${title}\n💰 <b>分值：</b>${pointsSign}${Math.abs(requestedPoints)}\n`;
        if (evidenceText) msgText += `💬 <b>留言：</b>${evidenceText}`;

        const keyboard = [[{ text: '✅ 同意', callback_data: `a:${id}` }, { text: '❌ 驳回', callback_data: `r:${id}` }]];

        if (family?.tg_group_id) {
          await sendTgMessageWithKeyboard(family.tg_group_id, msgText, keyboard, botToken);
        } else {
          await Promise.all(admins.results.map(adm => 
            sendTgMessageWithKeyboard(adm.telegram_id, msgText, keyboard, botToken)
          ));
        }
      } catch (tgErr) {
        console.error('[TG Notification Error]', tgErr);
      }
    }

    return c.json({ success: true });
  } catch (e) {
    return c.json({ success: false, errorMessage: e.message }, 500);
  }
});

/**
 * 3. 获取待办/已办列表
 */
approvals.get('/', async (c) => {
  const user = c.get('user');
  const childId = c.req.query('childId') || (user.userType === 'child' ? user.id : null);
  const status = c.req.query('status') || 'pending';
  
  let query = `SELECT * FROM approvals WHERE family_id = ? AND status = ?`;
  let params = [user.familyId, status];

  if (childId) { query += ` AND child_id = ?`; params.push(childId); }
  query += ` ORDER BY created_at DESC`;

  try {
    const { results } = await c.env.DB.prepare(query).bind(...params).all();
    return c.json({ success: true, data: results });
  } catch (e) {
    return c.json({ success: false, errorMessage: e.message }, 500);
  }
});

/**
 * 4. 家长审核 (核心：处理正负分流转)
 */
approvals.put('/:id/review', async (c) => {
  const user = c.get('user');
  if (user.role === 'viewer') return c.json({ success: false }, 403);

  const approvalId = c.req.param('id');
  const { action, finalPoints, rejectReason } = await c.req.json();

  try {
    const approval = await c.env.DB.prepare(`SELECT * FROM approvals WHERE id = ? AND family_id = ?`).bind(approvalId, user.familyId).first();
    if (!approval || approval.status !== 'pending') return c.json({ success: false, errorMessage: '任务不存在或已处理' }, 400);

    if (action === 'approve') {
      let pointsToAward = finalPoints ?? approval.requested_points;
      
      // 🌟 核心逻辑：如果是任务则加分，如果是商品兑换则扣分
      if (approval.type === 'reward') {
        pointsToAward = -Math.abs(pointsToAward); 
        if (approval.reward_id) {
          await c.env.DB.prepare(`UPDATE rewards SET stock = stock - 1 WHERE id = ? AND stock > 0`).bind(approval.reward_id).run();
        }
      } else {
        pointsToAward = Math.abs(pointsToAward);
        // 🌟 新增逻辑：如果是日常任务的打卡申请，联动修改打卡状态为已完成
        if (approval.rule_id) {
          await c.env.DB.prepare(`
            UPDATE routine_logs SET status = 'completed' 
            WHERE routine_id = ? AND child_id = ? AND status = 'pending'
          `).bind(approval.rule_id, approval.child_id).run();
        }
      }
      
      // 触发 DO
      const doId = c.env.FAMILY_MANAGER.idFromName(user.familyId);
      const doObj = c.env.FAMILY_MANAGER.get(doId);
      
      const doRes = await doObj.fetch(new Request(`http://do/adjust`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          familyId: user.familyId, 
          childId: approval.child_id, 
          ruleId: approval.rule_id,
          points: pointsToAward,
          operatorId: user.id,
          remark: approval.type === 'reward' ? `兑换商品：${approval.title}` : `任务审批：${approval.title}` 
        })
      }));

      if (!doRes.ok) {
        const errText = await doRes.text();
        console.error('[DO Error]', errText);
        throw new Error('[DO] 发分事务执行失败 - 调整积分失败');
      }

      await c.env.DB.prepare(`UPDATE approvals SET status = 'approved', requested_points = ?, reviewer_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(Math.abs(pointsToAward), user.id, approvalId).run();

    } else if (action === 'reject') {
      await c.env.DB.prepare(`UPDATE approvals SET status = 'rejected', reject_reason = ?, reviewer_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(rejectReason || '', user.id, approvalId).run();
    }

    return c.json({ success: true });
  } catch (e) {
    return c.json({ success: false, errorMessage: e.message }, 500);
  }
});

export default approvals;