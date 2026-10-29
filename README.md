# 美化浏览器主页 · 新标签页扩展 · 音乐歌词

> 作者 / Author：duchen

一个单文件的美化浏览器主页，并附带可覆盖「新标签页」的 Chrome / Edge 扩展，以及在线音乐解析（B站 / 网易云）与歌词显示。全部运行在本地浏览器，不依赖任何外部服务。

## ✨ 功能

- **搜索框**：预设百度 / Google / 必应 / DuckDuckGo / GitHub，并支持**自定义添加 / 删除**搜索引擎（用 `%s` 占位查询词）
- **壁纸自定义**：预设渐变、上传本地图片 / 视频、图片 / 视频链接、选择整个文件夹批量导入
- **动态壁纸与轮换**：视频壁纸，多张壁纸按自定义间隔 / 顺序 / 随机轮换，切换时交叉淡入
- **效果调节**：壁纸暗化、模糊强度
- **动态天气卡片**：左下角实时天气（自动定位 / 搜索城市），含晴/雨/雪/雾/云粒子特效、鼠标跟随高光
- **待办清单**：右下角轻量待办，回车添加、勾选完成、收起展开，本地持久化
- **玻璃效果可调**：所有卡片的淡化程度、模糊程度可自由调节，另有 4 档快捷预设
- **键盘快捷键**：`/` 或 `Ctrl+K` 聚焦搜索、`Esc` 关闭、`M` 音乐、`,` 设置、`?` 查看快捷键帮助
- **配置导出 / 导入**：导出 JSON 文件，在设备之间或扩展版与主页版之间迁移设置、链接、待办
- **快捷链接**：增删 + 拖拽排序
- **一键设为主页 / 新标签页**：自动复制地址并给出各浏览器设置步骤
- **音乐窗口**：本地音乐 / 音频链接播放 + 实时频谱柱形图
- **歌词**：LRC 同步滚动高亮；网易云歌曲可自动获取直链与歌词（网易云无词时自动兜底到酷狗歌词库）
- **在线解析**：哔哩哔哩视频链接 / BV 号 / av 号自动提取音频（含封面标题），网易云歌曲链接自动解析

## 📁 目录结构

```
index.html                  ← 构建产物（单文件，内联 CSS/JS，双击即用）
build.js                    ← 构建脚本（node build.js）
src/
  index.template.html       ← 主页版 HTML 模板
  newtab.template.html      ← 扩展版 HTML 模板
shared/
  style.css                 ← 两版共用样式
  core.js                   ← 两版共用逻辑
newtab-extension/           ← 扩展产物（Chrome/Edge/Firefox MV3）
lyric-proxy.js + start-proxy.bat ← 本地代理，供 index.html 解析音乐
```

## 🛠️ 开发流程（给二次开发者）

**两版共用一份源码**，改一处即可同步两版：

1. 修改 `shared/style.css` 或 `shared/core.js`（共用样式与逻辑）
2. 需要改结构时改 `src/*.template.html`（HTML 模板）
3. 运行 `node build.js` 生成 `index.html` 与 `newtab-extension/`

> ⚠️ **不要直接改 `index.html` 或 `newtab-extension/*`**，它们是构建产物，下次构建会被覆盖。

**两版的唯一差异**是 HOST 适配器（写在 `build.js` 里）：
- 主页版：音乐解析走本地代理 `http://127.0.0.1:8787/parse`
- 扩展版：音乐解析走 `chrome.runtime.sendMessage({type:'media_parse'})`，由 `background.js` 处理

新增环境相关能力时，在 `shared/core.js` 里通过 `HOST.parseMedia()` 这类注入点调用，不要写死环境判断。

### 📦 自动生成分享版本

`node build.js` **每次构建都会自动打包**并**自动删除旧包**，产出：

```
美化主页-新标签页扩展-v<版本>.zip
├── 美化主页-新标签页扩展-v<版本>/   ← 顶层套一层文件夹，解压不散落
│   ├── 安装说明.txt
│   ├── README.md / LICENSE / 版本信息.txt
│   ├── index.html                    ← 单文件，双击即用
│   ├── lyric-proxy.js + start-proxy.bat
│   └── newtab-extension/             ← 扩展版（Chrome/Edge/Firefox）
```

版本号来自 `shared/VERSION`，改版本号后重新构建即可。

