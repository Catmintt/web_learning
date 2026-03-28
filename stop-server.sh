#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_PID_FILE="${FRONTEND_PID_FILE:-${ROOT_DIR}/frontend/.vite-dev.pid}"
BACKEND_PID_FILE="${BACKEND_PID_FILE:-${ROOT_DIR}/backend/.uvicorn.pid}"
FRONTEND_PORT="${FRONTEND_PORT:-4173}"
BACKEND_PORT="${BACKEND_PORT:-8000}"

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

terminate_process_tree() {
  local target_pid="$1"

  if ! is_pid_alive "${target_pid}"; then
    return 0
  fi

  kill -TERM "-${target_pid}" 2>/dev/null || kill -TERM "${target_pid}" 2>/dev/null || true

  for _ in {1..20}; do
    if ! is_pid_alive "${target_pid}"; then
      return 0
    fi
    sleep 0.5
  done

  kill -KILL "-${target_pid}" 2>/dev/null || kill -KILL "${target_pid}" 2>/dev/null || true
  sleep 1

  if is_pid_alive "${target_pid}"; then
    echo "进程 ${target_pid} 关闭失败，请手动检查" >&2
    exit 1
  fi
}

reclaim_port() {
  local service_name="$1"
  local port="$2"

  if ! fuser -n tcp "${port}" >/dev/null 2>&1; then
    return 0
  fi

  echo "${service_name} 检测到端口 ${port} 仍被占用，正在释放"
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

stop_service() {
  local service_name="$1"
  local pid_file="$2"
  local port="$3"
  local handled="0"

  if [[ -f "${pid_file}" ]]; then
    local server_pid
    server_pid="$(<"${pid_file}")"

    if ! is_pid_alive "${server_pid}"; then
      rm -f "${pid_file}"
      echo "${service_name} 已停止，旧 PID 文件已清理"
    else
      terminate_process_tree "${server_pid}"
      rm -f "${pid_file}"
      echo "${service_name} 已关闭"
    fi
    handled="1"
  else
    echo "未找到 ${service_name} 的 PID 文件，继续检查端口占用"
  fi

  if fuser -n tcp "${port}" >/dev/null 2>&1; then
    reclaim_port "${service_name}" "${port}"
    handled="1"
  fi

  if [[ "${handled}" == "0" ]]; then
    echo "${service_name} 未运行"
  fi
}

stop_service "frontend dev server" "${FRONTEND_PID_FILE}" "${FRONTEND_PORT}"
stop_service "backend service" "${BACKEND_PID_FILE}" "${BACKEND_PORT}"
echo "前后端服务已停止，MySQL/Redis 容器保持运行"
