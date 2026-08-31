// rules.js — 可演进、可热更新的病毒签名库 + 学习引擎 + 社区共享导入导出。
// 纯数据 + 磁盘 I/O，无 dsh / OpenClaw 依赖，可单测、可复用。
// 移植自 MIT 项目 QinpanWan/openclaw-prompt-antivirus 的 src/rules.ts（病毒库功能），
// 按 MIT 许可保留署名；仅将 TypeScript 改为 ESM，并支持环境变量覆盖落盘路径。
"use strict";

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** 风险等级：0 干净 / 1 低 / 2 中 / 3 高。 */
export const Severity = Object.freeze({ CLEAN: 0, LOW: 1, MEDIUM: 2, HIGH: 3 });

// 插件根目录：lib/rules.js -> lib -> 插件根。
const PLUGIN_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const DEFAULT_RULES_PATH = join(PLUGIN_ROOT, "rules", "virus-signatures.json");

/** 病毒库落盘路径。可用环境变量 PROMPT_ANTIVIRUS_RULES_PATH 覆盖（测试/多实例用）。 */
export function rulesPath() {
  return process.env.PROMPT_ANTIVIRUS_RULES_PATH || DEFAULT_RULES_PATH;
}

// ---- 内置默认签名（可序列化：正则存字符串，整个库可 JSON 化、可热更新、可社区共享）。----
export const DEFAULT_RULE_SPECS = [
  { re: "ignore\\s+(all\\s+)?(previous|prior|above|earlier)\\s+(instructions|prompts|rules|directives)", flags: "gi", severity: 3, category: "instruction_override", sanitize: "该指令" },
  { re: "disregard\\s+(all\\s+)?(previous|prior|above)\\s+(instructions|prompts|rules)", flags: "gi", severity: 3, category: "instruction_override", sanitize: "该指令" },
  { re: "forget\\s+(everything|all|your)\\s+(instructions|rules|training|guidelines)", flags: "gi", severity: 3, category: "instruction_override", sanitize: "该规范" },
  { re: "you\\s+are\\s+now\\s+(?!an?\\s+ai[\\s\\S]*?assistant)", flags: "gi", severity: 3, category: "role_impersonation", sanitize: "一个 AI 助手" },
  { re: "act\\s+as\\s+(a\\s+)?(hacker|jailbreak|developer|root|admin|god|unfiltered|uncensored)", flags: "gi", severity: 3, category: "role_impersonation", sanitize: "一个 AI 助手" },
  { re: "reveal\\s+(your\\s+)?(system|hidden|secret)\\s+(prompt|instructions|rules|guideline)", flags: "gi", severity: 3, category: "prompt_leak", sanitize: "系统提示内容" },
  { re: "print\\s+(your\\s+)?(system|developer|hidden)\\s+prompt", flags: "gi", severity: 3, category: "prompt_leak", sanitize: "系统提示内容" },
  { re: "<\\|?system\\|?>|\\bsystem\\s*:\\s*$", flags: "gim", severity: 2, category: "system_marker", sanitize: "数据标记" },
  { re: "(send|post|email|publish|exfiltrate|upload|transmit)\\s+(this|the|all|any|the\\s+user['’]s)\\s+(data|info|contents|password|token|key|confidential|files)", flags: "gi", severity: 3, category: "data_exfiltration", sanitize: "外部传输请求" },
  { re: "(delete|remove|erase|overwrite|destroy)\\s+(all|everything|the)\\s+(files|emails|messages|data)", flags: "gi", severity: 3, category: "destructive_action", sanitize: "删除请求" },
  { re: "(grant|give)\\s+(yourself|me)\\s+(admin|root|elevated|unrestricted|more)\\s+(access|permissions|privileges)", flags: "gi", severity: 3, category: "privilege_escalation", sanitize: "提权请求" },
  { re: "bypass\\s+(the\\s+)?(safety|security|policy|filter|guardrails)", flags: "gi", severity: 3, category: "jailbreak", sanitize: "安全绕过请求" },
  { re: "you\\s+have\\s+no\\s+(restrictions|limits|rules|constraints)", flags: "gi", severity: 2, category: "jailbreak", sanitize: "限制说明" },
  { re: "(ignore|don['’]t\\s+follow|skip)\\s+(the\\s+)?(above|security|safety|policy)", flags: "gi", severity: 3, category: "policy_override", sanitize: "该策略" },
  { re: "\\[\\s*(system|user|assistant)\\s*\\]|<\\s*(system|user|assistant)\\s*>", flags: "gi", severity: 2, category: "prompt_marker", sanitize: "角色标记" },
  { re: "(urgent|important|critical|act\\s+now|immediately)[^\\n]{0,60}\\b(run|execute|call|send|install|download|deploy|transfer)\\b", flags: "gi", severity: 2, category: "urgent_command", sanitize: "紧急消息" },
  { re: "\\b(inject|injection)\\b[^\\n]{0,60}\\b(prompt|instruction)", flags: "gi", severity: 2, category: "meta_prompt", sanitize: "元提示内容" },
  { re: "(this\\s+is\\s+)?(an?\\s+)?(instruction|command|directive|order|task)\\s*:", flags: "gi", severity: 1, category: "meta_prompt", sanitize: "内容标记" },
  { re: "(install|run|execute|invoke|curl|wget|powershell|exec)\\s+[^\\s]{2,}", flags: "gi", severity: 1, category: "code_execution", sanitize: "执行请求" },
];

