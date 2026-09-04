**简体中文** | [English](README.en.md)

# dsh-harmonyos-pc

<p align="center"><img src="repo-cover-teal.png" alt="dsh-harmonyos-pc 封面" width="100%"></p>

<p align="center">
  <img alt="HarmonyOS" src="https://img.shields.io/badge/HarmonyOS-Adapt-blue">
  <img alt="DeepSeek Harness" src="https://img.shields.io/badge/DeepSeek_Harness-dsh-41b0ff">
  <img alt="Cache Hit" src="https://img.shields.io/badge/Cache_Hit-98%25-orange">
  <img alt="Node.js" src="https://img.shields.io/badge/Node.js-22%2B-black">
  <img alt="License" src="https://img.shields.io/badge/License-MIT-green">
</p>

让 [DeepSeek Harness](https://github.com/deepseek-ai/dsh)（dsh）在 **HarmonyOS / 鸿蒙** 设备上完整跑起来的全套适配方案。

<p align="center">
  <img src="repo-cover-aurora.png" alt="dsh-harmonyos-pc 特色总览：缓存命中 93.8%~98%、对话成本省 30 倍、纯 JS 零依赖、MIT" width="85%">
</p>

<p align="center">
  <a href="repo-cover.png"><img src="repo-cover.png" alt="dsh-harmonyos-pc 封面（navy）" width="85%"></a>
</p>

> 鸿蒙端几乎没人做这件事——原生 ELF/.node 模块、node-pty、Koffi 在这类设备上都加载不了。本仓库把「安装、打补丁、缓存优化、插件安装、自更新」一整套工程沉淀成可复刻的开源方案。

> **项目交流 QQ 群：930088487** —— 鸿蒙 dsh 适配、缓存优化、插件开发，欢迎加入交流。
>
> **新手教程**（在线版）：[点此打开 dsh-harmonyos-pc 新手安装教程](https://docs.google.com/document/d/1f3l-Q2Di6DmPy4xydYr4lUYIxmoOA014D63XNBTPSys/edit)

> **群介绍**：让 DeepSeek Harness（dsh）在 HarmonyOS / 鸿蒙 设备上完整跑起来的全套适配方案。鸿蒙端几乎没人做这件事——原生 ELF/.node 模块、node-pty、Koffi 在这类设备上都加载不了。本仓库把「安装、打补丁、缓存优化、插件安装、自更新」一整套工程沉淀成可复刻的开源方案：
>
> - **八套「鸿蒙对话模式」Agent 预设**：把 DeepSeek 前缀缓存命中率拉到最高，同时保留任务交付能力——`harmony-chat`（极简）/ `harmony-chat-pro`（缓存极致）/ `harmony-chat-promax`（六边形交付最强）/ `harmony-chat-ops`（常驻后台任务管家）/ `harmony-chat-rampagemax`（狂暴质量）/ `harmony-kb`（知识库专家）/ `harmony-deveco`（DevEco 全链路开发大师）/ `harmony-chat-monash`（Monash 学生版）
> - **六边形 ProMax**（2026-08-18 升级）：缓存命中 / 省 token / 交付能力 / 测试验证 / 集成闭环 / 共存防御六条硬规则同场，把「写完代码」与「系统跑起来」之间的鸿沟写成机械清单，交付纪律对标并反超主流通用 Agent
> - **狂暴 Max**（2026-08-18 新增）：不省 token 只讲质量与交付的极限模式——运行上下文 + 网页抓取全开，预检穷尽扫描，集成闭环与双重验证写死为铁律。慎用：高 token 消耗，可能清空账户额度
> - **启动补丁** `harmony.patch.yml`（web）+ `harmony-headless.patch.yml`（headless）：禁用依赖原生二进制的插件行，让 dsh 不再启动即崩
> - **node_modules 补丁脚本**：绕开鸿蒙文件系统的致命限制（`chmod 600` 被拒、不支持硬链接、存储拒绝硬链接/挂载点打不开只读句柄）+ 恢复对话框权限预设（`dsh-permission-presets` 改读 fs 沙箱，read-only/workspace-write/danger-full-access 下拉可用）+ 修好读图（attachment-local `link`→`copy`）与视觉识别（`dsh-visual-plugin` 回退到主视觉模型）
> - **省 token 优化实测**：11 道基准 A/B 验证 `reasoningEffort: high` 为帕累托最优（全对 + 步数最少 + 成本几乎不变），promax 委派组挂 Pro 模型路由兜底复杂子任务
> - **五套预设跑分（2026-08-18）**：经静态 persona 填充（前缀越过 128-token 块边界），静态前缀预设缓存命中率 52.9%–89.9% → **93.8%–98.0%**（promax 96.7%、ops 97.9%、rampagemax 98.0%），连开运行上下文的 harmony-chat 也拉到 93.8%——用数据印证「保缓存先保前缀稳定」（详见下方「性能实测」）
> - **工具链**：GitHub 插件一键安装器、dsh 自更新器 + 设置页
> - **全局防注入 `dsh-prompt-antivirus`**（2026-08-31 新增）：扫描工具参数 / 工具结果 / 进入模型前的消息，隔离或拦截提示注入与「上下文病毒」，每会话注入金丝雀守卫，危险工具走人工审批——profile 层挂载，对全部预设与子代理全局生效

- **八套「鸿蒙对话模式」Agent 预设**：把 DeepSeek 前缀缓存命中率拉到最高，同时保留任务交付能力——`harmony-chat`（极简）/ `harmony-chat-pro`（缓存极致）/ `harmony-chat-promax`（六边形交付最强）/ `harmony-chat-ops`（常驻后台任务管家）/ `harmony-chat-rampagemax`（狂暴质量）/ `harmony-kb`（知识库专家）/ `harmony-deveco`（DevEco 全链路开发大师）/ `harmony-chat-monash`（Monash 学生版）
- **六边形 ProMax**（2026-08-18 升级）：缓存命中 / 省 token / 交付能力 / 测试验证 / 集成闭环 / 共存防御六条硬规则同场，把「写完代码」与「系统跑起来」之间的鸿沟写成机械清单，交付纪律对标并反超主流通用 Agent
- **狂暴 Max**（2026-08-18 新增）：不省 token 只讲质量与交付的极限模式——运行上下文 + 网页抓取全开，预检穷尽扫描，集成闭环与双重验证写死为铁律。慎用：高 token 消耗，可能清空账户额度
- **知识库专家 `harmony-kb`**（2026-08-19 新增）：把工作区当知识库——分层检索问答 / 深度研究（Pro 委派提炼）/ 文档整理 / 思维脑图（可导入万兴脑图）/ 笔记生成，并按指令把总结推送进鸿蒙侧载版 Obsidian（`[[双链]]` 只挂已有笔记）。注意：频繁委派 Pro + 多工具调用，CPU 负载高，风扇转得较狠
- **鸿蒙开发大师 `harmony-deveco`**（2026-08-20 新增）：DevEco 全链路开发 Agent——通过 dev_* 工具驱动 hvigor/ohpm/hdc，打通「写 ArkTS → 编译 → 装真机 → 启动」完整闭环（含签名打包指引）；`dev_code` 把深子任务委托给本机 DevEco Code 代理（OpenCode web，127.0.0.1:4096）。麒麟 X90 软硬件协同功耗纪律：串行委托、4 核不拉满。
- **启动补丁** `harmony.patch.yml`（web）+ `harmony-headless.patch.yml`（headless）：禁用依赖原生二进制的插件行，让 dsh 不再启动即崩
- **node_modules 补丁脚本**：绕开鸿蒙文件系统的致命限制（`chmod 600` 被拒、不支持硬链接、存储拒绝硬链接/挂载点打不开只读句柄）+ 恢复对话框权限预设（`dsh-permission-presets` 改读 fs 沙箱，read-only/workspace-write/danger-full-access 下拉可用）+ 修好读图（attachment-local `link`→`copy`）与视觉识别（`dsh-visual-plugin` 回退到主视觉模型）
- **省 token 优化实测**：11 道基准 A/B 验证 `reasoningEffort: high` 为帕累托最优（全对 + 步数最少 + 成本几乎不变），promax 委派组挂 Pro 模型路由兜底复杂子任务
- **五套预设跑分（2026-08-18）**：经静态 persona 填充（前缀越过 128-token 块边界），静态前缀预设缓存命中率 52.9%–89.9% → **93.8%–98.0%**（promax 96.7%、ops 97.9%、rampagemax 98.0%），连开运行上下文的 harmony-chat 也拉到 93.8%——用数据印证「保缓存先保前缀稳定」（详见下方「性能实测」）
- **工具链**：GitHub 插件一键安装器、dsh 自更新器 + 设置页
- **全局防注入 `dsh-prompt-antivirus`**（2026-08-31 新增）：扫描工具参数 / 工具结果 / 进入模型前的消息，隔离或拦截提示注入与「上下文病毒」（`[CRON TASK]` / `[SCHEDULE REMINDER]` / 网页检索 / 文件内容里夹带的恶意指令），每会话注入金丝雀守卫，危险工具命中高危时走人工审批；`block` / `quarantine` / `monitor` 三模式 + 本地审计，profile 层挂载对全部预设与子代理全局生效，纯 JS 零依赖

---

## 为什么需要这套方案

| 鸿蒙设备的限制 | 后果 | 本仓库的解法 |
|---|---|---|
| 无法加载原生 ELF / `.node` 模块 | `node-pty`(subprocess)、`Koffi`(sandbox/fs-local) 启动即崩 | `harmony.patch.yml` 禁用这些插件行 |
| 文件系统强制组权限位，`chmod 600` 被拒 | 凭据文件权限检查永远炸，配不了 API key | 补丁 `dsh-credentials-local`：`assertOwnerOnly` 直接 `return` |
| 文件系统不支持硬链接 | session 持久化 `link()` 发布日志报 `EPERM` | 补丁 `dsh-session-persistence-jsonl`：`link` 改 `rename` |
| 鸿蒙无 bash shell（沙箱原生依赖被禁） | 对话框没有权限预设下拉（read-only/workspace-write/danger-full-access） | 补丁 `dsh-permission-presets`：`sandboxMode` 改读 fs 沙箱（纯 JS，一直在运行） |
| 鸿蒙存储拒绝硬链接 / 部分挂载点打不开只读句柄 | 读图（read_image / 附件）`link()` 报 `EPERM`、目录 `fsync` 报错，图片存不下来 → 模型看不到图 | 补丁 `dsh-attachment-local`：`link` 失败改 `copy` 发布（EEXIST 竞态走完整性校验）；`syncDirectory` 对 EPERM/EACCES/ENOTSUP 挂载点跳过 fsync |
| 鸿蒙存储拒绝硬链接 | 工作区新文件写入（`createIfAbsent`）`link()` 报 `EPERM`，新文件写不进去 | 补丁 `dsh-fs-local`：先确认目标不存在，再改按 `rename` 发布，保住 create-if-absent 语义 |
| `dsh-visual-plugin`（第三方）面板默认未配置视觉端点 | `vision model is not configured`，或自定义 prompt 时视觉模型返回空文本被硬抛 | 补丁 `dsh-visual-plugin`：端点为空时回退到主 DeepSeek 视觉模型（`llm-deepseek` + `DEEPSEEK_API_KEY`）；空 content 重试一次并降级为明确提示 |
| `git ls-remote` 被 isogit 垫片拦截 | GitHub 源插件装不了 | `scripts/dsh-hm-install.mjs` 安装器（fetch 源码 → 构建 → 软链） |

---

## 安全声明

本仓库的全部内容都是纯文本 / 纯 JS 的配置与脚本，**不删除、不加密、不外传你的数据，不注册系统服务、不要求 root 权限**，可放心使用：

- **纯 JS / 纯文本**：预设是 YAML 配置文件，补丁是 YAML 覆盖层，插件是零依赖的纯 JS（只用 `node:fs/promises`），脚本是 Node/Shell 文本。不含可执行二进制、原生 `.node`/ELF 模块、内核改动或驱动。
- **不碰系统级东西**：不注册 `systemd` / 开机自启 / 系统计划任务，不改系统路径，不要求 root。所有写入都发生在 dsh 安装目录与 `~/.dsh` 用户配置目录内。
- **不动你的数据**：预设只改 dsh 的「对话模式」配置；插件只做目录列举与文件读取；补丁只开关 dsh 自己的插件行。不会删除、覆盖、加密或外传你的文件。
- **网络行为最小**：只在启动 dsh 时加载配置、在你主动发起对话/检查更新时访问 DeepSeek 与 GitHub 官方接口。无遥测、无埋点、无数据上报。
- **完全可审阅**：全仓库仅 20 余个文本文件，任何一行都可打开检查。
- **防注入插件只做本地扫描**：`dsh-prompt-antivirus` 只在本机对工具参数 / 工具结果 / 会话消息做正则扫描，审计日志写到本地 `~/.dsh/task-board/prompt-antivirus-audit.jsonl`；不联网、不读取未进入会话的磁盘文件、不上传任何内容。
- **可逆卸载**：删除 `~/.dsh/.agent-presets/` 下用到的预设目录（如 `harmony-chat-ops/`、`harmony-kb/`、`harmony-deveco/`）、`~/dsh-test/node_modules/@deepseek-ai/dsh-tool-list/` 与 `@deepseek-ai/dsh-deveco-bridge/` 及 profile 层对应软链，重启 dsh 即完全还原。

---

## 快速开始

### 1. 安装 dsh

```bash
cd ~/dsh-test && npm install @deepseek-ai/dsh
```

> 安装位置可用 `DSH_DIR` 环境变量覆盖；下文默认 `~/dsh-test`。

### 2. 部署预设（对话模式）

把预设目录拷进 dsh 的用户预设目录：

```bash
mkdir -p ~/.dsh/.agent-presets
cp -r presets/* ~/.dsh/.agent-presets/
```

然后在 `~/.dsh/settings.yaml` 里把默认对话模式设为其中一个：

```yaml
agent-presets:
  default: harmony-chat-promax
```

八套模式在 dsh 设置面板「对话模式」下拉里可随时自由切换（切换只影响新建会话）。详见 [docs/CACHE-OPTIMIZATION.md](docs/CACHE-OPTIMIZATION.md) 了解它们为什么快。

| 模式 | persona | 缓存策略 | 工具集 |
|---|---|---|---|
| `harmony-chat`（基础） | 常规 | 开运行上下文（前缀易变） | 单 Agent |
| `harmony-chat-pro`（缓存极致） | `complete:true` 唯一提示段 | 前缀零变化，命中率极限 | 单 Agent，计划纪律内建 |
| `harmony-chat-promax`（六边形交付最强） | `complete:false` | 关闭运行上下文，长稳定前缀 | + 子代理 / 工作流 / Ralph 委派组 + 六条交付硬规则 |
| `harmony-chat-ops`（任务管家） | 常驻后台任务管家 | 关闭运行上下文，前缀稳定 | + 定时任务（cron_create/list/set_enabled/delete + schedule_create/list/delete）+ 目录枚举（list_dir） |
| `harmony-chat-rampagemax`（狂暴 Max） | 不省 token 只讲质量与交付 | 开运行上下文（前缀易变）+ 网页抓取全开 | + 委派组（全 Pro）+ 预检穷尽 / 双重验证 / 复盘铁律 |
| `harmony-chat-rampagemax`（狂暴Max，慎用） | 不省 token 只讲质量与交付 | **打开**运行上下文，前缀动态、命中率低 | 全部 promax 能力 + 网页 fetch 全开 + 双重验证/交叉互证 + 委派全量 Pro + 预检穷尽扫描 |
| `harmony-kb`（知识库专家） | 工作区即知识库：分层检索 / 深度研究 / 文档整理 / 脑图 / 笔记 | 关闭运行上下文，前缀稳定 | + 目录枚举（list_dir）+ Obsidian 双链笔记推送 |
| `harmony-deveco`（开发大师） | 鸿蒙 DevEco 全链路开发（写 ArkTS → 编译 → 装真机 → 启动） | 关闭运行上下文，前缀稳定 | + dev_environment/build/install_deps/list_devices/deploy + dev_code（委托本机 DevEco Code 代理）+ 麒麟 X90 功耗纪律 |
| `harmony-chat-monash`（Monash 学生版） | Monash 全校区学生助手：文献解读 / 论文查重 / 作业辅助 + 学生服务与墨尔本交通知识库 | 关闭运行上下文，长稳定前缀（同 ProMax） | 同 promax 全工具集（fs / 检索 / 委派 / 工作流） |

### 2.4 六边形 ProMax：鸿蒙上交付能力的天花板

`harmony-chat-promax` 不在「缓存命中」与「交付能力」之间做取舍，而是六条硬规则同场——每一条都对应一次真实踩坑后的沉淀：

| # | 维度 | 规则 | 对抗的失败模式 |
|---|---|---|---|
| 1 | **缓存命中** | `includeRuntimeContext:false`，系统提示全静态、前缀零变化 | 前缀随会话动态变，DeepSeek 缓存命中率掉到谷底（未命中输入贵约 **30 倍**） |
| 2 | **省 token** | 静态前缀 + 任务分级：轻任务直接完成不写计划，重任务才走完整闭环 | 把「简单问答」也铺成计划/多轮往返，输出白烧 |
| 3 | **交付能力** | 完整提示段全保留（计划策略 / 工具指引 / 委派组），只关运行上下文 | 为保缓存砍成瘦壳，重任务交付不了 |
| 4 | **测试验证** | 「声称完成前必须跑验证命令拿到真实输出，拿不出证据等于未完成」 | 写完代码就宣称完成，语法/回归全裸奔 |
| 5 | **集成闭环** | 交付 = 文件写完 + 依赖就位（node_modules 软链）+ 重启服务 + 核对 boot 加载 + 实测生效 | 「文件正确」≠「系统能跑起来」，差的那几步没人做 |
| 6 | **共存防御** | 动手前先扫冲突（namespace / wiring.id / system-prompt 槽位 / 设置页 order / 工具名），复用同构已上线参照作模板 | 新插件互相踩，改共享资源不列影响面 |

六条全部落在 `agent.cordis.yml` 的 persona 静态文本里，不注入任何动态内容——**规则本身不破坏第 1 条缓存命中**。

#### 与其他 Agent 的对比

| 能力 | 六边形 ProMax | 主流通用 Agent（Claude Code / Codex CLI / Cursor 等） |
|---|---|---|
| 缓存命中率 | 静态前缀保缓存，命中率极限 | 运行上下文随会话动态变化，前缀易碎，未命中价高 |
| token 成本 | 命中输入 ≈ 1/30 价，轻任务零铺张 | 每次请求动态注入，缓存收益大打折扣 |
| 平台感知 | 知道鸿蒙/dsh 特有条件：无原生 ELF、`chmod 600` 被拒、不支持硬链接、isogit 垫片、原生插件启动即崩 | 按 Linux/服务器假设建模，在鸿蒙上第一步就崩或受限 |
| 集成闭环 | **软链 → 重启 → boot 核对 → 实测**写死成机械清单 | 写完代码 + 测试过就停，不知道 dsh 特有步骤 |
| 验证纪律 | 「改完有证据」写入 persona，验证命令与输出记录在案 | 靠模型自觉，无强制，易「应该好了」式空口断言 |

**为什么能秒杀通用 Agent：** 通用 Agent 的「完成」标准是「代码写完 + 测试过」，而 dsh 插件交付的完成标准是「系统能跑起来」。差的正是那一整段**平台特有收尾**——node_modules 软链要建在 `~/.dsh` 树内、重启要带 `--patch harmony.patch.yml`、boot entries 要核对加载、功能要实测。通用 Agent 不知道这些步骤，它把「写完」当终点；ProMax 把这套机械清单写进 persona，把「收尾」也当成不可跳过的交付环节。

**这套规则从哪里来：** 不是设计出来的，是从插件开发实测里逐条长出来的。用 ProMax 写明日方舟干员角色插件（dsh-arknights-persona）时暴露的问题——代码零语法错误、API 全对（9/10），但 node_modules 软链没建、没重启、没核对 boot、没实测（闭环仅 6/10）——每条都变成上面的一格规则。这正是「交付最强」的含义：**代码交付率 9/10，系统跑通率 6/10，差在收尾纪律不在智能。**

### 2.5 安装 ops / kb 模式依赖（仅 `harmony-chat-ops` 与 `harmony-kb` 需要）

ops 与 kb 两个预设都引用了一个 dsh 之外的**自定义插件** `@deepseek-ai/dsh-tool-list`（目录枚举，dsh fs 服务没有 readdir）。它不在 dsh 基础安装里，需手动放两份（源码 + profile 层软链，缺一不可）：

```bash
# ① 源码进 dsh 基础 node_modules（预设按裸包名解析到此层）
cp -r plugins/@deepseek-ai/dsh-tool-list ~/dsh-test/node_modules/@deepseek-ai/
# ② 软链进 profile 层依赖树（web profile 的 node_modules 向上走到 profiles/node_modules）
ln -s ~/dsh-test/node_modules/@deepseek-ai/dsh-tool-list ~/.dsh/profiles/node_modules/@deepseek-ai/
```

> 定时调度工具 `schedule_create/list/delete` 随 dsh 基础安装自带（`@deepseek-ai/dsh-schedule` 是 dsh 直接依赖），`harmony.patch.yml` 已用 `insert` 挂载，无需额外安装。

### 2.6 鸿蒙知识库专家（harmony-kb）：工作区即知识库 + Obsidian 双链

`harmony-kb` 把 dsh 的工作区直接当知识库用，基于 ops 的 `list_dir` 目录枚举能力，五类玩法：

1. **分层检索问答**：先查 `笔记/kb-index.md` 命中候选 → 只精读命中文件的相关段落作答；索引缺失时自动枚举目录生成。
2. **深度研究**：发「研究<主题>」走网页检索 + 委派 Pro 子代理提炼，产出 `研究/YYYY-MM-DD-<主题>.md`。
3. **文档整理**：对工作区文档批量去重、归档、出清单。
4. **思维脑图**：默认输出 Markdown 树状大纲，说「导入万兴脑图」时另生成 `.mm` 文件到 `笔记/`。
5. **Obsidian 双链笔记**：按指令（如「总结这段并推送到 Obsidian」）把总结写成 md 落到 Obsidian vault（主目录 `obsidian/` 下含 `.obsidian` 的目录，本机如 `~/obsidian/Monash University/`），用 `[[文件名]]` 双链只挂 `kb-index.md` 里已有的笔记——Obsidian 侧载版自动显示，反链与图谱自动生成。

> ⚠ **注意**：本模式频繁委派 Pro 子代理 + 多工具调用，CPU 负载较高，运行中电脑风扇会明显变响，建议空闲时段使用。

### 2.7 安装鸿蒙开发大师依赖（`harmony-deveco` 需要）

`harmony-deveco` 的 dev_* 工具由 dsh 之外的**自定义插件** `@deepseek-ai/dsh-deveco-bridge`（hvigor/ohpm/hdc 驱动 + dev_code 委托，纯 JS，node:child_process，无原生依赖）提供。它不在 dsh 基础安装里，需手动放两份（源码 + profile 层软链，缺一不可，同 2.5 的 dsh-tool-list）：

```bash
# ① 源码进 dsh 基础 node_modules（预设按裸包名解析到此层）
cp -r plugins/@deepseek-ai/dsh-deveco-bridge ~/dsh-test/node_modules/@deepseek-ai/
# ② 软链进 profile 层依赖树
ln -s ~/dsh-test/node_modules/@deepseek-ai/dsh-deveco-bridge ~/.dsh/profiles/node_modules/@deepseek-ai/
```

预设已内建 `- id: deveco-bridge` 挂载行，dev_* 工具随 `harmony-deveco` 预设自动可用；若想在其他预设里也用上 dev_*，在 profile 补丁 `cordis.patch.yml` 加一段 insert：

```yaml
- insert:
    - id: deveco-bridge
      name: '@deepseek-ai/dsh-deveco-bridge'
```

> **工具路径**：插件默认到 `$HOME/deveco/deveco_tools/` 找 node/hvigor/sdk/ohpm（DevEco Studio 默认安装位置）；自定义安装用 `DEVECO_TOOLS_HOME` 整体指路，或 `DEVECO_NODE_HOME` / `DEVECO_HVIGOR_HOME` / `DEVECO_SDK_HOME` / `DEVECO_OHPM_BIN` / `DEVECO_HDC_BIN` 逐项覆盖。
>
> **`dev_code` 委托**：把自包含深子任务交给本机 DevEco Code 代理（OpenCode web，127.0.0.1:4096）跑独立 agent 循环。用前需先启动 DevEco Code 并配好 DeepSeek（`~/.deveco/deveco.jsonc`），地址可用 `DEVECO_WEB_BASE` 覆盖。每次委托约 13K 输入 token、串行执行，只对深子任务用（功耗纪律见预设人设）。

### 2.8 安装全局防注入（可选但推荐）

仓库内置 `plugins/dsh-prompt-antivirus/`（原理移植自 `openclaw-prompt-antivirus`，按 dsh 钩子面接线）：

| 防线 | dsh 钩子 | 行为 |
| --- | --- | --- |
| 工具参数扫描（直接注入） | `tools/pre-execute` | 高危 → 拒绝；高危 + 危险工具（`send_email` / `apply_patch` / `delete_*` 等）→ 人工审批 |
| 工具结果扫描（间接注入） | `tools/post-execute` | `block` 转 isError / `quarantine` 替换命中片段 |
| 进入模型前的消息扫描 | `agent/pre-step` | 高危消息进入前隔离；每会话注入一次金丝雀守卫 |
| 出站消毒 / 金丝雀检测 | `llm/stream` | 金丝雀命中 → block 模式中断输出；出站注入片段 → 替换 |

安装（幂等，重复执行安全；装完重启 dsh 生效）：

```bash
cd ~/dsh-harmonyos-pc && node scripts/dsh-prompt-antivirus-install.mjs
sh scripts/dsh-web.sh
```

已内置 `dsh-hm-update.mjs` 自动部署：以后 `node scripts/dsh-hm-update.mjs` 更新时会自动把 `plugins/` 下的 profile 级插件同步到 web + headless profile。模式可在插件源码 `lib/index.js` 的 `DEFAULT_CONFIG` 调整（`quarantine` 默认 / `block` / `monitor`），`_antivirus_scan` / `_antivirus_status` 两个诊断工具随会话可用。

### 3. 启动 dsh（带鸿蒙补丁）

```bash
sh scripts/dsh-web.sh
# 等价手启动：
# cd ~/dsh-test && node --expose-internals node_modules/@deepseek-ai/dsh/lib/bin.js \
#   --profile web --patch <本仓库>/harmony.patch.yml
```

启动后浏览器访问 `http://127.0.0.1:3080`。

> **必须 `--expose-internals`**，否则 `cordis-plugin-hmr` 报错；必须带 `--patch harmony.patch.yml`，否则原生插件崩溃。`dsh-web.sh` 默认自动定位仓库内的补丁文件，也可用 `PATCH_YML` 覆盖。

### 3.5 headless 模式（无人值守/基准测试）

headless 树比 web 多出 bash/pwsh/fs-search 等原生依赖插件行，需要第二个补丁：

```bash
cd ~/dsh-test && node --expose-internals node_modules/@deepseek-ai/dsh/lib/bin.js \
  --profile headless --patch <本仓库>/harmony-headless.patch.yml "任务描述"
```

> ⚠ `fs-sandbox` 是纯 JS 的 fs 服务提供方，**不能禁**（`tool-fs` 靠它）。headless 补丁只禁原生依赖插件行。

### 3.6 一键更新（推荐）

我们每次迭代后会推送到 GitHub。想要同步到最新版，在仓库目录跑一行即可（自动处理官方 dsh 升级 + 预设/插件/补丁同步，最后自动重启服务）：

```bash
sh scripts/dsh-hm-update.sh          # 一键更新并重启
sh scripts/dsh-hm-update.sh check    # 只看状态不更新
```

它做的事：
1. **官方 dsh**：`npm view @deepseek-ai/dsh` 比对已装版本，有新版本就升级并重打鸿蒙 node_modules 补丁
2. **本仓库**：以 `github.com/QinpanWan/dsh-harmonyos-pc` main 分支的 commit SHA 判定版本（写入 `~/.dsh/.dsh-harmonyos.version`），有更新就从 codeload 下载 tarball，同步 `presets/`、`plugins/`、`scripts/`、`harmony*.patch.yml` 到本机仓库副本，并重新部署预设与 `plugins/@deepseek-ai/` 下的全部插件（如 `dsh-tool-list`、`dsh-deveco-bridge`）
3. **重启** dsh web，新预设即时生效

更新会先把旧预设备份到 `~/.dsh/.dsh-harmonyos-backup/`，**不动** `~/.dsh/settings.yaml`、凭据与你的个性化配置。

### 3.7 关机重启后：恢复启动

鸿蒙没有 `systemd` / `cron` / `XDG autostart` 开机自启服务。重启后按下面任一方式把 dsh 拉起来：

**① 仓库脚本（推荐，幂等探活 3080）**

```bash
sh scripts/dsh-web.sh        # 已在跑则跳过；未跑则拉起并等健康检查
```

等价手启动（不依赖脚本）：

```bash
cd ~/dsh-test && node --expose-internals node_modules/@deepseek-ai/dsh/lib/bin.js \
  --profile web --patch <本仓库>/harmony.patch.yml
```

启动后浏览器访问 `http://127.0.0.1:3080`。

**② headless（无人值守/基准测试）**

```bash
cd ~/dsh-test && node --expose-internals node_modules/@deepseek-ai/dsh/lib/bin.js \
  --profile headless --patch <本仓库>/harmony-headless.patch.yml "任务描述"
```

**③ 开机自动恢复（可选）**：鸿蒙设置里把「终端」App 设为开机自启，再在 shell 启动配置（如 `~/.zshrc`）加一段探活钩子，每次打开终端自动拉起服务：

```bash
for _svc in dsh-web; do sh "$HOME/bin/$_svc.sh" >/dev/null 2>&1 & done
```

`dsh-web.sh` 幂等：已在跑就跳过，未跑才拉起，重启系统后无需手动干预。原理见下文「限制」一节。

### 4. 打 node_modules 补丁（升级/重装后需重打）

```bash
node scripts/dsh-update.mjs patch
```

按内容锚点幂等重打九个补丁（新版本改代码也能识别），不打这九处：
- 配不了模型 API key（凭据 660 权限检查）
- 发消息 `EPERM link`（session 持久化）
- 对话框没有权限预设下拉（permission-presets 需改读 fs 沙箱的 `sandboxMode`）
- 读图存不下来（attachment-local：`link` 失败改 `copy` 发布 + 挂载点 fsync 容错）
- 工作区新文件写入 `EPERM link`（dsh-fs-local：`createIfAbsent` 时 link 失败改按 `rename` 发布）
- 视觉识别报「模型未配置」/自定义 prompt 返回空文本（dsh-visual-plugin 回退到主视觉模型 + 空 content 重试降级）
- 裸插件名从 `dsh-test` 解析不到（cordis-plugin-loader 需补 `v0` legacy 内部 loader 识别，鸿蒙 node v22.7.0 无 `getOrCreateModuleJob`/`getModuleJobForImport`）
- `dsh-settings` 缺 `installSettingsSection`/`settingsNamespace` 旧导出（恢复导出并委托给 `SettingsProvider.installSection`，兼容沿用旧 API 的社区插件）
- 浏览器/收藏夹裸地址 `127.0.0.1:3080` 永远 401「authentication required」（dsh-client-connection 回环地址免 token 自动签发 30 天 cookie，旧 token URL 也兜底换新）

---

## 性能实测：五套预设「六边形」跑分（2026-08-18）

跑分引擎 = **六边形能力雷达**（数学/代码/逻辑/事实/规划/自我修正 6 轴 × 2 题 = 12 道全自动判分，走 opencode-go API 免费 cost:0）+ **性能表**（DeepSeek 直连 API 同前缀连发 4 次测第 4 次稳态缓存命中率，前缀缓存按 128-token 块计费）+ **交付质量表**（3 道流程题按交付步骤标记命中打分，测 persona 交付纪律贯彻度）。

### 六边形能力雷达

| 预设 | 数学 | 代码 | 逻辑 | 事实 | 规划 | 自我修正 | 综合 |
|---|---|---|---|---|---|---|---|
| `harmony-chat` | 100 | 100 | 100 | 100 | 100 | 100 | **100** |
| `harmony-chat-pro` | 100 | 100 | 100 | 100 | 100 | 100 | **100** |
| `harmony-chat-promax` | 100 | 100 | 100 | 100 | 100 | 100 | **100** |
| `harmony-chat-ops` | 100 | 100 | 100 | 100 | 100 | 100 | **100** |
| `harmony-chat-rampagemax` | 100 | 100 | 100 | 100 | 100 | 100 | **100** |

能力地板一致且满分——五套共享同一模型，跑分比拼的是**性能与交付纪律**，不是能力。

### 性能表（before → after：给 persona 填充静态指令越过 128-token 块边界后）

| 预设 | 前缀 token | 缓存命中率 | 输出效率（中位 tok/正确题） | 平均耗时 |
|---|---|---|---|---|
| `harmony-chat` | 273 | 52.9% → **93.8%** | 70 | 130s |
| `harmony-chat-pro` | 406 | 71.3% → **94.6%** | 73 | 98s |
| `harmony-chat-promax` | 794 | 87.2% → **96.7%** | 104 | **71s** |
| `harmony-chat-ops` | 523 | 97.9% → 97.9% | 155 | 99s |
| `harmony-chat-rampagemax` | 914 | 89.9% → **98.0%** | 125 | 142s |

### 交付质量（交付规范贯彻度）

| 预设 | 集成闭环 W1 | 验证先于完成 W2 | 复盘收尾 W3 | 综合 |
|---|---|---|---|---|
| `harmony-chat` | 75 | 75 | 67 | **72** |
| `harmony-chat-pro` | 25 | 50 | 67 | **47** |
| `harmony-chat-promax` | **100** | **100** | 67 | **89** |
| `harmony-chat-ops` | 25 | 50 | 33 | **36** |
| `harmony-chat-rampagemax` | **100** | 75 | **100** | **92** |

**结论**

- **ProMax = 六边形战士**：能力六轴全满分，性能拉满——缓存 96.7% 进第一梯队、输出效率 104 tok（全功能预设最省）、平均耗时 71s 全场最快，交付规范 89 仅次于狂暴。**性能与交付纪律兼得**。
- **狂暴 Max = 交付质量天花板**：交付规范 **92 全场最高**，集成闭环 100 + 复盘收尾 100（唯一满分）——验证/复盘/闭环贯彻最彻底；缓存 98.0% 全场最高，但效率 125 tok、耗时 142s 最长，「不省 token 只讲质量」的设计本意。
- **极简 harmony-chat 最省输出**：效率 70 tok 全场最低，但无交付纪律条款，交付 72；pro 效率 73 次省，交付纪律弱（47）。
- **缓存优化立竿见影**：填充静态 persona 指令使前缀越过 128-token 块边界（余数 ≤15），命中率从 52.9-89.9% 拉到 93.8-98.0%——缓存命中输入比未命中便宜约 **30 倍**，前缀稳定性是最大杠杆。
- 运行上下文预设（harmony-chat / rampagemax）真实会话前缀随快照变化，此处为理想静态基线，实际命中率略低。

原始数据 `bench/result.json`、报告 `bench/result.md`，跑分脚本 `bench/bench.mjs` 可复现。

---

## 鸿蒙桌面客户端（ArkTS UI，`client/`）

把 dsh 做成**鸿蒙电脑（2in1）桌面客户端**：基于 HarmonyOS NEXT ArkTS/ArkUI 声明式开发范式编写，严格参照华为开发者文档（Stage 模型、@Entry/@Component/@State/@Link/@ObjectLink、List/ForEach、bindSheet、@kit.NetworkKit、@kit.ArkData）。

### 界面

- 左侧栏：品牌区、新建会话、会话列表（运行指示、选中高亮）、连接状态 + 设置入口
- 聊天主区：顶部栏（会话标题 / 停止生成）、消息列表（用户气泡、助手富文本、代码块、工具卡片、流式光标）、底部输入栏（回车发送）
- 设置面板（bindSheet 半模态）：配置 dsh 服务地址（默认 `http://127.0.0.1:3080`），持久化到 preferences

### 通信（与 dsh 官方 Web 前端同协议）

| 用途 | 端点 | 说明 |
|---|---|---|
| 单次 RPC | `POST /api/session.list` 等 | body 为 `client-request` 信封，响应 `server-response` |
| 事件流 | `GET /api/events.mux` | SSE（`data:` 行 + `\n\n` 分帧），推送 `session/event` 等帧 |
| 应答 | `POST /api/respond` | 客户端回执 |

流式输出：`@ohos.net.http` 的 `on('dataReceive')` 事件接收 SSE 分块 → `assistant/chunk` 的 `text-delta` 逐字更新消息（`@Observed` + `@ObjectLink` 增量刷新）。

### 构建

```bash
cd client
ohpm install
node hvigorw.js assembleHap
# 产物：client/entry/build/default/outputs/default/entry-default-unsigned.hap
```

可用 DevEco Studio 打开 `client/` 直接运行/签名/部署到鸿蒙电脑（2in1）。

---

## 工具链

| 脚本 | 作用 |
|---|---|
| `scripts/dsh-web.sh` | dsh Web 服务启动/重启（3080，幂等探活） |
| `scripts/dsh-update.mjs` | dsh 检查更新：`check` / `patch` / `install` / `rollback`，升级后自动重打补丁 |
| `scripts/dsh-manual-install.mjs` | 手动直装器：registry 元数据递归解析 + tarball 直装（绕过 npm arborist 解析卡死），`install()`/`rollback()` 自动调用、npm 兜底 |
| `scripts/dsh-update-web.sh` | 设置与更新页（3098，内嵌 HTML） |
| `scripts/dsh-hm-install.mjs` | GitHub 源插件一键安装（绕过 isogit 拦截） |
| `scripts/dsh-hm-update.sh` | **一键更新**（官方 dsh 升级 + 仓库预设/插件/补丁同步，`check` / 默认 update） |

所有脚本支持 `NODE_BIN` 环境变量覆盖 node 路径（鸿蒙默认 `/data/service/hnp/node.org/node_v24.13.0/bin/node`）。

---

## 鸿蒙适配细节

### 安装器做了什么（`dsh-hm-install.mjs`）

market 里点 GitHub 源插件时（`process.platform === 'openharmony'` 分支拦截）：
1. `fetch` 源码 `tar.gz`，递归扫描带 dsh 清单的插件目录
2. 有预编译产物直接装；没有则**就地尝试构建**（`--ignore-scripts` 兜底原生 postinstall）
3. 剥掉缺失的 `dsh.client` 前端产物（防 `MissingClientBundleError` 炸启动），装成仅服务端
4. 软链进 `~/.dsh/profiles/web` 依赖树，写 manifest，重启生效

> ⚠ **link 插件必须在 `~/.dsh` 树内**：`plugins-src/<name>` 放源码，`package.json` 写 `link:/storage/Users/currentUser/.dsh/profiles/web/plugins-src/<name>`，否则解析不到 `@deepseek-ai/*` 软链。

### 能装的插件范围

只选 **纯 JS / `node:sqlite`** 依赖的插件。原生依赖（koffi/pty/esbuild/WASM 运行时）在鸿蒙跑不了。

---

## 限制

- 无 `systemd` / `cron` / `XDG autostart`，鸿蒙没有开机自启系统服务。自启需在鸿蒙设置里把「终端」App 设为开机自启 + shell 探活钩子拉服务
- `bash`/终端执行与沙箱已禁用，Agent 无法真正跑 shell 命令，只能通过文件编辑 / 网页检索 / Skills / 计划 / 委派工作
- 无法切回 `standard` / `code` / `minimal` 官方 preset（它们依赖被禁用的原生能力，会报 `agent-preset-invalid`）
- 纯 UI 的 client 插件会变成空壳；WASM 运行时依赖只在调用时崩

---

## 许可证与致谢

MIT License，见 [LICENSE](LICENSE)。

本项目不包含 dsh 源码，只含独立编写的配置、补丁脚本与文档。dsh 本身由 [DeepSeek](https://github.com/deepseek-ai/dsh) 以 MIT 许可发布，本仓库对其的引用与补丁使用遵循 MIT 条款，特此致谢。

---

## 更新记录

### 2026-09-03 — 跟进官方 0.1.2-rc.1（9 处补丁锚点全命中 + 2 个自更新器兼容修复）

dsh 官方更新至 `0.1.2-rc.1`（2026-09-03 发布），本机 dsh-test 已升级并验证 web 可启动。九个 node_modules 补丁的内容锚点在 rc.1 全部命中，重打后 3080 正常：

- **`ensureCompatDeps()` 弃用 npm、改直装**：0.1.2-rc.1 闭包不再含 `fzstd`/`zstd-codec`（compat-loader 依赖）。此前用 `npm install` 补齐会触发 npm arborist 按 `~/dsh-test/package.json` 里过期的 `^0.1.1-rc.2` 重解析整棵树，把刚装好的 `0.1.2-rc.1` **降级回 `0.1.1-rc.2`** 并冲掉全部补丁（本次实测复现）。改为 registry 直装该两包自身（fetch manifest + tarball + tar 解压），零副作用；并新增 `syncPackageJson()`，升级/回滚后把 dsh 版本固化进 `~/dsh-test/package.json`，防止后续任何 npm 操作再降级。
- **`dsh-web.sh` 升级为鸿蒙可用版 + 孤儿锁清理**：仓库内 `scripts/dsh-web.sh` 此前仍是 v24 node 旧版（鸿蒙上 V8 code-range 崩 `ENOMEM`），也没有 compat-loader / 插件市场本地镜像 / 正确的补丁定位。现同步为本机可用逻辑：默认用 deveco 自带 node v22 + `--experimental-loader compat-loader.mjs` + `--patch harmony.patch.yml` + 市场 3988 本地镜像，`NODE_BIN/DSH_DIR/PATCH_YML/PORT/LOG` 可用环境变量覆盖。新增 `clear_stale_locks()`：dsh 的 atomic-write 从不回收孤儿锁，SIGKILL/崩溃退出会留下 `~/.dsh/profiles/node_modules.lock`，下次启动即「timed out waiting for the writer lock」（本次实测）；启动前清一次，避免该死锁。
- 验证：`@deepseek-ai/dsh` 0.1.2-rc.1（闭包 549 包），`node scripts/dsh-update.mjs patch` 全绿（credential/session/permission/attachment/cordisLoader/settingsCompat/loopbackAuth/fsLocal 重打、vision 幂等），3080 带 token 303 正常，codex-bridge / deveco-bridge / cron / peak-valley / evoresearch / cost-meter 均加载。`bridge-browser` 维持禁用（rc.1 `dsh-api-remotes` 仍未恢复 `ApiRemoteSessionNotFound`）。

### 2026-09-01 — 跟进官方 0.1.2-alpha.3（fs-local 补丁 + 自更新器修复）

dsh 官方更新至 `0.1.2-alpha.3`（2026-08-31 发布），本机 dsh-test 已同步升级并验证 web 可启动：

- **`dsh-fs-local` 补丁纳入 `patchAll`（新增 `patchFsLocal()`）**：工作区新文件写入（`createIfAbsent`）在鸿蒙 `/storage` 对 `link()` 报 `EPERM`，且目标不存在也失败；此前该补丁不在自更新器里，每次升级重装都被冲掉、需手工重打。现按其它补丁同样的「内容锚点 + 幂等标记」纳入，升级/重装后自动重打。官方 `dsh-fs-local@0.1.2-alpha.3`（alpha.2→alpha.3 逐字节相同）均未含该兜底，已下载 tarball 比对确认。
- **修复 `dsh-update.mjs` 的 `isUp()` 误判**：token 认证下根路径无 cookie 返回 303 跳转，`fetch()` 跟随跳转却不跨跳保留 cookie，最终仍 3xx，被误判为「未起来」导致 `install` 报错退出（实际升级已成功、服务在跑）。改为 `redirect:'manual'` 并把 2xx–3xx 都视为 up，`dsh-web.sh` 的 `is_up`（curl 任意响应）继续兜底。
- 验证：`install` 成功后 `@deepseek-ai/dsh` 版本为 `0.1.2-alpha.3`，`fsLocal=重打`、其余补丁幂等；`node scripts/dsh-update.mjs patch` 全绿；3080 `/` 带 cookie 到 200，`codex-bridge` / `deveco-bridge` / `cron` / `peak-valley` / `cost-meter` / `evoresearch` 均加载。

### 2026-08-31 — 新增 harmony-chat-monash 鸿蒙对话 Monash 学生版预设

第八套「鸿蒙对话模式」预设（order 8），以 `harmony-chat-promax` 为骨架（`includeRuntimeContext:false` 关闭动态运行上下文，系统提示段全静态、DeepSeek 前缀缓存命中率高；工具集与 ProMax 完全相同：fs / 网页检索 / 委派 / 计划 / 工作流，纯 JS 无原生依赖），persona 领域化为 Monash University 学生学习场景：

- **文献解读**：一句话总结与研究问题 → 背景 → 方法 → 结果 → 讨论 → 局限 → 与作业的关联；解释关键术语与统计方法（t 检验、回归、效应量等），可直接引用并给引用格式（默认 APA 7th，法律类 AGLC4）
- **论文查重与学术诚信**：不替代 Turnitin——引导经 Moodle 上传草稿看 Similarity Report，区分合理引用与需要改写的重复文本并给改写策略；红线：代写、购买论文、未声明使用 AI、自我抄袭均违反 Student Academic Integrity Procedure
- **作业辅助**：任务动词拆题 + rubric 对照 → 搭论证结构 → 列要点 → 审草稿逐段给改进意见；不代写整篇、不编造参考文献
- **内置知识库**：Clayton / Caulfield / Docklands（Monash College）三校区学生服务与图书馆、全校服务（Student Academic Success / English Connect / 咨询 03 9905 3020 / Safer Community / eSolutions / Career Connect，入口 moodle.monash.edu · my.monash.edu · WES）；墨尔本交通（免费 Intercampus Shuttle、Huntingdale / Caulfield / Southern Cross 乘车指引、myki concession / ISTP / Monash Commuter Club 折扣，班次以 PTV Journey Planner 为准）

### 2026-08-31 — 全局防注入 dsh-prompt-antivirus（防「上下文病毒」）

把 `openclaw-prompt-antivirus`（提示注入 / mind-virus 运行时防御）的原理移植到 dsh，做成 profile 层全局插件：

- **四道钩子防线**：`tools/pre-execute` 扫工具参数（高危拒绝、危险工具走人工审批）、`tools/post-execute` 扫工具结果（间接注入藏身处，block/quarantine）、`agent/pre-step` 扫进入模型前的消息（`[CRON TASK]` / `[SCHEDULE REMINDER]` / 网页检索 / 文件内容夹带的恶意指令在进入模型前被隔离）+ 每会话一次金丝雀守卫、`llm/stream` 出站消毒与金丝雀命中检测（block 模式中断输出）。
- **三模式**：`quarantine`（默认，可原地改写的路径替换命中片段）/ `block`（更严格 + 金丝雀中断）/ `monitor`（只审计）。
- **工具与审计**：`_antivirus_scan` / `_antivirus_status` 随会话可用；审计写 `~/.dsh/task-board/prompt-antivirus-audit.jsonl`（环形 500 条 + 文件上限 2MB，失败静默）。
- **接入**：`plugins/dsh-prompt-antivirus/` 随仓库分发；`scripts/dsh-prompt-antivirus-install.mjs` 一键装到 web + headless profile（源码 → plugins-src + 软链 + 清单注册，幂等）；`dsh-hm-update.mjs` 自动部署 `plugins/` 下全部 profile 级插件。
- **验证**：32 项单测 + harness 全绿（签名库全类别/严重级、中文无害文本不误报、三模式决策、pre-step 金丝雀单次注入、stream 金丝雀中断/移除）。

### 2026-08-31 — 跟进官方 0.1.2-alpha.2（3 处鸿蒙补丁）

dsh 官方更新至 `0.1.2-alpha.2`（2026-08-30 发布），本地 dsh-test 已同步升级并验证 web 可启动。alpha.2 重构了插件解析与设置接口，鸿蒙补丁需对应补齐：

- **`cordis-plugin-loader` 内部 ESM loader 识别**：官方 `ModuleLoader.fromInternal()` 只识别 `getOrCreateModuleJob`(v2) / `getModuleJobForImport`(v1) 两种 loader 形状；鸿蒙自带 node v22.7.0 的内部 loader 两个方法都没有，判定 shape 未知 → `loader.internal = undefined` → 裸插件名退化为从 `dsh-test/node_modules` 解析，profile 里另装的社区插件全线 `Cannot find package`，dsh 直接起不来。补 `v0`（有 `import` 即 legacy loader）分类后恢复从 profile 目录解析。
- **`dsh-settings` 旧导出兼容垫片**：alpha.2 把 `installSettingsSection` / `settingsNamespace` 从 `@deepseek-ai/dsh-settings` 移除，迁入 `SettingsProvider.installSection`。社区插件 `dsh-harmonyos-market` / `dshmarket` / `dsh-visual-plugin` / `dsh-knowledge-base` / `dsh-workstation` / `dsh-hiboard-push` 仍按旧 API 导入 → 重新导出这两个符号并委托给新 `installSection`，插件无需改码即可运行。
- **`harmony.patch.yml` 禁用 `bridge-browser`**：该浏览器桥依赖的 `@deepseek-ai/dsh-api-remotes` 旧 API（`ApiRemoteSessionNotFound`）被官方整体重设计移除，无法低成本垫片，暂禁浏览器桥；上游适配新 API 后重新启用。
- 验证：dsh web 在 3080 正常返回 token 认证 303/前端可访问，`codex-bridge` / `deveco-bridge`(6 工具) / `cron` / `peak-valley` / `cost-meter` / `evoresearch` 均加载。

### 2026-08-30 — harmony-chat-ops 内置 cron 定时任务

**`harmony-chat-ops` 常驻后台任务管家升级为完整定时任务**：

- **标准 cron 定时**：新增 `cron_create`（标准 5 段 cron 表达式「分 时 日 月 星期」，支持 `@daily/@weekly/@monthly/@hourly` 快捷方式与 `JAN..DEC`/`SUN..SAT` 名称，日与星期同时受限按任一匹配）+ `cron_next`（创建前校验表达式是否符合用户意图）+ 管理工具 `cron_list` / `cron_set_enabled` / `cron_delete`；时区默认 `Asia/Shanghai`，可传 `time_zone` 覆盖。
- **`[CRON TASK]` 触发语义**：到期投递的是不可信任务文本（非新指令），agent 空闲时按任务要求执行并归档到 `~/dsh-kb/`；任务绑定创建会话，在线准时触发、离线标记 `overdue`，恢复后只补最新一次、不回放积压。
- **向后兼容**：旧 `schedule_create / schedule_list / schedule_delete`（after/at/every）仍可用。

### 2026-08-28 — 兼容依赖防剪（fzstd/zstd-codec）+ 仓库更名同步

官方 `0.1.1-rc.2` 重装验证中发现：`scripts/dsh-update.mjs` 用 npm 重装核心包时，会把不在依赖树里的 `fzstd`/`zstd-codec` 剪掉——它们是 `~/dsh-test/compat-loader.mjs`（node v22 鸿蒙运行时 polyfill）的依赖，剪掉后 dsh 启动即崩（`Cannot find module 'fzstd'`）、客户端显示 54 插件 pending。

- **`scripts/dsh-update.mjs` 新增 `ensureCompatDeps()`**：`install` / `rollback` 装完核心包后自动校验，缺失即补齐 `fzstd`、`zstd-codec` 并写入 `~/dsh-test/package.json` 固化，后续官方更新不再踩。仅当本机存在 `compat-loader.mjs` 时生效，其余用户零影响。
- **仓库更名同步**：`Entity-Him/dsh-harmonyos-pc` → `QinpanWan/dsh-harmonyos-pc`，已更新 `dsh-hm-update.mjs` 的 OWNER、README 与安装教程中的仓库地址（旧地址 GitHub 自动 301 跳转，兼容期仍可用）。
- 鸿蒙补丁本体（`harmony.patch.yml` / `harmony-headless.patch.yml`）与五个 node_modules 补丁锚点对照 `0.1.1-rc.2` 均无需改动。

### 2026-08-24 — 跟进官方 0.1.1-rc.2（鸿蒙补丁零变化）

dsh 官方更新至 `0.1.1-rc.2`（2026-08-21 发布），本地 dsh-test 已同步升级并验证：

- 升级：`dsh-manual-install.mjs 0.1.1-rc.2`，闭包 472 包（覆盖 3 / 保留基线 408 / 平台跳过 61），依赖树仅新增 `@types/retry`、`@types/node`
- 五个鸿蒙源码补丁（credentials / session / permission / attachment / vision）锚点全部命中，无需改动
- `harmony.patch.yml` 照常生效：web 启动正常、3080 HTTP 200，插件全加载（codex-bridge / deveco-bridge 6 工具 / peak-valley / evoresearch / cost-meter）
- 历史崩溃点复查：`dsh-workflow-worker-thread` 依赖的 `@deepseek-ai/dsh-workflow` 基线完整，无预设挂载错误

### 2026-08-24 — 平板端本地 Agent 方案出炉（dsh-pad v1.0.0）

华为鸿蒙**平板端（tablet / 2in1）** dsh 客户端首个构建（bundle `com.dsh.harmonyos.pad`，Release 资产 `entry-default-unsigned.hap`）：

- **本地 Agent 循环**：`LocalAgent.ets` 设备端完整 agent 循环，不依赖云端调度
- **工具注册**：`ToolRegistry.ets` 本地工具注册与调度
- **双通道**：`DeepSeekClient.ets` 直连 DeepSeek + `DshApiClient.ets` 走 dsh 宿主 API，可切换
- **会话存储**：`SessionStore.ets` 本地持久化
- 当前为 debug 未签名构建，安装需先开发签名（hap_installer / hdc）

### 2026-08-22 — 修好读图与视觉识别（attachment-local + dsh-visual-plugin 补丁）

本机实测「把图片拖进 DeepSeek Harness → 模型看见并描述」之前断在两级：图片存不下来、视觉端点未配置。

- **`[补丁] dsh-attachment-local`**：鸿蒙存储对 `link()` 报 `EPERM`（Android/HarmonyOS 不支持硬链接），图片附件同一目录内发布失败 → 读图记录 `Unable to persist image attachment`。补丁让 `link` 失败改走 `copyFile(..., COPYFILE_EXCL)` 发布（`EEXIST` 竞态照旧走 sha256 完整性校验）；`syncDirectory` 对无法以只读句柄打开（EPERM/EACCES/ENOTSUP）的挂载点跳过该次 fsync。修好「read_image 能读到并持久化」。
- **`[补丁] dsh-visual-plugin`**：① 视觉面板未配置时 `resolvedFacts()` 回退到主 DeepSeek 视觉模型——复用 `llm-deepseek`（provider）段的 `baseURL` + `DEEPSEEK_API_KEY` 与 `deepseek-v4-flash-vision-exp`，消除「`vision model is not configured`」；② `describeImage` 对自定义 prompt 时模型返回的空 `content`（PROTOCOL）重试一次，仍空则降级为「模型未返回内容」明确提示而非硬抛。修好「带针对性的 prompt 也能稳定返回视觉描述」。
- **配套**：`settings.yaml` 在 `llm-deepseek` 后新增 `vision-bridge` 段（url=DeepSeek、model=deepseek-v4-flash-vision-exp、apiKeyEnv=DEEPSEEK_API_KEY），与代码层回退双保险且支持热重载。
- **`scripts/dsh-update.mjs`**：新增 `patchAttachment()` / `patchVision()`（幂等、内容锚点匹配、带 `HarmonyOS patch` 标记），并入 `patchAll()` 五连校验——升级/重装后自动重打，读图不再丢、视觉不再报未配置。

### 2026-08-20 — 新增鸿蒙开发大师预设（harmony-deveco）+ dev_code 委托 DevEco Code

**第七套对话模式 `harmony-deveco`**（order 7，预设计数六套→七套），把 dsh 变成鸿蒙 DevEco 全链路开发 Agent：

- **dev_* 工具链**：通过 dsh-deveco-bridge 直接驱动 hvigor/ohpm/hdc（纯 JS，node:child_process，无原生依赖），打通「写 ArkTS → 编译 → 装真机 → 启动」完整闭环，含 release 签名打包指引
- **`dev_code` 委托本机 DevEco Code 代理**：deveco-bridge 新增第 6 个工具 `dev_code`——把自包含深子任务经 HTTP 委托给本机 DevEco Code（OpenCode web，127.0.0.1:4096）跑独立 agent 循环，一次一个（串行，`isConcurrencySafe:false`），model 默认 `deepseek-v4-pro`；task 必须自包含（子代理无本会话记忆）；返回带 cost/tokens 元信息供复盘
- **麒麟 X90 软硬件协同功耗纪律**：本机 4 核 AArch64 + 32GB，多 agent 并行是最吃功耗的行为——任何时刻最多一个委托型 agent（subagent / dev_code 二选一）在跑，工具按依赖串行推进，把「深度」集中到少数真正需要的步骤（dev_code / pro 子代理），快而不燥
- **实测闭环**：dsh 重启后 `deveco-bridge` 注册 6 工具（含 dev_code）；dev_code 端到端委托实测 4.2s / 13528 tok / ¥0.0002 返回正确回答；仓库预设与本地 `~/.dsh/.agent-presets/harmony-deveco/` 一致

### 2026-08-20 — 跟进官方 0.1.0-rc.8

dsh 官方更新至 `0.1.0-rc.8`（2026-08-19 发布），本仓库移植版已同步。升级要点：

- **`dsh-update.mjs getLatest()` 修复 dist-tags 探测**：官方 `dist-tags.latest` 停在 rc.7，但 `0.1.0-rc.8` 已发布，导致 `npm view version` 误判「已是最新」。现改为遍历 `versions` 取数值最高版本（`rc.N` 与稳定版均按数字比较），`check` 实测 `installed = latest = 0.1.0-rc.8`。
- **新增 `scripts/dsh-manual-install.mjs` 手动直装器**：npm arborist 在鸿蒙本机的依赖解析阶段会静默卡死（无输出、CPU 低、拖到超时，3 次实测均复现）。直装器改从 registry 元数据**递归解析完整依赖图 + tarball 直装**，对已装且满足 spec 的包保留基线、optional 依赖按 `os/cpu` 平台门控，实测 470 包闭包零缺口。已接入 `dsh-update.mjs` 的 `install()` / `rollback()`（npm 作兜底）。
- **rc.8 依赖树变化**：54 个 `@deepseek-ai/dsh-*` 从 `^0.1.0-rc.7` 升到 `^0.1.0-rc.8`（含官方「多轮推理回传 reasoning_content」「SQLite 持久化布局优化」「Agent Teams 目录更名」「构建产物 slot 化」「pwsh 常驻 pty」等改动），并新增 `@deepseek-ai/dsh-tool-pwsh-persistent`。
- **三个鸿蒙补丁在 rc.8 锚点全部命中**：credentials（chmod 600 跳过）、session（link→rename + `rename` import，官方 SQLite 改动未波及 JSONL 持久化文件）、permission（`ctx.shell.sandboxMode`→`ctx.fs.sandboxMode`）。
- **实测闭环**：npm 直装 rc.8 → 重打补丁 → 重启 dsh → 3080 HTTP 200 → 插件正常加载（deveco-bridge 5 工具 / evoresearch / dsh-cost-meter）→ 七套鸿蒙预设 `agentPreset.list` 全部 `broken: 无`。

### 2026-08-20 — 鸿蒙桌面客户端（ArkTS UI）+ 鸿蒙底层适配

新增 `client/` 目录：基于 HarmonyOS NEXT ArkTS/ArkUI 声明式开发范式的 dsh 鸿蒙电脑（2in1）桌面客户端，hvigor 构建通过，产物 `client/entry/build/default/outputs/default/entry-default-unsigned.hap`。

**与 dsh 官方 Web 前端同协议对接**（`POST /api/*` RPC 信封 + `GET /api/events.mux` SSE 流式推送），并完成鸿蒙底层适配：

- **SSE 断线自动重连**：`@ohos.net.http` 流式接收，断线指数退避重连（2s→30s）——dsh 服务被 `dsh-update`/`dsh-web.sh` 重启后客户端自动恢复
- **六套鸿蒙对话模式预设接入**：设置面板可下拉选择 `harmony-chat(-pro/-promax/-ops/-rampagemax)/harmony-kb`（`agentPreset.list`），新建会话自动带上所选预设
- **服务启动引导**：设置面板内置 `sh ~/bin/dsh-web.sh`（node 全路径 + harmony.patch.yml + 3080）提示
- **桌面窗口适配**：1200×800 默认尺寸、2in1 形态、深色品牌主题（DeepSeek 蓝）

### 2026-08-19 — 新增鸿蒙知识库专家预设（harmony-kb）+ Obsidian 双链笔记

**第六套对话模式 `harmony-kb`**，把 dsh 工作区当知识库用，预设计数五套→六套：

- **分层检索问答**：先查 `笔记/kb-index.md` 命中候选再精读，索引缺失自动枚举目录生成（依赖 `@deepseek-ai/dsh-tool-list` 的 `list_dir`，安装见上文「2.5」）
- **深度研究 / 文档整理 / 思维脑图**：网页检索 + 委派 Pro 提炼 → `研究/YYYY-MM-DD-<主题>.md`；脑图可生成 `.mm` 导入万兴脑图
- **Obsidian 双链笔记**：按指令（如「总结这段并推送到 Obsidian」）把总结推送进鸿蒙侧载版 Obsidian vault（主目录 `obsidian/` 下含 `.obsidian` 的目录），`[[双链]]` 只挂 kb-index 已有笔记，Obsidian 自动生成反链与图谱
- **注意**：频繁委派 Pro + 多工具调用，CPU 负载高，运行中风扇转得较狠，建议空闲时段使用
- **实测闭环**：三处预设文件（仓库 / 内部分发 / 本机部署）逐字节一致；dsh 重启后 `agentPreset.list` 显示「鸿蒙知识库专家」broken 0、`agentPreset.read` 与仓库逐字一致（含 Obsidian 指令块）；单文件自解压 install.sh 假环境解出 IDENTICAL。浏览器黄金路径（推送到 Obsidian）待实测确认

### 2026-08-18 — 恢复对话框权限预设（dsh-permission-presets 补丁）

鸿蒙对话框原本没有「直接开放权限」功能——根因是 `dsh-permission-presets` 依赖 bash shell 的 `ctx.shell.sandboxMode`（硬检查），而鸿蒙禁 bash-sandbox 原生依赖导致该插件被 `harmony.patch.yml` 禁用。本仓库解法：

- **`harmony.patch.yml`**：`id: permission` 改为 `disabled: false`（配合下方代码补丁）
- **node_modules 补丁 `dsh-permission-presets`**：把 5 处 `ctx.shell.sandboxMode` 改为 `ctx.fs.sandboxMode`，inject 依赖 `"shell"` 换 `"fs"`——fs 沙箱（`dsh-fs-sandbox`，纯 JS）一直在运行，`sandboxMode` 读自 `ctx.sandboxPolicy.defaultMode`（默认 workspace-write）。对话框恢复 read-only / workspace-write / danger-full-access 三档下拉，切 danger-full-access 即放开工作区外写权限。
- **`scripts/dsh-update.mjs`**：新增 `patchPermission()`（幂等、锚点匹配、带 `HarmonyOS patch` 标记），并入 `patchAll()` 三连校验——升级/重装 dsh 后自动重打，下拉不丢。同时补上 session 补丁的 `rename` import（2026-08-18 实测：只换调用不补 import 会 `rename is not defined` 崩溃）。
- **验证**：`verify-permission-presets.mjs` 独立 cordis 上下文 8/8 通过（fs.sandboxMode 非 undefined、构造不抛、三档齐全、切换写对 session 事件）。

### 2026-08-18 — 跟进官方 0.1.0-rc.7

dsh 官方更新至 `0.1.0-rc.7`（DeepSeek 群聊发布），本仓库移植版已同步。升级要点：

- **`--ignore-scripts` 绕过 koffi 原生构建**：rc.7 依赖树把 koffi 升到 3.1.5，其 install 脚本需 CMake 编译原生二进制——鸿蒙无编译器直接失败。实测 koffi 原生部分只在 win32 路径被 dsh-fs-local 懒加载（鸿蒙永不触发）、node-pty 本机本就不可用、sharp 走预编译、@deepseek-ai 各包均为纯 JS 无 install 脚本，故安装时整体跳过 scripts 安全。已固化进 `scripts/dsh-update.mjs`，后续升级不再踩坑。
- **DeepSeek 推理档位新增 `low`**：官方适配器现支持 `off/low/high/max`（默认仍 `high`），`medium` 无效。已同步 `docs/CACHE-OPTIMIZATION.md` 实测注记。
- **升级闭环**：npm install → 重打鸿蒙补丁（credentials/session）→ 重启 dsh → 3080 正常 → 五套预设 `agent.cordis.yml` 经 rc.7 `entryListSchema` 校验全部可加载。

### 2026-08-18 — 跑分重写为「六边形雷达 + 性能表 + 交付质量表」

跑分从 6 题扩到 6 轴 × 2 题 = 12 道全自动判分，并新增交付质量表（3 道流程题按交付步骤标记命中打分）。核心数字：能力六轴五套全满分（同模型能力地板一致）；缓存命中率经静态 persona 填充后 52.9-89.9% → 93.8-98.0%；交付规范 promax 89（性能与纪律兼得）、rampagemax 92 全场最高（复盘收尾唯一满分，但效率/耗时最贵）。脚本 `bench/bench.mjs` 可复现，原始数据 `result.json`、报告 `result.md`。同步 README 简介：预设计数四套→五套（模式表补 `harmony-chat-rampagemax` 行），简介跑分数字更新为填充后 93.8-98.0%。

### 2026-08-18 — 新增狂暴 Max 预设（不省 token 只讲质量）

**第五套对话模式 `harmony-chat-rampagemax`**，与 promax 相反——牺牲缓存换质量，慎用（高 token 消耗）：

- **运行上下文打开**（`includeRuntimeContext:true`），前缀随会话动态变化，缓存命中率低
- **网页 fetch 全开**（`fetch:true`，搜索超时放宽 30s），可抓取页面全文核验
- **双重验证 + 关键路径交叉互证**，轻任务无捷径、全部走完整闭环
- **预检穷尽扫描**：namespace / wiring.id / system-prompt 槽位 / 设置页 order / 工具名逐一核对
- **委派全量 Pro**：子代理一律路由 deepseek-v4-pro，一次做对
- **persona 内置慎用警告**：「可能一次清空账户额度，仅攻坚疑难/跨文件重构/交付前终极检验时使用」

**实测闭环**：YAML 解析通过 → 同步运行副本 → dsh 重启 → `agentPreset.list` 显示「鸿蒙狂暴Max 已加载，broken: 无」→ `agentPreset.read` 7409 字符全段含慎用警告/质量第一/双重/穷尽/委派。

### 2026-08-18 — 六边形 ProMax：交付纪律升级

**promax 的 persona 块重写为六条硬规则**（任务分级 / 预检 / 实现 / 集成闭环 / 验证先于完成 / 委派），全部静态文本、不注入动态内容，缓存命中率不受影响。核心是把「集成闭环」与「验证先于完成」写成不可跳过的机械清单：交付 = 文件写完 + node_modules 软链 + 重启 + boot 核对 + 实测生效。

**触发背景**：用 promax 写明日方舟干员角色插件（dsh-arknights-persona）的实测。结果——代码交付 9/10（零语法错误、API 全对、框架地道），但集成闭环仅 6/10（软链未建、未重启、未核对 boot、未实测）。结论：**差在收尾纪律不在智能**，于是把每条缺口变成 persona 里的规则。详见上方「2.4 六边形 ProMax」。

### 2026-08-17 — 新增 ops 常驻任务管家模式 + 定时调度

**新增功能**

- **`harmony-chat-ops` 常驻后台任务管家预设**：鸿蒙设备上的无人值守任务模式，纯 JS、零原生依赖。三类职责——知识整理（读目录 → 提取 → 去重 → 归档 `~/dsh-kb/`）、批量文件处理（重命名/归档/去重 → 清单到 `~/dsh-kb/logs/`）、定时任务（cron_create 标准 cron 表达式 + schedule_create every/at，空闲自动执行并归档）。超出三类的事先询问用户。
- **`@deepseek-ai/dsh-tool-list` 目录枚举插件**：dsh 的 fs 服务没有 readdir，导致 ops 模式无法发现目录内容。补一个零依赖 `list_dir` 工具（`node:fs/promises`），支持相对路径、文件大小、200 条上限。
- **`harmony.patch.yml` 挂载 dsh-schedule 定时调度**：为 web 会话根 agent 注册 `schedule_create / schedule_list / schedule_delete`（包随 dsh 基础安装自带），一次性/周期提醒到点自动触发，agent 空闲时自动执行并归档。
- **委派子代理路由到 Pro**：按 id 整行覆盖 `tool-subagent` 的 `agentOptions` 为 `deepseek-v4-pro`（实测 preset 内的 agentOptions 不生效，需 profile 层覆盖）。主循环 flash 省成本，复杂子任务 Pro 一次做对，省去反复试错往返。

**实测闭环（本机验证）**

- 手动批量：ops 会话枚举 `~/dsh-kb-test/notes/` 3 篇会议纪要 → 读取 → 去重「预算 ok」 → 归档 `~/dsh-kb/会议纪要/*.md`（含来源表）。
- 定时：`schedule_create after_seconds: 60` 到点自动触发，agent 独立产出 `~/dsh-kb/reports/notes-summary-*.md`；一次性提醒执行后 `schedule_list` 不再出现。
- 回归：现有 harmony-chat / pro / promax 三套预设加载无错误，web 稳定 UP；测试数据已清理。

**修复**

- 修复了新建会话失败的 bug：预设引用的自定义插件包名需同时存在于 dsh 基础 `node_modules` 与 profile 层 `node_modules` 软链层（host 组合基座向上解析到 `profiles/node_modules`），缺软链会导致 preset mount 失败 → `SessionCreateError`。安装步骤见上文「2.5」。`dsh-tool-list` 已按此双路径就位。

---

## 参与开发 / Contributing

欢迎共同创建！本项目开放协作，开发群成员可直接申请成为协作者，任何开发者也可通过 Fork + PR 参与。

- 贡献指南：[CONTRIBUTING.md](CONTRIBUTING.md)
- 提交规范：`main` 分支受保护，PR 需 review 后合并
- 想成为共同创建者：联系群主申请，或在 Discussions 里冒泡
