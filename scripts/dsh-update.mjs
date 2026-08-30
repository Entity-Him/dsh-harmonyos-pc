#!/usr/bin/env node
// dsh 核心「检查更新」：check / patch / install / rollback。鸿蒙本机专用，零依赖。
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, unlinkSync, appendFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';

const HOME = homedir();
const DSH_DIR = join(HOME, 'dsh-test');
const PKG = join(DSH_DIR, 'node_modules', '@deepseek-ai', 'dsh', 'package.json');
const WEB_SH = join(HOME, 'bin', 'dsh-web.sh');
const LOG = join(HOME, 'dsh-update.log');
const PREV = join(HOME, 'dsh-update.prev');
const LOCK = join(HOME, 'dsh-update.lock');
const CRED_FILE = join(DSH_DIR, 'node_modules', '@deepseek-ai', 'dsh-credentials-local', 'lib', 'index.js');
const SESS_FILE = join(DSH_DIR, 'node_modules', '@deepseek-ai', 'dsh-session-persistence-jsonl', 'lib', 'index.js');
const PERM_FILE = join(DSH_DIR, 'node_modules', '@deepseek-ai', 'dsh-permission-presets', 'lib', 'index.js');
const ATTACH_FILE = join(DSH_DIR, 'node_modules', '@deepseek-ai', 'dsh-attachment-local', 'lib', 'index.js');
// dsh-visual-plugin（第三方，github.com/jyh20030112/dsh-visual-plugin）以源码形式落在 profile 树，
// 经 dsh-hm-install.mjs 铺进 plugins-src 并软链到 node_modules；运行时入口是 lib/index.js。
const VISUAL_FILE = join(HOME, '.dsh', 'profiles', 'web', 'plugins-src', 'dsh-visual-plugin', 'lib', 'index.js');
const MARK = 'HarmonyOS patch';
const __dirname = dirname(fileURLToPath(import.meta.url));

function log(...parts) {
  const line = `[${new Date().toISOString()}] ${parts.join(' ')}`;
  try { appendFileSync(LOG, line + '\n'); } catch {}
  console.log(parts.join(' '));
}
function tail(s, n = 6000) { return (s || '').slice(-n); }
function readFileSafe(p) { try { return readFileSync(p, 'utf8'); } catch { return ''; } }

function sh(cmd, args, opts = {}) {
  args = args.concat(opts.extra || []);
  const r = spawnSync(cmd, args, {
    encoding: 'utf8', maxBuffer: 16 * 1024 * 1024,
    timeout: opts.timeout ?? 600000, cwd: opts.cwd, env: { ...process.env, CI: 'true' },
  });
  return { ok: r.status === 0, code: r.status, out: (r.stdout || '') + (r.stderr || '') };
}
// 鸿蒙适配：--ignore-scripts 跳过原生构建（koffi 需 CMake 但本机无编译器，
// 且其原生二进制只在 win32 路径使用、node-pty 本机本就不可用、sharp 走预编译）。
// 纯 JS 的 @deepseek-ai 包均无 install 脚本，忽略是安全的。
function npm(...args) { return sh('npm', args, { cwd: DSH_DIR, extra: ['--ignore-scripts'] }); }
// 鸿蒙适配：npm arborist 在本机依赖解析阶段会静默卡死（无输出、CPU 低、拖到超时）。
// 手动直装器经 registry 元数据递归解析 + tarball 直装，实测 470 包闭包零缺口。npm 作兜底。
function manualInstall(version) {
  const script = join(__dirname, 'dsh-manual-install.mjs');
  if (!existsSync(script)) { log('dsh-manual-install.mjs 不存在，回退 npm'); return false; }
  const r = sh(process.execPath, [script, version], { cwd: DSH_DIR, timeout: 600000 });
  if (r.ok) { log('手动直装完成 → ' + version); return true; }
  log('手动直装失败，回退 npm: ' + tail(r.out));
  return false;
}