### 常用命令

| 命令 | 作用 |
|---|---|
| `node build.js` | 构建 + 自动打包 + 删除旧包 |
| `node build.js --no-zip` | 只构建，不打包 |
| `node watch.js` | **监听模式**：改 `shared/` 或 `src/` 下的文件自动重建并打包（约 0.8 秒） |
| `node install-hook.js` | 安装 git hook，**每次 commit 后自动重建并打包** |
| `npm run clean` | 删除所有分享包 |

> **git hook 已默认安装**：`node install-hook.js` 会写入 `.git/hooks/post-commit`，提交代码后自动出包，避免发出旧版本。重新 clone 仓库后需要再执行一次。

## 🚀 使用方式

### 方式一：直接打开主页
双击 `index.html` 即可。所有数据（壁纸、设置）存在浏览器本地（localStorage / IndexedDB）。

### 方式二：安装为浏览器新标签页（推荐）
1. 打开 `chrome://extensions`（Edge 用 `edge://extensions`）
2. 右上角开启「开发者模式」
3. 点「加载已解压的扩展程序」，选择本仓库的 `newtab-extension` 文件夹
4. 之后每个新标签页都会显示该主页；改了文件后点扩展「重新加载」生效

> 首次使用请到右上角 ⚙ 里重新设置一次壁纸（扩展与 index.html 数据相互独立）。

### 天气卡片
- 左下角卡片会自动定位所在城市，显示实时天气、温度、今日高低温与未来 3 天预报。
- 卡片内含动态粒子特效（晴天光束 / 多云雾团 / 雨滴 / 雪花 / 雾带），鼠标悬停时粒子加速。
- 输入城市名可搜索切换，📍 重新定位，↻ 刷新。点击城市名可直接聚焦搜索框。
- 定位优先用浏览器精确定位（GPS，授权后街区级），未授权时自动回退到 IP 城市级估算。
- 数据源为 Open-Meteo 公开接口（免费免密钥），首次使用需联网。
- 想调透明度：⚙ →「卡片玻璃效果」，可分别调节「淡化」「模糊」「天气」三个滑块。

### 待办清单
- 右下角「📋 待办」卡片，输入内容回车即可添加。
- 点击方框标记完成（划线置灰），悬停显示删除按钮，点标题栏或 ▾ 收起/展开。
- 数据存在浏览器本地，刷新不丢。

### 键盘快捷键
按 `?` 随时查看完整列表。

| 快捷键 | 作用 |
|---|---|
| `/` 或 `Ctrl+K` | 聚焦搜索框 |
| `Esc` | 关闭设置面板 / 弹层 / 天气搜索建议 |
| `,` | 打开 / 关闭壁纸设置 |
| `M` | 打开 / 关闭音乐窗口 |
| `?` | 显示 / 隐藏快捷键帮助 |

### 配置导出 / 导入
- ⚙ →「配置备份 / 迁移」→「📤 导出配置」会下载一个 JSON 文件。
- 在另一台电脑、或扩展版 ↔ 主页版之间，用「📥 导入配置」选择该文件即可迁移设置、快捷链接、自定义搜索引擎与待办。
- ⚠️ 本地上传的图片 / 视频无法打包进配置（浏览器安全限制），迁移壁纸请改用「图片链接」或「文件夹」方式。

### 音乐与歌词
- **扩展版（推荐，无需额外工具）**：在音乐窗口「在线解析」粘贴链接即可。扩展后台直连平台官方接口，绕过跨域限制。
  - **B站**：粘贴视频链接 / BV 号 / av 号，自动提取最高音质音频并显示封面与标题。
  - **网易云**：粘贴歌曲链接或 ID，可选音质，自动获取歌词。
- **index.html 版**：受浏览器跨域限制，需先双击 `start-proxy.bat` 启动本地代理（窗口保持开启），再粘贴链接。
- 自动获取会先向网易云请求歌词；若网易云因版权/登录限制未返回歌词，会自动到**酷狗歌词库**按「歌名 + 时长」兜底检索，绝大多数歌曲可拿到同步歌词。
- 也可在任何版本手动粘贴 LRC 文本到「歌词」框，播放时同步滚动。

