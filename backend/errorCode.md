这是一份为你精心整理的 **最终版 `errorCode` 字典**。

为了方便前端（Vue/React）进行统一的错误拦截和多语言（i18n）翻译，我将这些错误码按照**业务场景**进行了分类，并附带了对应的 HTTP 状态码、触发场景以及建议的前端处理方式。

### 🔑 1. 身份与权限 (Authentication & Authorization)

| 错误码 (errorCode) | HTTP 状态码 | 触发场景说明 | 附加参数 (errorParams) | 前端建议处理方式 |
| :--- | :--- | :--- | :--- | :--- |
| **`ERR_UNAUTHORIZED`** | 401 | Telegram/飞书 Token 缺失、无效或已过期。 | 无 | 引导用户重新打开小程序或重新登录。 |
| **`ERR_USER_NOT_FOUND`** | 404 | 平台 Token 校验通过，但数据库中未找到绑定的家庭记录。 | 无 (附带 `needRegister: true`) | 跳转到【创建/加入家庭】引导页。 |
| **`ERR_FORBIDDEN`** | 403 | 越权操作。如：孩子尝试加分/审批，或 viewer(只读) 尝试修改数据。 | 无 | 弹出 Toast 提示：“权限不足”。 |

---

### 📝 2. 参数与资源校验 (Validation & Resources)

| 错误码 (errorCode) | HTTP 状态码 | 触发场景说明 | 附加参数 (errorParams) | 前端建议处理方式 |
| :--- | :--- | :--- | :--- | :--- |
| **`ERR_MISSING_PARAMS`** | 400 | 接口必传参数缺失（如：建家庭没传名称，加分没传 childId）。 | 无 | Toast 提示：“请填写完整信息”。 |
| **`ERR_INVALID_CODE`** | 400 | 加入家庭或孩子绑定设备时，邀请码/绑定码不存在或已过期。 | 无 | Toast 提示：“邀请码无效或已过期”。 |
| **`ERR_NOT_FOUND`** | 404 | 请求的资源不存在。如：审批的记录已被撤销，要兑换的奖品已被删除。 | 无 | Toast 提示：“该记录不存在或已被处理”，并刷新当前列表。 |

---

### 💼 3. 核心业务逻辑 (Business Logic)

| 错误码 (errorCode) | HTTP 状态码 | 触发场景说明 | 附加参数 (errorParams) | 前端建议处理方式 |
| :--- | :--- | :--- | :--- | :--- |
| **`ERR_ALREADY_BOUND`** | 400 | 创建家庭、加入家庭或绑定孩子时，当前社交账号已绑定过其他角色。 | 无 | Toast 提示：“该账号已绑定，请勿重复操作”。 |
| **`ERR_INSUFFICIENT_POINTS`** | 400 | 孩子发起兑换时，当前可用余额小于商品所需积分。 | `{ balance: 100, cost: 500 }` | 弹窗提示：“积分不足（剩余 100，需要 500）”。 |
| **`ERR_OUT_OF_STOCK`** | 400 | 发起兑换或自动审批时，商品库存为 0 或瞬间被抢空。 | 无 | Toast 提示：“手慢了，商品刚刚被兑换完啦！”并刷新列表。 |
| **`ERR_DAILY_LIMIT_REACHED`**| 400 | 家长加/减分时，该规则今日触发次数已达上限。 | `{ limit: 3 }` | Toast 提示：“已达该规则每日限额（3次）”。 |

---

### ⚙️ 4. 系统级异常 (System Errors)

| 错误码 (errorCode) | HTTP 状态码 | 触发场景说明 | 附加参数 (errorParams) | 前端建议处理方式 |
| :--- | :--- | :--- | :--- | :--- |
| **`ERR_SYSTEM_ERROR`** | 500 | 数据库 D1 读写失败、事务回滚、或其他未捕获的代码级异常。 | 无 | Toast 提示：“系统繁忙，请稍后重试”，不阻塞用户后续操作。 |

### 5. 速率限制 (Rate Limiting)

| 错误码 (errorCode) | HTTP 状态码 | 触发场景说明 | 附加参数 (errorParams) | 前端建议处理方式 |
| :--- | :--- | :--- | :--- | :--- |
| **`ERR_TOO_FREQUENT_REDEEM`** | 429 | 孩子发起兑换过于频繁，超过每分钟 3 次的限制。 | 无 | Toast 提示：“操作过于频繁，请稍后再试”。 |
| **`ERR_TOO_MANY_EMAILS`** | 429 | 发送邮箱验证码过于频繁，超过每分钟 1 次的限制。 | 无 | Toast 提示：“请求过于频繁，请稍后再试”。 |

---

### 💡 给前端对接的建议规范：

前端在封装 `axios` 或 `fetch` 的响应拦截器（Response Interceptor）时，可以采用以下黄金逻辑：

```javascript
// 前端拦截器伪代码示例
import i18n from '@/locales'; // 你的前端多语言库

api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const data = error.response?.data;
    
    if (data && data.errorCode) {
      // 1. 特殊业务逻辑：引导注册
      if (data.errorCode === 'ERR_USER_NOT_FOUND' && data.needRegister) {
        router.push('/register');
        return Promise.reject(error);
      }

      // 2. 通用业务报错：根据 errorCode 去本地多语言字典里找翻译
      // 并支持插入 errorParams 变量（如余额、所需积分）
      const translatedMessage = i18n.t(`api_errors.${data.errorCode}`, data.errorParams);
      Toast.show(translatedMessage);
      
    } else {
      // 3. 兜底网络或网关报错
      Toast.show('网络请求失败，请检查网络连接');
    }
    
    return Promise.reject(error);
  }
);
```

有了这份表格和拦截规范，前端开发在做错误提示和多语言适配时，就不需要再去猜后端的中文提示词了，直接根据 `errorCode` 做映射，代码会变得极其优雅和健壮！