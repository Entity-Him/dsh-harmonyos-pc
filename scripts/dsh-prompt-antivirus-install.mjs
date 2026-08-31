#!/usr/bin/env node
/**
 * dsh-prompt-antivirus-install.mjs — 一键安装/更新全局防注入插件到 web + headless profile。
 *
 * 幂等：重复执行安全。步骤：
 *  1) 源码复制到 web profile plugins-src/（dsh-cron 同款布局）；
 *  2) 软链 web profile node_modules/ 与共享 profiles/node_modules/（headless 解析用）；
 *  3) web profile package.json 补 dependencies(link:) + dsh.profile.bundles；
 *  4) headless profile cordis.patch.yml 幂等追加 insert 行。
 * 完成后需重启 dsh-web（`sh scripts/dsh-web.sh`）生效。
 */
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..");
const HOME = homedir();
const PLUGIN_REL = "plugins/dsh-prompt-antivirus";
const SRC = join(REPO, PLUGIN_REL);
const PROFILES = join(HOME, ".dsh", "profiles");

function log(...a) { console.log(...a); }
function die(msg) { console.error("✗ " + msg); process.exit(1); }

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function copyTree(src, dst) {
  rmSync(dst, { recursive: true, force: true });
  mkdirSync(dirname(dst), { recursive: true });
  cpSync(src, dst, { recursive: true });
}

function linkDir(target, link) {
  rmSync(link, { recursive: true, force: true });
  mkdirSync(dirname(link), { recursive: true });
  symlinkSync(target, link, "dir");
}

/**
 * 安装一个仓库 plugins/ 下的 profile 级插件到 web + headless profile（幂等）。
 * @param {object} opts - { pluginDir, pluginName, profilesRoot }
 * @returns {number} 变更计数（0 = 已是最新）
 */
export function installProfilePlugin({ pluginDir, pluginName, profilesRoot }) {
  if (!existsSync(join(pluginDir, "package.json"))) die(`插件源码缺失: ${pluginDir}`);
  if (!existsSync(join(pluginDir, "lib", "index.js"))) die(`插件入口缺失: ${pluginDir}/lib/index.js`);
  const web = join(profilesRoot, "web");
  const headless = join(profilesRoot, "headless");
  const pluginsSrc = join(web, "plugins-src", pluginName);
  let changes = 0;

  log(`① 源码 → ${pluginsSrc}`);
  copyTree(pluginDir, pluginsSrc);
  changes++;

  log(`② 软链 web profile node_modules`);
  linkDir(pluginsSrc, join(web, "node_modules", pluginName));
  log(`③ 软链共享 profiles/node_modules（headless 解析用）`);
  linkDir(pluginsSrc, join(profilesRoot, "node_modules", pluginName));

  log(`④ web profile 清单注册（${pluginName}）`);
  if (registerWebManifest(web, pluginsSrc, pluginName)) changes++;

  log(`⑤ headless profile 补丁（${pluginName}）`);
  if (patchHeadless(headless, pluginName)) changes++;

  return changes;
}

/** 幂等注册到 web profile package.json（dependencies + bundles）。返回是否变更。 */
function registerWebManifest(web, pluginsSrc, pluginName) {
  const manifestPath = join(web, "package.json");
  if (!existsSync(manifestPath)) die(`找不到 web profile 清单: ${manifestPath}`);
  const manifest = readJson(manifestPath);
  let changed = false;
  manifest.dependencies ??= {};
  if (!manifest.dependencies[pluginName]) {
    manifest.dependencies[pluginName] = `link:${pluginsSrc}`;
    changed = true;
  }
  manifest.dsh ??= {};
  manifest.dsh.profile ??= {};
  manifest.dsh.profile.bundles ??= [];
  if (!manifest.dsh.profile.bundles.includes(pluginName)) {
    manifest.dsh.profile.bundles.push(pluginName);
    changed = true;
  }
  if (changed) {
    writeJson(manifestPath, manifest);
    log(`  package.json: 已注册 dependencies + bundles（${pluginName}）`);
  } else {
    log(`  package.json: 已是最新，跳过`);
  }
  return changed;
}

/** 幂等追加 headless profile 的 insert 行。返回是否变更。 */
function patchHeadless(headless, pluginName) {
  const patchPath = join(headless, "cordis.patch.yml");
  if (!existsSync(patchPath)) die(`找不到 headless profile 补丁: ${patchPath}`);
  const text = readFileSync(patchPath, "utf8");
  if (text.includes(pluginName)) {
    log(`  headless cordis.patch.yml: 已存在，跳过`);
    return false;
  }
  const block = `
# --- ${pluginName} (全局防注入; 共享 profiles/node_modules 软链) ---
- insert:
    - id: ${pluginName === "dsh-prompt-antivirus" ? "prompt-antivirus" : pluginName}
      name: ${pluginName}
`;
  writeFileSync(patchPath, `${text.replace(/\s*$/, "")}\n${block}`);
  log(`  headless cordis.patch.yml: 已追加 insert`);
  return true;
}

function main() {
  const changes = installProfilePlugin({
    pluginDir: SRC,
    pluginName: "dsh-prompt-antivirus",
    profilesRoot: PROFILES,
  });
  log(`完成（变更 ${changes} 处）。重启 dsh-web 后生效：cd ${REPO} && sh scripts/dsh-web.sh`);
}

// 直接执行时才跑 main；被 dsh-hm-update.mjs import 时仅导出函数。
const executedDirectly = process.argv[1] !== undefined && import.meta.url === new URL(`file://${process.argv[1]}`).href;
if (executedDirectly) main();
