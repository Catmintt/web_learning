# 接口交接文档

## 使用说明

- 本文档只保留当前项目的重要接口内容。
- 开发前先检查这里的现有接口，确认是否已经具备可复用能力。
- 若新增接口、修改请求体、调整响应语义或变更错误码，需要先更新本文档。

## 1. 发送注册验证码

- 方法：`POST`
- 路径：`/api/register/send-code`
- 代码位置：[app.py](/home/administrator/web_learning/backend/app.py)

请求体：

```json
{
  "account": "alice01",
  "email": "alice@example.com"
}
```

成功响应：

```json
{
  "success": true,
  "message": "验证码已发送，请前往邮箱查收。"
}
```

失败语义：

- `409`：账号已存在
- `422`：账号格式不合法
- `422`：邮箱格式不合法
- `429`：发送频率超限
- `500`：SMTP 未配置完整

当前约束：

- 同一邮箱 10 分钟内最多发送 5 次验证码
- 每次重新发送都会立即覆盖旧验证码
- 最新验证码 5 分钟后自动失效

## 2. 注册接口

- 方法：`POST`
- 路径：`/api/register`
- 代码位置：[app.py](/home/administrator/web_learning/backend/app.py)

请求体：

```json
{
  "account": "alice01",
  "email": "alice@example.com",
  "verification_code": "123456",
  "password": "password123",
  "confirm_password": "password123"
}
```

成功响应：

```json
{
  "success": true,
  "message": "注册成功，当前账号已经可以登录。"
}
```

失败语义：

- `400`：两次密码不一致
- `400`：验证码错误或已过期
- `409`：账号已存在
- `422`：密码为空或纯空格
- `422`：账号格式不合法

注册约束：

- 账号只能包含英文和数字
- 账号前后和中间都不能有空格
- 不允许中文
- 密码至少需要 1 个非空格字符
- 两次密码必须一致
- 不允许注册数据库中已存在的账号
- 注册成功后，当前邮箱验证码会立即失效

## 3. 登录接口

- 方法：`POST`
- 路径：`/api/login`
- 代码位置：[app.py](/home/administrator/web_learning/backend/app.py)

请求体：

```json
{
  "account": "alice01",
  "password": "password123",
  "remember_me": false
}
```

成功响应：

```json
{
  "success": true,
  "message": "登录成功，默认保持登录状态 7 天。",
  "account": "alice01",
  "remember_me": false,
  "session_days": 7
}
```

失败语义：

- `401`：账号或密码错误

当前语义：

- `remember_me = false`
  - Cookie 有效期 7 天
- `remember_me = true`
  - Cookie 有效期由 `LONG_LIVED_SESSION_DAYS` 控制，默认 3650 天
