#!/usr/bin/env node
/**
 * 安装 git hook —— 每次 commit 后自动重建并生成可分享版本
 *
 * 用法：  node install-hook.js
 *
 * 作用：提交代码后自动生成最新的分享包（并自动删除旧包），
 *       避免忘记手动打包导致发出去的是旧版本。
 */
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const HOOKS_DIR = path.join(ROOT, ".git", "hooks");
const HOOK_PATH = path.join(HOOKS_DIR, "post-commit");

if (!fs.existsSync(path.join(ROOT, ".git"))) {
  console.log("⚠️  当前目录不是 git 仓库，跳过 hook 安装。");
  process.exit(0);
}

const HOOK = `#!/bin/sh
# 自动生成可分享版本（由 install-hook.js 安装）
# 提交后自动重建 + 打包，并删除旧版本包
node "$(dirname "$0")/../../build.js" >/dev/null 2>&1 || true
exit 0
`;

fs.mkdirSync(HOOKS_DIR, { recursive: true });
fs.writeFileSync(HOOK_PATH, HOOK, "utf8");
try { fs.chmodSync(HOOK_PATH, 0o755); } catch (e) {}

console.log("✅ 已安装 git post-commit hook");
console.log("   " + HOOK_PATH);
console.log("   今后每次 git commit 后会自动重建并生成分享包（旧包自动删除）。");
console.log("   如需移除：删除该文件即可。");
