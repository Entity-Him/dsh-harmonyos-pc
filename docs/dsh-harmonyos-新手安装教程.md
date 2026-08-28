# dsh-harmonyos-pc 新手安装教程

在 HarmonyOS / 鸿蒙 设备上完整跑起 DeepSeek Harness（dsh）

适用设备：HarmonyOS（arm64）｜配套版本：dsh 0.1.1-rc.2（2026-08-24 跟进）｜项目仓库：github.com/QinpanWan/dsh-harmonyos-pc

## 1. 这是什么

dsh-harmonyos-pc 让 DeepSeek Harness（dsh）在鸿蒙设备上完整跑起来。鸿蒙端的原生 ELF/.node 模块、node-pty、Koffi 都加载不了，本仓库把「安装、打补丁、缓存优化、插件安装、自更新」一整套工程沉淀成可复刻的开源方案。

核心收益是：通过稳定请求前缀，把 DeepSeek 前缀缓存命中率拉到 **93.8%～98.0%**（缓存命中输入比未命中便宜约 **30 倍**）。仓库内置 **七套「鸿蒙对话模式」Agent 预设**，各有缓存与工具策略：

- `harmony-chat`（极简）/ `harmony-chat-pro`（缓存极致）/ `harmony-chat-promax`（六边形交付最强，默认推荐）
- `harmony-chat-ops`（常驻后台任务管家）/ `harmony-chat-rampagemax`（狂暴质量，慎用）
- `harmony-kb`（知识库专家）/ `harmony-deveco`（DevEco 全链路开发大师）

另有启动补丁（禁用原生依赖插件行）、五个 node_modules 补丁（绕开鸿蒙文件系统限制）、GitHub 源插件一键安装器、dsh 自更新器，以及可选配的鸿蒙桌面客户端（`client/`，ArkTS 构建 `.hap`）。

## 2. 前置准备

- 一台 HarmonyOS 设备（本教程基于 arm64 / musl 环境实测）
- Node.js ≥ 22（推荐 v24，本机路径 `/data/service/hnp/node.org/node_v24.13.0/bin/node`）与 npm
- 能访问 `api.deepseek.com`、npm registry 与 GitHub 的网络
- 一个 DeepSeek API key（必选）；OpenAI key 可选
- git（可选，用于克隆与更新仓库）

## 3. 第 1 步：获取仓库

```bash
git clone https://github.com/QinpanWan/dsh-harmonyos-pc.git
cd dsh-harmonyos-pc
```

没有 git 也可以下载仓库 zip 解压。仓库目录建议放在固定位置（如 `~/dsh-harmonyos-pc`），后续启动脚本会用到。

## 4. 第 2 步：安装 dsh 本体

在安装目录执行（本教程默认 `~/dsh-test`，可用环境变量 `DSH_DIR` 覆盖）：

```bash
cd ~/dsh-test && npm install @deepseek-ai/dsh
```

鸿蒙没有 C 编译器，依赖树里的 koffi 原生构建（需要 CMake）可能失败；若报 CMake / koffi 构建错误，改用 `npm install @deepseek-ai/dsh --ignore-scripts`。这样跳过原生构建是安全的：koffi 原生部分只在 Windows 路径被懒加载（鸿蒙永不触发）、node-pty 在本机本就不可用、sharp 走预编译，而所有 @deepseek-ai 包都是纯 JS、没有 install 脚本。该参数已固化在 `scripts/dsh-update.mjs`，后续升级自动带上。

## 5. 第 3 步：部署七套「鸿蒙对话模式」预设

```bash
mkdir -p ~/.dsh/.agent-presets
cp -r presets/* ~/.dsh/.agent-presets/
```

然后编辑 `~/.dsh/settings.yaml`，把默认对话模式设为其中一套：

```yaml
agent-presets:
  default: harmony-chat-promax
```

七套模式都可在 dsh 设置面板「对话模式」下拉里随时切换（切换只影响新建会话）：

