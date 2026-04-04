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

// 新增或更新分类
categories.post('/manage/upsert', async (c) => {
  const user = c.get('user');
  const data = await c.req.json();
  if (user.userType !== 'parent' || user.role === 'viewer') return c.json({ success: false, errorCode: 'ERR_FORBIDDEN' }, 403);

  const id = data.id || nanoid(8);
  try {
    await c.env.DB.prepare(`
      INSERT INTO categories (id, family_id, name, sort_order)
      VALUES (?1, ?2, ?3, ?4)
      ON CONFLICT(id) DO UPDATE SET name = ?3, sort_order = ?4
      WHERE family_id = ?2
    `).bind(id, user.familyId, data.name, data.sort_order || 0).run();
    return c.json({ success: true, id });
  } catch (e) {
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