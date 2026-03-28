# 2026-03-28 前端启动脚本设计

- 目标：在项目根目录提供两个简单脚本，用于启动和关闭 frontend 的 Vite 开发服务器。
- 方案：start 脚本后台启动 npm run dev -- --host 0.0.0.0 --port 4173，记录 PID 到 frontend/.vite-dev.pid，日志写入 frontend/.vite-dev.log；stop 脚本读取 PID，校验进程是否存在并优雅停止，最后清理 PID 文件。
- 约束：不引入额外依赖，不改 package.json，脚本使用 bash 严格模式。
