// 后台 service worker：直连网易云官方接口解析歌曲直链
// 在扩展后台调用，不受网页 CORS 限制，无需任何第三方服务。
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg) return;
  // 心跳 / 预热：让页面确认后台在线。MV3 空闲时 service worker 不活动属正常省电行为，
  // 收到 ping 会被唤醒并完成监听器注册，使后续解析消息能够立即送达。
  if (msg.type === "ping") { sendResponse({ ok: true, ts: Date.now() }); return true; }
  // 通用在线解析：B站 / 网易云（自动识别平台）
  if (msg.type === "media_parse") {
    parseByPlatform(msg.url, msg.musicType)
      .then(function (r) { try { sendResponse(r); } catch (e) {} })
      .catch(function (e) { try { sendResponse({ ok: false, error: String(e && e.message ? e.message : e) }); } catch (e2) {} });
    return true;
  }
  if (msg.type !== "netease_parse") return;

  const reply = (obj) => { try { sendResponse(obj); } catch (e) {} };

  parseNetease(msg.url, msg.musicType)
    .then(reply)
    .catch(function (e) { reply({ ok: false, error: String(e && e.message ? e.message : e) }); });

  return true; // 保持消息通道开放，等待异步 sendResponse
});

// 网易云解析（Promise 版），供 netease_parse 与通用 parseByPlatform 共用
function parseNetease(raw, musicType) {
  const id = extractSongId(raw);
  if (!id) {
    return Promise.resolve({ ok: false, error: "无法识别该链接，请粘贴网易云歌曲分享链接或数字歌曲ID" });
  }
  const br = brFromQuality(musicType);
  return fetch("https://music.163.com/api/song/enhance/player/url", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Referer": "https://music.163.com/",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
    },
    body: "ids=" + encodeURIComponent("[" + id + "]") + "&br=" + br
  })
    .then(function (r) { return r.json(); })
    .then(function (j) {
      const item = j && j.data && j.data[0];
      if (!item || !item.url) {
        throw new Error("该歌曲暂无可用音频（可能已下架或受版权限制）");
      }
      const url = item.url;
      const H = { "Referer": "https://music.163.com/", "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" };
      const pName = fetch("https://music.163.com/api/song/detail/?id=" + id + "&ids=" + encodeURIComponent("[" + id + "]"), { headers: H })
        .then(function (r) { return r.json(); })
        .then(function (j2) {
          try { return j2.songs[0].name + " - " + j2.songs[0].artists[0].name; } catch (e) { return "网易云音乐"; }
        })
        .catch(function () { return "网易云音乐"; });
      const pLyric = fetch("https://music.163.com/api/song/lyric?id=" + id, { headers: H })
        .then(function (r) { return r.json(); })
        .then(function (j3) {
          const lrc = (j3 && j3.lrc && j3.lrc.lyric) || "";
          const tlrc = (j3 && j3.tlyric && j3.tlyric.lyric) || "";
          return mergeLyric(lrc, tlrc);
        })
        .catch(function () { return ""; });
      return Promise.all([pName, pLyric]).then(function (vals) {
        const name = vals[0];
        let lyric = vals[1], source = lyric ? "netease" : "";
        if (lyric) return { ok: true, url: url, name: name, lyric: lyric, lyricSource: source, platform: "netease" };
        // 网易云未提供歌词 → 兜底酷狗
        return kugouLyric(stripArtist(name), item.playTime).then(function (kg) {
          if (kg) { lyric = kg; source = "kugou"; }
          return { ok: true, url: url, name: name, lyric: lyric, lyricSource: source, platform: "netease" };
        });
      });
    });
}

// 从各种网易云链接/ID 中提取歌曲数字 ID
function extractSongId(raw) {
  if (!raw) return null;
  raw = String(raw).trim();
  if (/^\d+$/.test(raw)) return raw;                       // 纯数字 ID
  let m = raw.match(/[?&]id=(\d+)/);                       // song?id=123 / #/song?id=123
  if (m) return m[1];
  m = raw.match(/song\/(\d+)/);                            // /song/123
  return null;
}

