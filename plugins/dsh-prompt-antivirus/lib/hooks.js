// hooks.js — 各拦截点的决策执行（纯逻辑，无 dsh 依赖，可单测）。
"use strict";

import { RISK, sanitizeText } from "./scanner.js";
import {
  buildGuardText,
  postExecuteDecision,
  preExecuteDecision,
  renderFindings,
  stepDecision,
} from "./policy.js";

/** 把工具结果内容块中命中注入的 text 块替换为消毒文案。 */
export function quarantineBlocks(blocks, scan) {
  if (!Array.isArray(blocks) || scan.risk < RISK.HIGH) return blocks;
  let changed = false;
  const out = blocks.map((block) => {
    if (!block || block.type !== "text" || typeof block.text !== "string") return block;
    const clean = sanitizeText(block.text);
    if (clean === block.text) return block;
    changed = true;
    return { ...block, text: clean };
  });
  return changed ? out : blocks;
}

/** 把消息内容块中命中注入的 text 替换为消毒文案。 */
export function quarantineMessage(message) {
  if (!message || !Array.isArray(message.content)) return message;
  let changed = false;
  const content = message.content.map((block) => {
    if (!block || block.type !== "text" || typeof block.text !== "string") return block;
    const clean = sanitizeText(block.text);
    if (clean === block.text) return block;
    changed = true;
    return { ...block, text: clean };
  });
  return changed ? { ...message, content } : message;
}

/** 汇总多条消息的扫描结果。 */
export function scanMessages(messages, scanToolResult) {
  const blocks = [];
  for (const message of messages) {
    if (Array.isArray(message?.content)) blocks.push(...message.content);
    else if (typeof message?.content === "string") blocks.push({ type: "text", text: message.content });
  }
  return scanToolResult(blocks);
}

/** 组装全部拦截监听器。deps: { cfg, audit, canaries, scanToolParams, scanToolResult, createGuardMessage } */
export function createHooks(deps) {
  const { cfg, audit, canaries, scanToolParams, scanToolResult, createGuardMessage } = deps;

  /** tools/pre-execute：扫描工具参数（直接注入面）。 */
  async function preExecute(exec, next) {
    const decision = await next();
    if (!exec || exec.arguments === undefined || exec.arguments === null) return decision;
    const scan = scanToolParams(exec.arguments);
    if (scan.risk < RISK.HIGH) return decision;
    const verdict = preExecuteDecision(scan, exec.name, cfg);
    audit.add({
      hook: "tools/pre-execute",
      tool: exec.name,
      callId: exec.callId,
      risk: scan.label,
      categories: scan.categories,
      action: verdict.action,
    });
    if (verdict.action === "ask") return { kind: "ask", reason: verdict.reason };
    if (verdict.action === "deny") return { kind: "deny", reason: verdict.reason };
    return decision;
  }

  /** tools/post-execute：扫描工具结果（间接注入面）。 */
  async function postExecute(exec, result, next) {
    const decision = await next();
    if (!result || !Array.isArray(result.content)) return decision;
    const scan = scanToolResult(result.content);
    if (scan.risk < RISK.HIGH) return decision;
    const verdict = postExecuteDecision(scan, cfg);
    audit.add({
      hook: "tools/post-execute",
      tool: exec.name,
      callId: exec.callId,
      risk: scan.label,
      categories: scan.categories,
      action: verdict.action,
    });
    if (verdict.action === "block") return { kind: "block", feedback: verdict.feedback };
    if (verdict.action === "quarantine") {
      return { kind: "accept", content: quarantineBlocks(result.content, scan) };
    }
    return decision;
  }

  /** agent/pre-step：扫描进入模型前的消息；会话首次注入金丝雀守卫。 */
  async function preStep(payload, next) {
    const decision = await next(payload);
    if (!payload || !Array.isArray(payload.messages)) return decision;
    if (!decision || decision.kind !== "enter") return decision;
    const messages = Array.isArray(decision.messages) ? decision.messages : payload.messages;
    const scan = scanMessages(messages, scanToolResult);
    const verdict = stepDecision(scan, cfg);
    let nextMessages = messages;
    if (verdict.action === "quarantine") {
      nextMessages = messages.map(quarantineMessage);
      audit.add({
        hook: "agent/pre-step",
        agent: payload.agent?.id,
        risk: scan.label,
        categories: scan.categories,
        action: "quarantine",
        step: payload.step,
      });
    } else if (verdict.action === "monitor") {
      audit.add({
        hook: "agent/pre-step",
        agent: payload.agent?.id,
        risk: scan.label,
        categories: scan.categories,
        action: "monitor",
        step: payload.step,
      });
    }
    if (cfg.canaryEnabled && payload.agent !== undefined && !canaries.injected.has(payload.agent)) {
      canaries.injected.add(payload.agent);
      const token = canaries.tokenFor(payload.agent);
      nextMessages = [...nextMessages, createGuardMessage(buildGuardText(token))];
      audit.add({ hook: "canary", action: "inject", agent: payload.agent?.id });
    }
    return nextMessages === messages ? decision : { kind: "enter", messages: nextMessages };
  }

  /** llm/stream：金丝雀命中检测 + 出站文本消毒（对应 message_sending）。 */
  function streamWrap(options, next) {
    const downstream = next();
    const agent = options?.agent;
    const token = agent === undefined ? null : canaries.tokenFor(agent);
    return (async function* promptAntivirusStream() {
      for await (const chunk of downstream) {
        if (chunk === null || chunk === undefined || chunk.type !== "text-delta" || typeof chunk.text !== "string") {
          yield chunk;
          continue;
        }
        if (token !== null && chunk.text.includes(token)) {
          audit.add({ hook: "canary", action: "hit", agent: agent?.id });
          if (cfg.mode === "block") return;
          yield { ...chunk, text: chunk.text.split(token).join("[已隔离:canary]") };
          continue;
        }
        if (cfg.mode !== "monitor") {
          const clean = sanitizeText(chunk.text);
          if (clean !== chunk.text) {
            audit.add({ hook: "llm/stream", action: "sanitize", agent: agent?.id });
            yield { ...chunk, text: clean };
            continue;
          }
        }
        yield chunk;
      }
    })();
  }

  return { preExecute, postExecute, preStep, streamWrap };
}

/** 供状态工具复用的摘要。 */
export function summaryOf(scan) {
  return {
    risk: scan.label,
    categories: scan.categories,
    findings: scan.findings.length,
    detail: renderFindings(scan),
  };
}
