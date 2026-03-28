#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="${ROOT_DIR}/frontend"
PID_FILE="${FRONTEND_DIR}/.vite-dev.pid"

if [[ ! -f "${PID_FILE}" ]]; then
  echo "未找到 frontend dev server 的 PID 文件"
  exit 0
fi

SERVER_PID="$(<"${PID_FILE}")"

# 清理失效 PID 文件，避免后续误判为仍在运行。
if [[ -z "${SERVER_PID}" ]] || ! kill -0 "${SERVER_PID}" 2>/dev/null; then
  rm -f "${PID_FILE}"
  echo "frontend dev server 已停止，旧 PID 文件已清理"
  exit 0
fi

# 优先结束整个进程组，兼容 npm 包裹 node 子进程的情况。
kill -TERM "-${SERVER_PID}" 2>/dev/null || kill -TERM "${SERVER_PID}" 2>/dev/null || true

for _ in {1..20}; do
  if ! kill -0 "${SERVER_PID}" 2>/dev/null; then
    rm -f "${PID_FILE}"
    echo "frontend dev server 已关闭"
    exit 0
  fi
  sleep 0.5
done

kill -KILL "-${SERVER_PID}" 2>/dev/null || kill -KILL "${SERVER_PID}" 2>/dev/null || true
sleep 1

if kill -0 "${SERVER_PID}" 2>/dev/null; then
  echo "frontend dev server 关闭失败，请手动检查 PID=${SERVER_PID}" >&2
  exit 1
fi

rm -f "${PID_FILE}"
echo "frontend dev server 已强制关闭"
