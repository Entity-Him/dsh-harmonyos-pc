#!/usr/bin/env node
// dsh-harmonyos 一键更新：① 跟随官方 dsh 版本（dsh-update.mjs）② 同步本仓库的预设/插件/补丁。
// 鸿蒙零依赖：只用 fetch + tar + fs。版本判定 = 本仓库 GitHub main 分支 commit SHA。
// Usage: node dsh-hm-update.mjs [check|update]    （默认 update）
import { spawnSync } from 'node:child_process';
import {
  readFileSync, writeFileSync, mkdirSync, cpSync, rmSync, existsSync,
  readdirSync, statSync, symlinkSync, renameSync, appendFileSync, unlinkSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { installProfilePlugin } from './dsh-prompt-antivirus-install.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..');
const HOME = homedir();
const OWNER = 'QinpanWan';
const REPO_NAME = 'dsh-harmonyos-pc';
const NODE = process.env.NODE_BIN || '/data/service/hnp/node.org/node_v24.13.0/bin/node';
const UA = 'dsh-hm-update/0.1';

const PRESET_DIR = join(HOME, '.dsh', '.agent-presets');
const DSH_DIR = join(HOME, 'dsh-test');
const VERSION_FILE = join(HOME, '.dsh', '.dsh-harmonyos.version');
const BACKUP_DIR = join(HOME, '.dsh', '.dsh-harmonyos-backup');
const LOCK = join(HOME, '.dsh-hm-update.lock');

// 仓库内随包同步到本机仓库副本的产物（tarball 里这些路径 → REPO 对应路径）
const SYNC_LIST = ['presets', 'plugins', 'scripts', 'harmony.patch.yml', 'harmony-headless.patch.yml'];

function log(...a) { console.log(...a); }
function die(msg) { console.error('✗ ' + msg); process.exit(1); }
function tail(s, n = 8000) { return String(s || '').slice(-n); }
function readSafe(p) { try { return readFileSync(p, 'utf8').trim(); } catch { return ''; } }
function writeSafe(p, s) { mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, s); }

function run(args, timeout = 600000) {
  const r = spawnSync(NODE, args, { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, timeout });
  return { ok: r.status === 0, code: r.status, out: (r.stdout || '') + (r.stderr || '') };
}
function runSh(cmd, timeout = 600000) {
  const r = spawnSync('sh', ['-c', cmd], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, timeout });
  return { ok: r.status === 0, code: r.status, out: (r.stdout || '') + (r.stderr || '') };
}

// ---- 版本判定 ----
async function remoteSha() {
  const res = await fetch(`https://api.github.com/repos/${OWNER}/${REPO_NAME}/commits/main`, { headers: { 'user-agent': UA } });
  if (!res.ok) return null;
  const j = await res.json();
  return typeof j.sha === 'string' ? j.sha : null;
}
function localSha() { return readSafe(VERSION_FILE); }

// ---- ① 官方 dsh ----
function officialStatus() {
  const r = run([join(HERE, 'dsh-update.mjs'), 'check'], 60000);
  try { return JSON.parse(r.out); } catch { return null; }
}
function officialInstall() {
  const r = run([join(HERE, 'dsh-update.mjs'), 'install']);
  return r.ok;
}

// ---- ② 仓库产物 ----
async function downloadAndExtract() {
  const res = await fetch(`https://codeload.github.com/${OWNER}/${REPO_NAME}/tar.gz/main`, { headers: { 'user-agent': UA } });
  if (!res.ok) throw new Error('下载失败: codeload ' + res.status);
  const buf = Buffer.from(await res.arrayBuffer());
  const work = join(HOME, '.dsh', `.hm-update-${Date.now()}`);
  const ex = join(work, 'x');
  mkdirSync(ex, { recursive: true });
  writeFileSync(join(work, 'src.tar.gz'), buf);
  const t = spawnSync('tar', ['-xzf', join(work, 'src.tar.gz'), '-C', ex], { encoding: 'utf8' });
  if (t.status !== 0) throw new Error('tar 解压失败: ' + tail(t.stderr));
  const top = readdirSync(ex)
    .map((e) => join(ex, e))
    .find((p) => statSync(p).isDirectory() && !basename(p).startsWith('.'));
  if (!top) throw new Error('tarball 里未找到仓库目录');
  return { work, top };
}