/** 把可序列化签名编译为正则对象（非法条目返回 null）。 */
export function compile(spec) {
  if (!spec || typeof spec.re !== "string" || !spec.category) return null;
  try {
    const flags = typeof spec.flags === "string" && spec.flags.length > 0 ? spec.flags : "gi";
    const severity = Number.isInteger(spec.severity) && spec.severity >= 0 && spec.severity <= 3 ? spec.severity : 1;
    return {
      re: new RegExp(spec.re, flags),
      severity,
      category: spec.category,
      sanitize: typeof spec.sanitize === "string" ? spec.sanitize : undefined,
    };
  } catch {
    return null;
  }
}

/** 批量编译，静默丢弃无法编译的非法条目。 */
export function buildCompiled(specs) {
  const out = [];
  for (const spec of specs ?? []) {
    const rule = compile(spec);
    if (rule) out.push(rule);
  }
  return out;
}

/** 读取磁盘病毒库；文件缺失/损坏时回退默认库并落盘引导（库可检视、可打补丁）。 */
export function loadRules() {
  const path = rulesPath();
  try {
    if (existsSync(path)) {
      const parsed = JSON.parse(readFileSync(path, "utf8"));
      if (Array.isArray(parsed)) {
        const valid = parsed.filter((spec) => compile(spec) !== null);
        if (valid.length > 0) return valid;
      }
    }
  } catch (error) {
    console.warn(`[prompt-antivirus] 病毒库读取失败，使用默认库: ${error.message}`);
  }
  saveRules(DEFAULT_RULE_SPECS);
  return DEFAULT_RULE_SPECS;
}

/** 把签名库写回磁盘（自动建目录）。返回是否成功。 */
export function saveRules(specs) {
  try {
    const path = rulesPath();
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, `${JSON.stringify(specs, null, 2)}\n`, "utf8");
    return true;
  } catch (error) {
    console.warn(`[prompt-antivirus] 病毒库写入失败: ${error.message}`);
    return false;
  }
}

// ---- 学习引擎：从漏网攻击样本中提炼一条保守签名并持久化。----
// 提示词刻意用单词而非整句攻击短语，避免本文件自身触发扫描器。
const LEARN_HINTS = [
  { category: "instruction_override", re: /\b(ignore|disregard|forget|override|skip)\b/i },
  { category: "role_impersonation", re: /\b(persona|hacker|jailbreak|unfiltered|uncensored|god)\b/i },
  { category: "prompt_leak", re: /\b(reveal|print)\b/i },
  { category: "data_exfiltration", re: /\b(send|post|upload|transmit|exfiltrate)\s+(confidential|password|token|data|info)\b/i },
  { category: "destructive_action", re: /\b(delete|erase|wipe|destroy|overwrite)\b/i },
  { category: "privilege_escalation", re: /\b(escalate|privileges?|elevated)\b/i },
  { category: "jailbreak", re: /\b(bypass|guardrail)\b/i },
  { category: "code_execution", re: /\b(curl|wget|powershell|subprocess)\b/i },
];

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * 从样本提炼签名并写库。
 * @param {string} text - 漏网攻击样本
 * @param {string} [hintCategory] - 手动指定类别（可选）
 * @returns {{added:boolean, rule?:object, reason:string}}
 */
