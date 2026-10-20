
  // ===== 引擎配置 =====
  const ENGINES = {
    "百度":   "https://www.baidu.com/s?wd=",
    "Google": "https://www.google.com/search?q=",
    "必应":   "https://www.bing.com/search?q=",
    "DuckDuckGo": "https://duckduckgo.com/?q=",
    "GitHub": "https://github.com/search?q="
  };

  // ===== 预设壁纸（纯 CSS 渐变，离线可用）=====
  const PRESETS = [
    "linear-gradient(135deg,#667eea,#764ba2)",
    "linear-gradient(135deg,#f093fb,#f5576c)",
    "linear-gradient(135deg,#4facfe,#00f2fe)",
    "linear-gradient(135deg,#43e97b,#38f9d7)",
    "linear-gradient(135deg,#fa709a,#fee140)",
    "linear-gradient(135deg,#30cfd0,#330867)",
    "linear-gradient(135deg,#a8edea,#fed6e3)",
    "linear-gradient(135deg,#ff9a9e,#fecfef)"
  ];

  // ===== 本地存储 =====
  const STORE_KEY = "homepage_settings";
  let settings = {
    engine: "必应",
    customEngines: [],
    wallpaper: PRESETS[0],
    isGradient: true,
    wallpaperType: "gradient",
    dark: 0.35,
    blur: 0,
    ambient: true,
    videoPaused: false,
    quoteAuto: 30,                // 每日一言自动刷新间隔（秒）；设为 0 = 关闭
    rotation: { enabled: false, interval: 30, random: false },
    galleryIndex: 0,
    links: [
      { name: "GitHub", emoji: "🐙", url: "https://github.com" },
      { name: "B站",    emoji: "📺", url: "https://bilibili.com" },
      { name: "知乎",   emoji: "💡", url: "https://zhihu.com" },
      { name: "邮箱",   emoji: "✉️", url: "https://mail.google.com" },
      { name: "YouTube",emoji: "▶️", url: "https://youtube.com" },
      { name: "微博",   emoji: "🌐", url: "https://weibo.com" }
    ]
  };
  try {
    const saved = JSON.parse(localStorage.getItem(STORE_KEY));
    if (saved) settings = Object.assign(settings, saved);
  } catch (e) {}

  function save() { localStorage.setItem(STORE_KEY, JSON.stringify(settings)); }

  // ===== 壁纸应用（双图层交叉淡入，切换更自然）=====
  const wallpaperEl = document.getElementById("wallpaper");
  let currentLayer = null;   // 当前显示的图层
  let currentVideo = null;   // 当前视频元素（若有）
  let lastObjUrl = null;
  function setBlobUrl(blob) {
    if (lastObjUrl) URL.revokeObjectURL(lastObjUrl);
    lastObjUrl = URL.createObjectURL(blob);
    return lastObjUrl;
  }
  function makeLayer(type, src) {
    const layer = document.createElement("div");
    layer.className = "wp-layer";
    if (type === "video") {
      const v = document.createElement("video");
      v.src = src; v.autoplay = true; v.muted = true; v.loop = true; v.playsInline = true;
      v.setAttribute("playsinline", "");
      layer.appendChild(v);
      if (settings.videoPaused) v.pause(); else v.play().catch(function(){});
      layer._video = v;
    } else {
      layer.style.backgroundImage = (type === "gradient") ? src : 'url("' + src + '")';
    }
    return layer;
  }
  function updateVideoToggle(v) {
    const vt = document.getElementById("video-toggle");
    if (!vt) return;
    if (v) {
      vt.style.display = "block";
      vt.textContent = settings.videoPaused ? "▶ 播放动态壁纸" : "⏸ 暂停动态壁纸";
    } else {
      vt.style.display = "none";
    }
  }
  // animate=true 时做交叉淡入；首屏加载用 animate=false 立即显示
  function showLayer(type, src, animate) {
    const newLayer = makeLayer(type, src);
    wallpaperEl.appendChild(newLayer);
    currentVideo = newLayer._video || null;
    updateVideoToggle(currentVideo);
    void newLayer.offsetWidth; // 触发过渡
    newLayer.classList.add("show");
    if (currentLayer && currentLayer !== newLayer) {
      const old = currentLayer;
      const delay = animate ? 850 : 0;
      setTimeout(function () {
        if (old._video) { old._video.pause(); old._video.removeAttribute("src"); old._video.load(); }
        if (old.parentNode) old.parentNode.removeChild(old);
      }, delay);
    }
    currentLayer = newLayer;
  }
  async function renderMedia(type, blob, animate) {
    const url = setBlobUrl(blob);
    showLayer(type, url, animate);
  }
  async function applyWallpaper(animate) {
    const type = settings.wallpaperType || (settings.isGradient ? "gradient" : "image");
    if (type === "gradient") {
      showLayer("gradient", settings.wallpaper, animate);
      return;
    }
    let src = settings.wallpaper;
    if (src === "__blob__") {
      try {
        const b = await getBlob();
        if (b) { await renderMedia(type, b, animate); return; }
      } catch (e) {}
      // 兜底：单文件丢失则回退预设
      settings.wallpaper = PRESETS[0]; settings.isGradient = true; settings.wallpaperType = "gradient"; save();
      applyWallpaper(animate); return;
    }
    showLayer(type, src, animate);
  }
  applyWallpaper(false);

  // ===== IndexedDB：持久化上传的本地壁纸（突破 localStorage 5MB 限制，支持大视频）=====
  function openDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open("homepage_wallpaper_db", 2);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains("blobs")) db.createObjectStore("blobs");
        if (!db.objectStoreNames.contains("gallery")) db.createObjectStore("gallery", { keyPath: "id", autoIncrement: true });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  async function saveBlob(blob) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("blobs", "readwrite");
      tx.objectStore("blobs").put(blob, "wallpaper");
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
  async function getBlob() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("blobs", "readonly");
      const r = tx.objectStore("blobs").get("wallpaper");
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
  }
  async function deleteBlob() {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction("blobs", "readwrite");
      tx.objectStore("blobs").delete("wallpaper");
      tx.oncomplete = () => resolve();
    });
  }

  // ===== 壁纸库（文件夹批量导入，用于动态轮换）=====
  async function saveGalleryItem(blob, type, name) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("gallery", "readwrite");
      tx.objectStore("gallery").add({ blob, type, name });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
  async function getAllGallery() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("gallery", "readonly");
      const r = tx.objectStore("gallery").getAll();
      r.onsuccess = () => resolve(r.result || []);
      r.onerror = () => reject(tx.error);
    });
  }
  async function clearGallery() {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction("gallery", "readwrite");
      tx.objectStore("gallery").clear();
      tx.oncomplete = () => resolve();
    });
  }

  // ===== 动态轮换 =====
  let rotationTimer = null;
  let galleryCache = [];
  async function loadGalleryCache() { galleryCache = await getAllGallery(); }
  async function applyGalleryItem() {
    if (galleryCache.length === 0) return;
    const idx = ((settings.galleryIndex % galleryCache.length) + galleryCache.length) % galleryCache.length;
    const item = galleryCache[idx];
    await renderMedia(item.type, item.blob, true);
  }
  function startRotation() {
    stopRotation();
    if (!settings.rotation.enabled || galleryCache.length === 0) return;
    applyGalleryItem();
    const ms = Math.max(1, settings.rotation.interval) * 1000;
    rotationTimer = setInterval(() => {
      if (settings.rotation.random) {
        settings.galleryIndex = Math.floor(Math.random() * galleryCache.length);
      } else {
        settings.galleryIndex = (settings.galleryIndex + 1) % galleryCache.length;
      }
      applyGalleryItem();
      save();
    }, ms);
  }
  function stopRotation() {
    if (rotationTimer) { clearInterval(rotationTimer); rotationTimer = null; }
  }
  function disableRotation() {
    if (settings.rotation.enabled) { settings.rotation.enabled = false; save(); }
    stopRotation();
    syncRotationUI();
  }

  // ===== 时钟 =====
  const clockEl = document.getElementById("clock");
  const chEl = document.getElementById("ch");
  const cmEl = document.getElementById("cm");
  const csEl = document.getElementById("cs");
  let lastMM = "";
  // ===== 农历（纯计算，无需联网；覆盖 1900–2099）=====
  const lunarInfo = [
    0x04bd8,0x04ae0,0x0a570,0x054d5,0x0d260,0x0d950,0x16554,0x056a0,0x09ad0,0x055d2,
    0x04ae0,0x0a5b6,0x0a4d0,0x0d250,0x1d255,0x0b540,0x0d6a0,0x0ada2,0x095b0,0x14977,
    0x04970,0x0a4b0,0x0b4b5,0x06a50,0x06d40,0x1ab54,0x02b60,0x09570,0x052f2,0x04970,
    0x06566,0x0d4a0,0x0ea50,0x06e95,0x05ad0,0x02b60,0x186e3,0x092e0,0x1c8d7,0x0c950,
    0x0d4a0,0x1d8a6,0x0b550,0x056a0,0x1a5b4,0x025d0,0x092d0,0x0d2b2,0x0a950,0x0b557,
    0x06ca0,0x0b550,0x15355,0x04da0,0x0a5b0,0x14573,0x052b0,0x0a9a8,0x0e950,0x06aa0,
    0x0aea6,0x0ab50,0x04b60,0x0aae4,0x0a570,0x05260,0x0f263,0x0d950,0x05b57,0x056a0,
    0x096d0,0x04dd5,0x04ad0,0x0a4d0,0x0d4d4,0x0d250,0x0d558,0x0b540,0x0b5a0,0x195a6,
    0x095b0,0x049b0,0x0a974,0x0a4b0,0x0b27a,0x06a50,0x06d40,0x0af46,0x0ab60,0x09570,
    0x04af5,0x04970,0x064b0,0x074a3,0x0ea50,0x06b58,0x055c0,0x0ab60,0x096d5,0x092e0,
    0x0c960,0x0d954,0x0d4a0,0x0da50,0x07552,0x056a0,0x0abb7,0x025d0,0x092d0,0x0cab5,
    0x0a950,0x0b4a0,0x0baa4,0x0ad50,0x055d9,0x04ba0,0x0a5b0,0x15176,0x052b0,0x0a930,
    0x07954,0x06aa0,0x0ad50,0x05b52,0x04b60,0x0a6e6,0x0a4e0,0x0d260,0x0ea65,0x0d530,
    0x05aa0,0x076a3,0x096d0,0x04afb,0x04ad0,0x0a4d0,0x1d0b6,0x0d250,0x0d520,0x0dd45,
    0x0b5a0,0x056d0,0x055b2,0x049b0,0x0a577,0x0a4b0,0x0aa50,0x1b255,0x06d20,0x0ada0,
    0x14b63,0x09370,0x049f8,0x04970,0x064b0,0x168a6,0x0ea50,0x06b20,0x1a6c4,0x0aae0,
    0x0a2e0,0x0d2e3,0x0c960,0x0d557,0x0d4a0,0x0da50,0x05d55,0x056a0,0x0a6d0,0x055d4,
    0x052d0,0x0a9b8,0x0a950,0x0b4a0,0x0b6a6,0x0ad50,0x055a0,0x0aba4,0x0a5b0,0x052b0,
    0x0b273,0x06930,0x07337,0x06aa0,0x0ad50,0x14b55,0x04b60,0x0a570,0x054e4,0x0d160,
    0x0e968,0x0d520,0x0daa0,0x16aa6,0x056d0,0x04ae0,0x0a9d4,0x0a2d0,0x0d150,0x0f252,
    0x0d520
  ];
  const lunarMonths = ["正","二","三","四","五","六","七","八","九","十","冬","腊"];
  const lunarDays = ["初一","初二","初三","初四","初五","初六","初七","初八","初九","初十","十一","十二","十三","十四","十五","十六","十七","十八","十九","二十","廿一","廿二","廿三","廿四","廿五","廿六","廿七","廿八","廿九","三十"];
  function lYearDays(y) {
    let sum = 348, info = lunarInfo[y - 1900];
    for (let m = 1; m <= 12; m++) if (info & (0x10000 >> m)) sum++;
    return sum + leapDays(y);
  }
  function leapDays(y) {
    if (leapMonth(y) === 0) return 0;
    return (lunarInfo[y - 1900] & 0x10000) ? 30 : 29;
  }
  function leapMonth(y) { return lunarInfo[y - 1900] & 0xf; }
  function monthDays(y, m) { return (lunarInfo[y - 1900] & (0x10000 >> m)) ? 30 : 29; }
  function getLunar(date) {
    const y = date.getFullYear(), m = date.getMonth() + 1, d = date.getDate();
    if (y < 1900 || y > 2099) return "";
    let offset = Math.round((Date.UTC(y, m - 1, d) - Date.UTC(1900, 0, 31)) / 86400000);
    let year, temp, leap, isLeap = false, month;
    for (year = 1900; year < 2100 && offset > 0; year++) { temp = lYearDays(year); offset -= temp; }
    if (offset < 0) { offset += temp; year--; }
    leap = leapMonth(year);
    for (month = 1; month < 13 && offset > 0; month++) {
      if (leap > 0 && month === leap + 1 && !isLeap) { --month; isLeap = true; temp = leapDays(year); }
      else { temp = monthDays(year, month); }
      if (isLeap && month === leap + 1) isLeap = false;
      offset -= temp;
    }
    if (offset === 0 && leap > 0 && month === leap + 1) {
      if (isLeap) { isLeap = false; } else { isLeap = true; month--; }
    }
    if (offset < 0) { offset += temp; month--; }
    const ld = offset + 1;
    return (isLeap ? "闰" : "") + lunarMonths[month - 1] + "月" + lunarDays[ld - 1];
  }
  function getGreeting(h) {
    if (h >= 5 && h < 11) return "早上好";
    if (h >= 11 && h < 13) return "中午好";
    if (h >= 13 && h < 18) return "下午好";
    if (h >= 18 && h < 23) return "晚上好";
    return "夜深了";
  }

  function tick() {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, "0");
    const mm = String(now.getMinutes()).padStart(2, "0");
    if (chEl.textContent !== hh) chEl.textContent = hh;
    if (cmEl.textContent !== mm) {
      cmEl.textContent = mm;
      if (mm !== lastMM) {
        lastMM = mm;
        const big = (mm === "00");
        clockEl.classList.remove("pulse", "pulse-big");
        void clockEl.offsetWidth;
        clockEl.classList.add(big ? "pulse-big" : "pulse");
      }
    }
    const ss = String(now.getSeconds()).padStart(2, "0");
    if (csEl.textContent !== ss) csEl.textContent = ss;
    const days = ["日","一","二","三","四","五","六"];
    const lunar = getLunar(now);
    document.getElementById("date").textContent =
      `${now.getFullYear()}年${now.getMonth()+1}月${now.getDate()}日 星期${days[now.getDay()]}` + (lunar ? ` · 农历${lunar}` : "");
    document.getElementById("greeting").textContent = getGreeting(now.getHours());
  }
  tick(); setInterval(tick, 1000);

  // ===== 每日一言 =====
  const QUOTES = [
    /* 现代治愈短句 */
    { t: "今天也要好好吃饭。", a: "" },
    { t: "慢慢来，比较快。", a: "" },
    { t: "你已经做得很好了。", a: "" },
    { t: "允许自己偶尔停下来。", a: "" },
    { t: "生活明朗，万物可爱。", a: "" },
    { t: "把日子过成自己喜欢的样子。", a: "" },
    { t: "别着急，好运正在路上。", a: "" },
    { t: "照顾好自己，是头等大事。", a: "" },
    { t: "愿你所愿皆成真。", a: "" },
    { t: "平凡的一天，也很值得纪念。", a: "" },
    { t: "不开心的时候，就去吹吹风。", a: "" },
    { t: "学会和自己和解。", a: "" },
    { t: "把烦恼留给昨天的风。", a: "" },
    { t: "温柔地对待世界，也温柔地对待自己。", a: "" },
    /* 励志成长金句 */
    { t: "你只管努力，剩下的交给时间。", a: "" },
    { t: "所有的惊艳，都来自长久的准备。", a: "" },
    { t: "自律，是普通人最好的天赋。", a: "" },
    { t: "你现在的所有努力，都是未来的伏笔。", a: "" },
    { t: "别让未来的你，讨厌现在的自己。", a: "" },
    { t: "不为模糊的未来担忧，只为清清楚楚的现在努力。", a: "" },
    { t: "越努力，越幸运。", a: "" },
    { t: "乾坤未定，你我皆是黑马。", a: "" },
    { t: "把每一件小事做到极致，就是非凡。", a: "" },
    { t: "梦想还是要有的，万一实现了呢。", a: "马云" },
    { t: "与其抱怨黑暗，不如提灯前行。", a: "" },
    { t: "再小的努力，乘以 365 都会变得了不起。", a: "" },
    { t: "你不必光芒万丈，但可以始终温暖有光。", a: "" },
    /* 英文名言（双语） */
    { t: "Stay hungry, stay foolish.", a: "求知若饥，虚心若愚 · Steve Jobs" },
    { t: "The best way to predict the future is to create it.", a: "预测未来最好的方式，是去创造它 · Peter Drucker" },
    { t: "Be yourself; everyone else is already taken.", a: "做你自己，因为别人都有人做了 · Oscar Wilde" },
    { t: "In the middle of difficulty lies opportunity.", a: "困难之中，往往蕴藏着机会 · Einstein" },
    { t: "Yesterday is history, tomorrow is a mystery, today is a gift.", a: "昨日已成历史，明日仍是谜团，而今天是礼物" },
    { t: "Dream big and dare to fail.", a: "大胆梦想，也敢于失败" },
    { t: "Keep going. What you need will come at the perfect time.", a: "继续前行，你所需的一切会在恰好的时机到来" },
    { t: "Happiness comes from your own actions.", a: "幸福源于你自己的行动 · Dalai Lama" },
    { t: "What doesn't kill you makes you stronger.", a: "那些杀不死你的，使你更强大" },
    { t: "You only live once, but if you do it right, once is enough.", a: "一生只活一次，但活得好，一次便已足够 · Mae West" },
    /* 影视 / 动漫台词 */
    { t: "生活就像一盒巧克力，你永远不知道下一颗是什么味道。", a: "《阿甘正传》" },
    { t: "愿原力与你同在。", a: "《星球大战》" },
    { t: "希望是好事，也许是最好的事。", a: "《肖申克的救赎》" },
    { t: "做人如果没有梦想，跟咸鱼有什么分别。", a: "《少林足球》" },
    { t: "不管前方的路有多苦，只要方向正确，就比站在原地更接近幸福。", a: "《千与千寻》" },
    { t: "我们一路奋战，不是为了改变世界，而是为了不让世界改变我们。", a: "《熔炉》" },
    { t: "有些鸟是关不住的，它们的羽毛太鲜亮了。", a: "《肖申克的救赎》" },
    { t: "我命由我不由天。", a: "《哪吒之魔童降世》" },
    { t: "人生不能像做菜，把所有的料都备齐了才下锅。", a: "《饮食男女》" },
    { t: "如果再也不能见到你，祝你早安、午安、晚安。", a: "《楚门的世界》" }
  ];
  const quoteTextEl = document.querySelector("#quote .q-text");
  const quoteAuthorEl = document.querySelector("#quote .q-author");
  const WA_CACHE_KEY = "wenan_quotes_v2";   // v2：升版强制绕过旧解析器写入的脏缓存
  const WA_CACHE_DAY = "wenan_quotes_day_v2";
  let ACTIVE_QUOTES = QUOTES;   // 默认本地兜底，联网拿到文案网后替换
  let quoteIdx = -1;
  function renderQuote(idx) {
    const q = ACTIVE_QUOTES[idx];
    if (!q) return;
    quoteTextEl.textContent = q.t;
    if (q.a) { quoteAuthorEl.textContent = q.a; quoteAuthorEl.style.display = ""; }
    else { quoteAuthorEl.textContent = ""; quoteAuthorEl.style.display = "none"; }
    quoteIdx = idx;
  }
  function dailyQuoteIndex() {
    const day = Math.floor(Date.now() / 86400000);
    return ((day % ACTIVE_QUOTES.length) + ACTIVE_QUOTES.length) % ACTIVE_QUOTES.length;
  }
  function refreshQuote() {
    if (ACTIVE_QUOTES.length <= 1) return;
    let i = Math.floor(Math.random() * ACTIVE_QUOTES.length);
    while (i === quoteIdx) i = Math.floor(Math.random() * ACTIVE_QUOTES.length);
    renderQuote(i);
    restartQuoteTimer();
  }
  // ===== 文案自动刷新（默认每 30 秒换一句，可开关/调间隔） =====
  var QUOTE_AUTO_DEFAULT = 30;            // 秒
  var quoteTimer = null;
  function quoteAutoSeconds() {
    var v = parseInt((settings.quoteAuto != null ? settings.quoteAuto : 30), 10);
    return (isFinite(v) && v >= 5) ? v : QUOTE_AUTO_DEFAULT;
  }
  function restartQuoteTimer() {
    if (quoteTimer) { clearInterval(quoteTimer); quoteTimer = null; }
    var mode = (settings.quoteAuto != null ? settings.quoteAuto : 30);
    if (mode === 0 || mode === "0" || mode === "off") return;
    var sec = quoteAutoSeconds();
    quoteTimer = setInterval(function () {
      if (!ACTIVE_QUOTES.length) return;
      var i = Math.floor(Math.random() * ACTIVE_QUOTES.length);
      while (ACTIVE_QUOTES.length > 1 && i === quoteIdx) i = Math.floor(Math.random() * ACTIVE_QUOTES.length);
      renderQuoteFade(i);
    }, sec * 1000);
  }
  function renderQuoteFade(idx) {           // 淡入切换，避免生硬跳变
    var box = document.getElementById("quote");
    if (box) {
      box.style.transition = "opacity .5s ease, transform .5s ease";
      box.style.opacity = "0"; box.style.transform = "translateY(6px)";
      setTimeout(function () { renderQuote(idx); box.style.opacity = "1"; box.style.transform = "translateY(0)"; }, 260);
    } else { renderQuote(idx); }
  }
  // 抓取文案网（wenanwang.com）的治愈 / 励志文案。
  // 关键：列表页只用来拿「文章链接」；真正解析每篇「详情页」里的 <p> 带序号句子，
  // 避免把文章标题 / 日期 / 围观数等串味进文案（之前整页正文切分导致的 bug）。
  const WA_BASE = "https://www.wenanwang.com";
  const WA_TAGS = [WA_BASE + "/zt/zhiyu/", WA_BASE + "/zt/lizhi/"];
  function parseWenanList(html) {
    const links = [];
    const re = /href=["'](\/lz\/\d+\.html)["']/gi;
    let m;
    while ((m = re.exec(html)) !== null) if (m[1]) links.push(WA_BASE + m[1]);
    return Array.from(new Set(links));
  }
  function parseWenanDetail(html) {
    const out = [];
    const re = /<p[^>]*>([\s\S]*?)<\/p>/gi;
    let m;
    while ((m = re.exec(html)) !== null) {
      const t = m[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      const mm = t.match(/^\d{1,3}[、.．]\s*(.+)$/);
      if (!mm) continue;                         // 只收「序号 + 句子」的行
      const s = mm[1].trim();
      if (s.length < 4 || s.length > 80) continue;
      if (/[<>]/.test(s)) continue;
      out.push({ t: s, a: "" });
    }
    return out;
  }
  // 清洗：过滤列表页元数据串味（标题/日期/围观数）与异常项，并按句子去重
  function cleanWenanPool(list) {
    if (!Array.isArray(list)) return [];
    const seen = new Set(); const out = [];
    for (const q of list) {
      if (!q || typeof q.t !== "string") continue;
      const s = q.t.replace(/\s+/g, " ").trim();
      if (/人围观|共\s*\d+\s*人|20\d{2}[-/年]\d{1,2}[-/月]\d{1,2}|阅读全文|点击查看|查看详情|详情页/.test(s)) continue;
      if (s.includes("...") || s.includes("…")) continue;   // 截断预览/串味都带省略号
      if (s.length < 4 || s.length > 80) continue;
      if (/[<>]/.test(s)) continue;
      if (seen.has(s)) continue;
      seen.add(s);
      out.push({ t: s, a: "" });
    }
    return out;
  }
  function applyWenanPool(pool) {
    const cleaned = cleanWenanPool(pool);
    if (cleaned.length < 10) return;
    ACTIVE_QUOTES = cleaned;
    renderQuote(dailyQuoteIndex());   // 当天序号刷新为文案网内容
    restartQuoteTimer();             // 池子换了，按新池重新计自动轮换
  }
  async function loadRemoteQuotes() {
    const today = new Date().toISOString().slice(0, 10);
    try {
      const cached = localStorage.getItem(WA_CACHE_KEY);
      const cachedDay = localStorage.getItem(WA_CACHE_DAY);
      if (cached && cachedDay === today) { applyWenanPool(JSON.parse(cached)); return; }
    } catch (e) {}
    if (typeof navigator !== "undefined" && navigator.onLine === false) return;
    try {
      // 1) 取治愈 + 励志两个列表页，汇总文章链接
      const lists = await Promise.all(WA_TAGS.map(u =>
        fetch(u).then(r => { if (!r.ok) throw new Error("list"); return r.text(); })));
      let links = [];
      lists.forEach(h => { links = links.concat(parseWenanList(h)); });
      links = Array.from(new Set(links));
      if (!links.length) return;
      // 2) 随机挑 4 篇详情页，并发抓取并解析
      const picks = [];
      const pool = links.slice();
      for (let i = 0; i < 4 && pool.length; i++) picks.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
      const results = await Promise.allSettled(picks.map(u => fetch(u).then(r => r.text())));
      let pool2 = [];
      for (const r of results) if (r.status === "fulfilled") pool2 = pool2.concat(parseWenanDetail(r.value));
      pool2 = cleanWenanPool(pool2);   // 二次清洗后再落缓存，杜绝脏数据
      if (pool2.length >= 10) {
        try {
          localStorage.setItem(WA_CACHE_KEY, JSON.stringify(pool2));
          localStorage.setItem(WA_CACHE_DAY, today);
        } catch (e) {}
        applyWenanPool(pool2);
      }
    } catch (e) {
      /* 联网失败 / 被 CORS 拦截：保持本地文案兜底 */
    }
  }
  renderQuote(dailyQuoteIndex());
  restartQuoteTimer();
  loadRemoteQuotes();
  const quoteRefresh = document.getElementById("quote-refresh");
  if (quoteRefresh) quoteRefresh.addEventListener("click", refreshQuote);

  // ===== 搜索 =====
  const engineBtn = document.getElementById("engine-btn");
  const engineName = document.getElementById("engine-name");
  const engineMenu = document.getElementById("engine-menu");
  const searchInput = document.getElementById("search-input");

  engineName.textContent = settings.engine;

  function getEngineUrl(name, q) {
    const custom = (settings.customEngines || []).find(e => e.name === name);
    const tpl = custom ? custom.url : ENGINES[name];
    if (!tpl) return ENGINES["百度"] + encodeURIComponent(q);
    if (tpl.indexOf("%s") !== -1) return tpl.replace(/%s/g, encodeURIComponent(q));
    return tpl + encodeURIComponent(q);
  }

  function buildEngineMenu() {
    engineMenu.innerHTML = "";
    const custom = settings.customEngines || [];
    const allNames = Object.keys(ENGINES).concat(custom.map(e => e.name));
    allNames.forEach(name => {
      const b = document.createElement("button");
      const label = document.createElement("span");
      label.textContent = name;
      b.appendChild(label);
      if (name === settings.engine) b.classList.add("active");
      b.onclick = (e) => {
        e.stopPropagation();
        settings.engine = name;
        engineName.textContent = name;
        save();
        engineMenu.classList.remove("open");
        [...engineMenu.children].forEach(c => c.classList.remove("active"));
        b.classList.add("active");
      };
      if (custom.some(e => e.name === name)) {
        const del = document.createElement("span");
        del.className = "engine-del";
        del.textContent = "✕";
        del.title = "删除该搜索引擎";
        del.onclick = (e) => {
          e.stopPropagation();
          if (!confirm("确定删除搜索引擎「" + name + "」？")) return;
          settings.customEngines = custom.filter(e2 => e2.name !== name);
          if (settings.engine === name) { settings.engine = "必应"; engineName.textContent = "必应"; }
          save();
          buildEngineMenu();
        };
        b.appendChild(del);
      }
      engineMenu.appendChild(b);
    });
    const add = document.createElement("button");
    add.className = "engine-add";
    add.textContent = "＋ 添加搜索引擎";
    add.onclick = (e) => {
      e.stopPropagation();
      const nm = prompt("搜索引擎名称（例如：知乎）：");
      if (!nm || !nm.trim()) return;
      const url = prompt("搜索链接（用 %s 表示搜索词，例如：\nhttps://www.zhihu.com/search?q=%s）");
      if (!url || !url.trim()) return;
      settings.customEngines = (settings.customEngines || []).concat([{ name: nm.trim(), url: url.trim() }]);
      settings.engine = nm.trim();
      engineName.textContent = nm.trim();
      save();
      buildEngineMenu();
      engineMenu.classList.remove("open");
    };
    engineMenu.appendChild(add);

    const exp = document.createElement("button");
    exp.className = "engine-add";
    exp.textContent = "⤓ 导出引擎配置";
    exp.onclick = (e) => { e.stopPropagation(); exportEngines(); };
    engineMenu.appendChild(exp);

    const imp = document.createElement("button");
    imp.className = "engine-add";
    imp.textContent = "⤒ 导入引擎配置";
    imp.onclick = (e) => { e.stopPropagation(); const fi = document.getElementById("engine-import"); if (fi) fi.click(); };
    engineMenu.appendChild(imp);
  }
  buildEngineMenu();

  // 搜索引擎配置导入/导出
  const engineImportInput = document.getElementById("engine-import");
  if (engineImportInput) engineImportInput.addEventListener("change", (e) => {
    const f = e.target.files && e.target.files[0];
    if (f) importEnginesFromFile(f);
    e.target.value = "";
  });

  function exportEngines() {
    const data = { engine: settings.engine, customEngines: settings.customEngines || [] };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "search-engines.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);
    showToast("已导出搜索引擎配置");
  }

  function importEnginesFromFile(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (data && Array.isArray(data.customEngines)) {
          settings.customEngines = data.customEngines;
          if (data.engine) settings.engine = data.engine;
          save();
          buildEngineMenu();
          engineName.textContent = settings.engine;
          showToast("已导入搜索引擎配置");
        } else {
          showToast("文件格式不正确");
        }
      } catch (err) {
        showToast("导入失败：JSON 解析错误");
      }
    };
    reader.readAsText(file);
  }

  engineBtn.onclick = (e) => { e.stopPropagation(); engineMenu.classList.toggle("open"); };

  function doSearch() {
    const q = searchInput.value.trim();
    if (!q) return;
    // 若输入的是完整网址，直接打开
    if (/^https?:\/\//i.test(q)) { window.open(q, "_blank"); return; }
    window.open(getEngineUrl(settings.engine, q), "_blank");
  }
  document.getElementById("search-btn").onclick = doSearch;
  searchInput.addEventListener("keydown", (e) => { if (e.key === "Enter") doSearch(); });
  document.addEventListener("click", () => engineMenu.classList.remove("open"));

  // ===== 快捷链接 =====
  const linksEl = document.getElementById("links");
  let dragIndex = null;
  function renderLinks() {
    linksEl.innerHTML = "";
    settings.links.forEach((lk, i) => {
      const a = document.createElement("a");
      a.className = "link enter";
      a.href = lk.url; a.target = "_blank";
      a.draggable = true;
      a.style.setProperty("--i", i);
      const icon = document.createElement("span");
      icon.className = "icon";
      const emojiSpan = document.createElement("span");
      emojiSpan.className = "emoji";
      emojiSpan.textContent = lk.emoji || "🔗";
      icon.appendChild(emojiSpan);
      try {
        const domain = new URL(lk.url).hostname;
        if (domain) {
          const img = document.createElement("img");
          img.className = "favimg";
          img.alt = "";
          img.referrerPolicy = "no-referrer";
          img.loading = "lazy";
          img.onload = () => { emojiSpan.style.display = "none"; };
          img.onerror = () => { img.remove(); };
          img.src = "https://api.iowen.cn/favicon/" + domain + ".png";
          icon.appendChild(img);
        }
      } catch (e) {}
      a.appendChild(icon);
      const nameSpan = document.createElement("span");
      nameSpan.textContent = lk.name;
      a.appendChild(nameSpan);
      const del = document.createElement("button");
      del.className = "del"; del.title = "删除"; del.textContent = "×";
      del.onclick = (e) => {
        e.preventDefault(); e.stopPropagation();
        settings.links.splice(i, 1); save(); renderLinks();
      };
      a.appendChild(del);
      a.addEventListener("dragstart", (e) => {
        dragIndex = i;
        e.dataTransfer.effectAllowed = "move";
        try { e.dataTransfer.setData("text/plain", lk.url); } catch (err) {}
      });
      a.addEventListener("dragover", (e) => { e.preventDefault(); });
      a.addEventListener("drop", (e) => {
        e.preventDefault();
        if (dragIndex === null || dragIndex === i) return;
        const [moved] = settings.links.splice(dragIndex, 1);
        settings.links.splice(i, 0, moved);
        dragIndex = null;
        save(); renderLinks();
      });
      linksEl.appendChild(a);
    });
    const add = document.createElement("a");
    add.className = "link add-link enter";
    add.style.setProperty("--i", settings.links.length);
    add.innerHTML = `<span class="emoji">＋</span><span>添加</span>`;
    add.onclick = (e) => {
      e.preventDefault();
      const name = prompt("网站名称：");
      if (!name) return;
      const url = prompt("网站链接（含 https://）：", "https://");
      if (!url) return;
      const emoji = prompt("图标 emoji（可选）：", "🔗") || "🔗";
      settings.links.push({ name, url, emoji });
      save(); renderLinks();
    };
    linksEl.appendChild(add);
  }
  renderLinks();

  // ===== 设置面板 =====
  const settingsBtn = document.getElementById("settings-btn");
  const panel = document.getElementById("panel");

  // ===== 设置面板拖动 + 位置记忆 =====
  (function () {
    const bar = document.getElementById("panel-bar");
    if (!bar) return;
    let dragging = false, sx = 0, sy = 0, ox = 0, oy = 0;
    function getPt(e) { return e.touches ? e.touches[0] : e; }
    function initPos() {
      const pw = panel.offsetWidth || 340;
      if (settings.panelPos && typeof settings.panelPos.x === "number") {
        panel.style.left = settings.panelPos.x + "px";
        panel.style.top = settings.panelPos.y + "px";
      } else {
        panel.style.left = Math.max(0, window.innerWidth - pw - 22) + "px";
        panel.style.top = "70px";
      }
      panel.style.right = "auto";
      panel.style.bottom = "auto";
    }
    initPos();
    function onStart(e) {
      dragging = true;
      const pt = getPt(e);
      sx = pt.clientX; sy = pt.clientY;
      const r = panel.getBoundingClientRect();
      ox = r.left; oy = r.top;
      document.body.style.userSelect = "none";
      if (e.cancelable) e.preventDefault();
    }
    function onMove(e) {
      if (!dragging) return;
      const pt = getPt(e);
      let nx = ox + (pt.clientX - sx);
      let ny = oy + (pt.clientY - sy);
      const w = panel.offsetWidth, h = panel.offsetHeight;
      nx = Math.max(0, Math.min(nx, window.innerWidth - w));
      ny = Math.max(0, Math.min(ny, window.innerHeight - h));
      panel.style.left = nx + "px";
      panel.style.top = ny + "px";
      if (e.cancelable) e.preventDefault();
    }
    function onEnd() {
      if (!dragging) return;
      dragging = false;
      document.body.style.userSelect = "";
      settings.panelPos = {
        x: parseInt(panel.style.left, 10) || 0,
        y: parseInt(panel.style.top, 10) || 0
      };
      save();
    }
    bar.addEventListener("mousedown", onStart);
    bar.addEventListener("touchstart", onStart, { passive: false });
    document.addEventListener("mousemove", onMove);
    document.addEventListener("touchmove", onMove, { passive: false });
    document.addEventListener("mouseup", onEnd);
    document.addEventListener("touchend", onEnd);
  })();

  // 面板开/关（带过渡动画）：open 时入场上浮，关闭时反向收缩淡出后再隐藏
  function togglePanel(panel) {
    if (panel._closing) return;
    var isOpen = panel.classList.contains("open");
    if (isOpen) {
      panel.classList.remove("open");
      panel.classList.add("closing");
      panel._closing = setTimeout(function () {
        panel.classList.remove("closing");
        panel._closing = null;
      }, 200);
    } else {
      if (panel._closing) { clearTimeout(panel._closing); panel.classList.remove("closing"); panel._closing = null; }
      panel.classList.add("open");
    }
  }
  function closePanel(panel) {
    if (!panel.classList.contains("open")) return;
    togglePanel(panel);
  }
  settingsBtn.onclick = (e) => { e.stopPropagation(); togglePanel(panel); };
  document.addEventListener("click", (e) => {
    if (!panel.contains(e.target) && e.target !== settingsBtn) closePanel(panel);
  });

  // ===== 预设壁纸 =====
  const presetGrid = document.getElementById("preset-grid");
  PRESETS.forEach((p, i) => {
    const d = document.createElement("div");
    d.className = "preset";
    d.style.backgroundImage = p;
    const isActive = settings.isGradient && settings.wallpaper === p;
    if (isActive) d.classList.add("active");
    d.onclick = () => {
      disableRotation();
      settings.wallpaper = p; settings.isGradient = true; settings.wallpaperType = "gradient"; save();
      applyWallpaper(true);
      [...presetGrid.children].forEach(c => c.classList.remove("active"));
      d.classList.add("active");
    };
    presetGrid.appendChild(d);
  });

  // ===== 导入本地图片 / 视频（存入 IndexedDB，持久保存）=====
  async function handleFile(file) {
    if (!file) return;
    const isVideo = file.type.startsWith("video/");
    try {
      await saveBlob(file);
      disableRotation();
      settings.wallpaper = "__blob__";
      settings.wallpaperType = isVideo ? "video" : "image";
      settings.isGradient = false;
      save();
      await applyWallpaper(true);
      [...presetGrid.children].forEach(c => c.classList.remove("active"));
      showToast(isVideo ? "视频已保存，下次打开自动播放" : "图片已保存，下次打开自动显示");
    } catch (err) {
      alert("保存失败：" + (err && err.message ? err.message : err));
    }
  }
  document.getElementById("upload-image").addEventListener("change", (e) => {
    handleFile(e.target.files[0]); e.target.value = "";
  });
  document.getElementById("upload-video").addEventListener("change", (e) => {
    handleFile(e.target.files[0]); e.target.value = "";
  });

  // ===== 图片 / 视频链接 =====
  document.getElementById("url-apply").onclick = () => {
    const url = document.getElementById("url-input").value.trim();
    if (!url) return;
    if (!/^https?:\/\//i.test(url)) {
      alert("请输入以 http(s):// 开头的图片或视频直链。");
      return;
    }
    disableRotation();
    const isVideo = /\.(mp4|webm|ogg|mov|m4v)$/i.test(url);
    const clearPreset = () => [...presetGrid.children].forEach(c => c.classList.remove("active"));
    if (isVideo) {
      const v = document.createElement("video");
      v.preload = "metadata";
      v.onerror = () => alert("⚠️ 该链接无法作为视频加载，请确认是可直接访问的 .mp4/.webm 等视频文件地址。");
      settings.wallpaper = url; settings.wallpaperType = "video"; settings.isGradient = false; save();
      applyWallpaper(true); clearPreset();
    } else {
      const img = new Image();
      let settled = false;
      img.onload = () => {
        if (settled) return; settled = true;
        settings.wallpaper = url; settings.wallpaperType = "image"; settings.isGradient = false; save();
        applyWallpaper(true); clearPreset();
      };
      img.onerror = () => {
        if (settled) return; settled = true;
        alert("⚠️ 该链接无法直接作为图片加载。\n\n常见原因：\n• 粘贴的是「壁纸网站详情页」链接（网页），不是图片文件本身；\n• 链接不是以 .jpg/.png/.webp 等图片格式结尾；\n• 图片开启了防盗链，不允许外部引用。\n\n解决办法：在网站点「下载原图 / 查看大图」，右键复制图片地址（.jpg/.png 结尾）再粘贴；或改用本地上传。");
      };
      img.src = url;
    }
  };

  // ===== 壁纸效果：暗化 / 模糊 =====
  const darkSlider = document.getElementById("dark-slider");
  const blurSlider = document.getElementById("blur-slider");
  const videoToggle = document.getElementById("video-toggle");
  function applyEffects() {
    document.documentElement.style.setProperty("--dark", settings.dark);
    document.documentElement.style.setProperty("--blur", settings.blur + "px");
  }
  darkSlider.value = settings.dark;
  blurSlider.value = settings.blur;
  applyEffects();
  darkSlider.addEventListener("input", () => {
    settings.dark = parseFloat(darkSlider.value); applyEffects(); save();
  });
  blurSlider.addEventListener("input", () => {
    settings.blur = parseInt(blurSlider.value, 10); applyEffects(); save();
  });
  videoToggle.addEventListener("click", function () {
    settings.videoPaused = !settings.videoPaused; save();
    if (currentVideo) {
      if (settings.videoPaused) currentVideo.pause();
      else currentVideo.play().catch(function(){});
    }
    if (videoToggle) videoToggle.textContent = settings.videoPaused ? "▶ 播放动态壁纸" : "⏸ 暂停动态壁纸";
  });

  // ===== 背景氛围光斑开关 =====
  const ambientToggle = document.getElementById("ambient-toggle");
  function applyAmbient() {
    const a = document.getElementById("ambient");
    if (a) a.style.display = settings.ambient ? "block" : "none";
  }
  if (ambientToggle) {
    ambientToggle.checked = !!settings.ambient;
    ambientToggle.addEventListener("change", function () {
      settings.ambient = ambientToggle.checked; save(); applyAmbient();
    });
  }
  applyAmbient();

  // ===== 每日一言自动刷新设置 =====
  var quoteAutoToggle = document.getElementById("quote-auto-toggle");
  var quoteAutoInterval = document.getElementById("quote-auto-interval");
  if (quoteAutoToggle) {
    quoteAutoToggle.checked = (settings.quoteAuto !== 0);
    quoteAutoToggle.addEventListener("change", function () {
      settings.quoteAuto = quoteAutoToggle.checked ? (parseInt(quoteAutoInterval.value, 10) || 30) : 0;
      save(); restartQuoteTimer();
    });
  }
  if (quoteAutoInterval) {
    quoteAutoInterval.value = String(settings.quoteAuto > 0 ? settings.quoteAuto : 30);
    quoteAutoInterval.addEventListener("change", function () {
      if (!quoteAutoToggle || quoteAutoToggle.checked) {
        settings.quoteAuto = parseInt(quoteAutoInterval.value, 10) || 30;
        save(); restartQuoteTimer();
      }
    });
  }

  // ===== 随机壁纸 =====
  document.getElementById("random-btn").addEventListener("click", () => {
    const p = PRESETS[Math.floor(Math.random() * PRESETS.length)];
    settings.wallpaper = p; settings.isGradient = true; settings.wallpaperType = "gradient"; save();
    applyWallpaper(true);
    [...presetGrid.children].forEach((c, idx) => c.classList.toggle("active", PRESETS[idx] === p));
  });

  // ===== 选择文件夹：批量导入壁纸库 =====
  document.getElementById("folder-input").addEventListener("change", async (e) => {
    const files = Array.from(e.target.files || []);
    const media = files.filter(f => f.type.startsWith("image/") || f.type.startsWith("video/"));
    if (media.length === 0) { alert("该文件夹中没有找到图片或视频文件。"); e.target.value = ""; return; }
    await clearGallery();
    let ok = 0, fail = 0;
    for (const f of media) {
      const type = f.type.startsWith("video/") ? "video" : "image";
      try { await saveGalleryItem(f, type, f.name); ok++; }
      catch (err) { fail++; }
    }
    await loadGalleryCache();
    settings.galleryIndex = 0;
    settings.rotation.enabled = true;
    save();
    syncRotationUI();
    updateGalleryCount();
    startRotation();
    showToast(`已导入 ${ok} 个壁纸${fail ? `，${fail} 个过大保存失败` : ""}，开始轮换`);
    e.target.value = "";
  });

  // ===== 动态轮换控制 =====
  function syncRotationUI() {
    const re = document.getElementById("rotation-enabled");
    const ri = document.getElementById("rotation-interval");
    const rr = document.getElementById("rotation-random");
    if (re) re.checked = settings.rotation.enabled;
    if (ri) ri.value = String(settings.rotation.interval);
    if (rr) rr.checked = settings.rotation.random;
    updateGalleryCount();
  }
  function updateGalleryCount() {
    const el = document.getElementById("gallery-count");
    if (el) el.textContent = galleryCache.length === 0 ? "尚未导入壁纸库" : `壁纸库共 ${galleryCache.length} 个文件`;
  }
  document.getElementById("rotation-enabled").addEventListener("change", (e) => {
    settings.rotation.enabled = e.target.checked; save();
    if (settings.rotation.enabled) startRotation(); else stopRotation();
  });
  document.getElementById("rotation-interval").addEventListener("change", (e) => {
    let v = parseInt(e.target.value, 10);
    if (!v || v < 1) v = 1;
    if (v > 3600) v = 3600;
    settings.rotation.interval = v; e.target.value = v; save();
    if (settings.rotation.enabled) startRotation();
  });
  document.getElementById("rotation-random").addEventListener("change", (e) => {
    settings.rotation.random = e.target.checked; save();
  });
  document.getElementById("next-wallpaper").addEventListener("click", () => {
    if (galleryCache.length === 0) { showToast("壁纸库为空，请先选择文件夹"); return; }
    if (settings.rotation.random) settings.galleryIndex = Math.floor(Math.random() * galleryCache.length);
    else settings.galleryIndex = (settings.galleryIndex + 1) % galleryCache.length;
    applyGalleryItem(); save();
  });
  document.getElementById("clear-gallery").addEventListener("click", async () => {
    await clearGallery();
    galleryCache = [];
    settings.rotation.enabled = false;
    settings.galleryIndex = 0;
    save();
    syncRotationUI();
    stopRotation();
    settings.wallpaper = PRESETS[0]; settings.isGradient = true; settings.wallpaperType = "gradient"; save();
    applyWallpaper(true);
    showToast("壁纸库已清空");
  });

  // ===== 初始化：读取壁纸库并按需启动轮换 =====
  (async () => {
    try {
      await loadGalleryCache();
      syncRotationUI();
      if (settings.rotation.enabled && galleryCache.length > 0) startRotation();
    } catch (e) {}
  })();

  // ===== 启动自愈：当前图片壁纸若已失效（如之前的坏链接）则回退到预设 =====
  (function () {
    const type = settings.wallpaperType || (settings.isGradient ? "gradient" : "image");
    if (type === "image" && !String(settings.wallpaper).startsWith("data:") && settings.wallpaper !== "__blob__") {
      const probe = new Image();
      probe.onerror = () => {
        settings.wallpaper = PRESETS[0];
        settings.isGradient = true;
        settings.wallpaperType = "gradient";
        save();
        applyWallpaper(true);
        [...presetGrid.children].forEach((c, idx) =>
          c.classList.toggle("active", PRESETS[idx] === PRESETS[0]));
      };
      probe.src = settings.wallpaper;
    }
  })();

  // ===== 轻提示 =====
  function showToast(msg) {
    let t = document.getElementById("toast");
    if (!t) { t = document.createElement("div"); t.id = "toast"; document.body.appendChild(t); }
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.remove("show"), 2200);
  }

  // ===== 复制本页路径（用于设置浏览器自动启动）=====
  document.getElementById("copy-path").addEventListener("click", () => {
    const path = location.href;
    const done = () => alert("已复制主页路径：\n" + path +
      "\n\n设置方法：浏览器「设置 → 启动时 / 主页」→ 打开特定页面或一组页面 → 粘贴上面地址。\n" +
      "或：菜单 → 更多工具 → 创建快捷方式（勾选作为窗口打开），再把该快捷方式设为开机启动。");
    try {
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(path).then(done, fallback);
      } else { fallback(); }
    } catch (e) { fallback(); }
    function fallback() {
      try {
        const ta = document.createElement("textarea");
        ta.value = path; ta.style.position = "fixed"; ta.style.opacity = "0";
        document.body.appendChild(ta); ta.select();
        document.execCommand("copy"); ta.remove(); done();
      } catch (e2) {
        alert("请手动复制地址栏中的路径：\n" + path);
      }
    }
  });

  // ===== 一键设为主页（识别浏览器并给出精确设置步骤，自动复制地址）=====
  function detectBrowser() {
    const ua = navigator.userAgent;
    if (/Edg\//.test(ua)) return "Edge";
    if (/Firefox\//.test(ua)) return "Firefox";
    if (/Chrome\//.test(ua) || /Chromium\//.test(ua)) return "Chrome";
    if (/Safari\//.test(ua)) return "Safari";
    return "其他";
  }
  async function copyText(text) {
    try {
      if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(text); return true; }
    } catch (e) {}
    try {
      const ta = document.createElement("textarea");
      ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      const ok = document.execCommand("copy"); ta.remove(); return ok;
    } catch (e2) { return false; }
  }
  document.getElementById("set-home").addEventListener("click", async () => {
    const path = location.href;
    const copied = await copyText(path);
    const browser = detectBrowser();
    let steps;
    if (browser === "Chrome") {
      steps = "Chrome 设置主页 / 启动页：\n\n" +
        "【主页按钮】右上角「⋮」→ 设置 → 外观 → 开启「显示主页按钮」→ 选择「输入自定义网址」并粘贴。\n\n" +
        "【启动页】设置 → 启动时 →「打开特定页面或一组页面」→「添加新页面」→ 粘贴。";
    } else if (browser === "Edge") {
      steps = "Edge 设置主页 / 启动页：\n\n" +
        "设置 →「开始、主页、新建标签页」→「主页」→ 选择「打开自定义页面」并粘贴。\n\n" +
        "「启动时」→「打开以下页面」→「添加新页面」→ 粘贴。";
    } else if (browser === "Firefox") {
      steps = "Firefox 设置主页：\n\n" +
        "右上角「☰」→ 设置 → 左侧「主页」→「主页和新窗口」「新标签页」→ 选择「自定义网址」并粘贴。";
    } else if (browser === "Safari") {
      steps = "Safari 设置主页：\n\n" +
        "顶部菜单「Safari」→ 设置 →「通用」→「主页」一栏粘贴网址；\n" +
        "「新窗口打开方式」「新标签页打开方式」可选为「主页」。";
    } else {
      steps = "请在浏览器的「设置 → 主页 / 启动时」中，把网址设为你复制的地址：\n" + path;
    }
    if (!copied) steps += "\n\n（未能自动复制，请手动复制地址栏中的网址）";
    else steps += "\n\n✅ 本页地址已自动复制到剪贴板，按上面步骤粘贴即可。";
    alert(steps);
    showToast("已复制主页地址，按提示粘贴即可");
  });

  // ===== 设为新建标签页（识别浏览器并给出 new tab 设置步骤，自动复制地址）=====
  document.getElementById("set-newtab").addEventListener("click", async () => {
    const path = location.href;
    const copied = await copyText(path);
    const browser = detectBrowser();
    let steps;
    if (browser === "Firefox") {
      steps = "Firefox 设置新建标签页：\n\n" +
        "右上角「☰」→ 设置 → 左侧「主页」→「新标签页」下拉 → 选择「自定义网址」→ 粘贴下面的地址。\n\n" +
        "说明：Firefox 原生支持把新标签页指向任意网址，无需扩展。";
    } else if (browser === "Safari") {
      steps = "Safari 设置新建标签页：\n\n" +
        "1) 先点上方「🏠 一键设为主页」把主页设为该地址（Safari → 设置 → 通用 → 主页）。\n" +
        "2) 设置 → 通用 →「新标签页打开方式」选择「主页」。\n\n" +
        "说明：Safari 的新标签页可指向主页，无需扩展。";
    } else if (browser === "Chrome" || browser === "Edge") {
      const bn = browser === "Chrome" ? "Chrome" : "Edge";
      steps = bn + " 设置新建标签页：\n\n" +
        bn + " 原生不支持把新标签页直接设为自定义网址，需要借助扩展：\n\n" +
        "方法一（推荐）：到网上应用店安装「New Tab Redirect」或「Custom New Tab URL」扩展，在扩展设置里把重定向地址粘贴为：\n" + path + "\n\n" +
        "方法二：把本页设为「启动页」（见🏠设为主页里的启动页步骤），新开窗口即显示；新标签页可手动访问。\n\n" +
        "（同时设为「主页」也能让主页按钮直达本页。）";
    } else {
      steps = "请在浏览器的「新标签页」设置中，把打开地址设为你复制的网址：\n" + path +
        "\n\n（部分浏览器原生不支持自定义新标签页，可搜索「New Tab Redirect」类扩展实现。）";
    }
    if (!copied) steps += "\n\n（未能自动复制，请手动复制地址栏中的网址）";
    else steps += "\n\n✅ 本页地址已自动复制到剪贴板，按上面步骤粘贴即可。";
    alert(steps);
    showToast("已复制地址，按提示设置新标签页");
  });


/* 扩展提示条：默认隐藏，未记住才显示（避免已记住时短暂闪烁）；关闭时可选择记住 */
(function(){
  var note = document.getElementById("ext-note");
  var btn = document.getElementById("ext-note-close");
  var chk = document.getElementById("ext-note-remember");
  if (!note) return;
  // CSS 已默认 display:none；仅当未选择「记住」时才显示，避免已记住仍闪一下
  if (!settings.hideExtNote) { note.style.display = "flex"; }
  if (btn) {
    btn.addEventListener("click", function(){
      if (chk && chk.checked) { settings.hideExtNote = true; save(); }
      note.style.display = "none";
    });
  }
})();

// ===== 音乐解析窗口（播放 + 频谱柱形图）=====
(function () {
  var musicBtn = document.getElementById("music-btn");
  var win = document.getElementById("music-win");
  var bar = document.getElementById("music-bar");
  var audio = document.getElementById("music-audio");
  var playBtn = document.getElementById("music-play");
  var progress = document.getElementById("music-progress");
  var timeEl = document.getElementById("music-time");
  var nameEl = document.getElementById("music-name");
  var volEl = document.getElementById("music-volume");
  var bufferEl = document.getElementById("music-progress-buffer");
  var tipEl = document.getElementById("music-progress-tip");
  var fileInput = document.getElementById("music-file");
  var urlInput = document.getElementById("music-url");
  var urlApply = document.getElementById("music-url-apply");
  var canvas = document.getElementById("viz");
  var ctx = canvas.getContext("2d");
  var lyricBox = document.getElementById("lyric-box");
  var lyricInput = document.getElementById("lyric-input");
  var lyricApply = document.getElementById("lyric-apply");

  var audioCtx = null, analyser = null, sourceNode = null, dataArray = null, vizRAF = null;
  var lyricLines = [], curLyric = -1;

  function sizeCanvas() {
    var dpr = window.devicePixelRatio || 1;
    var w = canvas.offsetWidth || 480, h = 84;
    canvas.width = w * dpr; canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function ensureAudioGraph() {
    if (audioCtx) return;
    var AC = window.AudioContext || window.webkitAudioContext;
    audioCtx = new AC();
    sourceNode = audioCtx.createMediaElementSource(audio);
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 128;
    analyser.smoothingTimeConstant = 0.82;
    sourceNode.connect(analyser);
    analyser.connect(audioCtx.destination);
    dataArray = new Uint8Array(analyser.frequencyBinCount);
  }
  function drawViz() {
    vizRAF = requestAnimationFrame(drawViz);
    var w = canvas.offsetWidth || 480, h = 84;
    ctx.clearRect(0, 0, w, h);
    if (!analyser) return;
    analyser.getByteFrequencyData(dataArray);
    var bars = dataArray.length;
    var gap = 2;
    var bw = (w - gap * (bars - 1)) / bars;
    for (var i = 0; i < bars; i++) {
      var v = dataArray[i] / 255;
      var bh = Math.max(2, v * h);
      var x = i * (bw + gap);
      var grad = ctx.createLinearGradient(0, h, 0, h - bh);
      grad.addColorStop(0, "#4facfe");
      grad.addColorStop(1, "#f5576c");
      ctx.fillStyle = grad;
      ctx.fillRect(x, h - bh, bw, bh);
    }
  }
  function startViz() { if (!vizRAF) { sizeCanvas(); drawViz(); } canvas.classList.remove("idle"); }
  function stopViz() { if (vizRAF) { cancelAnimationFrame(vizRAF); vizRAF = null; } canvas.classList.add("idle"); }

  function escapeHtml(s) {
    return (s || "").replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function parseLRC(text) {
    var lines = [];
    if (!text) return lines;
    var re = /\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]/g;
    text.split(/\r?\n/).forEach(function (line) {
      var times = [];
      var m; re.lastIndex = 0;
      while ((m = re.exec(line)) !== null) {
        var min = parseInt(m[1], 10), sec = parseInt(m[2], 10);
        var ms = m[3] ? parseInt((m[3] + "00").slice(0, 3), 10) : 0;
        times.push(min * 60 + sec + ms / 1000);
      }
      if (times.length) {
        var txt = line.replace(/\[\d{1,2}:\d{2}(?:[.:]\d{1,3})?\]/g, "").trim();
        times.forEach(function (t) { lines.push({ time: t, text: txt }); });
      }
    });
    lines.sort(function (a, b) { return a.time - b.time; });
    return lines;
  }
  function setLyric(text) {
    lyricLines = parseLRC(text);
    curLyric = -1;
    renderLyric(true);
  }
  // 网易云与酷狗都拿不到歌词时，给出明确的版权限制说明 + 手动粘贴引导（而不是默默空白）
  function showLyricUnavailable() {
    lyricLines = [];
    if (lyricBox) lyricBox.innerHTML =
      '<div class="lyric-empty">该歌曲在网易云与酷狗均未提供歌词（版权/登录限制）。<br>' +
      '如需同步滚动歌词，可在下方「手动粘贴 LRC」文本框中粘贴歌词后点「应用歌词」。</div>';
  }
  function renderLyric(reset) {
    if (!lyricBox) return;
    if (!lyricLines.length) { lyricBox.innerHTML = '<div class="lyric-empty">暂无歌词</div>'; return; }
    if (reset) {
      lyricBox.innerHTML = lyricLines.map(function (l, i) {
        return '<div class="lyric-line" data-i="' + i + '">' + (escapeHtml(l.text) || "♪") + "</div>";
      }).join("");
      lyricBox.scrollTop = 0;
      return;
    }
    var items = lyricBox.querySelectorAll(".lyric-line");
    var curTime = (lyricLines[curLyric] && lyricLines[curLyric].time) || -1;
    for (var i = 0; i < items.length; i++) {
      items[i].classList.toggle("active", lyricLines[i] && lyricLines[i].time === curTime);
    }
    var active = items[curLyric];
    if (active) {
      var target = active.offsetTop - lyricBox.clientHeight / 2 + active.clientHeight / 2;
      lyricBox.scrollTo({ top: target, behavior: "smooth" });
    }
  }
  function updateLyric() {
    if (!lyricLines.length) return;
    var t = audio.currentTime;
    var idx = 0;
    for (var i = 0; i < lyricLines.length; i++) { if (lyricLines[i].time <= t) idx = i; else break; }
    if (idx !== curLyric) { curLyric = idx; renderLyric(false); }
  }

  function fmtTime(s) {
    s = Math.floor(s || 0);
    var m = Math.floor(s / 60);
    return m + ":" + ("0" + (s % 60)).slice(-2);
  }
  function loadMusic(src, name, crossOrigin) {
    if (crossOrigin) audio.setAttribute("crossorigin", "anonymous");
    else audio.removeAttribute("crossorigin");
    audio.src = src;
    nameEl.textContent = name || "未命名音频";
    try { ensureAudioGraph(); } catch (e) {}
    if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();
    audio.play().then(function () { playBtn.textContent = "⏸ 暂停"; })
      .catch(function () { playBtn.textContent = "▶ 播放"; });
  }

  playBtn.addEventListener("click", function () {
    if (!audio.src) { showToast("请先选择或加载音乐"); return; }
    ensureAudioGraph();
    if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();
    if (audio.paused) {
      audio.play().then(function () { playBtn.textContent = "⏸ 暂停"; })
        .catch(function () { playBtn.textContent = "▶ 播放"; });
    } else {
      audio.pause(); playBtn.textContent = "▶ 播放";
    }
  });
  audio.addEventListener("play", function () { playBtn.textContent = "⏸ 暂停"; startViz(); });
  audio.addEventListener("pause", function () { playBtn.textContent = "▶ 播放"; stopViz(); });
  function updateBuffer() {
    if (!bufferEl) return;
    try {
      if (audio.duration && audio.buffered && audio.buffered.length) {
        let end = 0;
        for (let i = 0; i < audio.buffered.length; i++) {
          if (audio.buffered.start(i) <= audio.currentTime && audio.currentTime <= audio.buffered.end(i)) {
            end = audio.buffered.end(i); break;
          }
        }
        bufferEl.style.width = (end / audio.duration * 100) + "%";
      } else { bufferEl.style.width = "0%"; }
    } catch (e) { bufferEl.style.width = "0%"; }
  }
  function bindProgressTip() {
    if (!tipEl) return;
    progress.addEventListener("mousemove", function (e) {
      if (!audio.duration) return;
      var rect = progress.getBoundingClientRect();
      var ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
      tipEl.textContent = fmtTime(ratio * audio.duration);
      tipEl.style.left = (ratio * 100) + "%";
    });
    progress.addEventListener("mouseleave", function () { tipEl.style.opacity = ""; });
  }
  bindProgressTip();
  audio.addEventListener("progress", updateBuffer);
  audio.addEventListener("loadedmetadata", updateBuffer);
  audio.addEventListener("ended", function () { playBtn.textContent = "▶ 播放"; progress.value = 0; progress.style.setProperty("--pct", "0%"); updateBuffer(); stopViz(); });
  audio.addEventListener("timeupdate", function () {
    if (audio.duration) {
      progress.value = (audio.currentTime / audio.duration) * 100;
      progress.style.setProperty("--pct", progress.value + "%");   // 渐变填充跟随播放
      timeEl.textContent = fmtTime(audio.currentTime) + " / " + fmtTime(audio.duration);
      updateBuffer();
    }
    updateLyric();
  });
  progress.addEventListener("input", function () {
    progress.style.setProperty("--pct", progress.value + "%");
    if (audio.duration) audio.currentTime = (progress.value / 100) * audio.duration;
  });
  function syncVolume() {
    var v = parseFloat(volEl.value);
    audio.volume = v;
    volEl.style.setProperty("--vpct", (v * 100) + "%");
  }
  volEl.addEventListener("input", syncVolume);
  syncVolume();

  fileInput.addEventListener("change", function (e) {
    var f = e.target.files[0];
    if (!f) return;
    loadMusic(URL.createObjectURL(f), f.name);
    showToast("已加载本地音乐：" + f.name);
  });
  urlApply.addEventListener("click", function () {
    var u = urlInput.value.trim();
    if (!u) return;
    if (!/^https?:\/\//i.test(u)) { showToast("请输入以 http(s):// 开头的音频地址"); return; }
    // 不是音频文件直链（如网易云歌曲详情页）→ 明确告知原因
    var audioExt = /\.(mp3|wav|ogg|m4a|flac|aac|webm|opus)(\?.*)?$/i;
    if (!audioExt.test(u)) {
      var isMusicSite = /163\.com|qq\.com|spotify|music|\/song|\/play|yt\.|youtube/i.test(u);
      showToast(isMusicSite
        ? "这是歌曲网页链接（如网易云歌曲页），不是音频文件直链。这类平台对音频加密/版权保护，无法外链直播。请先把歌曲下载到本地，再用「选择本地音乐文件」加载（频谱也最完整）。"
        : "该链接不是音频文件直链（应以 .mp3/.wav 等结尾）。请粘贴音频文件地址，或用本地文件。");
      return;
    }
    // 看起来是音频，先尝试加载校验，避免「点了没反应」
    var probe = new Audio();
    probe.preload = "metadata";
    var settled = false;
    var fail = function (why) { if (settled) return; settled = true; showToast("加载失败：" + why + "（部分服务器禁止外链/未开 CORS，建议改用本地文件）"); };
    probe.oncanplay = function () { if (settled) return; settled = true; loadMusic(u, (u.split("/").pop().split("?")[0]) || "在线音频"); showToast("已加载音频链接"); };
    probe.onerror = function () { fail("地址无效或服务器拒绝访问"); };
    probe.src = u;
    setTimeout(function () { if (!settled) fail("加载超时"); }, 10000);
  });

  // ===== 网易云解析（后台 service worker 代发，绕过 CORS）=====
  // MV3 service worker 空闲时会「不活动」，属正常省电行为；页面加载时先 ping 一次唤醒后台，
  // 使后续解析消息能立即送达（避免首次 sendMessage 因后台未就绪而报 “Receiving end does not exist”）。
  if (typeof chrome !== "undefined" && chrome.runtime) {
    try {
      chrome.runtime.sendMessage({ type: "ping" }, function () { try { void chrome.runtime.lastError; } catch (e) {} });
    } catch (e) {}
  }

  var neInput = document.getElementById("ne-input");
  var neParse = document.getElementById("ne-parse");
  var neQuality = document.getElementById("ne-quality");
  neParse.addEventListener("click", function () {
    var raw = (neInput && neInput.value || "").trim();
    if (!raw) { showToast("请粘贴网易云链接或歌曲ID"); return; }
    neParse.textContent = "解析中…"; neParse.disabled = true;
    chrome.runtime.sendMessage(
      { type: "netease_parse", url: raw, musicType: neQuality ? neQuality.value : "standard" },
      function (resp) {
        neParse.textContent = "解析"; neParse.disabled = false;
        if (chrome.runtime.lastError || !resp || !resp.ok || !resp.url) {
          var leMsg = (chrome.runtime.lastError && chrome.runtime.lastError.message) || "";
          if (/Receiving end does not exist|message port closed|Could not establish connection/i.test(leMsg)) {
            showToast("后台未就绪：请在扩展页（chrome://extensions）点「重新加载」本扩展，并重开新标签页再试");
          } else {
            showToast("解析失败：" + ((resp && resp.error) || leMsg || "请确认扩展已重新加载"));
          }
          return;
        }
        loadMusic(resp.url, resp.name || "网易云音乐", "anonymous");
        if (resp.lyric) {
          setLyric(resp.lyric);
          showToast("已加载：" + (resp.name || "网易云音乐") +
            (resp.lyricSource === "kugou" ? "（歌词来自酷狗兜底）" : ""));
        } else {
          showLyricUnavailable();
          showToast("已加载：" + (resp.name || "网易云音乐") + "，但网易云与酷狗均无该歌词，可手动粘贴 LRC");
        }
      }
    );
  });
  if (lyricApply) {
    lyricApply.addEventListener("click", function () {
      var t = lyricInput ? lyricInput.value : "";
      if (!t.trim()) { setLyric(""); showToast("已清空歌词"); return; }
      setLyric(t);
      showToast("歌词已应用，播放时将同步滚动");
    });
  }

  musicBtn.addEventListener("click", function (e) {
    e.stopPropagation();
    // 频谱已移到主页，关窗不再停止绘制
    togglePanel(win);
    if (!audio.paused) startViz();
  });

  var dragging = false, sx = 0, sy = 0, ox = 0, oy = 0;
  function getPt(e) { return e.touches ? e.touches[0] : e; }
  function initPos() {
    if (win.style.left) return;
    win.style.transform = "none";
    win.style.right = "auto"; win.style.bottom = "auto";
    var r = win.getBoundingClientRect();
    win.style.left = r.left + "px"; win.style.top = r.top + "px";
  }
  function onStart(e) {
    dragging = true; var pt = getPt(e); sx = pt.clientX; sy = pt.clientY;
    initPos();
    var r = win.getBoundingClientRect(); ox = r.left; oy = r.top;
    document.body.style.userSelect = "none";
    if (e.cancelable) e.preventDefault();
  }
  function onMove(e) {
    if (!dragging) return;
    var pt = getPt(e);
    var nx = ox + (pt.clientX - sx), ny = oy + (pt.clientY - sy);
    var w = win.offsetWidth, h = win.offsetHeight;
    nx = Math.max(0, Math.min(nx, window.innerWidth - w));
    ny = Math.max(0, Math.min(ny, window.innerHeight - h));
    win.style.left = nx + "px"; win.style.top = ny + "px";
    if (e.cancelable) e.preventDefault();
  }
  function onEnd() { dragging = false; document.body.style.userSelect = ""; }
  bar.addEventListener("mousedown", onStart);
  bar.addEventListener("touchstart", onStart, { passive: false });
  document.addEventListener("mousemove", onMove);
  document.addEventListener("touchmove", onMove, { passive: false });
  document.addEventListener("mouseup", onEnd);
  document.addEventListener("touchend", onEnd);
})();
