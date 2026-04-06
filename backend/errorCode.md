基于目前的后端架构重构（包括多家庭 M:N 模型、Durable Objects 积分一致性、多平台绑定等），我重新梳理并完善了系统的错误码列表。

这些错误码已根据逻辑模块进行分类，建议同步更新到 `backend/errorCode.md` 文件中。

### 1. 鉴权与访问控制 (Auth & Access)
| 错误码 | 含义 | 触发场景 |
| :--- | :--- | :--- |
| `ERR_NO_CREDENTIALS` | 缺失身份凭证 | 未携带 Token、TG 数据或设备 ID。 |
| `ERR_UNAUTHORIZED` | 身份校验失败 | 第三方平台签名验证（TG/Lark）未通过。 |
| `ERR_TOKEN_EXPIRED` | 登录已过期 | JWT Token 过期或被篡改。 |
| `ERR_USER_NOT_FOUND` | 用户未注册 | 已通过平台校验但尚未在系统中创建用户，需引导至注册流。 |
| `ERR_FORBIDDEN` | 权限不足 | `viewer` 尝试加分，或普通 `admin` 尝试解散家庭。 |
| `ERR_NOT_IN_FAMILY` | 非家庭成员 | 用户尝试访问未加入的 `family_id`。 |
| `ERR_FAMILY_CONTEXT_MISSING` | 缺失家庭上下文 | 请求头中未携带必填的 `x-family-id`。 |

### 2. 积分与 Durable Object 相关 (Score & DO)
| 错误码 | 含义 | 触发场景 |
| :--- | :--- | :--- |
| `ERR_DAILY_LIMIT_REACHED` | 触及每日限额 | 命中了规则中定义的每日触发次数上限。 |
| `ERR_INSUFFICIENT_POINTS` | 积分不足 | 孩子尝试兑换超出当前余额的商品。 |
| `ERR_DO_OFFLINE` | 边缘实例异常 | Durable Object 实例无法启动或超时（罕见）。 |
| `ERR_REVERT_FAILED` | 撤销失败 | 尝试撤销一条已经撤销过或不存在的历史记录。 |

### 3. 邀请与绑定相关 (Invite & Binding)
| 错误码 | 含义 | 触发场景 |
| :--- | :--- | :--- |
| `ERR_INVALID_INVITE` | 邀请码无效 | 邀请码不存在、已过期或已被手动删除。 |
| `ERR_ALREADY_BOUND` | 平台已被占用 | 尝试绑定的 TG/微信账号已被其他系统用户关联。 |
| `ERR_LAST_BINDING` | 无法解绑最后手段 | 账户必须保留至少一个登录方式。 |
| `ERR_SOLE_SUPERADMIN` | 唯一管理员限制 | 最后一个超级管理员在退出家庭前必须转让权限或解散家庭。 |

### 4. 业务逻辑与资源 (Business & Resources)
| 错误码 | 含义 | 触发场景 |
| :--- | :--- | :--- |
| `ERR_MISSING_PARAMS` | 参数缺失 | API 请求缺少必要的 Body 字段（如 `childId`, `points`）。 |
| `ERR_NOT_FOUND` | 资源不存在 | 访问不存在的孩子、商品、规则或分类。 |
| `ERR_STOCK_OUT` | 商品缺货 | 兑换商品的库存不足（且非无限量）。 |
| `ERR_ALREADY_PROCESSED` | 重复处理 | 审批申请已被其他管理员处理。 |

### 5. 系统级错误 (System)
| 错误码 | 含义 | 触发场景 |
| :--- | :--- | :--- |
| `ERR_DB_ERROR` | 数据库操作失败 | D1 写入超时或约束冲突。 |
| `ERR_QUEUE_FAILED` | 异步队列异常 | 消息发送至 Queue 失败。 |
| `ERR_SYSTEM_ERROR` | 未知系统故障 | 全局 Catch 到的未捕获异常。 |

---

### 检查建议
在前端重构 `api/request.ts` 时，请务必针对 `ERR_USER_NOT_FOUND` (404) 和 `ERR_FAMILY_CONTEXT_MISSING` (400) 编写全局拦截逻辑：
1.  **`ERR_USER_NOT_FOUND`**: 跳转到 `Onboarding` 页面进行注册。
2.  **`ERR_FAMILY_CONTEXT_MISSING`**: 弹出家庭切换器或引导进入家庭创建流程。

**后端所有核心文件与配置已完成最终检查。我们可以开始前端改造了吗？**