#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
START_SCRIPT="${ROOT_DIR}/start-server.sh"
STOP_SCRIPT="${ROOT_DIR}/stop-server.sh"
TEST_RUNTIME_DIR="$(mktemp -d)"
FRONTEND_PORT="14173"
BACKEND_PORT="18000"
FRONTEND_PID_FILE="${TEST_RUNTIME_DIR}/frontend.pid"
BACKEND_PID_FILE="${TEST_RUNTIME_DIR}/backend.pid"
FRONTEND_LOG_FILE="${TEST_RUNTIME_DIR}/frontend.log"
BACKEND_LOG_FILE="${TEST_RUNTIME_DIR}/backend.log"
FAKE_FRONTEND_DIR="${TEST_RUNTIME_DIR}/fake-frontend"
FAKE_BACKEND_DIR="${TEST_RUNTIME_DIR}/fake-backend"

cleanup() {
  FRONTEND_PORT="${FRONTEND_PORT}" \
  BACKEND_PORT="${BACKEND_PORT}" \
  FRONTEND_PID_FILE="${FRONTEND_PID_FILE}" \
  BACKEND_PID_FILE="${BACKEND_PID_FILE}" \
  FRONTEND_LOG_FILE="${FRONTEND_LOG_FILE}" \
  BACKEND_LOG_FILE="${BACKEND_LOG_FILE}" \
  "${STOP_SCRIPT}" >/dev/null 2>&1 || true

  if [[ -n "${FAKE_FRONTEND_PID:-}" ]] && kill -0 "${FAKE_FRONTEND_PID}" 2>/dev/null; then
    kill "${FAKE_FRONTEND_PID}" >/dev/null 2>&1 || true
  fi

  if [[ -n "${FAKE_BACKEND_PID:-}" ]] && kill -0 "${FAKE_BACKEND_PID}" 2>/dev/null; then
    kill "${FAKE_BACKEND_PID}" >/dev/null 2>&1 || true
  fi

  rm -rf "${TEST_RUNTIME_DIR}"
}

trap cleanup EXIT

mkdir -p "${FAKE_FRONTEND_DIR}" "${FAKE_BACKEND_DIR}"
printf 'dummy-frontend-page\n' > "${FAKE_FRONTEND_DIR}/index.html"
printf '{"title":"dummy-openapi"}\n' > "${FAKE_BACKEND_DIR}/openapi.json"

python3 -m http.server "${FRONTEND_PORT}" --bind 127.0.0.1 --directory "${FAKE_FRONTEND_DIR}" >/dev/null 2>&1 &
FAKE_FRONTEND_PID=$!
python3 -m http.server "${BACKEND_PORT}" --bind 127.0.0.1 --directory "${FAKE_BACKEND_DIR}" >/dev/null 2>&1 &
FAKE_BACKEND_PID=$!

for _ in {1..20}; do
  if curl -fsS "http://127.0.0.1:${FRONTEND_PORT}/" >/dev/null 2>&1 && \
     curl -fsS "http://127.0.0.1:${BACKEND_PORT}/openapi.json" >/dev/null 2>&1; then
    break
  fi
  sleep 0.5
done

FAKE_FRONTEND_RESPONSE="$(curl -fsS "http://127.0.0.1:${FRONTEND_PORT}/")"
FAKE_BACKEND_RESPONSE="$(curl -fsS "http://127.0.0.1:${BACKEND_PORT}/openapi.json")"

if [[ "${FAKE_FRONTEND_RESPONSE}" != *"dummy-frontend-page"* ]]; then
  echo "前置条件失败：假 frontend 服务未成功占用测试端口" >&2
  exit 1
fi

if [[ "${FAKE_BACKEND_RESPONSE}" != *"dummy-openapi"* ]]; then
  echo "前置条件失败：假 backend 服务未成功占用测试端口" >&2
  exit 1
fi

FRONTEND_PORT="${FRONTEND_PORT}" \
BACKEND_PORT="${BACKEND_PORT}" \
FRONTEND_PID_FILE="${FRONTEND_PID_FILE}" \
BACKEND_PID_FILE="${BACKEND_PID_FILE}" \
FRONTEND_LOG_FILE="${FRONTEND_LOG_FILE}" \
BACKEND_LOG_FILE="${BACKEND_LOG_FILE}" \
"${START_SCRIPT}"

if kill -0 "${FAKE_FRONTEND_PID}" 2>/dev/null; then
  echo "启动脚本未接管 frontend 端口" >&2
  exit 1
fi

if kill -0 "${FAKE_BACKEND_PID}" 2>/dev/null; then
  echo "启动脚本未接管 backend 端口" >&2
  exit 1
fi

if [[ ! -f "${FRONTEND_PID_FILE}" ]] || [[ ! -f "${BACKEND_PID_FILE}" ]]; then
  echo "启动后未写入测试 PID 文件" >&2
  exit 1
fi

REAL_FRONTEND_RESPONSE="$(curl -fsS "http://127.0.0.1:${FRONTEND_PORT}/")"
REAL_BACKEND_RESPONSE="$(curl -fsS "http://127.0.0.1:${BACKEND_PORT}/openapi.json")"

if [[ "${REAL_FRONTEND_RESPONSE}" == *"dummy-frontend-page"* ]]; then
  echo "frontend 端口仍返回假服务内容" >&2
  exit 1
fi

if [[ "${REAL_BACKEND_RESPONSE}" == *"dummy-openapi"* ]]; then
  echo "backend 端口仍返回假服务内容" >&2
  exit 1
fi

FRONTEND_PORT="${FRONTEND_PORT}" \
BACKEND_PORT="${BACKEND_PORT}" \
FRONTEND_PID_FILE="${FRONTEND_PID_FILE}" \
BACKEND_PID_FILE="${BACKEND_PID_FILE}" \
FRONTEND_LOG_FILE="${FRONTEND_LOG_FILE}" \
BACKEND_LOG_FILE="${BACKEND_LOG_FILE}" \
"${STOP_SCRIPT}"

if [[ -f "${FRONTEND_PID_FILE}" ]] || [[ -f "${BACKEND_PID_FILE}" ]]; then
  echo "停止后测试 PID 文件仍存在" >&2
  exit 1
fi

echo "端口接管脚本检查通过"