function readInstalled() {
  try { return String(JSON.parse(readFileSync(PKG, 'utf8')).version || '').trim(); }
  catch { return ''; }
}
// 官方 dist-tags.latest 可能滞后于实际发布（如 rc.8 已发布而 latest 停在 rc.7），
// 因此遍历 versions 取数值最高的版本（rc.N 与稳定版均按数字比较）。
function getLatest() {
  const r = npm('view', '@deepseek-ai/dsh', 'versions', '--json');
  if (!r.ok) throw new Error('npm view 失败: ' + tail(r.out));
  let list = [];
  try { list = JSON.parse(r.out.trim()); } catch {}
  if (!Array.isArray(list) || !list.length) throw new Error('npm 未返回可用版本列表: ' + tail(r.out));
  const nums = (v) => {
    const m = /^(\d+)\.(\d+)\.(\d+)(?:-rc\.(\d+))?/.exec(String(v).trim());
    return m ? [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4] || 0)] : null;
  };
  const sorted = list.filter((v) => nums(v)).sort((a, b) => {
    const A = nums(a), B = nums(b);
    for (let i = 0; i < 4; i++) if (A[i] !== B[i]) return A[i] - B[i];
    return 0;
  });
  return sorted[sorted.length - 1] || '';
}
export function check() {
  const installed = readInstalled();
  const latest = getLatest();
  return { installed, latest, upToDate: !!installed && installed === latest };
}

