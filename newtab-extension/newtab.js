
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
    videoPaused: false,
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
  function tick() {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, "0");
    const mm = String(now.getMinutes()).padStart(2, "0");
    document.getElementById("clock").textContent = `${hh}:${mm}`;
    const days = ["日","一","二","三","四","五","六"];
    document.getElementById("date").textContent =
      `${now.getFullYear()}年${now.getMonth()+1}月${now.getDate()}日 星期${days[now.getDay()]}`;
  }
  tick(); setInterval(tick, 1000);

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
      a.className = "link";
      a.href = lk.url; a.target = "_blank";
      a.draggable = true;
      a.innerHTML = `<span class="emoji">${lk.emoji || "🔗"}</span><span>${lk.name}</span>` +
        `<button class="del" title="删除">×</button>`;
      a.querySelector(".del").onclick = (e) => {
        e.preventDefault(); e.stopPropagation();
        settings.links.splice(i, 1); save(); renderLinks();
      };
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
    add.className = "link add-link";
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

  settingsBtn.onclick = (e) => { e.stopPropagation(); panel.classList.toggle("open"); };
  document.addEventListener("click", (e) => {
    if (!panel.contains(e.target) && e.target !== settingsBtn) panel.classList.remove("open");
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
    var w = canvas.offsetWidth || 320, h = 120;
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
    var w = canvas.offsetWidth || 320, h = 120;
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
  function startViz() { if (!vizRAF) { sizeCanvas(); drawViz(); } }
  function stopViz() { if (vizRAF) { cancelAnimationFrame(vizRAF); vizRAF = null; } }

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
  audio.addEventListener("pause", function () { playBtn.textContent = "▶ 播放"; });
  audio.addEventListener("ended", function () { playBtn.textContent = "▶ 播放"; progress.value = 0; });
  audio.addEventListener("timeupdate", function () {
    if (audio.duration) {
      progress.value = (audio.currentTime / audio.duration) * 100;
      timeEl.textContent = fmtTime(audio.currentTime) + " / " + fmtTime(audio.duration);
    }
    updateLyric();
  });
  progress.addEventListener("input", function () {
    if (audio.duration) audio.currentTime = (progress.value / 100) * audio.duration;
  });
  volEl.addEventListener("input", function () { audio.volume = parseFloat(volEl.value); });
  audio.volume = parseFloat(volEl.value);

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
    if (win.classList.contains("open")) { win.classList.remove("open"); stopViz(); return; }
    win.classList.add("open");
    sizeCanvas();
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