| 模式 | 定位 | 缓存策略 | 工具集 |
|---|---|---|---|
| `harmony-chat`（基础） | 极简 · 基线 | 开运行上下文（前缀易变，命中率较低） | 单 Agent |
| `harmony-chat-pro`（缓存极致） | complete:true 唯一提示段 | 前缀零变化，命中率极限 | 单 Agent，计划纪律内建 |
| `harmony-chat-promax`（六边形交付最强，默认推荐） | 缓存命中与交付能力兼得 | 关运行上下文，长稳定前缀 | + 子代理 / 工作流 / Ralph 委派组 + 六条交付硬规则 |
| `harmony-chat-ops`（任务管家） | 常驻后台任务管家 | 关运行上下文，前缀稳定 | + 定时调度（schedule_create/list/delete）+ 目录枚举（list_dir） |
| `harmony-chat-rampagemax`（狂暴 Max，慎用） | 不省 token 只讲质量与交付 | 开运行上下文 + 网页抓取全开 | 全部 promax 能力 + 双重验证/交叉互证 + 委派全量 Pro + 预检穷尽扫描 |
| `harmony-kb`（知识库专家） | 工作区即知识库 | 关运行上下文，前缀稳定 | + 目录枚举（list_dir）+ Obsidian 双链笔记推送 |
| `harmony-deveco`（开发大师） | 鸿蒙 DevEco 全链路开发 | 关运行上下文，前缀稳定 | + dev_environment/build/install_deps/list_devices/deploy + dev_code 委托 DevEco Code |

## 6. 第 3.5 步：安装自定义插件依赖（ops / kb / deveco 需要）

三个预设引用 dsh 之外的**自定义插件**，不在 dsh 基础安装里，需手动放两份（源码 + profile 层软链，缺一不可；缺软链会导致新建会话 `SessionCreateError`）：

```bash
# ① 源码进 dsh 基础 node_modules（预设按裸包名解析到此层）
cp -r plugins/@deepseek-ai/dsh-tool-list ~/dsh-test/node_modules/@deepseek-ai/
# ② 软链进 profile 层依赖树（web profile 的 node_modules 向上走到 profiles/node_modules）
ln -s ~/dsh-test/node_modules/@deepseek-ai/dsh-tool-list ~/.dsh/profiles/node_modules/@deepseek-ai/
```

`harmony-chat-ops` 与 `harmony-kb` 依赖 `@deepseek-ai/dsh-tool-list`（目录枚举，dsh 的 fs 服务没有 readdir），按上面命令安装。定时调度工具 `schedule_create/list/delete` 随 dsh 基础安装自带（`@deepseek-ai/dsh-schedule` 是 dsh 直接依赖），`harmony.patch.yml` 已用 insert 挂载，无需额外安装。

`harmony-deveco` 依赖 `@deepseek-ai/dsh-deveco-bridge`（hvigor/ohpm/hdc 驱动 + dev_code 委托，纯 JS、无原生依赖）：

```bash
cp -r plugins/@deepseek-ai/dsh-deveco-bridge ~/dsh-test/node_modules/@deepseek-ai/
ln -s ~/dsh-test/node_modules/@deepseek-ai/dsh-deveco-bridge ~/.dsh/profiles/node_modules/@deepseek-ai/
```

> 工具路径：插件默认到 `$HOME/deveco/deveco_tools/` 找 node/hvigor/sdk/ohpm（DevEco Studio 默认安装位置）；自定义安装用 `DEVECO_TOOLS_HOME` 整体指路，或 `DEVECO_NODE_HOME` / `DEVECO_HVIGOR_HOME` / `DEVECO_SDK_HOME` / `DEVECO_OHPM_BIN` / `DEVECO_HDC_BIN` 逐项覆盖。`dev_code` 委托本机 DevEco Code 代理（OpenCode web，127.0.0.1:4096），用前需先启动 DevEco Code 并配好 DeepSeek（`~/.deveco/deveco.jsonc`）。

## 7. 第 4 步：打 node_modules 补丁

```bash
node scripts/dsh-update.mjs patch
```

鸿蒙文件系统有多个致命限制，不打补丁 dsh 会异常。补丁按内容锚点幂等重打，升级/重装后需重跑一次：