> ⚠️ 极少数歌曲（多为翻唱版、同人曲或强版权歌）在网易云与酷狗两个曲库都查不到公开歌词，此时音乐窗口会明确提示「两边均未提供歌词」，请手动粘贴 LRC。本项目仅供学习交流，请遵守相关平台使用条款。


## 📝 说明

- 扩展与 `index.html` 数据相互独立（同源策略），在扩展里需重新设置一次壁纸。
- 本项目不收集任何数据，全部运行在本地浏览器。

## 📄 许可证

本项目基于 [MIT 许可证](LICENSE) 开源，版权归 **duchen** 所有。

---

## English

# Beautified Browser New Tab · Extension · Music Lyrics

> Author: **duchen**

A single-file beautified browser homepage, plus a Chrome / Edge / Firefox extension that overrides the new-tab page, with online music parsing (Bilibili / NetEase) and lyrics display. Everything runs locally in your browser — no external services.

## ✨ Features

- **Search box** — presets (Baidu / Google / Bing / DuckDuckGo / GitHub) plus add / remove your own engines (%s = query placeholder).
- **Custom wallpapers** — preset gradients, upload local images / videos, image / video URLs, or bulk-import an entire folder.
- **Dynamic wallpaper & rotation** — video wallpapers; rotate multiple wallpapers by custom interval / order / random, with cross-fade transitions.
- **Effects** — wallpaper dimming and blur strength.
- **Dynamic weather card** — bottom-left live weather (auto-locate / search cities) with sun/rain/snow/fog/cloud particle effects and cursor-following highlights.
- **Todo list** — bottom-right lightweight todos: Enter to add, click to complete, collapse/expand, stored locally.
- **Adjustable glass** — tune the fade and blur of every glass card, plus 4 one-click presets.
- **Keyboard shortcuts** — `/` or `Ctrl+K` focus search, `Esc` close, `M` music, `,` settings, `?` help.
- **Config export / import** — export a JSON file to move settings, links and todos between devices or between the extension and the standalone page.
- **Quick links** — add / remove and drag-to-reorder.
- **One-click set as homepage / new tab** — auto-copy the address and provide setup steps per browser.
- **Music window** — play local music / audio links with a real-time spectrum visualizer.
- **Lyrics** — synchronized LRC scrolling & highlighting; NetEase songs can auto-fetch playback URL and lyrics (falls back to the KuGou lyrics library when NetEase has none).
- **Online parsing** — paste a Bilibili video link / BV id / av id to extract the audio (with cover & title), or a NetEase song link to parse it.

## 📁 Structure

```
index.html                  ← build artifact (single file, inlined CSS/JS)
build.js                    ← build script (node build.js)
src/
  index.template.html       ← main-version HTML template
  newtab.template.html      ← extension-version HTML template
shared/
  style.css                 ← styles shared by both versions
  core.js                   ← logic shared by both versions
newtab-extension/           ← extension artifact (Chrome/Edge/Firefox MV3)
lyric-proxy.js + start-proxy.bat ← local proxy for index.html music parsing
```

## 🛠️ Development workflow (for contributors)

**Both versions share one source tree** — change once, both stay in sync:

1. Edit `shared/style.css` or `shared/core.js` (shared styles & logic)
2. Edit `src/*.template.html` when the structure changes
3. Run `node build.js` to regenerate `index.html` and `newtab-extension/`

> ⚠️ **Do not edit `index.html` or `newtab-extension/*` directly** — they are build artifacts and will be overwritten.

**The only difference between versions** is the HOST adapter (defined in `build.js`):
- Main version: music parsing goes through the local proxy `http://127.0.0.1:8787/parse`
- Extension version: music parsing goes through `chrome.runtime.sendMessage({type:'media_parse'})`, handled by `background.js`

When adding environment-specific features, call through an injection point like `HOST.parseMedia()` in `shared/core.js` instead of hard-coding environment checks.

### 📦 Auto-generating a shareable package

`node build.js` **packages on every build** and **removes the previous package**, producing:

```
美化主页-新标签页扩展-v<version>.zip
├── 美化主页-新标签页扩展-v<version>/   ← wrapped in a top-level folder
│   ├── 安装说明.txt
│   ├── README.md / LICENSE / 版本信息.txt
│   ├── index.html                    ← single file, double-click to run
│   ├── lyric-proxy.js + start-proxy.bat
│   └── newtab-extension/             ← extension build
```

The version comes from `shared/VERSION`; edit it and rebuild to publish a new one.