// ---- 幂等补丁 ----
function patchCredentials() {
  const txt = readFileSafe(CRED_FILE);
  if (!txt) throw new Error('credentials 文件不存在，需手动处理: ' + CRED_FILE);
  if (txt.includes(MARK)) return { changed: false };
  const anchor = 'if (process.platform === "win32") return;';
  const stop = '/* v8 ignore stop */';
  const ai = txt.indexOf(anchor);
  if (ai === -1) throw new Error('credentials 补丁锚点缺失(win32 guard)，需手动处理: ' + CRED_FILE);
  const si = txt.indexOf(stop, ai);
  if (si === -1) throw new Error('credentials 补丁锚点缺失(v8 ignore stop)，需手动处理: ' + CRED_FILE);
  const block =
    anchor + '\n' +
    '\t/* HarmonyOS patch: 文件系统强制组位(chmod 600 被拒)，所有者检查在此必然抛错，跳过。 */\n' +
    '\treturn;\n';
  writeFileSync(CRED_FILE, txt.slice(0, ai) + block + txt.slice(si));
  return { changed: true };
}
function patchSession() {
  const txt = readFileSafe(SESS_FILE);
  if (!txt) throw new Error('session 文件不存在，需手动处理: ' + SESS_FILE);
  if (txt.includes(MARK)) return { changed: false };
  const re = /(\t+)await link\(\s*tmp\s*,\s*finalPath\s*\);/;
  const m = re.exec(txt);
  if (!m) throw new Error('session 补丁锚点缺失(await link(tmp, finalPath))，需手动处理: ' + SESS_FILE);
  const indent = m[1];
  let patched = txt.slice(0, m.index) +
    indent + '/* HarmonyOS patch: 本机不支持硬链接(EPERM)，link→rename */\n' +
    indent + 'await rename(tmp, finalPath);' +
    txt.slice(m.index + m[0].length);
  // 仅换调用不补 import 会 ReferenceError(rename is not defined)：新 dsh 版本 fs/promises import 只含 link，
  // 必须在 import 解构里补上 rename（否则每次会话落盘都炸，2026-08-18 实测）。
  const im = /(import\s*\{[^}]*?)\}\s*from\s*["']node:fs\/promises["'];/.exec(patched);
  if (im && !/\brename\b/.test(im[1])) {
    patched = patched.slice(0, im.index + im[1].length) + ', rename' + patched.slice(im.index + im[1].length);
  }
  writeFileSync(SESS_FILE, patched);
  return { changed: true };
}
function patchPermission() {
  const txt = readFileSafe(PERM_FILE);
  if (!txt) throw new Error('permission-presets 文件不存在，需手动处理: ' + PERM_FILE);
  if (txt.includes(MARK)) return { changed: false };
  // 前置条件：此版本仍把 sandboxMode 读自 bash shell（fs 沙箱未启用时该字段不存在，patch 才需要）。
  // 若上游改读 ctx.fs.sandboxMode 或其他来源，锚点会失败并提示人工确认，绝不静默打错。
  const injRe = /static\s+inject\s*=\s*(\[[^\]]*\])/;
  const injM = injRe.exec(txt);
  if (!injM || !injM[1].includes('"shell"')) {
    throw new Error('permission 补丁锚点缺失(inject 数组无 "shell")，需手动处理: ' + PERM_FILE);
  }
  if (!/ctx\.shell\.sandboxMode/.test(txt)) {
    throw new Error('permission 补丁锚点缺失(ctx.shell.sandboxMode)，需手动处理: ' + PERM_FILE);
  }
  const newInject = injM[1].replace('"shell"', '"fs"');
  // 先替换 this.ctx.shell. 形式（其包含 ctx.shell. 子串），再替换剩余直接引用。
  let patched = txt
    .replace(/this\.ctx\.shell\.sandboxMode/g, 'this.ctx.fs.sandboxMode')
    .replace(/ctx\.shell\.sandboxMode/g, 'ctx.fs.sandboxMode');
  patched = patched.slice(0, injM.index) +
    '/* HarmonyOS patch: 无 bash shell(沙箱原生依赖被禁)，改用 fs 沙箱的 sandboxMode(纯 JS，在运行) */\n\tstatic inject = ' + newInject +
    patched.slice(injM.index + injM[0].length);
  writeFileSync(PERM_FILE, patched);
  return { changed: true };
}
// read_image 持久化：dsh-attachment-local 在本机(Android/HarmonyOS 存储)对 link() 报 EPERM，
// 且部分挂载点/目录无法以只读句柄打开(EPERM/EACCES/ENOTSUP)。syncDirectory 增挂载点 guard，
// link 失败时改按 copy 发布(EEXIST 竞态走完整性校验)。补 copyFile import。
function patchAttachment() {
  const txt = readFileSafe(ATTACH_FILE);
  if (!txt) throw new Error('attachment-local 文件不存在，需手动处理: ' + ATTACH_FILE);
  if (txt.includes(MARK)) return { changed: false };
  let patched = txt;
  // 1) import 补 copyFile（仅当干净 import 无 copyFile 时替换，幂等）。
  const impRe = /(import\s*\{\s*chmod,\s*)link(\s*,)/;
  const im = impRe.exec(patched);
  if (im) patched = patched.slice(0, im.index) + im[1] + 'copyFile, link' + im[2] + patched.slice(im.index + im[0].length);
  // 2) syncDirectory 挂载点 guard：把「直接 open 只读句柄」换成 try/catch 容错。
  const syncAnchor = '\t/* v8 ignore start -- Windows cannot exercise directory fsync; POSIX behavior tests enforce this peer. */\n\tconst handle = await open(path, constants.O_RDONLY);';
  if (patched.includes(syncAnchor)) {
    patched = patched.replace(syncAnchor,
      '\t/* v8 ignore start -- Windows cannot exercise directory fsync; POSIX behavior tests enforce this peer. */\n' +
      '\t/* HarmonyOS patch: 部分挂载点/目录无法以只读句柄打开(EPERM/EACCES/ENOTSUP)，跳过该次 fsync，持久化归挂载所有者。 */\n' +
      '\tlet handle;\n' +
      '\ttry {\n' +
      '\t\thandle = await open(path, constants.O_RDONLY);\n' +
      '\t} catch (error) {\n' +
      '\t\t/* v8 ignore next -- 无法 fsync 的边界走 return，不再上抛。 */\n' +
      '\t\tif (error instanceof Error && "code" in error && ["EPERM", "EACCES", "ENOTSUP"].includes(error.code)) return;\n' +
      '\t\t/* v8 ignore next -- 其余错误如实上抛。 */\n' +
      '\t\tthrow error;\n' +
      '\t}');
  } else if (!patched.includes('let handle;\n\t\t\thandle = await open(path, constants.O_RDONLY)')) {
    throw new Error('attachment 补丁锚点缺失(syncDirectory 只读句柄)，需手动处理: ' + ATTACH_FILE);
  }
  // 3) link EPERM → copyFile 回退。锚定为干净 link 段(仅捕获 EEXIST)。
  const linkAnchor = '\t\t\tawait link(temporary, target);\n' +
    '\t\t} catch (error) {\n' +
    '\t\t\t/* v8 ignore next -- Private same-filesystem directories make EEXIST the only recoverable link race. */\n' +
    '\t\t\tif (!(error instanceof Error && "code" in error && error.code === "EEXIST")) throw error;\n' +
    '\t\t\tif (digest(new Uint8Array(await readFile(target))) !== sha256) throw new AttachmentError("Stored attachment failed integrity verification.", "ATTACHMENT_CORRUPT");\n' +
    '\t\t}';
  if (patched.includes(linkAnchor)) {
    patched = patched.replace(linkAnchor,
      '\t\t\tawait link(temporary, target);\n' +
      '\t\t} catch (error) {\n' +
      '\t\t\t/* HarmonyOS patch: 不支持硬链接的存储(如 Android/HarmonyOS)对 link() 报 EPERM，改按 copy 发布。 */\n' +
      '\t\t\tif (!(error instanceof Error && "code" in error)) throw error;\n' +
      '\t\t\tif (error.code === "EPERM") {\n' +
      '\t\t\t\ttry {\n' +
      '\t\t\t\t\tawait copyFile(temporary, target, constants.COPYFILE_EXCL);\n' +
      '\t\t\t\t} catch (copyError) {\n' +
      '\t\t\t\t\t/* v8 ignore next -- copy 发布竞态与 link 相同：EEXIST 即视为已发布。 */\n' +
      '\t\t\t\t\tif (!(copyError instanceof Error && "code" in copyError && copyError.code === "EEXIST")) throw copyError;\n' +
      '\t\t\t\t\tif (digest(new Uint8Array(await readFile(target))) !== sha256) throw new AttachmentError("Stored attachment failed integrity verification.", "ATTACHMENT_CORRUPT");\n' +
      '\t\t\t\t}\n' +
      '\t\t\t} else if (error.code === "EEXIST") {\n' +
      '\t\t\t\tif (digest(new Uint8Array(await readFile(target))) !== sha256) throw new AttachmentError("Stored attachment failed integrity verification.", "ATTACHMENT_CORRUPT");\n' +
      '\t\t\t} else {\n' +
      '\t\t\t\tthrow error;\n' +
      '\t\t\t}\n' +
      '\t\t}');
  } else if (!patched.includes('await copyFile(temporary, target, constants.COPYFILE_EXCL)')) {
    throw new Error('attachment 补丁锚点缺失(link 段)，需手动处理: ' + ATTACH_FILE);
  }
  writeFileSync(ATTACH_FILE, patched);
  return { changed: true };
}
function patchVision() {
  const txt = readFileSafe(VISUAL_FILE);
  if (!txt) throw new Error('dsh-visual-plugin 入口不存在，需手动处理: ' + VISUAL_FILE);
  if (txt.includes(MARK)) return { changed: false };
  let patched = txt;
  // 1) 面板未配置时的回退常量（紧跟 DEFAULT_API_KEY_ENV 之后）。
  const constAnchor = 'const DEFAULT_API_KEY_ENV = "VISION_API_KEY";';
  if (patched.includes(constAnchor) && !patched.includes('const FALLBACK_VISION_MODEL')) {
    patched = patched.replace(constAnchor, constAnchor + '\n' +
      '/* HarmonyOS patch: 视觉面板未配置时回退到主 DeepSeek 视觉模型 + 同一密钥。 */\n' +
      'const FALLBACK_VISION_MODEL = "deepseek-v4-flash-vision-exp";\n' +
      'const DEEPSEEK_PROVIDER_NS = settingsNamespace("llm-deepseek");\n' +
      'const DEEPSEEK_API_KEY_ENV = "DEEPSEEK_API_KEY";\n' +
      'const DEEPSEEK_BASE_URL = "https://api.deepseek.com";');
  }
  // 2) resolvedFacts：面板配置为空时回退到 llm-deepseek 的 baseURL/凭据引用 + 主视觉模型。
  const factsAnchor = '\t\tif (url.length === 0 || model.length === 0) return void 0;\n' +
    '\t\tconst apiKeyEnv = value?.apiKeyEnv ?? "VISION_API_KEY";\n' +
    '\t\tconst resolved = await credentials.resolve(credentialRef(apiKeyEnv));\n' +
    '\t\tif (resolved === void 0) return void 0;\n' +
    '\t\treturn {\n' +
    '\t\t\turl,\n' +
    '\t\t\tmodel,\n' +
    '\t\t\tapiKey: resolved.value\n' +
    '\t\t};';
  if (patched.includes(factsAnchor)) {
    patched = patched.replace(factsAnchor,
      '\t\tif (url.length > 0 && model.length > 0) {\n' +
      '\t\t\tconst apiKeyEnv = value?.apiKeyEnv ?? "VISION_API_KEY";\n' +
      '\t\t\tconst resolved = await credentials.resolve(credentialRef(apiKeyEnv));\n' +
      '\t\t\tif (resolved !== void 0) return {\n' +
      '\t\t\t\turl,\n' +
      '\t\t\t\tmodel,\n' +
      '\t\t\t\tapiKey: resolved.value\n' +
      '\t\t\t};\n' +
      '\t\t}\n' +
      '\t\t/* HarmonyOS patch: 面板未配置时回退到主 DeepSeek 视觉模型，复用 llm-deepseek 的 baseURL 与凭据引用。 */\n' +
      '\t\tconst deepseek = settings.get(DEEPSEEK_PROVIDER_NS) ?? {};\n' +
      '\t\tconst fallbackBaseUrl = typeof deepseek.baseURL === "string" && deepseek.baseURL.length > 0 ? deepseek.baseURL : DEEPSEEK_BASE_URL;\n' +
      '\t\tconst fallbackApiKeyEnv = typeof deepseek.apiKeyEnv === "string" && deepseek.apiKeyEnv.length > 0 ? deepseek.apiKeyEnv : DEEPSEEK_API_KEY_ENV;\n' +
      '\t\tconst fallbackKey = await credentials.resolve(credentialRef(fallbackApiKeyEnv));\n' +
      '\t\tif (fallbackKey === void 0) return void 0;\n' +
      '\t\treturn {\n' +
      '\t\t\turl: fallbackBaseUrl,\n' +
      '\t\t\tmodel: FALLBACK_VISION_MODEL,\n' +
      '\t\t\tapiKey: fallbackKey.value\n' +
      '\t\t};');
  } else if (!patched.includes('const deepseek = settings.get(DEEPSEEK_PROVIDER_NS)')) {
    throw new Error('vision 补丁锚点缺失(resolvedFacts)，需手动处理: ' + VISUAL_FILE);
  }
  // 3) describeImage：空 content(PROTOCOL)重试一次，仍空则降级为明确提示而非硬抛。
  const descAnchor = '\tconst result = await callChatCompletions(completionsUrl(baseUrl), apiKey, model, messages, signal);\n' +
    '\tconst describe = { description: result.content };\n' +
    '\tif (result.usage !== void 0) describe.usage = result.usage;\n' +
    '\treturn describe;';
  if (patched.includes(descAnchor)) {
    patched = patched.replace(descAnchor,
      '\t/* HarmonyOS patch: 自定义 prompt 偶发返回空 content，重试一次；仍为空则降级为明确提示而非硬抛。 */\n' +
      '\tconst url = completionsUrl(baseUrl);\n' +
      '\tconst describeOf = (result) => result.usage !== void 0 ? { description: result.content, usage: result.usage } : { description: result.content };\n' +
      '\tlet lastError;\n' +
      '\tfor (let attempt = 0; attempt < 2; attempt += 1) {\n' +
      '\t\ttry {\n' +
      '\t\t\treturn describeOf(await callChatCompletions(url, apiKey, model, messages, signal));\n' +
      '\t\t} catch (error) {\n' +
      '\t\t\tif (!(error instanceof VisionError && error.code === "PROTOCOL")) throw error;\n' +
      '\t\t\tlastError = error;\n' +
      '\t\t}\n' +
      '\t}\n' +
      '\tif (lastError !== void 0) return { description: "（视觉模型未返回内容，请重试或换个问法）" };\n' +
      '\treturn { description: "（视觉模型未返回内容）" };');
  } else if (!patched.includes('const describeOf = (result) =>')) {
    throw new Error('vision 补丁锚点缺失(describeImage)，需手动处理: ' + VISUAL_FILE);
  }
  writeFileSync(VISUAL_FILE, patched);
  return { changed: true };
}
function patchAll() {
  const r1 = patchCredentials(), r2 = patchSession(), r3 = patchPermission(), r4 = patchAttachment(), r5 = patchVision();
  for (const f of [CRED_FILE, SESS_FILE, PERM_FILE, ATTACH_FILE, VISUAL_FILE]) {
    if (!readFileSafe(f).includes(MARK)) throw new Error('补丁校验失败(标记缺失): ' + f);
  }
  return { credential: r1.changed, session: r2.changed, permission: r3.changed, attachment: r4.changed, vision: r5.changed };
}

// ---- 锁 / 重启 ----
function acquireLock() {
  try { writeFileSync(LOCK, String(process.pid), { flag: 'wx' }); return true; }
  catch { return false; }
}
function releaseLock() { try { unlinkSync(LOCK); } catch {} }

function stopDsh() {
  const r = sh('sh', ['-c', 'ps -ef 2>/dev/null | grep -F "dsh/lib/bin.js" | grep -v grep | awk \'{print $2}\'']);
  const pids = (r.out || '').trim().split(/\s+/).filter(Boolean);
  let n = 0;
  for (const p of pids) {
    const pid = Number(p);
    if (Number.isInteger(pid) && pid > 1) { try { process.kill(pid, 'SIGKILL'); n++; } catch {} }
  }
  return n;
}
function restartDsh() {
  const r = sh('sh', [WEB_SH], { timeout: 60000 });
  if (!r.ok) throw new Error('dsh-web.sh 重启失败: ' + tail(r.out));
}
export async function isUp() {
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 1500);
    const res = await fetch('http://127.0.0.1:3080/', { signal: ctl.signal });
    clearTimeout(t);
    return res.ok;
  } catch { return false; }
}

