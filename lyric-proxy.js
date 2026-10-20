// 本地代理：代 index.html（file:// 双击打开）请求网易云官方接口，绕过浏览器 CORS 限制。
// 零依赖，仅用 Node 内置 http / https 模块。运行：node lyric-proxy.js（或双击 start-proxy.bat）
const http = require("http");
const https = require("https");

const PORT = 8787;
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64)";

function httpsGetJSON(url, referer) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: { "Referer": referer || "https://music.163.com/", "User-Agent": UA }
    }, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error("解析响应失败: " + e.message)); }
      });
    });
    req.on("error", reject);
    req.setTimeout(15000, () => req.destroy(new Error("请求超时")));
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

// ===== B站（bilibili）音频解析 =====
// 支持：完整视频链接、bvid（BV1xx411c7mD）、av号、以及分享短链 b23.tv
function extractBili(raw) {
  raw = String(raw || "").trim();
  let m = raw.match(/(BV[0-9A-Za-z]{10})/);
  if (m) return { bvid: m[1] };
  m = raw.match(/(?:^|\/|av)(\d+)(?:\?|$|i)/i);
  if (m && /av|^\d+$/i.test(raw)) return { aid: m[1] };
  return null;
}

async function getBiliAudio(raw) {
  const id = extractBili(raw);
  if (!id) return { ok: false, error: "无法识别 B站视频号，请粘贴完整链接（如 https://www.bilibili.com/video/BV1xx411c7mD）" };

  // 1) 取视频信息，拿 cid / 标题 / 封面
  const infoUrl = id.bvid
    ? ("https://api.bilibili.com/x/web-interface/view?bvid=" + id.bvid)
    : ("https://api.bilibili.com/x/web-interface/view?aid=" + id.aid);
  const info = await httpsGetJSON(infoUrl, "https://www.bilibili.com/");
  if (!info || info.code !== 0 || !info.data) {
    return { ok: false, error: "B站视频信息获取失败（" + ((info && info.message) || "视频不存在或需要登录") + "）" };
  }
  const d = info.data;
  const page = (d.pages && d.pages[0]) || {};
  const cid = page.cid;
  if (!cid) return { ok: false, error: "未找到该视频的分P信息，可能需要登录后访问" };

  // 2) 取 DASH 音频（fnval=16 表示返回 DASH）
  const playUrl = "https://api.bilibili.com/x/player/playurl?bvid=" + d.bvid +
    "&cid=" + cid + "&qn=80&fnval=16&fourk=1";
  const play = await httpsGetJSON(playUrl, "https://www.bilibili.com/");
  if (!play || play.code !== 0 || !play.data) {
    return { ok: false, error: "B站音频地址获取失败（" + ((play && play.message) || "接口异常") + "）" };
  }
  const pd = play.data;
  let audioUrl = "";
  // 优先 DASH 音频流；退回 durl（旧式 flac/mp4）
  if (pd.dash && pd.dash.audio && pd.dash.audio.length) {
    // 选带宽最高的音质
    const best = pd.dash.audio.slice().sort((a, b) => (b.bandwidth || 0) - (a.bandwidth || 0))[0];
    audioUrl = (best.baseUrl || (best.backupUrl && best.backupUrl[0]) || "");
    // baseUrl 可能带一个多余的 "/n" 前缀，需剥掉
    if (audioUrl.startsWith("/n")) audioUrl = audioUrl.slice(2);
  } else if (pd.durl && pd.durl.length) {
    audioUrl = pd.durl[0].url;
  }
  if (!audioUrl) return { ok: false, error: "该视频未提供音频流（可能是纯视频或需要大会员）" };

  // B站音频 CDN 常校验 Referer，统一走本机代理转发（见 /bili-audio）
  const proxied = "http://127.0.0.1:" + PORT + "/bili-audio?url=" + encodeURIComponent(audioUrl);

  let lyric = "";
  try {
    // B站字幕需要额外接口且多数视频没有，这里保持空，前端会引导手动粘贴
    lyric = "";
  } catch (e) {}

  return {
    ok: true,
    url: proxied,
    rawUrl: audioUrl,
    name: d.title || "B站音频",
    cover: d.pic || "",
    duration: d.duration || 0,
    lyric,
    lyricSource: "",
    platform: "bilibili",
    isBili: true,
    bvid: d.bvid
  };
}

// ===== 平台自动识别 =====
function detectPlatform(raw) {
  raw = String(raw || "").toLowerCase();
  if (/bilibili\.com|b23\.tv|(^|\/)av\d+|\bbv[0-9a-z]{10}/.test(raw)) return "bilibili";
  if (/music\.163\.com|163\.cn/.test(raw)) return "netease";
  if (/y\.qq\.com|qq\.com/.test(raw)) return "qq";
  if (/kugou\.com/.test(raw)) return "kugou";
  if (/kuwo\.cn/.test(raw)) return "kuwo";
  return "";
}

