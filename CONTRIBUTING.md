# 参与开发 / Contributing

欢迎加入 **dsh-harmonyos-pc** 共同开发！本项目让 DeepSeek Harness（dsh）在华为鸿蒙 PC（HarmonyOS）上完整跑起来：缓存优化对话预设、启动补丁、工具链与鸿蒙客户端。

## 加入方式

- **共同创建者**：在开发群里联系群主申请，被邀请后即可直接创建分支、提 PR。
- **任何开发者**：Fork 本仓库 → 改代码 → 提 PR，一样被欢迎。

## 环境准备

- HarmonyOS PC / 鸿蒙设备 + Node.js 环境
- dsh 本体与依赖说明见 `docs/` 目录
- 鸿蒙客户端在 `client/`（DevEco Studio / hvigor 构建）

## 仓库结构

- `presets/` — 各场景对话预设（harmony-chat 系列）
- `plugins/` — dsh 插件补丁
- `client/` — 鸿蒙客户端工程
- `bench/` — 预设/插件性能基准数据
- `docs/` — 文档与教程

## 提 Issue

- **Bug**：请附上 dsh 版本、鸿蒙系统版本、复现步骤、报错日志
- **功能建议**：说明使用场景、期望效果，最好附参考实现

## 提 PR 流程

1. 从最新 `main` 拉分支：`git checkout -b feat/你的改动`
2. 提交信息用前缀 + 一句话描述：`feat:` `fix:` `docs:` `refactor:` `perf:`
3. 改动聚焦单一目标，不要顺手改无关文件；新增功能尽量补说明
4. 推到自己的分支后开 PR，标题一句话说清改动，描述写动机和验证方式
5. `main` 分支受保护：必须通过至少 1 人 review 才能合并

## 协作约定

- `main` 只通过 PR 合并，禁止直接推送（管理员除外）
- 大改动先在 Discussions 里聊方案再动手
- 动了预设/插件后，尽量跑一下 `bench/` 下的基准，保留对比数据

## 沟通渠道

- GitHub Issues / Discussions
- 开发群（群主维护）
