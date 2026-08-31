// dsh-prompt-antivirus — 全局提示注入 / 上下文病毒防御插件（纯 JS，无原生依赖）。
// 原理移植自 MIT 项目 openclaw-prompt-antivirus，按 dsh（cordis）钩子面接线：
//   tools/pre-execute  → 扫描工具参数（直接注入面），高危 deny / 危险工具 ask（人工审批）
//   tools/post-execute → 扫描工具结果（间接注入面），block / quarantine
//   agent/pre-step     → 扫描进入模型前的消息 + 每会话注入一次金丝雀守卫
//   llm/stream         → 金丝雀命中检测 + 出站文本消毒（防外泄）
// 病毒库（v0.1.1 同步上游）：rules/virus-signatures.json 磁盘化可热更新，支持
//   _antivirus_learn（学习漏网样本）、_antivirus_rules_export/_import（社区共享）。
// 在 profile 层挂载，对所有预设、所有会话与子代理全局生效。
"use strict";

import { defineTool } from "@deepseek-ai/dsh-tools";
import { createUserMessage } from "@deepseek-ai/dsh-llm";
import { scanText, scanToolParams, scanToolResult, setActiveRules, getRuleCount } from "./scanner.js";
import { buildCompiled, loadRules, rulesPath, learnFromSample, exportRules, importRules, validateRules } from "./rules.js";
import { renderFindings } from "./policy.js";
import { createHooks, summaryOf } from "./hooks.js";
import { AuditLog, CanaryRegistry } from "./state.js";

export const name = "prompt-antivirus";
export const inject = ["agents", "tools"];

const DEFAULT_CONFIG = {
  mode: "quarantine", // "block" | "quarantine" | "monitor"
  blockDangerousTools: true,
  requireApprovalOnHighRisk: true,
  canaryEnabled: true,
  auditLog: true,
};

function renderValue(_args, value) {
  return [{ type: "text", text: JSON.stringify(value, null, 2) }];
}

const SCAN_OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    risk: { type: "string" },
    categories: { type: "array" },
    findings: { type: "integer" },
    detail: { type: "string" },
  },
};

const STATUS_OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    mode: { type: "string" },
    blockDangerousTools: { type: "boolean" },
    requireApprovalOnHighRisk: { type: "boolean" },
    canaryEnabled: { type: "boolean" },
    auditLog: { type: "boolean" },
    audit: { type: "array" },
    ruleCount: { type: "integer" },
    rulesPath: { type: "string" },
  },
};

const LEARN_OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    learned: { type: "boolean" },
    reason: { type: "string" },
    rule: { type: "object", additionalProperties: false },
    rulesPath: { type: "string" },
    ruleCount: { type: "integer" },
  },
};

const EXPORT_OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    rules: { type: "string" },
    ruleCount: { type: "integer" },
    rulesPath: { type: "string" },
  },
};

const IMPORT_OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    added: { type: "integer" },
    skipped: { type: "integer" },
    ruleCount: { type: "integer" },
    error: { type: "string" },
  },
};

