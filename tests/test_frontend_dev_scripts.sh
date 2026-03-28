#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
START_SCRIPT="${ROOT_DIR}/start-server.sh"
STOP_SCRIPT="${ROOT_DIR}/stop-server.sh"
TEST_RUNTIME_DIR="$(mktemp -d)"
FRONTEND_PID_FILE="${TEST_RUNTIME_DIR}/frontend.pid"
BACKEND_PID_FILE="${TEST_RUNTIME_DIR}/backend.pid"
FRONTEND_LOG_FILE="${TEST_RUNTIME_DIR}/frontend.log"
BACKEND_LOG_FILE="${TEST_RUNTIME_DIR}/backend.log"
FRONTEND_PORT="14174"
BACKEND_PORT="18001"

cleanup() {
  FRONTEND_PORT="${FRONTEND_PORT}" \
  BACKEND_PORT="${BACKEND_PORT}" \
  FRONTEND_PID_FILE="${FRONTEND_PID_FILE}" \
  BACKEND_PID_FILE="${BACKEND_PID_FILE}" \
  FRONTEND_LOG_FILE="${FRONTEND_LOG_FILE}" \
  BACKEND_LOG_FILE="${BACKEND_LOG_FILE}" \
  "${STOP_SCRIPT}" >/dev/null 2>&1 || true
  rm -rf "${TEST_RUNTIME_DIR}"
}

trap cleanup EXIT

# 先确保环境干净，再验证启动脚本是否能写入 PID 并成功拉起前后端服务。
FRONTEND_PORT="${FRONTEND_PORT}" \
BACKEND_PORT="${BACKEND_PORT}" \
FRONTEND_PID_FILE="${FRONTEND_PID_FILE}" \
BACKEND_PID_FILE="${BACKEND_PID_FILE}" \
FRONTEND_LOG_FILE="${FRONTEND_LOG_FILE}" \
BACKEND_LOG_FILE="${BACKEND_LOG_FILE}" \
"${STOP_SCRIPT}" >/dev/null 2>&1 || true

FRONTEND_PORT="${FRONTEND_PORT}" \
BACKEND_PORT="${BACKEND_PORT}" \
FRONTEND_PID_FILE="${FRONTEND_PID_FILE}" \
BACKEND_PID_FILE="${BACKEND_PID_FILE}" \
FRONTEND_LOG_FILE="${FRONTEND_LOG_FILE}" \
BACKEND_LOG_FILE="${BACKEND_LOG_FILE}" \
"${START_SCRIPT}"

if [[ ! -f "${FRONTEND_PID_FILE}" ]]; then
  echo "未生成 frontend PID 文件" >&2
  exit 1
fi

if [[ ! -f "${BACKEND_PID_FILE}" ]]; then
  echo "未生成 backend PID 文件" >&2
  exit 1
fi

FRONTEND_PID="$(<"${FRONTEND_PID_FILE}")"
BACKEND_PID="$(<"${BACKEND_PID_FILE}")"

if [[ -z "${FRONTEND_PID}" ]] || ! kill -0 "${FRONTEND_PID}" 2>/dev/null; then
  echo "启动后未检测到有效 frontend 进程" >&2
  exit 1
fi

if [[ -z "${BACKEND_PID}" ]] || ! kill -0 "${BACKEND_PID}" 2>/dev/null; then
  echo "启动后未检测到有效 backend 进程" >&2
  exit 1
fi

for _ in {1..20}; do
  if curl -fsS "http://127.0.0.1:${FRONTEND_PORT}/" >/dev/null 2>&1 && \
     curl -fsS "http://127.0.0.1:${BACKEND_PORT}/openapi.json" >/dev/null 2>&1; then
    break
  fi
  sleep 0.5
done

curl -fsS "http://127.0.0.1:${FRONTEND_PORT}/" >/dev/null
curl -fsS "http://127.0.0.1:${BACKEND_PORT}/openapi.json" >/dev/null

# 再验证停止脚本是否会清理 PID 文件并关闭进程。
FRONTEND_PORT="${FRONTEND_PORT}" \
BACKEND_PORT="${BACKEND_PORT}" \
FRONTEND_PID_FILE="${FRONTEND_PID_FILE}" \
BACKEND_PID_FILE="${BACKEND_PID_FILE}" \
FRONTEND_LOG_FILE="${FRONTEND_LOG_FILE}" \
BACKEND_LOG_FILE="${BACKEND_LOG_FILE}" \
"${STOP_SCRIPT}"

if [[ -f "${FRONTEND_PID_FILE}" ]]; then
  echo "停止后 frontend PID 文件仍存在" >&2
  exit 1
fi

if [[ -f "${BACKEND_PID_FILE}" ]]; then
  echo "停止后 backend PID 文件仍存在" >&2
  exit 1
fi

if kill -0 "${FRONTEND_PID}" 2>/dev/null; then
  echo "停止后 frontend 进程仍在运行" >&2
  exit 1
fi

if kill -0 "${BACKEND_PID}" 2>/dev/null; then
  echo "停止后 backend 进程仍在运行" >&2
  exit 1
fi

echo "前后端启动/关闭脚本检查通过"
