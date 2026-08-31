// scanner.js — 提示注入 / 上下文病毒（context virus）检测引擎。
// 纯 JS、零依赖，签名库与决策可单测、可复用。
// 移植自 MIT 项目 QinpanWan/openclaw-prompt-antivirus（Copyright (c) 2026 Qinpan Wan (Entity-Him)），
// 按 MIT 许可保留署名；仅将 TypeScript 改为 ESM、sanitize 覆盖全部命中项。
// 签名库来自 lib/rules.js（磁盘化、可演进），支持 setActiveRules 运行时热换。
"use strict";

import { buildCompiled, DEFAULT_RULE_SPECS } from "./rules.js";

/** 风险等级：0 干净 / 1 低 / 2 中 / 3 高。 */
export const RISK = Object.freeze({ CLEAN: 0, LOW: 1, MEDIUM: 2, HIGH: 3 });

const LABELS = ["CLEAN", "LOW", "MEDIUM", "HIGH"];

export function labelFor(risk) {
  return LABELS[Math.max(0, Math.min(LABELS.length - 1, risk | 0))];
}

/** 默认签名库（编译后）。兼容旧导出，扫描器实际使用 activeRules。 */
export const RULES = buildCompiled(DEFAULT_RULE_SPECS);

/** 当前生效签名库，可被 setActiveRules 整体替换（磁盘库/学习结果热更新）。 */
let activeRules = RULES;

/** 运行时替换生效签名库。 */
export function setActiveRules(rules) {
  activeRules = Array.isArray(rules) && rules.length > 0 ? rules : RULES;
}

/** 当前生效签名数量。 */
export function getRuleCount() {
  return activeRules.length;
}

/** 对一段文本执行签名扫描，返回风险汇总。 */
export function scanText(text) {
  const findings = [];
  const categories = new Set();
  let risk = 0;
  for (const rule of activeRules) {
    rule.re.lastIndex = 0;
    let match;
    while ((match = rule.re.exec(text)) !== null) {
      const severity = rule.severity;
      findings.push({
        start: match.index,
        end: match.index + match[0].length,
        severity,
        category: rule.category,
        matched: match[0],
      });
      categories.add(rule.category);
      if (severity > risk) risk = severity;
      if (match.index === rule.re.lastIndex) rule.re.lastIndex += 1;
    }
  }
  return { risk, label: labelFor(risk), findings, categories: [...categories] };
}

/** 用消毒文案替换全部命中片段（隔离模式用）。 */
export function sanitizeText(text) {
  let out = text;
  for (const rule of activeRules) {
    out = out.replace(rule.re, () => rule.sanitize ?? `[已隔离:${rule.category}]`);
  }
  return out;
}

/** 递归扫描工具参数（含嵌套对象/数组）。 */
export function scanToolParams(params) {
  let risk = 0;
  const categories = new Set();
  const findings = [];
  const visit = (value) => {
    if (typeof value === "string") {
      const result = scanText(value);
      if (result.risk > risk) risk = result.risk;
      for (const category of result.categories) categories.add(category);
      findings.push(...result.findings);
    } else if (Array.isArray(value)) {
      for (const item of value) visit(item);
    } else if (value && typeof value === "object") {
      for (const item of Object.values(value)) visit(item);
    }
  };
  visit(params);
  return { risk, label: labelFor(risk), findings, categories: [...categories] };
}

/** 递归扫描工具结果内容块（text 块），间接注入常藏在这里。 */
export function scanToolResult(blocks) {
  const texts = [];
  const visit = (value) => {
    if (Array.isArray(value)) {
      for (const item of value) visit(item);
    } else if (value && typeof value === "object") {
      if (value.type === "text" && typeof value.text === "string") texts.push(value.text);
      for (const item of Object.values(value)) visit(item);
    } else if (typeof value === "string") {
      texts.push(value);
    }
  };
  visit(blocks);
  if (texts.length === 0) return { risk: 0, label: labelFor(0), findings: [], categories: [] };
  const findings = [];
  const categories = new Set();
  let risk = 0;
  for (const text of texts) {
    const result = scanText(text);
    if (result.risk > risk) risk = result.risk;
    for (const category of result.categories) categories.add(category);
    findings.push(...result.findings);
  }
  return { risk, label: labelFor(risk), findings, categories: [...categories] };
}

/** 危险工具清单：副作用不可逆或对外可见，配合人工门控使用。 */
export const DANGEROUS_TOOLS = [
  { name: /send_email|email|mail|smtp|gmail/i, reason: "对外通信" },
  { name: /\bexec\b|shell|command|run(?:_)?script|wsl|powershell|terminal/i, reason: "代码执行" },
  { name: /delete|rm|remove|destroy|overwrite|unlink/i, reason: "破坏性文件操作" },
  { name: /update|patch|write|apply_patch|write_file|transact/i, reason: "持久化文件写入" },
  { name: /transfer|pay|purchase|order|invoice|webhook|publish|release/i, reason: "外部副作用/资金" },
  { name: /push|deploy|upload|ftp|s3|cdn/i, reason: "对外发布" },
  { name: /approval|approve/i, reason: "自我审批提权" },
];