| 补丁 | 对抗的限制 | 不打会怎样 |
|---|---|---|
| `dsh-credentials-local` | chmod 600 被拒（强制组权限位） | 凭据权限检查永远炸，配不了 API key |
| `dsh-session-persistence-jsonl` | 不支持硬链接（link() 报 EPERM） | 发消息时日志发布失败 |
| `dsh-permission-presets` | 鸿蒙无 bash（沙箱原生依赖被禁） | 对话框没有权限预设下拉（read-only/workspace-write/danger-full-access） |
| `dsh-attachment-local` | 存储拒绝硬链接 / 部分挂载点打不开只读句柄 | 读图（read_image/附件）link() 报 EPERM，图片存不下来，模型看不到图 |
| `dsh-visual-plugin` | 视觉面板默认未配置视觉端点 | vision model is not configured，或自定义 prompt 时返回空文本被硬抛 |

## 8. 第 5 步：配置 API key

编辑 `~/.dsh/.credentials.yaml`（文件权限按 600 创建）：

```yaml
DEEPSEEK_API_KEY: sk-你的DeepSeek密钥
# OPENAI_API_KEY: sk-你的OpenAI密钥   # 可选
```

## 9. 第 6 步：启动 dsh

```bash
cd ~/dsh-harmonyos-pc
sh scripts/dsh-web.sh
```

启动后浏览器打开 `http://127.0.0.1:3080` 即可对话。

启动必须满足两个前提：dsh 用 `--expose-internals` 启动（否则 cordis-plugin-hmr 报错），并带 `--patch harmony.patch.yml`（否则原生插件启动即崩）。`dsh-web.sh` 已默认处理，也可以用 `PATCH_YML` 环境变量覆盖补丁路径。等价手动启动：

```bash
cd ~/dsh-test && node --expose-internals node_modules/@deepseek-ai/dsh/lib/bin.js \
  --profile web --patch ~/dsh-harmonyos-pc/harmony.patch.yml
```

无人值守/跑分可用 headless 模式，使用第二个补丁 `harmony-headless.patch.yml`（headless 树多出 bash/pwsh/fs-search 等原生依赖插件行）：

```bash
cd ~/dsh-test && node --expose-internals node_modules/@deepseek-ai/dsh/lib/bin.js \
  --profile headless --patch ~/dsh-harmonyos-pc/harmony-headless.patch.yml "任务描述"
```

> ⚠ `fs-sandbox` 是纯 JS 的 fs 服务提供方，**不能禁**（`tool-fs` 靠它）。headless 补丁只禁原生依赖插件行。

## 10. 第 7 步：验证安装

1. 浏览器访问 `http://127.0.0.1:3080`，页面正常打开；
2. 新建会话，在「对话模式」下拉看到七套预设并选中一个；
3. 在输入框发一条消息，能收到流式回复（含「思考」折叠块与正文）；
4. 在设置面板确认 API key 已配置、插件无加载报错；
5. 查看 `~/dsh-web.log` 无 preset-invalid / 原生崩溃类错误。

## 11. 日常更新与一键更新

推荐用一键更新（自动处理官方 dsh 升级 + 预设/插件/补丁同步，最后自动重启服务）：

```bash
sh scripts/dsh-hm-update.sh          # 一键更新并重启
sh scripts/dsh-hm-update.sh check    # 只看状态不更新
```

它做的事：① 官方 dsh：`npm view @deepseek-ai/dsh` 比对已装版本，有新版本就升级并重打鸿蒙 node_modules 补丁；② 本仓库：以 `github.com/QinpanWan/dsh-harmonyos-pc` main 分支的 commit SHA 判定版本（写入 `~/.dsh/.dsh-harmonyos.version`），有更新就从 codeload 下载 tarball，同步 `presets/`、`plugins/`、`scripts/`、`harmony*.patch.yml` 到本机仓库副本，并重新部署预设与全部自定义插件；③ 重启 dsh web，新预设即时生效。更新会先把旧预设备份到 `~/.dsh/.dsh-harmonyos-backup/`，**不动** `~/.dsh/settings.yaml`、凭据与你的个性化配置。

旧式/手动管理也可用：

```bash
node scripts/dsh-update.mjs check     # 检查官方是否有新版本
node scripts/dsh-update.mjs install   # 升级 + 自动重打鸿蒙补丁 + 重启
node scripts/dsh-update.mjs rollback  # 回滚到上一版本
sh scripts/dsh-update-web.sh          # 设置与更新页（3098，内嵌 HTML）
```

## 12. 关机重启后：恢复启动

鸿蒙没有开机自启系统服务（无 systemd / cron / XDG autostart）。重启后按下面任一方式把 dsh 拉起来：