// ---- 升级 / 回滚 ----
export async function install() {
  const before = readInstalled();
  const latest = getLatest();
  log('升级: ' + (before || '?') + ' → ' + (latest || '?'));
  if (before === latest && before) log('已是最新，仍重装同版本以修复补丁/产物。');
  const target = latest || before;
  if (!manualInstall(target)) {
    const r = npm('install', '@deepseek-ai/dsh@' + target);
    if (!r.ok) throw new Error('npm install 失败: ' + tail(r.out));
  }
  log('安装完成 → ' + target);
  writeFileSync(PREV, before);
  const p = patchAll();
  log('补丁: credential=' + (p.credential ? '重打' : '已存在') + ', session=' + (p.session ? '重打' : '已存在') + ', permission=' + (p.permission ? '重打' : '已存在') + ', attachment=' + (p.attachment ? '重打' : '已存在') + ', vision=' + (p.vision ? '重打' : '已存在'));
  const killed = stopDsh();
  if (killed > 0) log('已停旧 dsh 进程 ' + killed + ' 个');
  restartDsh();
  if (!(await isUp())) throw new Error('dsh 重启后 3080 未起来，见 ~/dsh-web.log');
  const webLog = readFileSafe(join(HOME, 'dsh-web.log'));
  if (/agent-preset|preset-invalid|preset invalid/i.test(webLog)) {
    log('⚠ dsh 日志出现 preset 报错，harmony-chat 预设可能需重建');
  }
  const installed = readInstalled();
  log('完成: 当前 ' + installed);
  return { ok: true, installed, latest, patched: p };
}
async function rollback(version) {
  const target = version || readFileSafe(PREV).trim();
  if (!target) throw new Error('无回滚目标版本（无 ~/dsh-update.prev）');
  log('回滚到 ' + target);
  if (!manualInstall(target)) {
    const r = npm('install', '@deepseek-ai/dsh@' + target);
    if (!r.ok) throw new Error('npm install 失败: ' + tail(r.out));
  }
  patchAll();
  stopDsh();
  restartDsh();
  if (!(await isUp())) throw new Error('回滚后 3080 未起来');
  return { ok: true, installed: readInstalled() };
}

