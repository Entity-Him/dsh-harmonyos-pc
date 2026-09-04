#!/bin/sh
# dsh web 服务:启动/重启 (127.0.0.1:3080)。用法: sh scripts/dsh-web.sh
# 环境变量可覆盖: NODE_BIN(节点路径) DSH_DIR(dsh 安装目录) PATCH_YML(适配补丁) PORT LOG
# HarmonyOS 适配: 必须用 node v22(本机 deveco 自带) + compat-loader(补 zstd/stripTypeScriptTypes)；
# node v24 新进程 V8 code-range 分配会原生崩溃(ENOMEM)。补丁默认定位仓库内 harmony.patch.yml。
SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
NODE="${NODE_BIN:-$HOME/deveco/deveco_tools/node/bin/node}"
DIR="${DSH_DIR:-$HOME/dsh-test}"
PATCH="${PATCH_YML:-$SCRIPT_DIR/../harmony.patch.yml}"
PORT="${PORT:-3080}"
LOG="${LOG:-$HOME/dsh-web.log}"
PIDF="$HOME/dsh-web.pid"

is_up() {
  /usr/bin/curl -s -o /dev/null --max-time 1 "http://127.0.0.1:$PORT/" 2>/dev/null
}

# 孤儿锁清理：dsh 的 atomic-write 从不回收孤儿锁（SIGKILL/崩溃退出会留下 .dsh/profiles/*.lock、
# ~/.dsh/.credentials.yaml.lock），不清下次启动即「timed out waiting for the writer lock」。
# 仅在确认本脚本要拉起服务(无 dsh 在跑)时调用，避免误删在跑进程持有的锁。
clear_stale_locks() {
  for lk in "$HOME/.dsh"/profiles/*.lock "$HOME/.dsh"/profiles/*/*.lock "$HOME/.dsh"/.credentials.yaml.lock; do
    [ -e "$lk" ] && rm -f "$lk"
  done
}

if is_up; then
  echo "dsh-web: already running at http://127.0.0.1:$PORT/ (skip)"
  exit 0
fi

cd "$DIR" || { echo "dsh-web: no dir $DIR"; exit 1; }
if [ ! -d "$DIR/node_modules/@deepseek-ai/dsh" ]; then
  echo "dsh-web: dsh not installed at $DIR"
  exit 1
fi
ps -ef 2>/dev/null | grep -F "dsh/lib/bin.js" | grep -v grep \
  | awk '{print $2}' | while read p; do kill "$p" 2>/dev/null; done
sleep 0.3
clear_stale_locks

# 插件市场目录本地镜像（鸿蒙上 node 直连外网 fetch 不可靠，用 curl 下载到本地再走 127.0.0.1 静态服务）
MC_DIR="$HOME/.dsh/market-catalog"
MC_PORT=3988
MC_LOG="$MC_DIR/server.log"
mkdir -p "$MC_DIR"
if command -v curl >/dev/null 2>&1; then
  curl -s --max-time 25 -o "$MC_DIR/plugins.json.tmp" https://awesome-dsh-plugin.com/plugins.json \
    && mv "$MC_DIR/plugins.json.tmp" "$MC_DIR/plugins.json" 2>/dev/null
  rm -f "$MC_DIR/plugins.json.tmp"
fi
if ! curl -s -o /dev/null --max-time 1 "http://127.0.0.1:$MC_PORT/plugins.json"; then
  pkill -f "http.server $MC_PORT" 2>/dev/null
  nohup python3 -m http.server "$MC_PORT" --bind 127.0.0.1 --directory "$MC_DIR" > "$MC_LOG" 2>&1 &
fi
export DSHM_REGISTRY_URL="http://127.0.0.1:$MC_PORT/plugins.json"

nohup "$NODE" --expose-internals --experimental-sqlite \
  --experimental-loader "$DIR/compat-loader.mjs" \
  node_modules/@deepseek-ai/dsh/lib/bin.js \
  --profile web --patch "$PATCH" --no-open > "$LOG" 2>&1 &
echo $! > "$PIDF"

for i in $(seq 1 30); do
  is_up && break
  sleep 1
done

if is_up; then
  echo "dsh-web: http://127.0.0.1:$PORT/ (pid $(cat "$PIDF"))"
else
  echo "dsh-web: FAILED to start (see $LOG)"
  head -5 "$LOG"
  exit 1
fi
