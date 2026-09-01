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
// 工作区新文件写入(create-if-absent)走硬链接发布，鸿蒙 /storage 挂载对 link() 报 EPERM，
// 即使目标不存在也失败；补丁在确认目标缺失后改按 rename 发布，保住 create-if-absent 语义。
// 官方 alpha.2/alpha.3 均未含此兜底，升级重装会被冲掉，故必须纳入 patchAll 幂等重打。
const FS_LOCAL_FILE = join(DSH_DIR, 'node_modules', '@deepseek-ai', 'dsh-fs-local', 'lib', 'index.js');
// 0.1.2-alpha.2 起官方把裸插件名解析交给 node 内部 ESM loader(internal.import(name, baseUrl))；
// 鸿蒙自带 node v22.7.0 的内部 loader 既无 getOrCreateModuleJob 也无 getModuleJobForImport，
// ModuleLoader.fromInternal() 因此判定 shape 未知并返回 undefined → 裸插件名从 dsh-test 解析，
// profile 里另装的社区插件全线 "Cannot find package"。需给 cordis-plugin-loader 补 v0(legacy) 分类。
const CORDIS_LOADER_FILE = join(DSH_DIR, 'node_modules', '@deepseek-ai', 'cordis-plugin-loader', 'lib', 'index.js');
// 0.1.2-alpha.2 重设计 dsh-settings：移除 installSettingsSection / settingsNamespace 导出，迁至
// SettingsProvider.installSection。社区插件(dsh-harmonyos-market/dshmarket/dsh-visual-plugin/
// dsh-knowledge-base/dsh-workstation/dsh-hiboard-push)仍按旧 API 导入，需加兼容垫片。
const SETTINGS_FILE = join(DSH_DIR, 'node_modules', '@deepseek-ai', 'dsh-settings', 'lib', 'index.js');
// dsh web 认证：0.1.2-alpha.2 每次进程启动都换新 launch token，本机新标签页/收藏夹的裸地址
// http://127.0.0.1:3080 永远 401「authentication required」。回环地址改为免 token 自动签发 cookie。
const CONN_FILE = join(DSH_DIR, 'node_modules', '@deepseek-ai', 'dsh-client-connection', 'lib', 'index.js');
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
// 因此遍历 versions 取数值最高的版本。版本解析为 5 元组 [maj,min,pa,stage,pre]：
// alpha=1 / rc=2 / 正式版=3，使 dsh-v0.1.2-alpha.2 这类 alpha 预发布也能正确参与比较。
function getLatest() {
  const r = npm('view', '@deepseek-ai/dsh', 'versions', '--json');
  if (!r.ok) throw new Error('npm view 失败: ' + tail(r.out));
  let list = [];
  try { list = JSON.parse(r.out.trim()); } catch {}
  if (!Array.isArray(list) || !list.length) throw new Error('npm 未返回可用版本列表: ' + tail(r.out));
  const nums = (v) => {
    const m = /^(\d+)\.(\d+)\.(\d+)(?:-(alpha|rc)\.(\d+))?/.exec(String(v).trim());
    return m ? [Number(m[1]), Number(m[2]), Number(m[3]), m[4] === 'alpha' ? 1 : m[4] === 'rc' ? 2 : 3, Number(m[5] || 0)] : null;
  };
  const sorted = list.filter((v) => nums(v)).sort((a, b) => {
    const A = nums(a), B = nums(b);
    for (let i = 0; i < 5; i++) if (A[i] !== B[i]) return A[i] - B[i];
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
  //    官方 0.1.2-alpha.2 打包产物把 sha256 函数重命名为 digest$1（rc.2 名为 digest），
  //    故用正则同时适配两种命名，捕获的函数名在替换块中原样沿用。
  const linkRe = /\t\t\tawait link\(temporary, target\);\n\t\t\} catch \(error\) \{\n\t\t\t\/\* v8 ignore next -- Private same-filesystem directories make EEXIST the only recoverable link race\. \*\/\n\t\t\tif \(!\(error instanceof Error && "code" in error && error\.code === "EEXIST"\)\) throw error;\n\t\t\tif \((digest(?:\$1)?)\(new Uint8Array\(await readFile\(target\)\)\) !== sha256\) throw new AttachmentError\("Stored attachment failed integrity verification\.", "ATTACHMENT_CORRUPT"\);\n\t\t\}/;
  const linkM = linkRe.exec(patched);
  if (linkM) {
    const dg = linkM[1];
    patched = patched.slice(0, linkM.index) +
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
      `\t\t\t\t\tif (${dg}(new Uint8Array(await readFile(target))) !== sha256) throw new AttachmentError("Stored attachment failed integrity verification.", "ATTACHMENT_CORRUPT");\n` +
      '\t\t\t\t}\n' +
      '\t\t\t} else if (error.code === "EEXIST") {\n' +
      `\t\t\t\tif (${dg}(new Uint8Array(await readFile(target))) !== sha256) throw new AttachmentError("Stored attachment failed integrity verification.", "ATTACHMENT_CORRUPT");\n` +
      '\t\t\t} else {\n' +
      '\t\t\t\tthrow error;\n' +
      '\t\t\t}\n' +
      '\t\t}' +
      patched.slice(linkM.index + linkM[0].length);
  } else if (!patched.includes('await copyFile(temporary, target, constants.COPYFILE_EXCL)')) {
    throw new Error('attachment 补丁锚点缺失(link 段)，需手动处理: ' + ATTACH_FILE);
  }
  writeFileSync(ATTACH_FILE, patched);
  return { changed: true };
}
// 工作区新文件写入：dsh-fs-local 在 createIfAbsent 分支先 link() 再 fallback，本机(Android/HarmonyOS
// 存储)对 link() 报 EPERM 且目标不存在也报错，导致新文件写入直接炸。先查目标是否已存在：
// 存在则该抛 create 冲突(原 throwGuardedCreateFailure 语义)，不存在则改按 rename 发布。
function patchFsLocal() {
  const txt = readFileSafe(FS_LOCAL_FILE);
  if (!txt) throw new Error('fs-local 文件不存在，需手动处理: ' + FS_LOCAL_FILE);
  // 幂等：本补丁专用的可读注释作为标记（用大写的 HarmonyOS 前缀与其它补丁区分）。
  if (txt.includes('HarmonyOS /storage mounts reject hard links')) return { changed: false };
  const re = /([ \t]+)await throwGuardedCreateFailure\(error, absolutePath, createIfAbsent\.displayPath, inspectPublicationTarget\);/;
  const m = re.exec(txt);
  if (!m) throw new Error('fs-local 补丁锚点缺失(throwGuardedCreateFailure createIfAbsent)，需手动处理: ' + FS_LOCAL_FILE);
  const ind = m[1];
  const block = ind + 'let existing;\n' +
    ind + 'try {\n' +
    ind + '\texisting = await inspectPublicationTarget(absolutePath);\n' +
    ind + '} catch (metadataError) {\n' +
    ind + '\tif (!isENOENT(metadataError) && !isENOTDIR(metadataError)) throw new FsError(`cannot write "${createIfAbsent.displayPath}": ${errorMessage(metadataError)}`, "FS_IO_ERROR", { cause: metadataError });\n' +
    ind + '}\n' +
    ind + 'if (existing !== void 0) {\n' +
    ind + '\tawait throwGuardedCreateFailure(error, absolutePath, createIfAbsent.displayPath, inspectPublicationTarget);\n' +
    ind + '}\n' +
    ind + '// HarmonyOS /storage mounts reject hard links with EPERM even for\n' +
    ind + '// absent targets; publish via rename instead (target absence was\n' +
    ind + '// just verified, so create-if-absent semantics are preserved).\n' +
    ind + 'await rename(tempPath, absolutePath);';
  writeFileSync(FS_LOCAL_FILE, txt.replace(re, block));
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
// node 内部 ESM loader 形状识别：v2(getOrCreateModuleJob) / v1(getModuleJobForImport) 之外，
// 还要兜底识别仅有 import/resolve/loadCache 的 legacy loader（node 22.7.0 鸿蒙自带）。
// 否则 internal=undefined，profile 插件无法从 profile 目录解析，dsh 启动直接崩。
function patchCordisLoader() {
  const txt = readFileSafe(CORDIS_LOADER_FILE);
  if (!txt) throw new Error('cordis-plugin-loader 文件不存在，需手动处理: ' + CORDIS_LOADER_FILE);
  if (txt.includes(MARK)) return { changed: false };
  const anchor = 'const version = typeof raw.getOrCreateModuleJob === "function" ? "v2" : typeof raw.getModuleJobForImport === "function" ? "v1" : void 0;';
  if (!txt.includes(anchor)) throw new Error('cordis-loader 补丁锚点缺失(version shape)，需手动处理: ' + CORDIS_LOADER_FILE);
  const replacement =
    '/* HarmonyOS patch: node v22.7.0 内部 loader 无 getOrCreateModuleJob/getModuleJobForImport，\n' +
    '\t\t\t\t\t\t\t\t\t\t\t\t * 官方识别返回 undefined 导致裸插件名从 dsh-test 解析 fail；有 import 即为可用 legacy loader，补 v0。 */\n' +
    '\t\t\t\t\t\t\t\t\t\t\t\tconst version = typeof raw.getOrCreateModuleJob === "function" ? "v2" : typeof raw.getModuleJobForImport === "function" ? "v1" : typeof raw.import === "function" ? "v0" : void 0;';
  writeFileSync(CORDIS_LOADER_FILE, txt.split(anchor).join(replacement));
  return { changed: true };
}
// 恢复 dsh-settings 旧导出(settingsNamespace/installSettingsSection)，委托给新版
// SettingsProvider.installSection，让沿用旧 API 的社区插件无需改源码即可在 0.1.2-alpha.2 运行。
function patchSettingsCompat() {
  const txt = readFileSafe(SETTINGS_FILE);
  if (!txt) throw new Error('dsh-settings 文件不存在，需手动处理: ' + SETTINGS_FILE);
  if (txt.includes(MARK)) return { changed: false };
  const anchor = 'export { SettingsConflictError, SettingsProvider, SettingsProvider as default, redactSecrets };';
  if (!txt.includes(anchor)) throw new Error('dsh-settings 补丁锚点缺失(export 行)，需手动处理: ' + SETTINGS_FILE);
  const block =
    '\n//#region HarmonyOS patch: restore exports removed upstream in 0.1.2-alpha.2\n' +
    '// settingsNamespace 是命名空间品牌化助手；installSettingsSection 迁入 SettingsProvider.installSection。\n' +
    '// 社区插件(dsh-harmonyos-market/dshmarket/dsh-visual-plugin/dsh-knowledge-base/dsh-workstation/dsh-hiboard-push)\n' +
    '// 仍按旧 API 导入，保持可用。\n' +
    'function settingsNamespace(value) {\n' +
    '\tif (!NAMESPACE_PATTERN.test(value)) throw new TypeError(`settings namespace "${value}" must match ${String(NAMESPACE_PATTERN)}`);\n' +
    '\treturn value;\n' +
    '}\n' +
    'function installSettingsSection(ctx, ns, schema, entry, hooks) {\n' +
    '\tctx.inject(["settings"], (sctx) => {\n' +
    '\t\tsctx.settings.installSection(ctx, ns, schema, entry, hooks);\n' +
    '\t});\n' +
    '}\n' +
    '//#endregion\n';
  const replacement = 'export { SettingsConflictError, SettingsProvider, SettingsProvider as default, deepEqualJson, installSettingsSection, redactSecrets, settingsNamespace };';
  writeFileSync(SETTINGS_FILE, txt.split(anchor).join(block + replacement));
  return { changed: true };
}
// dsh web 回环免 token：单用户本机 cookie 无效时对 GET / 自动签发 30 天会话 cookie
// （与 token 交换同一持久签名密钥、绑定 authority），有效 cookie 直接放行，无 303 循环；
// 旧进程残留的过期 token URL 也走回环兜底换新 cookie，不再死锁 401；非回环仍走原 token 流程。
function patchLoopbackAuth() {
  const txt = readFileSafe(CONN_FILE);
  if (!txt) throw new Error('dsh-client-connection 文件不存在，需手动处理: ' + CONN_FILE);
  if (txt.includes(MARK)) return { changed: false };
  const helperAnchor = 'function tokenMatches(actual, expected) {\n\tconst actualBytes = Buffer.from(actual, "utf8");\n\tconst expectedBytes = Buffer.from(expected, "utf8");\n\treturn actualBytes.byteLength === expectedBytes.byteLength && timingSafeEqual(actualBytes, expectedBytes);\n}';
  const inlineMint = '\t\t\t\tconst issuedAt = Date.now();\n\t\t\t\tconst expiresAt = issuedAt + this.maxAgeMilliseconds;\n\t\t\t\tconst value = encodeCookie({\n\t\t\t\t\tversion: COOKIE_PAYLOAD_VERSION,\n\t\t\t\t\tauthority,\n\t\t\t\t\tissuedAt,\n\t\t\t\t\texpiresAt\n\t\t\t\t}, this.secret);\n\t\t\t\tres.writeHead(303, {\n\t\t\t\t\t"cache-control": "no-store",\n\t\t\t\t\t"location": "/",\n\t\t\t\t\t"referrer-policy": "no-referrer",\n\t\t\t\t\t"set-cookie": sessionCookie(cookieName(authority), value, expiresAt, Math.floor(this.maxAgeMilliseconds / 1e3))\n\t\t\t\t});\n\t\t\t\tres.end();\n\t\t\t\treturn false;\n\t\t\t}';
  const tokensTailAnchor = '\t\t\tthis.writeUnauthorized(req, res);\n\t\t\treturn false;\n\t\t}\n\t\tif (this.isAuthenticated(req)) return true;';
  const noTokenTailAnchor = '\t\tif (this.isAuthenticated(req)) return true;\n\t\tthis.writeUnauthorized(req, res);\n\t\treturn false;\n\t}';
  for (const [name, anchor] of [['helper', helperAnchor], ['inlineMint', inlineMint], ['tokensTail', tokensTailAnchor], ['noTokenTail', noTokenTailAnchor]]) {
    if (!txt.includes(anchor)) throw new Error('client-connection 补丁锚点缺失(' + name + ')，需手动处理: ' + CONN_FILE);
  }
  const helper =
    '\n/** Loopback authorities are trusted on this single-user machine (HarmonyOS patch). */\n' +
    'function isLoopbackAuthority(authority) {\n' +
    '\tif (typeof authority !== "string") return false;\n' +
    '\tlet host = authority;\n' +
    '\tif (host.startsWith("[")) {\n' +
    '\t\tconst end = host.indexOf("]");\n' +
    '\t\tif (end === -1) return false;\n' +
    '\t\thost = host.slice(1, end);\n' +
    '\t} else {\n' +
    '\t\thost = host.split(":")[0];\n' +
    '\t}\n' +
    '\treturn host === "localhost" || host === "::1" || host === "0:0:0:0:0:0:0:1" || host.startsWith("127.");\n' +
    '}';
  const mintCall = '\t\t\t\tthis.mintCookie(req, res, authority);\n\t\t\t\treturn false;\n\t\t\t}';
  const staleFallback =
    '\t\t\t/* HarmonyOS patch: 回环地址兜底——旧进程的过期 token(浏览器里残留的旧 URL)\n' +
    '\t\t\t * 直接换新 cookie，避免「authentication required」死锁；非回环仍 401。 */\n' +
    '\t\t\tif (this.loopbackSession(req)) {\n' +
    '\t\t\t\tthis.mintCookie(req, res, requestAuthority(req.headers));\n' +
    '\t\t\t\treturn false;\n' +
    '\t\t\t}\n';
  const noTokenFallback =
    '\t\t/* HarmonyOS patch: 单用户本机(127.0.0.1/localhost)直接访问 / 无需 token，自动签发\n' +
    '\t\t * 30 天 cookie(与 token 交换同一签名密钥/绑定 authority)，随后刷新即可持续登录。\n' +
    '\t\t * 仅在 cookie 无效时兜底，避免有效会话被 303 循环；非回环地址仍走原 token 流程。 */\n' +
    '\t\tif (this.loopbackSession(req)) {\n' +
    '\t\t\tthis.mintCookie(req, res, requestAuthority(req.headers));\n' +
    '\t\t\treturn false;\n' +
    '\t\t}\n';
  const methods =
    '\t/** Mint the authority-bound 30-day session cookie and redirect to clean `/` (HarmonyOS patch). */\n' +
    '\tmintCookie(req, res, authority) {\n' +
    '\t\tconst issuedAt = Date.now();\n' +
    '\t\tconst expiresAt = issuedAt + this.maxAgeMilliseconds;\n' +
    '\t\tconst value = encodeCookie({\n' +
    '\t\t\tversion: COOKIE_PAYLOAD_VERSION,\n' +
    '\t\t\tauthority,\n' +
    '\t\t\tissuedAt,\n' +
    '\t\t\texpiresAt\n' +
    '\t\t}, this.secret);\n' +
    '\t\tres.writeHead(303, {\n' +
    '\t\t\t"cache-control": "no-store",\n' +
    '\t\t\t"location": "/",\n' +
    '\t\t\t"referrer-policy": "no-referrer",\n' +
    '\t\t\t"set-cookie": sessionCookie(cookieName(authority), value, expiresAt, Math.floor(this.maxAgeMilliseconds / 1e3))\n' +
    '\t\t});\n' +
    '\t\tres.end();\n' +
    '\t}\n' +
    '\t/** True for a GET index request from a trusted loopback authority (HarmonyOS patch). */\n' +
    '\tloopbackSession(req) {\n' +
    '\t\tconst authority = requestAuthority(req.headers);\n' +
    '\t\tif (req.method !== "GET" || authority === void 0 || !isLoopbackAuthority(authority)) return false;\n' +
    '\t\tconst url = new URL(req.url ?? "/", "http://dsh.invalid");\n' +
    '\t\treturn url.pathname === "/";\n' +
    '\t}';
  let patched = txt
    .split(helperAnchor).join(helperAnchor + helper)
    .split(inlineMint).join(mintCall)
    .split(tokensTailAnchor).join(staleFallback + tokensTailAnchor)
    .split(noTokenTailAnchor).join('\t\tif (this.isAuthenticated(req)) return true;\n' + noTokenFallback + '\t\tthis.writeUnauthorized(req, res);\n\t\treturn false;\n\t}\n' + methods);
  writeFileSync(CONN_FILE, patched);
  return { changed: true };
}
function patchAll() {
  const r1 = patchCredentials(), r2 = patchSession(), r3 = patchPermission(), r4 = patchAttachment(), r5 = patchVision();
  const r6 = patchCordisLoader(), r7 = patchSettingsCompat(), r8 = patchLoopbackAuth(), r9 = patchFsLocal();
  for (const f of [CRED_FILE, SESS_FILE, PERM_FILE, ATTACH_FILE, VISUAL_FILE, CORDIS_LOADER_FILE, SETTINGS_FILE, CONN_FILE]) {
    if (!readFileSafe(f).includes(MARK)) throw new Error('补丁校验失败(标记缺失): ' + f);
  }
  if (!readFileSafe(FS_LOCAL_FILE).includes('HarmonyOS /storage mounts reject hard links')) {
    throw new Error('补丁校验失败(标记缺失): ' + FS_LOCAL_FILE);
  }
  return { credential: r1.changed, session: r2.changed, permission: r3.changed, attachment: r4.changed, vision: r5.changed, cordisLoader: r6.changed, settingsCompat: r7.changed, loopbackAuth: r8.changed, fsLocal: r9.changed };
}

// compat-loader.mjs（node v22 鸿蒙运行时 polyfill）依赖的纯 JS 包：npm install 重装核心包时，
// 它们不在依赖树里会被剪掉，剪掉后 dsh 启动即崩（Cannot find module 'fzstd'，2026-08-28 实测，
// 客户端显示 54 插件 pending）。仅当本机存在 compat-loader 才补齐，其余用户零影响。
function ensureCompatDeps() {
  if (!existsSync(join(DSH_DIR, 'compat-loader.mjs'))) return 0;
  const missing = ['fzstd', 'zstd-codec'].filter((p) => !readFileSafe(join(DSH_DIR, 'node_modules', p, 'package.json')));
  if (missing.length === 0) return 0;
  const r = npm('install', ...missing);
  if (!r.ok) throw new Error('兼容依赖安装失败: ' + tail(r.out));
  return missing.length;
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
    // token 认证下根路径无有效 cookie 会 303 跳转（回环补丁下带 cookie 最终 200）。
    // fetch 默认跟随跳转但不会跨跳保留 cookie，最终仍是 3xx；服务在监听即视为 up，
    // 后续「当前 token 能否换到 200」由 dsh-web.sh 的 is_up(curl 任意响应)兜底。
    const res = await fetch('http://127.0.0.1:3080/', { signal: ctl.signal, redirect: 'manual' });
    clearTimeout(t);
    return res.status >= 200 && res.status < 400;
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
  const compat = ensureCompatDeps();
  if (compat > 0) log('补齐兼容依赖: ' + compat + ' 个 (fzstd/zstd-codec)');
  log('安装完成 → ' + target);
  writeFileSync(PREV, before);
  const p = patchAll();
  log('补丁: credential=' + (p.credential ? '重打' : '已存在') + ', session=' + (p.session ? '重打' : '已存在') + ', permission=' + (p.permission ? '重打' : '已存在') + ', attachment=' + (p.attachment ? '重打' : '已存在') + ', vision=' + (p.vision ? '重打' : '已存在') + ', cordisLoader=' + (p.cordisLoader ? '重打' : '已存在') + ', settingsCompat=' + (p.settingsCompat ? '重打' : '已存在') + ', loopbackAuth=' + (p.loopbackAuth ? '重打' : '已存在') + ', fsLocal=' + (p.fsLocal ? '重打' : '已存在'));
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
  ensureCompatDeps();
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