**① 仓库脚本（推荐，幂等探活 3080）**

```bash
sh scripts/dsh-web.sh        # 已在跑则跳过；未跑则拉起并等健康检查
```

**② 手动 / headless**：见第 6 步的手动启动命令。

**③ 开机自动恢复（可选）**：鸿蒙设置里把「终端」App 设为开机自启，再在 shell 启动配置（如 `~/.zshrc`）加一段探活钩子，每次打开终端自动拉起服务：

```bash
for _svc in dsh-web; do sh "$HOME/bin/$_svc.sh" >/dev/null 2>&1 & done
```

`dsh-web.sh` 幂等：已在跑就跳过，未跑才拉起，重启系统后无需手动干预。

## 13. 常见问题

| 症状 | 原因 | 解决 |
|---|---|---|
| 启动即崩 / 插件报错 | 没带 harmony.patch.yml 补丁 | 用 `scripts/dsh-web.sh` 启动，或手动加 `--patch` |
| 配不了模型 API key | credentials 补丁没打 | 重跑 `node scripts/dsh-update.mjs patch` |
| 发消息报 EPERM link | session 持久化补丁没打 | 同上，重打补丁后重启 dsh |
| 对话框没有权限预设下拉 | permission-presets 补丁没打 | 同上，重打补丁 |
| 读图失败 / 视觉识别报错 | attachment-local / dsh-visual-plugin 补丁没打 | 同上，重打补丁后重启 dsh |
| npm install 报 CMake / koffi 构建失败 | 鸿蒙无编译器 | 加 `--ignore-scripts` 重装 |
| 新建会话失败 SessionCreateError | 自定义插件缺 profile 层软链 | 按第 3.5 步补源码 + 软链两份 |
| GitHub 源插件装不上 | isogit 垫片拦截 git 操作 | 用 `scripts/dsh-hm-install.mjs`（只装纯 JS / node:sqlite 插件） |
| 切换官方 standard/code/minimal 报 agent-preset-invalid | 它们依赖被禁用的原生能力 | 只用七套鸿蒙预设 |

## 14. 工具链速查

| 脚本 | 作用 |
|---|---|
| `scripts/dsh-web.sh` | dsh Web 服务启动/重启（3080，幂等探活） |
| `scripts/dsh-hm-update.sh` | 一键更新：官方 dsh 升级 + 仓库预设/插件/补丁同步（`check` / 默认 update） |
| `scripts/dsh-update.mjs` | dsh 检查更新：`check` / `patch` / `install` / `rollback` |
| `scripts/dsh-manual-install.mjs` | 手动直装器：registry 元数据递归解析 + tarball 直装（绕 npm arborist 解析卡死） |
| `scripts/dsh-update-web.sh` | 设置与更新页（3098，内嵌 HTML） |
| `scripts/dsh-hm-install.mjs` | GitHub 源插件一键安装（绕过 isogit 拦截） |

所有脚本支持 `NODE_BIN` 环境变量覆盖 node 路径（鸿蒙默认 `/data/service/hnp/node.org/node_v24.13.0/bin/node`）。

## 15. 重要提示

- 鸿蒙没有开机自启系统服务；自启需在鸿蒙设置里把「终端」App 设为开机自启 + shell 探活钩子拉服务。
- bash / 终端执行与沙箱已禁用，Agent 无法真正跑 shell 命令，只能通过文件编辑 / 网页检索 / Skills / 计划 / 委派工作。
- 无法切回官方 standard / code / minimal 预设，它们依赖被禁用的原生能力。
- 纯 UI 的 client 插件会变成空壳；WASM 运行时依赖只在调用时崩。
- `harmony-chat-rampagemax` 与 `harmony-deveco` 慎用：前者高 token 消耗，可能清空账户额度；后者频繁委派/多工具调用，CPU 负载较高，建议空闲时段使用。
- 可选配鸿蒙桌面客户端（`client/`，ArkTS）：DevEco 构建，产物 `client/entry/build/default/outputs/default/entry-default-unsigned.hap`，详见仓库 README「鸿蒙桌面客户端」一节。

项目交流 QQ 群：**930088487** —— 鸿蒙 dsh 适配、缓存优化、插件开发，欢迎加入交流。
