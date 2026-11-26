# Architecture

像素工坊是一个纯静态、本地优先的浏览器应用。没有后端、数据库或前端构建步骤；浏览器加载 `index.html` 后，所有逻辑在本地执行。

## 运行模型

```text
index.html
  ├─ styles/*.css
  └─ src/shell/*.js             外壳：工作区、仓库、工具注册表、编辑器桥接
       └─ src/embedded/*.js     六类编辑器的 base64 HTML 文档
            └─ iframe(srcdoc)   独立编辑器界面
```

`serve.py` 是带禁用缓存的 `SimpleHTTPRequestHandler`，默认监听 `127.0.0.1:8766`。除静态文件外，它提供可选的同源 LLM 代理（`GET /api/llm/health`、`POST /api/llm`、`OPTIONS /api/llm`），用于解决浏览器直连大模型的 CORS 问题。代理不做鉴权、不存数据、不记录密钥或请求体；目标 host 白名单防 SSRF，Origin 校验防 CSRF，非回环绑定默认禁用（`CLASTAR_LLM_PROXY_ALLOW_LAN=1` 开启），每 IP 限流 120 次/分钟，请求体上限 8 MiB，上游超时 180 秒。GitHub Pages 纯静态模式无此代理，客户端自动降级为浏览器直连（仅 CORS 友好的服务商可用）。

## 外壳模块

| 文件 | 职责 |
| --- | --- |
| `src/shell/core.js` | 图标、主题、toast、标签页、基础状态与 localStorage 读写 |
| `src/shell/library.js` | 工作区、类别、作品卡、最近打开、回收站、右键菜单、图片导入、多选 |
| `src/shell/sidebar.js` | 左右面板、拖拽宽度、折叠状态、移动端抽屉 |
| `src/shell/editors.js` | 内嵌编辑器挂载、iframe 消息桥、3D 预览、设置、关于 |
| `src/shell/archive.js` | ZIP Store/Deflate 读写、下载、安全文件名 |
| `src/shell/importer.js` | 智能 ZIP 导入、资源包分类、仓库素材选择器 |
| `src/shell/exporter.js` | 多选资源包构建、路径映射、`pack.mcmeta`/`pack.png` |
| `src/shell/recolor.js` | 调色板提取、预设、精确/聚类换色、预览与写回 |
| `src/shell/variants.js` | 明度映射、色阶、矩阵、变种 ZIP 与写回 |
| `src/shell/shortcuts.js` | 快捷键动作注册、中心 UI、冲突检测、iframe 键位同步 |
| `src/shell/extensions.js` | 内置工具/扩展注册表、启停、设置面板与编辑器同步 |
| `src/shell/plugins.js` | 可选插件框架：安装、启停、沙箱 iframe、宿主 API、扩展中心 |
| `src/shell/assets.js` | 素材库：原版/模组纹理导入、分类、参考图、项目复制 |
| `src/shell/init.js` | 侧栏、手机壳、帮助、启动入口 |

脚本按 `index.html` 中的顺序执行，保持经典脚本作用域和全局函数入口。

## 数据模型

工作区数据保存在：

- `pixelWorkshop_v1`

结构：

```text
workspace[]
  ├─ id
  ├─ name
  └─ cats[]
      ├─ id / name
      └─ cards[]
          ├─ id / name / badge / meta
          ├─ thumb / full          16×16 缩略图与原始 PNG data URL
          ├─ block / armor / composite / ctex
          ├─ create                机械动力等插件方块族元数据
          ├─ anim / mcmeta
          ├─ ref                   素材库参考素材元数据
          └─ packPath / packNs
```

其他本地状态：

| 键 | 内容 |
| --- | --- |
| `pixelWorkshop_sidebar_v1` | 左右栏宽度、折叠、抽屉状态 |
| `pixelWorkshop_recolor_v1` | 换色预设、模式、容差等 |
| `pixelWorkshop_shortcuts_v1` | 自定义快捷键 |
| `pixelWorkshop_extensions_v1` | 内置工具/扩展启停 |
| `pixelWorkshop_plugins_v1` | 已安装可选插件、启停、来源、HTML |
| `pixelWorkshop_v1` 中的 `assetLibrary` 工作区 | 素材库纹理、分类与参考元数据 |
| `pixelWorkshop_plugin_<id>` | 插件独立设置 |
| `animStudioPanels_v2` | 编辑器内部面板顺序、归属、折叠、浮窗位置 |
| `animStudioSideWidths_v1` | 编辑器内部左右栏宽度 |