async function parseByPlatform(raw) {
  const p = detectPlatform(raw);
  if (p === "bilibili") return getBiliAudio(raw);
  if (p === "netease") {
    const id = extractId(raw);
    if (!id) return { ok: false, error: "无法识别网易云歌曲ID" };
    const r = await getLyric(id);
    r.platform = "netease"; return r;
  }
  return {
    ok: false,
    error: "暂不支持该平台。" +
      "目前支持：网易云音乐、哔哩哔哩(B站)。" +
      "QQ音乐/酷狗/酷我因接口签名与登录限制暂无法直链解析，" +
      "建议先用对应平台客户端下载音频文件，再用「选择本地音乐文件」播放。"
  };
}
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

// 去掉「歌名 - 歌手」中的歌手部分，仅保留标题用于歌词库检索
function stripArtist(name) {
  return String(name || "").replace(/\s*-\s*.*$/, "").trim();
}

// 兜底：从酷狗歌词库按「歌名 + 时长」检索歌词（网易云对版权歌常返回空，酷狗覆盖更广）
async function getKugouLyric(name, duration) {
  if (!name) return "";
  try {
    const kw = encodeURIComponent(stripArtist(name));
    const searchUrl = "https://lyrics.kugou.com/search?ver=1&man=yes&client=mobi&keyword=" + kw +
      (duration ? ("&duration=" + Math.round(duration)) : "");
    const sj = await httpsGetJSON(searchUrl);
    const cand = (sj && sj.candidates) || [];
    if (!cand.length) return "";
    const c = cand[0];
    const dj = await httpsGetJSON(
      "https://lyrics.kugou.com/download?ver=1&client=mobi&id=" + c.id +
      "&accesskey=" + encodeURIComponent(c.accesskey) + "&fmt=lrc&charset=utf8"
    );
    let lrc = (dj && dj.content) || "";
    if (lrc) { try { lrc = Buffer.from(lrc, "base64").toString("utf8"); } catch (e) {} }
    return lrc || "";
  } catch (e) { return ""; }
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
    let lyric = mergeLyric(lrc, tlrc);
    let source = lyric ? "netease" : "";
    if (!lyric) {
      // 网易云未提供歌词（版权/登录限制）→ 兜底到酷狗歌词库
      const kg = await getKugouLyric(name, item.playTime);
      if (kg) { lyric = kg; source = "kugou"; }
    }
    return { ok: true, url, name, lyric, lyricSource: source };
  } catch (e) {
    return { ok: false, error: String(e && e.message ? e.message : e) };
  }
}

const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "*");
  const u = new URL(req.url, "http://localhost");

  // 音频流转发：给 B站音频补上正确的 Referer，避免 CDN 403
  if (u.pathname === "/bili-audio") {
    const target = u.searchParams.get("url");
    if (!target || !/^https:\/\//i.test(target)) { res.statusCode = 400; res.end("bad url"); return; }
    try {
      const up = https.get(target, {
        headers: { "Referer": "https://www.bilibili.com/", "User-Agent": UA }
      }, (ur) => {
        res.writeHead(ur.statusCode || 200, {
          "Content-Type": ur.headers["content-type"] || "audio/mp4",
          "Access-Control-Allow-Origin": "*",
          "Accept-Ranges": ur.headers["accept-ranges"] || "bytes",
          "Cache-Control": "no-cache"
        });
        ur.pipe(res);
      });
      up.on("error", () => { if (!res.headersSent) { res.statusCode = 502; res.end("upstream error"); } });
      up.on("end", () => { /* 由pipe自然结束 */ });
      up.setTimeout(20000, () => up.destroy());
    } catch (e) {
      res.statusCode = 502; res.end("proxy error");
    }
    return;
  }

  if (u.pathname === "/lyric") {
    const id = extractId(u.searchParams.get("id"));
    if (!id) { res.end(JSON.stringify({ ok: false, error: "无法识别歌曲ID，请粘贴网易云歌曲链接或数字ID" })); return; }
    const result = await getLyric(id);
    res.end(JSON.stringify(result));
  } else if (u.pathname === "/parse") {
    // 统一多平台解析入口：自动识别 B站 / 网易云 等
    const raw = u.searchParams.get("url") || u.searchParams.get("id") || "";
    if (!raw.trim()) {
      res.end(JSON.stringify({ ok: false, error: "请输入链接（B站视频链接 / BV号 / 网易云歌曲链接均可）" }));
      return;
    }
    const result = await parseByPlatform(raw);
    res.end(JSON.stringify(result));
  } else if (u.pathname === "/") {
    res.end("lyric proxy ok");
  } else {
    res.statusCode = 404; res.end("not found");
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log("音乐解析代理已启动：http://127.0.0.1:" + PORT);
  console.log("支持平台：哔哩哔哩(B站视频链接/BV号) 、 网易云音乐(歌曲链接/ID)");
  console.log("在主页「网易云/B站 自动获取」里粘贴链接即可自动播放（B站还会显示封面与标题）。");
});
