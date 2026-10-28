# 美化浏览器主页 · 新标签页扩展 · 音乐歌词

> 作者 / Author：duchen

一个单文件的美化浏览器主页，并附带可覆盖「新标签页」的 Chrome / Edge 扩展，以及在线音乐解析（B站 / 网易云）与歌词显示。全部运行在本地浏览器，不依赖任何外部服务。

## ✨ 功能

- **搜索框**：预设百度 / Google / 必应 / DuckDuckGo / GitHub，并支持**自定义添加 / 删除**搜索引擎（用 `%s` 占位查询词）
- **壁纸自定义**：预设渐变、上传本地图片 / 视频、图片 / 视频链接、选择整个文件夹批量导入
- **动态壁纸与轮换**：视频壁纸，多张壁纸按自定义间隔 / 顺序 / 随机轮换，切换时交叉淡入
- **效果调节**：壁纸暗化、模糊强度
- **动态天气卡片**：左下角实时天气（自动定位 / 搜索城市），含晴/雨/雪/雾/云粒子特效、鼠标跟随高光
- **玻璃效果可调**：所有卡片的淡化程度、模糊程度可自由调节，另有 4 档快捷预设
- **快捷链接**：增删 + 拖拽排序
- **一键设为主页 / 新标签页**：自动复制地址并给出各浏览器设置步骤
- **音乐窗口**：本地音乐 / 音频链接播放 + 实时频谱柱形图
- **歌词**：LRC 同步滚动高亮；网易云歌曲可自动获取直链与歌词（网易云无词时自动兜底到酷狗歌词库）
- **在线解析**：哔哩哔哩视频链接 / BV 号 / av 号自动提取音频（含封面标题），网易云歌曲链接自动解析

## 📁 目录结构

- `index.html` —— 单文件主页，双击即可在浏览器打开使用
- `newtab-extension/` —— Chrome / Edge / Firefox MV3 扩展（覆盖新标签页）
- `lyric-proxy.js` + `start-proxy.bat` —— 本地代理，供 `index.html` 解析音乐用（见下）

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
- 输入城市名可搜索切换，📍 重新定位，↻ 刷新。
- 数据源为 Open-Meteo 公开接口（免费免密钥），首次使用需联网。
- 想调透明度：⚙ →「卡片玻璃效果」，可分别调节「淡化」「模糊」「天气」三个滑块。

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
- **Adjustable glass** — tune the fade and blur of every glass card, plus 4 one-click presets.
- **Quick links** — add / remove and drag-to-reorder.
- **One-click set as homepage / new tab** — auto-copy the address and provide setup steps per browser.
- **Music window** — play local music / audio links with a real-time spectrum visualizer.
- **Lyrics** — synchronized LRC scrolling & highlighting; NetEase songs can auto-fetch playback URL and lyrics (falls back to the KuGou lyrics library when NetEase has none).
- **Online parsing** — paste a Bilibili video link / BV id / av id to extract the audio (with cover & title), or a NetEase song link to parse it.

## 📁 Structure

- `index.html` — single-file homepage; double-click to open in a browser.
- `newtab-extension/` — Chrome / Edge / Firefox MV3 extension (overrides the new tab page).
- `lyric-proxy.js` + `start-proxy.bat` — local proxy so `index.html` can parse music (see below).

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
- Type a city name to switch locations; 📍 re-locates, ↻ refreshes.
- Data comes from the free, key-less Open-Meteo API (needs network on first use).
- Tune transparency: ⚙ → "Glass effect" → adjust the **Fade**, **Blur** and **Weather** sliders.

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