// 音质选项 → 目标码率（br，单位 bps）。实际返回可能按版权/登录态降级。
function brFromQuality(q) {
  switch (q) {
    case "exhigh":   return 320000;
    case "lossless": return 999000;
    case "hires":    return 1999000;
    case "jymaster": return 1999000;
    default:         return 128000;
  }
}

// 合并原文与翻译歌词：把同一时间戳的翻译行追加到原行之后（翻译也带时间标签，便于前端对齐）
function mergeLyric(lrc, tlrc) {
  if (!lrc && !tlrc) return "";
  if (!tlrc) return lrc || "";
  if (!lrc) return tlrc;
  const re = /\[(\d{1,2}):(\d{2}(?:[.:]\d{1,3})?)\]/g;
  const map = {};
  tlrc.split(/\r?\n/).forEach(function (line) {
    const m = line.match(/\[(\d{1,2}):(\d{2}(?:[.:]\d{1,3})?)\]/);
    if (m) {
      const t = line.replace(re, "").trim();
      if (t) map[m[1] + ":" + m[2]] = t;
    }
  });
  return lrc.split(/\r?\n/).map(function (line) {
    const m = line.match(/\[(\d{1,2}):(\d{2}(?:[.:]\d{1,3})?)\]/);
    if (m && map[m[1] + ":" + m[2]]) return line + "\n[" + m[1] + ":" + m[2] + "]" + map[m[1] + ":" + m[2]];
    return line;
  }).join("\n");
}

// 去掉「歌名 - 歌手」中的歌手部分，仅保留标题用于歌词库检索
function stripArtist(name) {
  return String(name || "").replace(/\s*-\s*.*$/, "").trim();
}

// 兜底：从酷狗歌词库按「歌名 + 时长」检索歌词（网易云对版权歌常返回空，酷狗覆盖更广）
function kugouLyric(name, duration) {
  return new Promise(function (resolve) {
    try {
      const kw = encodeURIComponent(stripArtist(name));
      const su = "https://lyrics.kugou.com/search?ver=1&man=yes&client=mobi&keyword=" + kw +
        (duration ? ("&duration=" + Math.round(duration)) : "");
      fetch(su, { headers: { "User-Agent": "Mozilla/5.0", "Referer": "https://www.kugou.com/" } })
        .then(function (r) { return r.json(); })
        .then(function (sj) {
          const cand = (sj && sj.candidates) || [];
          if (!cand.length) { resolve(""); return; }
          const c = cand[0];
          fetch("https://lyrics.kugou.com/download?ver=1&client=mobi&id=" + c.id +
            "&accesskey=" + encodeURIComponent(c.accesskey) + "&fmt=lrc&charset=utf8",
            { headers: { "User-Agent": "Mozilla/5.0", "Referer": "https://www.kugou.com/" } })
            .then(function (r) { return r.json(); })
            .then(function (dj) {
              let lrc = (dj && dj.content) || "";
              if (lrc) {
                try {
                  const bin = atob(lrc);
                  const bytes = new Uint8Array(bin.length);
                  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
                  lrc = new TextDecoder("utf-8").decode(bytes);
                } catch (e) {}
              }
              resolve(lrc || "");
            })
            .catch(function () { resolve(""); });
        })
        .catch(function () { resolve(""); });
    } catch (e) { resolve(""); }
  });
}

// ===== B站（bilibili）音频解析 =====
// 扩展自带 host 权限（*.bilibili.com / *.bilivideo.com），可直接跨域请求，无需本地代理。
// 注意：B站音频 CDN 校验 Referer，manifest 里已声明后由浏览器自动带 Referer，故直连 CDN 播放。
const BILI_HEADERS = { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)", "Referer": "https://www.bilibili.com/" };