// ---- 交互 ----
function ask(q) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((res) => rl.question(q, (a) => { rl.close(); res(a); }));
}
async function interactive() {
  const c = check();
  console.log('已装 ' + c.installed + ' / 最新 ' + c.latest + '  ' + (c.upToDate ? '✓ 已是最新' : '有更新'));
  if (c.upToDate) { console.log('无需升级。'); return; }
  const a = await ask('是否升级到 ' + c.latest + ' 并重启服务？(y/N) ');
  if (!/^y/i.test(a)) { console.log('已取消。'); return; }
  const r = await install();
  console.log(JSON.stringify(r, null, 2));
}

function die(msg) { console.error('✗ ' + msg); process.exit(1); }

async function main() {
  const cmd = process.argv[2];
  if (cmd === 'check') { console.log(JSON.stringify(check(), null, 2)); return; }
  if (cmd === 'patch') { console.log(JSON.stringify(patchAll(), null, 2)); return; }
  if (cmd === 'install' || cmd === 'update') {
    if (!acquireLock()) return die('另一操作进行中(锁 ' + LOCK + ')');
    try { console.log(JSON.stringify(await install(), null, 2)); } finally { releaseLock(); }
    return;
  }
  if (cmd === 'rollback') {
    if (!acquireLock()) return die('另一操作进行中');
    try { console.log(JSON.stringify(await rollback(process.argv[3]), null, 2)); } finally { releaseLock(); }
    return;
  }
  if (!acquireLock()) return die('另一操作进行中');
  try { await interactive(); } finally { releaseLock(); }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main().catch(() => process.exit(1));
