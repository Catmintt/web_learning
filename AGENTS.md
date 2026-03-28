# Agent Protocol

## 工作交接要求

- 开始任何开发、重构、联调、排障之前，先阅读 [docs/work-handoff.md](/home/administrator/web_learning/docs/work-handoff.md)，检查现有接口与未完成待办。
- 若新增接口、修改接口或关闭待办，需要先更新 [docs/work-handoff.md](/home/administrator/web_learning/docs/work-handoff.md)，再继续后续工作。

## 项目速览

### 前端

- 技术栈：`React 19 + Vite`
- 当前页面范围：
  - 登录
  - 注册弹窗
  - 密码显隐切换
  - 邮箱验证码发送
  - 字段级错误提示
  - `记住我`
- 当前登录语义：
  - 未勾选 `记住我`：登录态默认保留 7 天
  - 勾选 `记住我`：长期保留登录态，直到主动退出

### 后端

- 技术栈：`FastAPI + SQLAlchemy 2.x + MySQL + Redis`
- 当前账号表：`user_accounts`
- 当前核心字段：
  - `id`
  - `account`
  - `password`
- 当前边界：
  - 邮箱仅用于验证码校验，不入库
  - 验证码存 Redis
  - 登录 Cookie 已支持按 `remember_me` 设置时长

## 运行约定

- 启动脚本：[start-server.sh](/home/administrator/web_learning/start-server.sh)
  - 会自动接管 `4173/8000` 的旧端口占用，再启动新服务
- 停止脚本：[stop-server.sh](/home/administrator/web_learning/stop-server.sh)
  - 会清理 PID 文件对应进程，并兜底释放前后端端口
- 数据容器：
  - MySQL：`web-learning-mysql`，宿主机端口 `3307`
  - Redis：`web-learning-redis`，宿主机端口 `6380`

## 接口交接入口

- 重要接口与请求/响应细节统一维护在 [docs/work-handoff.md](/home/administrator/web_learning/docs/work-handoff.md)
- 开发前先检查现有接口是否已满足需求，避免重复设计或改坏现有语义

## 当前待办

### 高优先级

1. 实现主动退出接口，例如 `POST /api/logout`，并清理登录 Cookie。
2. 增加登录成功后的页面跳转和登录态校验接口，例如 `GET /api/me`。
3. 决定是否要为邮箱验证码剩余次数增加更明确的可视化提示。

### 中优先级

1. 为登录和注册接口增加更细粒度的错误码与审计日志。
2. 为 Redis/MySQL 容器补充 `docker compose` 管理方式，减少手动初始化成本。
3. 增加 Redis 可观测性，例如慢查询和命中率的基本监控。