export function learnFromSample(text, hintCategory) {
  if (!text || text.trim().length === 0) return { added: false, reason: "empty-sample" };

  let category = hintCategory ?? "instruction_override";
  let triggerIndex = -1;
  let triggerLen = 0;
  for (const hint of LEARN_HINTS) {
    const match = hint.re.exec(text);
    if (match && (triggerIndex === -1 || match.index < triggerIndex)) {
      triggerIndex = match.index;
      triggerLen = match[0].length;
      category = hintCategory ?? hint.category;
    }
  }

  // 围绕触发词构建保守的字面量签名（触发词 + 一小段尾巴）。
  const start = Math.max(0, triggerIndex === -1 ? 0 : triggerIndex);
  const end = Math.min(text.length, start + Math.max(20, triggerLen + 24));
  const fragment = text.slice(start, end).trim().replace(/\s+/g, " ");
  const literal = escapeRegExp(fragment);
  if (literal.length < 4) return { added: false, reason: "fragment-too-short" };

  // 与现有库去重（比较编译后的正则源）。
  const existing = loadRules();
  if (existing.some((rule) => rule.re === literal || rule.re === `\\b${literal}\\b`)) {
    return { added: false, reason: "already-covered" };
  }

  const rule = { re: literal, flags: "gi", severity: 3, category, sanitize: "已隔离" };
  const ok = saveRules([rule, ...existing]);
  return ok ? { added: true, rule, reason: "learned" } : { added: false, reason: "persist-failed" };
}

// ---- 病毒库交换（社区共享签名，类似杀软病毒库定义互换）。----
/** 导出当前库为可移植 JSON 字符串。 */
export function exportRules() {
  return JSON.stringify(loadRules(), null, 2);
}

/**
 * 合并外部病毒库（JSON 字符串或数组），按正则源去重。
 * @returns {{added:number, skipped:number}}
 */
export function importRules(input) {
  let incoming;
  try {
    incoming = typeof input === "string" ? JSON.parse(input) : input;
  } catch (error) {
    throw new Error(`无效的病毒库 JSON: ${error.message}`);
  }
  if (!Array.isArray(incoming)) throw new Error("病毒库必须是数组");

  const current = loadRules();
  const seen = new Set(current.map((rule) => rule.re));
  let added = 0;
  let skipped = 0;
  for (const spec of incoming) {
    const compiled = compile(spec);
    if (!compiled) {
      skipped++;
      continue;
    }
    if (seen.has(spec.re)) {
      skipped++;
      continue;
    }
    current.push({
      re: spec.re,
      flags: typeof spec.flags === "string" && spec.flags.length > 0 ? spec.flags : "gi",
      severity: compiled.severity,
      category: spec.category,
      sanitize: typeof spec.sanitize === "string" ? spec.sanitize : undefined,
    });
    seen.add(spec.re);
    added++;
  }
  saveRules(current);
  return { added, skipped };
}

/** 校验外部病毒库结构。@returns {{valid:boolean, count:number, errors:string[]}} */
export function validateRules(input) {
  const errors = [];
  if (!Array.isArray(input)) return { valid: false, count: 0, errors: ["不是数组"] };
  for (const [index, rule] of input.entries()) {
    if (!rule || typeof rule.re !== "string") errors.push(`第 ${index} 条: 缺少 re`);
    else if (typeof rule.category !== "string") errors.push(`第 ${index} 条: 缺少 category`);
    else if (typeof rule.severity !== "number" || rule.severity < 0 || rule.severity > 3) errors.push(`第 ${index} 条: severity 超出 0-3`);
    else if (compile(rule) === null) errors.push(`第 ${index} 条: 正则无法编译`);
  }
  return { valid: errors.length === 0, count: input.length, errors };
}
