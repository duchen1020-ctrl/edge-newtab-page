// 本地代理：代 index.html（file:// 双击打开）请求网易云官方接口，绕过浏览器 CORS 限制。
// 零依赖，仅用 Node 内置 http / https 模块。运行：node lyric-proxy.js（或双击 start-proxy.bat）
const http = require("http");
const https = require("https");

const PORT = 8787;
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64)";

function httpsGetJSON(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: { "Referer": "https://music.163.com/", "User-Agent": UA }
    }, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error("解析网易云响应失败: " + e.message)); }
      });
    });
    req.on("error", reject);
    req.setTimeout(15000, () => req.destroy(new Error("请求网易云超时")));
  });
}

function extractId(raw) {
  raw = String(raw || "").trim();
  if (/^\d+$/.test(raw)) return raw;
  let m = raw.match(/[?&]id=(\d+)/); if (m) return m[1];
  m = raw.match(/song\/(\d+)/); if (m) return m[1];
  return null;
}

function brFromQuality(q) {
  switch (q) {
    case "exhigh": return 320000;
    case "lossless": return 999000;
    case "hires": return 1999000;
    case "jymaster": return 1999000;
    default: return 128000;
  }
}

// 把同一时间戳的翻译行追加到原行之后（翻译也带时间标签，便于前端对齐高亮）
function mergeLyric(lrc, tlrc) {
  if (!lrc && !tlrc) return "";
  if (!tlrc) return lrc || "";
  if (!lrc) return tlrc;
  const re = /\[(\d{1,2}):(\d{2}(?:[.:]\d{1,3})?)\]/g;
  const map = {};
  tlrc.split(/\r?\n/).forEach((l) => {
    const m = l.match(/\[(\d{1,2}):(\d{2}(?:[.:]\d{1,3})?)\]/);
    if (m) { const t = l.replace(re, "").trim(); if (t) map[m[1] + ":" + m[2]] = t; }
  });
  return lrc.split(/\r?\n/).map((l) => {
    const m = l.match(/\[(\d{1,2}):(\d{2}(?:[.:]\d{1,3})?)\]/);
    if (m && map[m[1] + ":" + m[2]]) return l + "\n[" + m[1] + ":" + m[2] + "]" + map[m[1] + ":" + m[2]];
    return l;
  }).join("\n");
}

async function getLyric(id) {
  try {
    const br = brFromQuality("standard");
    const j = await httpsGetJSON(
      "https://music.163.com/api/song/enhance/player/url?ids=" +
      encodeURIComponent("[" + id + "]") + "&br=" + br
    );
    const item = j && j.data && j.data[0];
    if (!item || !item.url) return { ok: false, error: "该歌曲暂无可用音频（可能已下架或受版权限制）" };
    const url = item.url;
    const [j2, j3] = await Promise.all([
      httpsGetJSON("https://music.163.com/api/song/detail/?id=" + id + "&ids=" + encodeURIComponent("[" + id + "]")).catch(() => ({})),
      httpsGetJSON("https://music.163.com/api/song/lyric?id=" + id).catch(() => ({}))
    ]);
    let name = "网易云音乐";
    try { name = j2.songs[0].name + " - " + j2.songs[0].artists[0].name; } catch (e) {}
    const lrc = (j3.lrc && j3.lrc.lyric) || "";
    const tlrc = (j3.tlyric && j3.tlyric.lyric) || "";
    return { ok: true, url, name, lyric: mergeLyric(lrc, tlrc) };
  } catch (e) {
    return { ok: false, error: String(e && e.message ? e.message : e) };
  }
}

const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "*");
  const u = new URL(req.url, "http://localhost");
  if (u.pathname === "/lyric") {
    const id = extractId(u.searchParams.get("id"));
    if (!id) { res.end(JSON.stringify({ ok: false, error: "无法识别歌曲ID，请粘贴网易云歌曲链接或数字ID" })); return; }
    const result = await getLyric(id);
    res.end(JSON.stringify(result));
  } else if (u.pathname === "/") {
    res.end("lyric proxy ok");
  } else {
    res.statusCode = 404; res.end("not found");
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log("网易云歌词/直链代理已启动：http://127.0.0.1:" + PORT);
  console.log("在 index.html 的「网易云自动获取」里粘贴链接即可自动播放+显示歌词。");
});
