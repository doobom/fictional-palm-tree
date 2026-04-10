// src/routes/categories.js
import { Hono } from 'hono';
import { nanoid } from 'nanoid';

const categories = new Hono();

// 获取分类列表
categories.get('/list', async (c) => {
  const user = c.get('user');
  try {
    const { results } = await c.env.DB.prepare(
      `SELECT * FROM categories WHERE family_id = ? ORDER BY sort_order ASC, created_at DESC`
    ).bind(user.familyId).all();
    return c.json({ success: true, data: results });
  } catch (e) {
    return c.json({ success: false, errorCode: 'ERR_SYSTEM_ERROR' }, 500);
  }
});

// 🌟 新增/编辑商品分类
categories.post('/manage/upsert', async (c) => {
  const user = c.get('user');
  
  // 权限校验
  if (user.role !== 'admin' && user.role !== 'superadmin') {
    return c.json({ success: false, errorCode: 'ERR_FORBIDDEN' }, 403);
  }

  // 🌟 接收前端传来的 emoji 字段
  const { id, name, sort_order, emoji } = await c.req.json();

  if (!name) {
    return c.json({ success: false, errorMessage: '分类名称不能为空' }, 400);
  }

  try {
    const finalEmoji = emoji || '🏷️'; // 兜底默认图标

    if (id) {
      // 🌟 编辑分类：更新 name, sort_order 和 emoji
      await c.env.DB.prepare(`
        UPDATE categories 
        SET name = ?, sort_order = ?, emoji = ?
        WHERE id = ? AND family_id = ?
      `).bind(name, sort_order || 0, finalEmoji, id, user.familyId).run();

      return c.json({ success: true, message: '分类已更新' });
    } else {
      // 🌟 新增分类：插入 emoji
      // 假设你用的是 crypto.randomUUID 或者 nanoid 生成 ID
      const newId = crypto.randomUUID(); 
      
      await c.env.DB.prepare(`
        INSERT INTO categories (id, family_id, name, sort_order, emoji, created_at)
        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `).bind(newId, user.familyId, name, sort_order || 0, finalEmoji).run();

      return c.json({ success: true, data: { id: newId }, message: '分类已创建' });
    }
  } catch (error) {
    console.error(`[Category Error] Upsert failed:`, error);
    return c.json({ success: false, errorCode: 'ERR_SYSTEM_ERROR' }, 500);
  }
});

// 删除分类 (并将相关商品的分类置空)
categories.delete('/manage/:id', async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  if (user.userType !== 'parent' || user.role === 'viewer') return c.json({ success: false, errorCode: 'ERR_FORBIDDEN' }, 403);
  
  try {
    await c.env.DB.batch([
      c.env.DB.prepare(`UPDATE rewards SET category_id = NULL WHERE category_id = ? AND family_id = ?`).bind(id, user.familyId),
      c.env.DB.prepare(`DELETE FROM categories WHERE id = ? AND family_id = ?`).bind(id, user.familyId)
    ]);
    return c.json({ success: true });
  } catch (e) {
    return c.json({ success: false, errorCode: 'ERR_SYSTEM_ERROR' }, 500);
  }
});

export default categories;