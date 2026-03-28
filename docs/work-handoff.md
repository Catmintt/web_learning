# 工作交接文档

## 文档用途

- 本文档是当前项目的固定交接入口。
- 开始任何开发、重构、联调、排障之前，先阅读本文档，确认现有接口、运行环境和未完成待办。
- 新增接口、修改接口、调整环境变量或关闭待办后，需要同步更新本文档。

## 当前项目状态

### 前端

- 技术栈：`React 19 + Vite`
- 当前登录页已实现：
  - 账号输入
  - 密码输入与点击切换显隐按钮
  - `记住我` 复选框
  - 注册弹窗
  - 注册验证码发送
  - 双密码输入与二次确认
- 当前 `记住我` 语义已固定：
  - 未勾选：默认保持登录状态 7 天
  - 已勾选：长期保持登录，直到主动退出

### 后端

- 技术栈：`FastAPI + SQLAlchemy 2.x + MySQL`
- 数据库容器：`web-learning-mysql`
- 当前账号表：`user_accounts`
- 当前表结构：
  - `id`：自增主键
  - `account`：唯一账号
  - `password`：哈希后的密码
- 注意：
  - 邮箱仅用于验证码验证，当前不入库
  - 登录 Cookie 已能按 `remember_me` 设置时长
  - 主动退出接口还未实现

## 运行环境

### MySQL 容器

- 容器名：`web-learning-mysql`
- 镜像：`mysql:8.4`
- 端口映射：`3307 -> 3306`
- 数据卷：`web_learning_mysql_data`

### 关键环境变量

文件位置：[.env](/home/administrator/web_learning/backend/.env)

- `DATABASE_URL`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USERNAME`
- `SMTP_PASSWORD`
- `SMTP_FROM`
- `VERIFICATION_CODE_TTL_SECONDS`
- `LONG_LIVED_SESSION_DAYS`

说明：

- `SMTP_PASSWORD` 需要填写 QQ 邮箱 SMTP 授权码
- 未填写完整 SMTP 配置前，发送验证码接口会报错

## 已有接口

### 1. 发送注册验证码

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

- 账号已存在：`409`
- 账号格式不合法：`422`
- 邮箱格式不合法：`422`
- SMTP 未配置完整：`500`

### 2. 注册接口

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

- 两次密码不一致：`400`
- 验证码错误或已过期：`400`
- 账号已存在：`409`
- 密码长度不足：`422`
- 账号格式不合法：`422`

注册约束：

- 账号只能包含英文和数字
- 账号前后和中间都不能有空格
- 不允许中文
- 密码长度至少 8 位
- 两次密码必须一致
- 不允许注册数据库中已存在的账号

### 3. 登录接口

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

当前语义：

- `remember_me = false`
  - Cookie 有效期 7 天
- `remember_me = true`
  - Cookie 有效期由 `LONG_LIVED_SESSION_DAYS` 控制，默认 3650 天

失败语义：

- 账号或密码错误：`401`

## 关键代码位置

- 前端登录页：[App.tsx](/home/administrator/web_learning/frontend/src/App.tsx)
- 前端注册弹窗：[RegisterDialog.tsx](/home/administrator/web_learning/frontend/src/components/RegisterDialog.tsx)
- 前端登录服务：[auth.ts](/home/administrator/web_learning/frontend/src/services/auth.ts)
- 前端注册服务：[register.ts](/home/administrator/web_learning/frontend/src/services/register.ts)
- 后端应用入口：[app.py](/home/administrator/web_learning/backend/app.py)
- 数据库配置：[db.py](/home/administrator/web_learning/backend/db.py)
- ORM 模型：[models.py](/home/administrator/web_learning/backend/models.py)
- 请求模型：[schemas.py](/home/administrator/web_learning/backend/schemas.py)

## 未完成待办

### 高优先级

1. 在 [backend/.env](/home/administrator/web_learning/backend/.env) 填写 QQ 邮箱 SMTP 授权信息，打通真实验证码发信。
2. 实现主动退出接口，例如 `POST /api/logout`，并清理登录 Cookie。
3. 增加登录成功后的页面跳转和登录态校验接口，例如 `GET /api/me`。

### 中优先级

1. 为验证码增加重发倒计时和频率限制。
2. 为登录和注册接口增加更细粒度的错误码与审计日志。
3. 决定是否要把验证码存储从进程内字典升级为 Redis。

## 联调命令

### 后端

```bash
cd /home/administrator/web_learning/backend
PYTHONPATH=/home/administrator/web_learning/backend .venv/bin/python -m uvicorn app:app --host 0.0.0.0 --port 8000
```

### 前端

```bash
cd /home/administrator/web_learning/frontend
npm run dev -- --host 0.0.0.0 --port 4173
```

### MySQL

```bash
docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}'
docker exec web-learning-mysql mysqladmin ping -h 127.0.0.1 -uroot -pWebLearningRoot2026!
```
