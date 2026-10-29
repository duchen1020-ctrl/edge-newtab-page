#!/usr/bin/env node
/**
 * 构建 + 发布脚本 —— 从 src/ + shared/ 源码生成两版产物，并打包为可分享的 zip
 *
 *   src/index.template.html   src/newtab.template.html
 *   shared/style.css          shared/core.js      shared/VERSION
 *        ↓  build.js
 *   ├── index.html                    （单文件：CSS/JS 全内联，双击即用）
 *   ├── newtab-extension/
 *   │     ├── newtab.html             （引用独立 style.css / newtab.js）
 *   │     ├── newtab.js               （扩展 HOST 适配器 + core.js）
 *   │     └── style.css
 *   └── 美化主页-新标签页扩展-v<版本>.zip   （可直接发给别人）
 *
 * 用法：
 *   node build.js          构建 + 自动打包 + 自动删除旧包
 *   node build.js --no-zip 只构建，不打包
 *
 * 说明：修改功能请改 shared/ 或 src/ 下的模板，然后重新运行本脚本；
 *       直接改 index.html / newtab-extension/* 会在下次构建时被覆盖。
 */
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const write = (p, s) => fs.writeFileSync(path.join(ROOT, p), s);
const exists = (p) => fs.existsSync(path.join(ROOT, p));

const VERSION = read("shared/VERSION").trim();
const styleCss = read("shared/style.css");
const coreJs = read("shared/core.js");

// ---------- HOST 适配器（两版唯一差异点）----------

// 主页版：音乐解析走本地代理
const HOST_STANDALONE = `// ===== 主页版 HOST：音乐解析走本地代理（start-proxy.bat）=====
window.__HOST = {
  mode: "standalone",
  parseMedia(raw, quality) {
    return fetch("http://127.0.0.1:8787/parse?url=" + encodeURIComponent(raw) +
      "&q=" + encodeURIComponent(quality || "standard"))
      .then(r => r.json())
      .catch(() => ({ ok: false, error: "无法连接本地代理，请先双击 start-proxy.bat 启动" }));
  }
};
`;

// 扩展版：音乐解析走 chrome.runtime 消息（由 background.js 处理）
const HOST_EXTENSION = `// ===== 扩展版 HOST：音乐解析走 chrome.runtime 消息（background.js）=====
window.__HOST = {
  mode: "extension",
  parseMedia(raw, quality) {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage({ type: "media_parse", url: raw, musicType: quality }, (resp) => {
          const err = chrome.runtime.lastError;
          if (err) {
            const m = err.message || "";
            if (/Receiving end does not exist|message port closed|Could not establish connection/i.test(m)) {
              resolve({ ok: false, error: "后台未就绪：请在扩展页（chrome://extensions）点「重新加载」本扩展，并重开新标签页再试" });
            } else {
              resolve({ ok: false, error: m });
            }
            return;
          }
          resolve(resp || { ok: false, error: "无响应" });
        });
      } catch (e) {
        resolve({ ok: false, error: String(e && e.message ? e.message : e) });
      }
    });
  }
};
`;

// ---------- 构建 ----------

// 主页版：单文件，CSS/JS 全内联（可单独拷走使用）
function buildIndex() {
  const tpl = read("src/index.template.html");
  const out = tpl
    .replace("<!--STYLE-->", "<style>\n" + styleCss + "\n  </style>")
    .replace("<!--SCRIPT-->", "<script>\n" + HOST_STANDALONE + coreJs + "\n  </script>")
    .replace("<!--VERSION-->", VERSION);
  write("index.html", out);
  return out.length;
}

// 扩展版：HTML 外链 CSS/JS；JS = 适配器 + core
function buildExtension() {
  const tpl = read("src/newtab.template.html");
  const outHtml = tpl
    .replace("<!--STYLE-->", '<link rel="stylesheet" href="style.css" />')
    .replace("<!--SCRIPT-->", '<script src="newtab.js"></script>')
    .replace("<!--VERSION-->", VERSION);
  write("newtab-extension/newtab.html", outHtml);
  write("newtab-extension/style.css", styleCss);
  write("newtab-extension/newtab.js", HOST_EXTENSION + coreJs);
  return {
    html: outHtml.length,
    js: (HOST_EXTENSION + coreJs).length,
    css: styleCss.length
  };
}

// ---------- 打包（可分享版本）----------

// 包内应包含的文件（相对项目根）
const PKG_FILES = [
  "安装说明.txt",
  "README.md",
  "LICENSE",
  "index.html",
  "lyric-proxy.js",
  "start-proxy.bat"
];
const PKG_DIRS = ["newtab-extension"];

function cleanOldZips() {
  // 删除所有旧版本的分享包（只删根目录下的 *.zip，不递归）
  const removed = [];
  for (const f of fs.readdirSync(ROOT)) {
    if (f.endsWith(".zip")) {
      try { fs.unlinkSync(path.join(ROOT, f)); removed.push(f); } catch (e) {}
    }
  }
  return removed;
}

