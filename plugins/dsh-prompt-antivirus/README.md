# dsh-prompt-antivirus — 全局防上下文病毒感染

运行时防御：扫描 · 隔离 · 金丝雀陷阱 · 人工门控 · 审计，覆盖 dsh 全部预设与子代理。
原理移植自 MIT 项目 `openclaw-prompt-antivirus`（github.com/QinpanWan/openclaw-prompt-antivirus），按 dsh（cordis）钩子面接线。

## 问题

提示注入是 LLM 智能体的核心弱点：模型分不清「指令」与「数据」——藏在网页检索结果、文件内容、
`[CRON TASK]` / `[SCHEDULE REMINDER]` 到期文本里的恶意文字，可以悄悄改写行为、外传数据或执行破坏性操作
（即「上下文病毒」感染）。本插件在数据进入模型前后各加一道防线。

## 拦截点（dsh 钩子 ↔ OpenClaw 对照）

| 防线 | dsh 钩子 | 行为 |
| --- | --- | --- |
| 工具参数扫描（直接注入） | `tools/pre-execute` | 高危命中 → `deny`；高危 + 危险工具 → `ask`（人工审批） |
| 工具结果扫描（间接注入） | `tools/post-execute` | `block` 转 isError / `quarantine` 替换命中片段 |
| 进入模型前的消息扫描 | `agent/pre-step` | 高危消息进入前隔离替换；每会话注入一次金丝雀守卫 |
| 出站文本消毒 / 金丝雀检测 | `llm/stream` | 命中金丝雀 → block 模式中断；出站命中注入片段 → 替换 |
| 危险工具人工门控 | `tools/pre-execute` + approval | `send_email` / `apply_patch` / `delete_*` 等命中高危时要求确认 |

## 模式

- `quarantine`（默认）：可原地改写的路径（工具结果 / 消息 / 出站文本）替换命中片段；工具参数无法原地改写 → 拒绝并说明。
- `block`：同隔离，另加「金丝雀命中即中断输出」与更严格的拒绝。
- `monitor`：只审计不干预。

## 病毒库（可演进签名库 + 学习引擎）

签名库不写死在代码里，而是磁盘化存储于插件目录
`rules/virus-signatures.json`（可用环境变量 `PROMPT_ANTIVIRUS_RULES_PATH` 覆盖，便于多实例/测试）。
首次启动自动落盘默认库，之后可热更新、学习、社区共享，无需重新编译：

- `_antivirus_learn(sample, category?)` — 把漏网的攻击样本提炼成签名并持久化；下次相似攻击自动命中。
- `_antivirus_rules_export` — 导出当前病毒库为 JSON 字符串，像杀软病毒库定义一样在安装之间共享。
- `_antivirus_rules_import(rules)` — 合并外部病毒库（按正则源去重，返回新增/跳过计数），非法条目自动剔除。
- 启动日志会打印 `rules=<数量>, rulesPath=<路径>`；`_antivirus_status` 亦返回两者。

学习/导入后签名库立即生效（运行时热换，无需重启）。手工补丁也简单：直接编辑 JSON 后重启即可。

## 工具

- `_antivirus_scan <input>` — 扫描任意文本并报告 CLEAN/LOW/MEDIUM/HIGH。
- `_antivirus_status` — 当前配置 + 最近 20 条审计。
- `_antivirus_learn <sample> [category]` / `_antivirus_rules_export` / `_antivirus_rules_import <rules>` — 病毒库维护（见上）。

审计落盘 `~/.dsh/task-board/prompt-antivirus-audit.jsonl`（环形内存 500 条 + 文件上限 2MB，失败静默）。

## 接入

- web profile：`plugins-src/dsh-prompt-antivirus` + `node_modules` 软链 + `package.json` 的
  `dependencies` 与 `dsh.profile.bundles`（bundle 自带 `cordis.patch.yml` 插入 `id: prompt-antivirus`）。
- headless profile：`cordis.patch.yml` 追加同一条 insert（共享 `profiles/node_modules` 软链）。
- 仓库内一键安装：`node scripts/dsh-prompt-antivirus-install.mjs`；`dsh-hm-update.mjs` 更新时会自动部署。
- 修改后需重启 dsh-web 生效。

## 测试

```bash
cd plugins/dsh-prompt-antivirus && node --test
```

覆盖：签名库全类别/严重级、中文无害文本不误报、sanitize 全命中替换、参数递归扫描、
工具结果扁平化扫描、三种模式决策、pre-step 金丝雀单次注入、stream 金丝雀中断/移除、harness 端到端决策，
以及病毒库（磁盘引导/读写、学习去重、导入导出、校验、运行时热换）。

## 诚实的局限

签名扫描是「打地鼠」：能可靠命中已知措辞，改写后的攻击可能漏过。请配合最小权限工具集与危险操作人工确认
（本插件默认对高危 + 危险工具走审批通道）。真正的预防是架构性的——本插件是其中一层，不是银弹。
