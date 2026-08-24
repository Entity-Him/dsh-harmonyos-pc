# Contributing / 参与开发

> 让 DeepSeek Harness 在鸿蒙 PC 上跑得更好，需要你。

本项目把 DeepSeek Harness（dsh）完整带到华为鸿蒙 PC：缓存优化的对话预设、启动补丁、工具链，以及鸿蒙客户端。无论你是开发群成员、鸿蒙开发者，还是 dsh 深度用户，都欢迎参与。

## How to join / 加入方式

- **共同创建者（Collaborator）**：开发群成员可向群主申请，被邀请后获得 Write 权限——可以开分支、提 PR、参与 review。
- **普通贡献者**：Fork 本仓库 → 改代码 → 提 PR，一样被欢迎。
- **试用反馈**：装不上、跑不动、卡顿——提 Issue 或来 Discussions 说一声，就是贡献。

## Getting started / 环境准备

- 一台鸿蒙 PC / 鸿蒙设备，以及一台开发机（Node.js ≥ 18）
- 安装 dsh 本体：`npm i -g @deepseek-ai/dsh`（或按 `docs/` 里的教程）
- 鸿蒙客户端在 `client/`，用 DevEco Studio / hvigor 构建
- 建议先读 README 与 `docs/` 下的新手教程

## Repository layout / 仓库结构

| 路径 | 作用 |
|---|---|
| `presets/` | 对话预设（harmony-chat / promax / ops / kb 等） |
| `plugins/` | dsh 插件补丁 |
| `client/` | 鸿蒙客户端工程 |
| `bench/` | 预设与插件性能基准 |
| `docs/` | 教程与文档 |
| `scripts/` | 安装/更新脚本 |

## Filing issues / 提 Issue

**Bug 报告**，请附上：

- dsh 版本（`dsh --version`）与鸿蒙系统版本
- 设备型号
- 复现步骤
- 报错日志（`dsh-web.log` / 终端输出）
- 截图可选，但很加分

**功能建议**：说明使用场景、期望效果；有参考实现最好。大的功能建议先放 Discussions 讨论，避免返工。

> 模板已配好：新建 Issue 时选 Bug 报告 / 功能建议，跟着填空即可。

## Submitting PRs / 提 PR

### Step by step / 流程

1. 从最新 `main` 拉分支：`git checkout -b feat/你的改动`
2. 改代码，保持改动小而聚焦
3. 本地验证：跑通、必要时跑 `bench/` 基准
4. 推送分支，开 PR，标题一句话说清改动
5. 等 review；被打回就按评论改，改完推送即可

### Commit conventions / 提交信息规范

```
feat: 新预设 harmony-chat-lite
fix: 修复 promax 预设启动补丁失效
docs: 更新新手安装教程
perf: 优化缓存命中
refactor: 重构安装脚本
```

- 一行描述，中文或英文皆可，别写 update / fix bug 这种空话
- 一个 PR 尽量只做一件事，别夹带无关改动

### What gets bounced / 什么会被打回

- 直接推 `main`（受保护，除非你是 admin）
- 改动范围明显越界（顺手改了无关文件）
- 没验证就发（至少说明你测了什么）
- 大改动没先讨论方案

### What merges fast / 什么会被快速合并

- 修 bug：小而准，有复现步骤
- 文档：改错别字、补教程、补截图
- 预设/插件微调：有基准对比数据

## How review works / Review 怎么进行

- `main` 分支受保护：**必须至少 1 人 review 通过**才能合并
- review 关注：改动是否聚焦、是否破坏现有预设、是否有明显性能回退
- 被打回不是否定，改好再推即可

## Working agreements / 协作约定

- 大改动先讨论再动手（Discussions / 开发群）
- 动了预设/插件，尽量跑 `bench/` 并保留对比数据
- 新成员先从 Issue 认领小任务练手
- 遇到 dsh 本体的问题，先在官方仓库确认，别把锅背在自己的预设上

## FAQ / 常见问题

**Q：装不上 dsh 怎么办？**
A：先按 `docs/` 教程走；卡住就把报错贴到 Issue。

**Q：改预设需要重新构建客户端吗？**
A：不需要。预设是 `presets/` 下的配置，改完按 `scripts/dsh-hm-install.mjs` 重装即可；改 `client/` 才需要重新构建鸿蒙应用。

**Q：如何确认改动没有性能回退？**
A：跑 `bench/bench.mjs`，和 `bench/result-*.json` 对比。

## Contact / 沟通渠道

- GitHub Issues / Discussions
- 开发群：930088487（群主维护，招募共同创建者中）