所有数据仅在本机浏览器中；没有同步或远程备份。

## 内嵌编辑器

`src/embedded/*.js` 保存六类编辑器的原始 HTML 文档（base64）。外壳将它们作为 `iframe.srcdoc` 载入，并通过 `postMessage` 完成：

- 编辑器载入后的主题/布局同步
- 保存回仓库时从编辑器读取快照
- 一键换色、一键光源、彩色渐变等扩展面板的显隐
- 快捷键定义下发与键位更新

这种隔离方式让每个编辑器可以独立维护自己的 UI 和画布状态，同时保持外壳轻量。

## ZIP 与资源包

### 导入

智能 ZIP 导入会解析 `assets/<namespace>/textures/...`，按目录识别：

- 方块 / 物品 / 实体装备 / 实体 / 盔甲 / 界面 / 粒子 / 画 / 环境 / 字体 / 杂项

原始 `packPath` 和动画 `.mcmeta` 会被保留。资源包根部的 `pack.png`、`__MACOSX` 和隐藏文件会被跳过。

### 导出

多选作品导出会生成：

- `pack.mcmeta`（`pack_format` 按目标版本）
- `pack.png`
- `assets/<namespace>/textures/...`
- 动画的 `.png.mcmeta`

主要路径规则：

```text
普通纹理       assets/<ns>/textures/item|block/<name>.png
方块           assets/<ns>/textures/block/<name>[_face].png
复合纹理       assets/<ns>/textures/block/<name>_{1..5}.png + <name>_composite.png
人形盔甲       assets/<ns>/textures/entity/equipment/humanoid/...
               assets/<ns>/textures/entity/equipment/humanoid_leggings/...
旧版盔甲       assets/<ns>/textures/models/armor/...（可选）
其它装备       assets/<ns>/textures/entity/equipment/<profile>/...
```

文件名会统一 slug 化；冲突时追加序号。所有 ZIP 与 PNG 生成逻辑在浏览器端完成。

## 扩展与快捷键

`PWExtensions` 以统一描述注册工具页和编辑器扩展：

```js
PWExtensions.register({
  id: 'my-tool',
  name: '我的工具',
  kind: 'tool', // tool | editor
  icon: 'box',
  version: '1.0.0',
  open() {},
  onEnable() {},
  onDisable() {}
});
```

`PWShortcuts` 负责快捷键动作注册、上下文匹配、冲突检测和 iframe 键位下发。扩展可以提供自己的 `shortcuts`，由中心统一检测冲突。

### 可选插件

`PWPlugins` 管理不随核心包加载的可选插件：

- `plugin.json` / `manifest.json` 声明 id、版本、权限、工具和入口
- 安装来源：GitHub 仓库根清单、raw 文件、release ZIP、本地 ZIP
- 插件页面在 `sandbox="allow-scripts allow-downloads"` iframe 中运行，并注入 `connect-src 'none'` CSP
- 插件通过 `postMessage` 调用宿主 API：仓库读写、ZIP 读取、下载、插件存储
- 禁用插件会关闭对应工具页；卸载不删除已导入的卡片
- 官方可选插件位于 `plugins/`；机械动力扩展使用 `create` 卡片字段保存方块族、槽位、CT grid、状态和原始路径

## 安全边界

- 这是单用户本地应用，没有账号体系；可选插件通过显式权限和 sandbox 隔离访问本地能力。serve.py 的 /api/llm 代理是唯一的可选远程接口，仅转发到白名单 host，不记录密钥。
- 导入的 PNG / ZIP 在浏览器沙箱内处理；对外部 ZIP 仍需谨慎，不要导入不可信来源的文件。
- 第三方插件默认禁止网络请求，但仍会获得 manifest 声明的仓库读写能力；只安装可信来源，并在安装前核对权限。
- `HOST=0.0.0.0` 仅用于可信局域网调试，不应当直接暴露公网。
- 不要把真实用户工作区、个人截图或版权不明的素材提交到仓库。

