#!/usr/bin/env node
/**
 * 监听模式 —— 修改源码后自动重建 + 自动打包分享版
 *
 * 用法：  node watch.js
 *
 * 监听范围：
 *   shared/**  与  src/**   源码（改这些会触发重建）
 *   根目录的 index.html / newtab-extension/* 是构建产物，不监听（避免自触发循环）
 */
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = __dirname;
const WATCH_DIRS = ["shared", "src"];

let building = false;
let pending = false;

function build(reason) {
  if (building) { pending = true; return; }
  building = true;
  const t0 = Date.now();
  try {
    console.log("\n🔄 [" + new Date().toLocaleTimeString() + "] " + reason + " → 重建中…");
    const out = execFileSync(process.execPath, [path.join(ROOT, "build.js")], {
      cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"]
    });
    out.split("\n").filter(Boolean).forEach(l => console.log("   " + l));
    console.log("   ⏱️  耗时 " + (Date.now() - t0) + "ms");
  } catch (e) {
    console.log("   ❌ 构建失败：");
    console.log("   " + String(e.stdout || "").trim());
    console.log("   " + String(e.stderr || "").split("\n").slice(0, 5).join("\n   "));
  }
  building = false;
  if (pending) { pending = false; setTimeout(() => build("（合并的改动）"), 100); }
}

console.log("👀 监听模式已启动 —— 修改 shared/ 或 src/ 下的文件将自动重建并打包");
console.log("   源码目录：" + WATCH_DIRS.map(d => path.join(ROOT, d)).join("  "));
console.log("   按 Ctrl+C 退出\n");

// 首次构建
build("启动");

let timer = null;
for (const d of WATCH_DIRS) {
  const dir = path.join(ROOT, d);
  if (!fs.existsSync(dir)) continue;
  fs.watch(dir, { recursive: true }, (eventType, filename) => {
    if (!filename) return;
    // 忽略隐藏文件和临时文件
    if (filename.startsWith(".") || /\.tmp$|\.swp$/.test(filename)) return;
    clearTimeout(timer);
    timer = setTimeout(() => build("检测到 " + d + "/" + filename), 300);
  });
}
