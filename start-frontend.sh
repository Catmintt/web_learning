#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="${ROOT_DIR}/frontend"
PID_FILE="${FRONTEND_DIR}/.vite-dev.pid"
LOG_FILE="${FRONTEND_DIR}/.vite-dev.log"
PORT="4173"

# 检查已有开发服务器是否仍在运行，避免重复启动。
if [[ -f "${PID_FILE}" ]]; then
  EXISTING_PID="$(<"${PID_FILE}")"
  if [[ -n "${EXISTING_PID}" ]] && kill -0 "${EXISTING_PID}" 2>/dev/null; then
    echo "frontend dev server 已在运行，PID=${EXISTING_PID}"
    echo "访问地址: http://localhost:${PORT}/"
    exit 0
  fi

  rm -f "${PID_FILE}"
fi

cd "${FRONTEND_DIR}"
: > "${LOG_FILE}"

# 使用独立会话后台启动，便于后续按 PID 或进程组关闭。
setsid bash -lc "exec npm run dev -- --host 0.0.0.0 --port ${PORT}" >>"${LOG_FILE}" 2>&1 &
SERVER_PID=$!
echo "${SERVER_PID}" > "${PID_FILE}"

sleep 2

# 校验启动结果，失败时输出日志尾部帮助排查。
if ! kill -0 "${SERVER_PID}" 2>/dev/null; then
  echo "frontend dev server 启动失败" >&2
  tail -n 30 "${LOG_FILE}" >&2 || true
  rm -f "${PID_FILE}"
  exit 1
fi

echo "frontend dev server 已启动，PID=${SERVER_PID}"
echo "访问地址: http://localhost:${PORT}/"
echo "日志文件: ${LOG_FILE}"