## 测试

仓库提供轻量自检：

```bash
python -m py_compile serve.py tools/check_repo.py
python tools/check_repo.py
node --check sw.js
for f in src/shell/*.js src/embedded/*.js; do node --check "$f"; done
```

GitHub Actions 在每次 push / pull request 时运行同样检查，并启动本地服务器做一次首页 smoke test。

## 共享静态清单

`tools/static_manifest.json` 是 GitHub Pages、桌面打包与仓库自检共用的静态产物清单：

- `root_files`：复制到站点根目录的文件（index.html、manifest.json、sw.js、plugin.json、图标）
- `directories`：整目录复制（plugins、src、styles、integrations）
- `sw_assets`：sw.js 预缓存数组，须与 index.html 引用及磁盘文件一致
- `sw_cache_prefix`：`pixel-workshop-`，activate 时只清理本前缀的旧缓存，不误删同域名其他项目
- `sw_exclude_prefixes`：`./local/`、`./api/` 不走 Service Worker

新增静态文件时同步更新此清单与 sw.js ASSETS。`tools/check_repo.py` 会交叉校验三者一致性。

## GitHub Pages 部署

`.github/workflows/pages.yml` 在 push 到 main 且静态文件变更时触发，按 `tools/static_manifest.json` 构建 `_site` 并部署。产物不含 serve.py、tools/、local/、docs/。公开地址 `https://lyingice.github.io/ClastarStudio/`。

纯静态模式下：
- 无 /api/llm 代理，AI 助手自动降级为浏览器直连（需服务商允许 CORS）
- local/ 素材包不存在，素材库与 Create 扩展静默降级为手动导入
- Service Worker 正常注册（HTTPS），PWA 可安装

## 桌面壳（Tauri v2）

`desktop/` 是同仓单主干的薄壳打包层，不修改 src/ 下任何网页代码：

1. `prepare_dist.py` 按共享清单复制静态产物到 `desktop/dist/`
2. Tauri 把 dist/ 打入安装包资源
3. 运行时 `src/server.rs` 在 127.0.0.1 随机端口启动内嵌 HTTP（静态服务 + /api/llm 代理，安全模型对齐 serve.py）
4. WebView2 窗口加载 `http://127.0.0.1:<port>/`

使用回环 HTTP 而非 file:// 或 tauri:// 的原因：init.js 仅在 http:/https: 下注册 SW；Blockbench 桥接 allowedOrigin() 只放行 lyingice.github.io 与 localhost；/api/llm 需要 HTTP 语义。因此桌面端与网页端行为完全一致。

`.github/workflows/desktop.yml` 在打 v* tag 时自动构建 Windows NSIS 安装包并上传 Release。构建需 Rust MSVC target、Node 20+、Python 3.9+、WebView2 Runtime。首次 `cargo install tauri-cli --version "^2"`。

## 本地素材内容包

`local/` 被 .gitignore 忽略，不进入 GitHub、Pages 或发行包：

- `local/inbox/`：放入 Create jar / 原版客户端 jar / 资源包 ZIP
- `准备本地素材.bat` → `tools/prepare_local_assets.py` 扫描 inbox，调用 build_create_pack.py 与 build_vanilla_pack.py
- 生成 `local/create-pack.zip`（Create 扩展自动读取）与 `local/vanilla/`（素材库原版纹理目录 + catalog.json）
- 网页端请求这些路径返回 404 时静默降级为手动导入；桌面端与本地 serve.py 可正常读取

## Kiosk 启动器

`启动像素工坊.bat` → `tools/launch_kiosk.py`：启动 serve.py 并打开 Chrome/Edge 无边框 kiosk 窗口（独立 user-data-dir）。这是桌面 EXE 之前的过渡方案，要求本机装有 Python 与 Chrome/Edge。Tauri 桌面壳取代它后无需这些外部依赖。
