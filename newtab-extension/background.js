// 后台 service worker：直连网易云官方接口解析歌曲直链
// 在扩展后台调用，不受网页 CORS 限制，无需任何第三方服务。
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg) return;
  // 心跳 / 预热：让页面确认后台在线。MV3 空闲时 service worker 不活动属正常省电行为，
  // 收到 ping 会被唤醒并完成监听器注册，使后续解析消息能够立即送达。
  if (msg.type === "ping") { sendResponse({ ok: true, ts: Date.now() }); return true; }
  if (msg.type !== "netease_parse") return;

  const reply = (obj) => { try { sendResponse(obj); } catch (e) {} };

  let id = null;
  try { id = extractSongId(msg.url); } catch (e) {}

  if (!id) {
    reply({ ok: false, error: "无法识别该链接，请粘贴网易云歌曲分享链接或数字歌曲ID" });
    return true;
  }

  const br = brFromQuality(msg.musicType);

  // 1) 获取播放直链（官方 player url 接口）
  fetch("https://music.163.com/api/song/enhance/player/url", {
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
        reply({ ok: false, error: "该歌曲暂无可用音频（可能已下架或受版权限制）" });
        return;
      }
      const url = item.url;
      // 2) 并行获取歌名与歌词（任一失败都不影响播放）
      const H = {
        "Referer": "https://music.163.com/",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
      };
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
      Promise.all([pName, pLyric]).then(function (vals) {
        const name = vals[0], lyric0 = vals[1];
        let lyric = lyric0, source = lyric ? "netease" : "";
        if (!lyric) {
          // 网易云未提供歌词（版权/登录限制）→ 兜底到酷狗歌词库
          kugouLyric(stripArtist(name), item.playTime).then(function (kg) {
            if (kg) { lyric = kg; source = "kugou"; }
            reply({ ok: true, url: url, name: name, lyric: lyric, lyricSource: source });
          });
        } else {
          reply({ ok: true, url: url, name: name, lyric: lyric, lyricSource: source });
        }
      });
    })
    .catch(function (e) { reply({ ok: false, error: String(e) }); });

  return true; // 保持消息通道开放，等待异步 sendResponse
});

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