function syncRepo(top) {
  let n = 0;
  for (const rel of SYNC_LIST) {
    const s = join(top, rel);
    if (!existsSync(s)) continue;
    const d = join(REPO, rel);
    if (statSync(s).isDirectory()) {
      rmSync(d, { recursive: true, force: true });
      cpSync(s, d, { recursive: true });
    } else {
      rmSync(d, { force: true });
      cpSync(s, d, { force: true });
    }
    n++;
  }
  return n;
}

function deployPresets(top) {
  const src = join(top, 'presets');
  if (!existsSync(src)) return 0;
  mkdirSync(PRESET_DIR, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  let n = 0, backed = 0;
  for (const name of readdirSync(src)) {
    const s = join(src, name);
    if (!statSync(s).isDirectory()) continue;
    const dst = join(PRESET_DIR, name);
    if (existsSync(dst)) {
      const b = join(BACKUP_DIR, ts, name);
      mkdirSync(dirname(b), { recursive: true });
      rmSync(b, { recursive: true, force: true });
      renameSync(dst, b);
      backed++;
    }
    cpSync(s, dst, { recursive: true });
    n++;
  }
  if (backed) log(`  已备份旧预设 ${backed} 份 → ~/.dsh/.dsh-harmonyos-backup/${ts}`);
  return n;
}

// 部署 tarball plugins/@deepseek-ai/ 下的全部插件：copy 到 dsh-test node_modules + profile 软链。
// 每加一个新仓库插件（如 dsh-deveco-bridge）无需改脚本，遍历目录即可。
function deployPlugins(top) {
  const srcRoot = join(top, 'plugins', '@deepseek-ai');
  if (!existsSync(srcRoot)) return 0;
  let n = 0;
  for (const pkg of readdirSync(srcRoot)) {
    const src = join(srcRoot, pkg);
    if (!statSync(src).isDirectory()) continue;
    const dest = join(DSH_DIR, 'node_modules', '@deepseek-ai', pkg);
    const link = join(HOME, '.dsh', 'profiles', 'node_modules', '@deepseek-ai', pkg);
    rmSync(dest, { recursive: true, force: true });
    mkdirSync(dirname(dest), { recursive: true });
    cpSync(src, dest, { recursive: true });
    rmSync(link, { recursive: true, force: true });
    mkdirSync(dirname(link), { recursive: true });
    symlinkSync(dest, link, 'dir');
    n++;
  }
  return n;
}

// 部署 tarball plugins/ 下的 profile 级插件（非 @deepseek-ai 作用域，如 dsh-prompt-antivirus）：
// 复用 installProfilePlugin —— 源码进 web profile plugins-src + 软链 + 清单注册 + headless 补丁。
function deployProfilePlugins(top) {
  const srcRoot = join(top, 'plugins');
  if (!existsSync(srcRoot)) return 0;
  let n = 0;
  for (const pkg of readdirSync(srcRoot)) {
    if (pkg === '@deepseek-ai') continue;
    const src = join(srcRoot, pkg);
    if (!statSync(src).isDirectory() || !existsSync(join(src, 'package.json'))) continue;
    log(`  部署 profile 插件 ${pkg} …`);
    installProfilePlugin({ pluginDir: src, pluginName: pkg, profilesRoot: join(HOME, '.dsh', 'profiles') });
    n++;
  }
  return n;
}

// ---- 重启 ----
function stopDsh() {
  const r = runSh('ps -ef 2>/dev/null | grep -F "dsh/lib/bin.js" | grep -v grep | awk \'{print $2}\'');
  const pids = r.out.trim().split(/\s+/).filter(Boolean);
  let n = 0;
  for (const p of pids) {
    const pid = Number(p);
    if (Number.isInteger(pid) && pid > 1) { try { process.kill(pid, 'SIGKILL'); n++; } catch {} }
  }
  return n;
}
function startWeb() {
  const shPath = join(HERE, 'dsh-web.sh');
  if (!existsSync(shPath)) { log('  未找到 dsh-web.sh，请手动 `sh scripts/dsh-web.sh`'); return; }
  const r = spawnSync('sh', [shPath], { encoding: 'utf8', timeout: 60000 });
  log('  ' + (r.stdout || '').trim().split('\n').join('\n  '));
  if (r.status !== 0 && r.stderr) log('  ' + tail(r.stderr, 500));
}

// ---- check ----
async function check() {
  const off = officialStatus();
  log('【官方 dsh】' + (off
    ? `已装 ${off.installed} / 最新 ${off.latest}  ${off.upToDate ? '✓ 已是最新' : '→ 有更新(update 会升级)'}`
    : '读取失败(dsh-update.mjs check 未返回 JSON)'));
  const remote = await remoteSha();
  const local = localSha();
  log('【本仓库 ' + REPO_NAME + '】' + (remote
    ? (local ? `本地 ${local.slice(0, 7)} / 远程 ${remote.slice(0, 7)}  ${local === remote ? '✓ 已是最新' : '→ 有新版本(update 会同步)'}`
      : `未记录版本(首次将同步为 ${remote.slice(0, 7)})`)
    : '远程 SHA 读取失败(检查网络/API 限流)'));
}

// ---- update ----
async function update() {
  // 锁
  try { writeFileSync(LOCK, String(process.pid), { flag: 'wx' }); }
  catch { return die('另一操作进行中(锁 ' + LOCK + ')'); }
  let repoChanged = false;
  try {
    // ① 官方 dsh
    log('① 官方 dsh 更新检查…');
    const off = officialStatus();
    if (off && off.latest && !off.upToDate) {
      log(`  升级 ${off.installed} → ${off.latest}（npm install + 重打鸿蒙补丁 + 重启）…`);
      if (!officialInstall()) log('  ⚠ 官方升级失败，继续仓库同步');
    } else if (off) {
      log('  已是最新，跳过');
    } else {
      log('  ⚠ 官方状态读取失败，跳过');
    }

    // ② 本仓库
    log('② 本仓库预设/插件/补丁同步…');
    const remote = await remoteSha();
    if (!remote) { log('  远程 SHA 读取失败，跳过仓库同步（可稍后重试）'); return; }
    const local = localSha();
    if (local === remote) { log('  仓库已是最新（' + remote.slice(0, 7) + '），跳过'); return; }
    log(`  检测到新版本: ${local ? local.slice(0, 7) + ' → ' : ''}${remote.slice(0, 7)}`);
    log('  下载最新 tarball…');
    let work, top;
    try { ({ work, top } = await downloadAndExtract()); }
    finally { /* work cleanup below */ }
    try {
      const ns = syncRepo(top);
      log(`  同步本机仓库副本 ${ns} 项（presets/plugins/scripts/patch）`);
      const np = deployPresets(top);
      log(`  部署预设 ${np} 套 → ~/.dsh/.agent-presets/`);
      const npl = deployPlugins(top);
      if (npl > 0) log(`  部署插件 ${npl} 个（基础 node_modules + profile 软链）`);
      else log('  ⚠ tarball 里没有插件目录，跳过');
      const npp = deployProfilePlugins(top);
      if (npp > 0) log(`  部署 profile 级插件 ${npp} 个（plugins-src + 软链 + 清单注册）`);
      writeSafe(VERSION_FILE, remote);
      repoChanged = true;
    } finally {
      rmSync(work, { recursive: true, force: true });
    }
  } finally {
    unlinkSync(LOCK);
  }

  // 重启（官方 install 已自带重启；仓库变更需重启使预设生效）
  if (repoChanged) {
    log('③ 重启 dsh web 使预设生效…');
    const killed = stopDsh();
    if (killed > 0) log(`  已停旧进程 ${killed} 个`);
    startWeb();
    log('完成。当前版本 ' + localSha().slice(0, 7) + '。');
  } else {
    log('无仓库变更，无需重启。');
  }
}

const cmd = process.argv[2] || 'update';
if (cmd === 'check') check();
else update();
