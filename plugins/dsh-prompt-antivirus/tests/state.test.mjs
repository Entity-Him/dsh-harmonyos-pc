import test from "node:test";
import assert from "node:assert/strict";
import { join, dirname } from "node:path";
import { existsSync, readFileSync, rmSync, mkdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { AuditLog, CanaryRegistry } from "../lib/state.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const AUDIT_PATH = join(HERE, ".tmp-audit.jsonl");

test("AuditLog 写入、环形、上限", () => {
  rmSync(AUDIT_PATH, { force: true });
  const cfg = { auditLog: true, auditPath: AUDIT_PATH };
  const log = new AuditLog(cfg, null);
  for (let i = 0; i < 10; i++) log.add({ hook: "test", index: i });
  assert.equal(log.recent(3).length, 3);
  assert.equal(log.recent(3)[2].index, 9);
  assert.ok(existsSync(AUDIT_PATH));
  const lines = readFileSync(AUDIT_PATH, "utf8").trim().split("\n");
  assert.equal(lines.length, 10);
  assert.equal(JSON.parse(lines[0]).index, 0);
  assert.equal(JSON.parse(lines[9]).index, 9);
  rmSync(AUDIT_PATH, { force: true });
});

test("AuditLog 关闭时不写文件", () => {
  rmSync(AUDIT_PATH, { force: true });
  const cfg = { auditLog: false, auditPath: AUDIT_PATH };
  const log = new AuditLog(cfg, null);
  log.add({ hook: "test" });
  assert.ok(!existsSync(AUDIT_PATH));
  assert.equal(log.recent(1).length, 0);
});

test("CanaryRegistry 每 agent 唯一且复用", () => {
  const registry = new CanaryRegistry();
  const a = { id: "a" };
  const b = { id: "b" };
  const ta1 = registry.tokenFor(a);
  const ta2 = registry.tokenFor(a);
  const tb = registry.tokenFor(b);
  assert.equal(ta1, ta2);
  assert.match(ta1, /^TKN-[0-9A-F]{10}$/);
  assert.notEqual(ta1, tb);
});
