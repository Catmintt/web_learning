#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FRONTEND_DIR="${ROOT_DIR}/frontend"
PID_FILE="${FRONTEND_DIR}/.vite-dev.pid"
START_SCRIPT="${ROOT_DIR}/start-frontend.sh"
STOP_SCRIPT="${ROOT_DIR}/stop-frontend.sh"

cleanup() {
  "${STOP_SCRIPT}" >/dev/null 2>&1 || true
}

trap cleanup EXIT

# 先确保环境干净，再验证启动脚本是否能写入 PID 并成功拉起服务。
"${STOP_SCRIPT}" >/dev/null 2>&1 || true
"${START_SCRIPT}"

if [[ ! -f "${PID_FILE}" ]]; then
  echo "未生成 PID 文件" >&2
  exit 1
fi

SERVER_PID="$(<"${PID_FILE}")"
if [[ -z "${SERVER_PID}" ]] || ! kill -0 "${SERVER_PID}" 2>/dev/null; then
  echo "启动后未检测到有效进程" >&2
  exit 1
fi

for _ in {1..20}; do
  if curl -fsS "http://127.0.0.1:4173/" >/dev/null 2>&1; then
    break
  fi
  sleep 0.5
done

curl -fsS "http://127.0.0.1:4173/" >/dev/null

# 再验证停止脚本是否会清理 PID 文件并关闭进程。
"${STOP_SCRIPT}"

if [[ -f "${PID_FILE}" ]]; then
  echo "停止后 PID 文件仍存在" >&2
  exit 1
fi

if kill -0 "${SERVER_PID}" 2>/dev/null; then
  echo "停止后进程仍在运行" >&2
  exit 1
fi

echo "frontend 启动/关闭脚本检查通过"