/** Cordis 函数插件生命周期。 */
export function apply(ctx) {
  const cfg = { ...DEFAULT_CONFIG };
  const audit = new AuditLog(cfg, ctx);
  const canaries = new CanaryRegistry();
  // 病毒库：启动时从磁盘加载（缺失自动落盘默认库），可热更新/学习/社区导入。
  setActiveRules(buildCompiled(loadRules()));
  const hooks = createHooks({
    cfg,
    audit,
    canaries,
    scanToolParams,
    scanToolResult,
    createGuardMessage: (text) => createUserMessage({
      content: [{ type: "text", text }],
      source: { kind: "plugin", plugin: "prompt-antivirus", form: "guard" },
    }),
  });

  console.log(`[prompt-antivirus] 已加载, mode=${cfg.mode}, canary=${cfg.canaryEnabled}, audit=${cfg.auditLog}, rules=${getRuleCount()}, rulesPath=${rulesPath()}`);

  // 全局拦截点（host 层挂载，覆盖所有 agent / 会话 / 子代理）。
  ctx.effect(() => {
    const disposers = [
      ctx.on("tools/pre-execute", hooks.preExecute),
      ctx.on("tools/post-execute", hooks.postExecute),
      ctx.on("agent/pre-step", hooks.preStep),
      ctx.on("llm/stream", hooks.streamWrap),
    ];
    return () => {
      for (const dispose of disposers) dispose();
    };
  }, "prompt-antivirus: hooks");

  // 每 agent 注册诊断工具。
  ctx.effect(() => {
    const stopCreated = ctx.on("agent/created", ({ agent }) => {
      if (!agent?.ctx) return;
      return agent.ctx.effect(() => {
        const tools = agent.ctx.get("tools");
        if (!tools) return;
        const disposers = [
          tools.register(
            defineTool({
              name: "_antivirus_scan",
              description: "Scan arbitrary text for prompt-injection / context-virus patterns and report the risk (CLEAN/LOW/MEDIUM/HIGH).",
              parameters: {
                input: { type: "string", required: true, description: "Text to scan; for objects, pass JSON.stringify(obj)." },
              },
              output: { schema: SCAN_OUTPUT_SCHEMA, render: renderValue },
              async execute(args) {
                const scan = scanText(String(args.input ?? ""));
                return summaryOf(scan);
              },
            }),
          ),
          tools.register(
            defineTool({
              name: "_antivirus_status",
              description: "Show current prompt-antivirus config and recent audit entries.",
              parameters: {},
              output: { schema: STATUS_OUTPUT_SCHEMA, render: renderValue },
              async execute() {
                return {
                  mode: cfg.mode,
                  blockDangerousTools: cfg.blockDangerousTools,
                  requireApprovalOnHighRisk: cfg.requireApprovalOnHighRisk,
                  canaryEnabled: cfg.canaryEnabled,
                  auditLog: cfg.auditLog,
                  audit: audit.recent(20),
                  ruleCount: getRuleCount(),
                  rulesPath: rulesPath(),
                };
              },
            }),
          ),
          tools.register(
            defineTool({
              name: "_antivirus_learn",
              description: "Feed a sample that evaded detection; the plugin learns it into the on-disk virus signature library so future similar attempts are caught.",
              parameters: {
                sample: { type: "string", required: true, description: "The attack text that evaded detection." },
                category: { type: "string", description: "Optional category hint (instruction_override / role_impersonation / ...)." },
              },
              output: { schema: LEARN_OUTPUT_SCHEMA, render: renderValue },
              async execute(args) {
                const result = learnFromSample(args.sample, args.category);
                setActiveRules(buildCompiled(loadRules()));
                return {
                  learned: result.added,
                  reason: result.reason,
                  rule: result.rule ?? null,
                  rulesPath: rulesPath(),
                  ruleCount: getRuleCount(),
                };
              },
            }),
          ),
          tools.register(
            defineTool({
              name: "_antivirus_rules_export",
              description: "Export the current on-disk virus signature library as a JSON string, for sharing learned signatures between installations.",
              parameters: {},
              output: { schema: EXPORT_OUTPUT_SCHEMA, render: renderValue },
              async execute() {
                return { rules: exportRules(), ruleCount: getRuleCount(), rulesPath: rulesPath() };
              },
            }),
          ),
          tools.register(
            defineTool({
              name: "_antivirus_rules_import",
              description: "Merge an external virus signature library (JSON string) into the local one, de-duplicating by regex source.",
              parameters: {
                rules: { type: "string", required: true, description: "JSON string of a RuleSpec[] library, e.g. from _antivirus_rules_export." },
              },
              output: { schema: IMPORT_OUTPUT_SCHEMA, render: renderValue },
              async execute(args) {
                try {
                  const validation = validateRules(JSON.parse(args.rules));
                  if (!validation.valid) {
                    return { added: 0, skipped: 0, ruleCount: getRuleCount(), error: `Import rejected: ${validation.errors.join("; ")}` };
                  }
                  const result = importRules(args.rules);
                  setActiveRules(buildCompiled(loadRules()));
                  return { added: result.added, skipped: result.skipped, ruleCount: getRuleCount() };
                } catch (error) {
                  return { added: 0, skipped: 0, ruleCount: getRuleCount(), error: `Import failed: ${error.message}` };
                }
              },
            }),
          ),
        ];
        return () => {
          for (const dispose of disposers) dispose();
        };
      }, "prompt-antivirus: tools");
    });
    return () => stopCreated();
  }, "prompt-antivirus: agents");
}