### Common commands

| Command | What it does |
|---|---|
| `node build.js` | Build + auto-package + delete the old package |
| `node build.js --no-zip` | Build only, skip packaging |
| `node watch.js` | **Watch mode**: auto-rebuild and package on changes in `shared/` or `src/` (~0.8s) |
| `node install-hook.js` | Install a git hook that **rebuilds and packages after every commit** |
| `npm run clean` | Remove all shareable packages |

> **The git hook is installed by default**: `node install-hook.js` writes `.git/hooks/post-commit`, so committing automatically produces an up-to-date package — you can never accidentally share a stale build. Re-run it after cloning the repo.

## 🚀 Usage

### Method 1: Open the homepage directly
Double-click `index.html`. All data (wallpapers, settings) is stored locally in the browser (localStorage / IndexedDB).

### Method 2: Install as the browser new-tab page (recommended)
1. Open `chrome://extensions` (Edge: `edge://extensions`).
2. Enable **Developer mode** in the top-right corner.
3. Click **Load unpacked** and select the `newtab-extension` folder of this repo.
4. Every new tab will then show this homepage. After editing files, click **Reload** on the extension to apply changes.

> First run: set up your wallpaper once inside the extension (⚙) — the extension and `index.html` store data independently.

### Weather card
- The bottom-left card auto-locates your city and shows live weather, current temperature, today's high/low and a 3-day forecast.
- Particle effects react to the actual weather (sun rays / drifting clouds / raindrops / snowflakes / fog bands) and speed up on hover.
- Type a city name to switch locations, 📍 re-locates, ↻ refreshes. Click the city name to jump to the search box.
- Location prefers the browser's precise API (GPS — street level once granted), falling back to IP-based city-level estimation.
- Data comes from the free, key-less Open-Meteo API (needs network on first use).
- Tune transparency: ⚙ → "Glass effect" → adjust the **Fade**, **Blur** and **Weather** sliders.

### Todo list
- The bottom-right "📋 待办" card: type and press Enter to add.
- Click the square to mark done (struck through and dimmed); hover to reveal the delete button; click the header or ▾ to collapse/expand.
- Stored in your browser locally — survives refresh.

### Keyboard shortcuts
Press `?` anytime for the full list.

| Shortcut | Action |
|---|---|
| `/` or `Ctrl+K` | Focus the search box |
| `Esc` | Close the settings panel / overlays / city suggestions |
| `,` | Toggle the wallpaper settings panel |
| `M` | Toggle the music window |
| `?` | Show / hide the shortcut help |

### Config export / import
- ⚙ → "配置备份 / 迁移" → **📤 导出配置** downloads a JSON file.
- On another machine, or between the extension and the standalone page, use **📥 导入配置** and pick that file to migrate settings, quick links, custom engines and todos.
- ⚠️ Locally uploaded images/videos cannot be bundled (browser security) — use an image URL or a folder for wallpapers when migrating.

### Music & Lyrics
- **Extension version (recommended, no extra tools)**: paste a link in the music window's "Online parse" box. The background service worker talks directly to each platform's official API, bypassing CORS.
  - **Bilibili**: paste a video link / BV id / av id — it extracts the highest-quality audio and shows the cover & title.
  - **NetEase**: paste a song link or id, pick a quality level, lyrics are fetched automatically.
- **index.html version**: due to browser security (CORS), first double-click `start-proxy.bat` to start the local proxy (keep the window open), then paste the link.
- Auto-fetch asks NetEase for lyrics first; if NetEase returns none (copyright / login limits), it automatically falls back to the **KuGou lyrics library** by "song name + duration", covering the vast majority of songs.
- You can also paste LRC text into the "Lyrics" box in any version for synchronized scrolling.

> ⚠️ A very small number of songs (mostly covers, doujin, or strongly copyrighted tracks) have no public lyrics in either NetEase or KuGou. The music window will then clearly show "no lyrics provided by either source" — paste LRC manually. This project is for learning and personal use only; please comply with the relevant platforms' terms.


## 📝 Notes

- The extension and `index.html` store data independently (same-origin policy); set up the wallpaper once inside the extension.
- This project collects no data and runs entirely in your local browser.

## 📄 License

This project is open-source under the [MIT License](LICENSE). Copyright belongs to **duchen**.

