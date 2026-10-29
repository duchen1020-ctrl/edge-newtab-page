#!/usr/bin/env node
/**
 * 构建脚本 —— 从 src/ + shared/ 源码生成两版产物
 *
 *   src/index.template.html   src/newtab.template.html
 *   shared/style.css          shared/core.js
 *        ↓  build.js
 *   ├── index.html                    （单文件：CSS/JS 全内联，双击即用）
 *   └── newtab-extension/
 *         ├── newtab.html             （引用独立 style.css / newtab.js）
 *         ├── newtab.js               （扩展 HOST 适配器 + core.js）
 *         └── style.css
 *
 * 用法：  node build.js
 *
 * 说明：修改功能请改 shared/ 或 src/ 下的模板，然后重新运行本脚本；
 *       直接改 index.html / newtab-extension/* 会在下次构建时被覆盖。
 */
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const write = (p, s) => fs.writeFileSync(path.join(ROOT, p), s);

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
    .replace("<!--SCRIPT-->", "<script>\n" + HOST_STANDALONE + coreJs + "\n  </script>");
  write("index.html", out);
  return out.length;
}

// 扩展版：HTML 外链 CSS/JS；JS = 适配器 + core
function buildExtension() {
  const tpl = read("src/newtab.template.html");
  const outHtml = tpl
    .replace("<!--STYLE-->", '<link rel="stylesheet" href="style.css" />')
    .replace("<!--SCRIPT-->", '<script src="newtab.js"></script>');
  write("newtab-extension/newtab.html", outHtml);
  write("newtab-extension/style.css", styleCss);
  write("newtab-extension/newtab.js", HOST_EXTENSION + coreJs);
  return {
    html: outHtml.length,
    js: (HOST_EXTENSION + coreJs).length,
    css: styleCss.length
  };
}

// ---------- 执行 ----------
const a = buildIndex();
const b = buildExtension();
console.log("✅ 构建完成");
console.log("   index.html                    " + a.toLocaleString() + " 字节（单文件，内联）");
console.log("   newtab-extension/newtab.html  " + b.html.toLocaleString() + " 字节");
console.log("   newtab-extension/newtab.js    " + b.js.toLocaleString() + " 字节");
console.log("   newtab-extension/style.css    " + b.css.toLocaleString() + " 字节");
