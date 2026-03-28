#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="${ROOT_DIR}/frontend"
BACKEND_DIR="${ROOT_DIR}/backend"

FRONTEND_PID_FILE="${FRONTEND_PID_FILE:-${FRONTEND_DIR}/.vite-dev.pid}"
FRONTEND_LOG_FILE="${FRONTEND_LOG_FILE:-${FRONTEND_DIR}/.vite-dev.log}"
BACKEND_PID_FILE="${BACKEND_PID_FILE:-${BACKEND_DIR}/.uvicorn.pid}"
BACKEND_LOG_FILE="${BACKEND_LOG_FILE:-${BACKEND_DIR}/.uvicorn.log}"

FRONTEND_PORT="${FRONTEND_PORT:-4173}"
BACKEND_PORT="${BACKEND_PORT:-8000}"
MYSQL_CONTAINER="${MYSQL_CONTAINER:-web-learning-mysql}"
REDIS_CONTAINER="${REDIS_CONTAINER:-web-learning-redis}"

ensure_parent_dir() {
  local target_file="$1"

  mkdir -p "$(dirname "${target_file}")"
}

is_pid_alive() {
  local target_pid="$1"

  [[ -n "${target_pid}" ]] && kill -0 "${target_pid}" 2>/dev/null
}

wait_port_released() {
  local port="$1"

  for _ in {1..20}; do
    if ! fuser -n tcp "${port}" >/dev/null 2>&1; then
      return 0
    fi
    sleep 0.5
  done

  return 1
}

reclaim_port() {
  local service_name="$1"
  local port="$2"

  if ! fuser -n tcp "${port}" >/dev/null 2>&1; then
    return 0
  fi

  echo "${service_name} 发现端口 ${port} 已被占用，正在释放旧进程"
  fuser -k -TERM "${port}/tcp" >/dev/null 2>&1 || true

  if wait_port_released "${port}"; then
    return 0
  fi

  fuser -k -KILL "${port}/tcp" >/dev/null 2>&1 || true

  if wait_port_released "${port}"; then
    return 0
  fi

  echo "${service_name} 无法释放端口 ${port}" >&2
  exit 1
}

ensure_existing_container_running() {
  local container_name="$1"

  if ! docker container inspect "${container_name}" >/dev/null 2>&1; then
    echo "缺少容器 ${container_name}，请先完成初始化" >&2
    exit 1
  fi

  docker start "${container_name}" >/dev/null 2>&1 || true
}

ensure_redis_container_running() {
  if docker container inspect "${REDIS_CONTAINER}" >/dev/null 2>&1; then
    docker start "${REDIS_CONTAINER}" >/dev/null 2>&1 || true
    return
  fi

  docker run -d \
    --name "${REDIS_CONTAINER}" \
    --restart unless-stopped \
    -p 6380:6379 \
    redis:7-alpine >/dev/null
}

start_service() {
  local service_name="$1"
  local pid_file="$2"
  local log_file="$3"
  local startup_command="$4"
  local healthcheck_url="$5"
  local port="$6"

  ensure_parent_dir "${pid_file}"
  ensure_parent_dir "${log_file}"

  if [[ -f "${pid_file}" ]]; then
    local existing_pid
    existing_pid="$(<"${pid_file}")"
    if is_pid_alive "${existing_pid}"; then
      echo "${service_name} 已在运行，PID=${existing_pid}"
      return
    fi
    rm -f "${pid_file}"
  fi

  reclaim_port "${service_name}" "${port}"

  : > "${log_file}"
  setsid bash -lc "${startup_command}" >>"${log_file}" 2>&1 &
  local server_pid=$!
  echo "${server_pid}" > "${pid_file}"
  sleep 2

  if ! kill -0 "${server_pid}" 2>/dev/null; then
    echo "${service_name} 启动失败" >&2
    tail -n 30 "${log_file}" >&2 || true
    rm -f "${pid_file}"
    exit 1
  fi

  echo "${service_name} 已启动，PID=${server_pid}"
}

wait_http_ready() {
  local url="$1"
  local service_name="$2"

  for _ in {1..40}; do
    if curl -fsS "${url}" >/dev/null 2>&1; then
      echo "${service_name} 已就绪"
      return
    fi
    sleep 0.5
  done

  echo "${service_name} 未在预期时间内就绪" >&2
  exit 1
}

ensure_existing_container_running "${MYSQL_CONTAINER}"
ensure_redis_container_running

start_service \
  "backend service" \
  "${BACKEND_PID_FILE}" \
  "${BACKEND_LOG_FILE}" \
  "cd '${BACKEND_DIR}' && exec env PYTHONPATH='${BACKEND_DIR}' .venv/bin/python -m uvicorn app:app --host 0.0.0.0 --port ${BACKEND_PORT}" \
  "http://127.0.0.1:${BACKEND_PORT}/openapi.json" \
  "${BACKEND_PORT}"

wait_http_ready "http://127.0.0.1:${BACKEND_PORT}/openapi.json" "backend service"

start_service \
  "frontend dev server" \
  "${FRONTEND_PID_FILE}" \
  "${FRONTEND_LOG_FILE}" \
  "cd '${FRONTEND_DIR}' && exec npm run dev -- --host 0.0.0.0 --port ${FRONTEND_PORT}" \
  "http://127.0.0.1:${FRONTEND_PORT}/" \
  "${FRONTEND_PORT}"

wait_http_ready "http://127.0.0.1:${FRONTEND_PORT}/" "frontend dev server"

echo "前后端服务均已启动"
echo "frontend: http://localhost:${FRONTEND_PORT}/"
echo "backend: http://localhost:${BACKEND_PORT}/openapi.json"
echo "frontend 日志: ${FRONTEND_LOG_FILE}"
echo "backend 日志: ${BACKEND_LOG_FILE}"