// 极简 ZIP 写入（store 模式，无压缩）——避免引入第三方依赖
// 采用先构建目录再压缩的方式，保证跨平台可解压
function makeZip(srcDir, zipPath, topDirName) {
  const entries = [];
  function walk(dir, rel) {
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      const relPath = rel ? rel + "/" + name : name;
      const st = fs.statSync(full);
      if (st.isDirectory()) walk(full, relPath);
      else entries.push({ relPath, data: fs.readFileSync(full) });
    }
  }
  walk(srcDir, "");
  // 生成 zip（顶层套一层文件夹，解压后不会散落）
  const chunks = [];
  const central = [];
  let offset = 0;
  const dosTime = 0, dosDate = 0x21;   // 固定时间戳，保证可重复构建
  for (const e of entries) {
    const nameBuf = Buffer.from((topDirName ? topDirName + "/" : "") + e.relPath.replace(/\\/g, "/"), "utf8");
    const crc = crc32(e.data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);          // version needed
    local.writeUInt16LE(0x0800, 6);      // flags: UTF-8 名称
    local.writeUInt16LE(0, 8);           // method: store
    local.writeUInt16LE(dosTime, 10);
    local.writeUInt16LE(dosDate, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(e.data.length, 18);
    local.writeUInt32LE(e.data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);
    chunks.push(local, nameBuf, e.data);
    // central directory entry
    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0);
    cd.writeUInt16LE(20, 4);
    cd.writeUInt16LE(20, 6);
    cd.writeUInt16LE(0x0800, 8);
    cd.writeUInt16LE(0, 10);
    cd.writeUInt16LE(dosTime, 12);
    cd.writeUInt16LE(dosDate, 14);
    cd.writeUInt32LE(crc, 16);
    cd.writeUInt32LE(e.data.length, 20);
    cd.writeUInt32LE(e.data.length, 24);
    cd.writeUInt16LE(nameBuf.length, 28);
    cd.writeUInt32LE(0, 38);             // external attrs
    cd.writeUInt32LE(offset, 42);
    central.push(cd, nameBuf);
    offset += local.length + nameBuf.length + e.data.length;
  }
  const cdStart = offset;
  const cdBuf = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(cdBuf.length, 12);
  end.writeUInt32LE(cdStart, 16);
  fs.writeFileSync(zipPath, Buffer.concat([...chunks, cdBuf, end]));
  return entries.length;
}

let CRC_TABLE = null;
function crc32(buf) {
  if (!CRC_TABLE) {
    CRC_TABLE = new Int32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      CRC_TABLE[i] = c;
    }
  }
  let c = 0 ^ (-1);
  for (let i = 0; i < buf.length; i++) c = (c >>> 8) ^ CRC_TABLE[(c ^ buf[i]) & 0xFF];
  return (c ^ (-1)) >>> 0;
}

function buildPackage() {
  const pkgName = "美化主页-新标签页扩展-v" + VERSION;
  const stageDir = path.join(ROOT, "_dist", pkgName);
  // 准备暂存目录（递归删除旧暂存目录）
  if (fs.existsSync(path.join(ROOT, "_dist"))) {
    fs.rmSync(path.join(ROOT, "_dist"), { recursive: true, force: true });
  }
  fs.mkdirSync(stageDir, { recursive: true });
  for (const f of PKG_FILES) {
    if (!exists(f)) { console.warn("  ⚠️ 缺少文件，跳过：" + f); continue; }
    fs.copyFileSync(path.join(ROOT, f), path.join(stageDir, f));
  }
  for (const d of PKG_DIRS) {
    if (!exists(d)) continue;
    // 逐文件递归复制（cpSync 在目标已存在时行为不可靠）
    const copyDir = (src, dst) => {
      fs.mkdirSync(dst, { recursive: true });
      for (const name of fs.readdirSync(src)) {
        const s = path.join(src, name);
        const t = path.join(dst, name);
        if (fs.statSync(s).isDirectory()) copyDir(s, t);
        else fs.copyFileSync(s, t);
      }
    };
    copyDir(path.join(ROOT, d), path.join(stageDir, d));
  }
  // 版本信息文件
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const info = [
    "美化主页 · 新标签页扩展",
    "版本：" + VERSION,
    "构建时间：" + now.getFullYear() + "-" + pad(now.getMonth() + 1) + "-" + pad(now.getDate()) +
      " " + pad(now.getHours()) + ":" + pad(now.getMinutes()),
    "",
    "安装方法见「安装说明.txt」，或直接阅读 README.md。",
    "许可证：MIT"
  ].join("\n");
  fs.writeFileSync(path.join(stageDir, "版本信息.txt"), info, "utf8");
  // 打包
  const zipName = pkgName + ".zip";
  const zipPath = path.join(ROOT, zipName);
  const count = makeZip(stageDir, zipPath, pkgName);
  // 清理暂存目录
  fs.rmSync(path.join(ROOT, "_dist"), { recursive: true, force: true });
  const size = fs.statSync(zipPath).size;
  return { zipName, zipPath, count, size, info };
}

// ---------- 执行 ----------
const a = buildIndex();
const b = buildExtension();
console.log("✅ 构建完成  (v" + VERSION + ")");
console.log("   index.html                    " + a.toLocaleString() + " 字节（单文件，内联）");
console.log("   newtab-extension/newtab.html  " + b.html.toLocaleString() + " 字节");
console.log("   newtab-extension/newtab.js    " + b.js.toLocaleString() + " 字节");
console.log("   newtab-extension/style.css    " + b.css.toLocaleString() + " 字节");

if (!process.argv.includes("--no-zip")) {
  const removed = cleanOldZips();
  if (removed.length) {
    console.log("\n🗑️  已删除旧版本分享包：" + removed.length + " 个");
    removed.forEach(f => console.log("   - " + f));
  }
  const pkg = buildPackage();
  console.log("\n📦 可分享版本已生成：");
  console.log("   " + pkg.zipName + "   (" + pkg.size.toLocaleString() + " 字节, " + pkg.count + " 个文件)");
  console.log("   " + pkg.info.split("\n")[1]);
}
