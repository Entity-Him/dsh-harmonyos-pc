// state.js — 审计日志与金丝雀令牌注册表（纯 node，fail-silent）。
"use strict";

import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { appendFileSync, mkdirSync, rmSync, statSync } from "node:fs";
import { randomBytes } from "node:crypto";

const MAX_RING = 500;
const MAX_FILE_BYTES = 2 * 1024 * 1024;

/** 内存环形审计 + 追加写 ~/.dsh/task-board/prompt-antivirus-audit.jsonl（失败静默）。 */
export class AuditLog {
  constructor(cfg, ctx) {
    this.enabled = cfg.auditLog !== false;
    this.ctx = ctx;
    this.entries = [];
    this.path = cfg.auditPath ?? join(homedir(), ".dsh", "task-board", "prompt-antivirus-audit.jsonl");
    this.bytes = 0;
    try { this.bytes = statSync(this.path).size; } catch { this.bytes = 0; }
  }

  add(entry) {
    if (!this.enabled) return;
    const record = { ts: new Date().toISOString(), ...entry };
    this.entries.push(record);
    if (this.entries.length > MAX_RING) this.entries.shift();
    try {
      if (this.bytes > MAX_FILE_BYTES) {
        rmSync(this.path, { force: true });
        this.bytes = 0;
      }
      mkdirSync(dirname(this.path), { recursive: true });
      const line = `${JSON.stringify(record)}\n`;
      appendFileSync(this.path, line);
      this.bytes += line.length;
    } catch {
      this.ctx?.logger?.warn?.(`[prompt-antivirus] 审计写入失败: ${this.path}`);
    }
  }

  recent(count = 20) {
    return this.entries.slice(-count);
  }
}

/** 每 agent（会话）一个随机金丝雀令牌；同一 agent 复用。 */
export class CanaryRegistry {
  constructor() {
    this.tokens = new WeakMap();
    this.injected = new WeakSet();
  }

  tokenFor(agent) {
    let token = this.tokens.get(agent);
    if (!token) {
      token = `TKN-${randomBytes(5).toString("hex").toUpperCase()}`;
      this.tokens.set(agent, token);
    }
    return token;
  }
}