function extractBili(raw) {
  raw = String(raw || "").trim();
  let m = raw.match(/(BV[0-9A-Za-z]{10})/);
  if (m) return { bvid: m[1] };
  m = raw.match(/av(\d+)/i);
  if (m) return { aid: m[1] };
  m = raw.match(/(?:^|\/)(\d{5,})(?:\?|$|i)/);   // 纯 av 号（b23.tv短链需先展开，故不处理）
  if (m) return { aid: m[1] };
  return null;
}

function getBiliAudio(raw) {
  const id = extractBili(raw);
  if (!id) {
    return Promise.resolve({ ok: false, error: "无法识别B站视频号，请粘贴完整链接（如 https://www.bilibili.com/video/BV1xx411c7mD）或 BV 号" });
  }
  const infoUrl = id.bvid
    ? ("https://api.bilibili.com/x/web-interface/view?bvid=" + id.bvid)
    : ("https://api.bilibili.com/x/web-interface/view?aid=" + id.aid);
  return fetch(infoUrl, { headers: BILI_HEADERS })
    .then(function (r) { return r.json(); })
    .then(function (info) {
      if (!info || info.code !== 0 || !info.data) {
        throw new Error("B站视频信息获取失败（" + ((info && info.message) || "视频不存在或需要登录") + "）");
      }
      const d = info.data;
      const page = (d.pages && d.pages[0]) || {};
      if (!page.cid) throw new Error("未找到分P信息，该视频可能需要登录后访问");
      const playUrl = "https://api.bilibili.com/x/player/playurl?bvid=" + d.bvid +
        "&cid=" + page.cid + "&qn=80&fnval=16&fourk=1";
      return fetch(playUrl, { headers: BILI_HEADERS })
        .then(function (r) { return r.json(); })
        .then(function (play) {
          if (!play || play.code !== 0 || !play.data) {
            throw new Error("B站音频地址获取失败（" + ((play && play.message) || "接口异常") + "）");
          }
          const pd = play.data;
          let audioUrl = "";
          if (pd.dash && pd.dash.audio && pd.dash.audio.length) {
            // 选带宽最高的音质
            const best = pd.dash.audio.slice().sort(function (a, b) { return (b.bandwidth || 0) - (a.bandwidth || 0); })[0];
            audioUrl = best.baseUrl || (best.backupUrl && best.backupUrl[0]) || "";
            if (audioUrl.indexOf("/n") === 0) audioUrl = audioUrl.slice(2);   // 剥掉多余的 /n 前缀
          } else if (pd.durl && pd.durl.length) {
            audioUrl = pd.durl[0].url;
          }
          if (!audioUrl) throw new Error("该视频未提供音频流（可能是纯视频或需要大会员）");
          return {
            ok: true, url: audioUrl, name: d.title || "B站音频",
            cover: (d.pic || "").replace(/^http:/, "https:"),
            duration: d.duration || 0,
            lyric: "", lyricSource: "", platform: "bilibili", isBili: true, bvid: d.bvid
          };
        });
    });
}

// 平台自动识别
function detectPlatform(raw) {
  raw = String(raw || "").toLowerCase();
  if (/bilibili\.com|b23\.tv|(^|\/)av\d+|\bbv[0-9a-z]{10}/.test(raw)) return "bilibili";
  if (/music\.163\.com|163\.cn/.test(raw)) return "netease";
  if (/y\.qq\.com|qq\.com/.test(raw)) return "qq";
  if (/kugou\.com/.test(raw)) return "kugou";
  if (/kuwo\.cn/.test(raw)) return "kuwo";
  return "";
}

function parseByPlatform(raw, quality) {
  const p = detectPlatform(raw);
  if (p === "bilibili") return getBiliAudio(raw);
  if (p === "netease") return parseNetease(raw, quality);
  return Promise.resolve({
    ok: false,
    error: "暂不支持该平台。目前支持：哔哩哔哩、网易云音乐。QQ音乐/酷狗/酷我因平台签名与登录限制暂无法直链解析，建议先下载音频再用「选择本地音乐文件」播放。"
  });
}
