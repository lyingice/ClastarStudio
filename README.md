<p align="center">
  <img src="icon-192.png" width="96" height="96" alt="像素工坊图标">
</p>

<h1 align="center">像素工坊 · PIXEL WORKSHOP</h1>

<p align="center">把 Minecraft 纹理的创作、整理、预览与资源包交付，收进一个本地工作台。</p>

<p align="center">
  <a href="https://github.com/lyingice/ClastarStudio/releases"><img alt="Version" src="https://img.shields.io/github/v/release/lyingice/ClastarStudio?display_name=tag&sort=semver"></a>
  <a href="https://github.com/lyingice/ClastarStudio/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/lyingice/ClastarStudio/actions/workflows/ci.yml/badge.svg"></a>
  <a href="LICENSE"><img alt="License: MIT" src="https://img.shields.io/badge/license-MIT-4c9a2a"></a>
</p>

**像素工坊** 是一个无需安装、直接跑在浏览器里的 Minecraft 纹理工作台。它把工作区、纹理仓库、六类编辑器、换色与变种工具，以及资源包导入/导出放在同一个界面里。

- 默认不需要账号、云服务或后端。
- 工作区与作品保存在浏览器 `localStorage`，可随时导出资源包备份。
- 所有文件都在本地运行，适合个人创作与局域网调试。

当前版本：**v0.18.0**<br>
运行方式：`python serve.py`，打开 `http://127.0.0.1:8766/`。

## 功能亮点

### 一个工作台，六类编辑器

- **纹理 / 动画**：像素画布、图层、帧、调色板、对称、撤销/重做、参照画布、`.mcmeta` 预览与导出、播放插帧预览。
- **彩色渐变叠加**：色相彩虹或 2–8 个自定义色标，支持按帧、水平、垂直、对角、径向、球形与滚动模式；设置自动保存。
- **方块**：20+ 种模型结构，包括全部同纹理、六面独立、顶/侧/底、柱状、台阶、楼梯、栅栏、墙、玻璃板、植物等；支持多材质、六面映射与 3D 预览。
- **实体**：人形盔甲 64×32 双层、狼铠、马铠、鹦鹉螺铠、快乐恶魂挽具、鞘翅；包含 UV 分区、材质层、3D 人台与尺寸校验。
- **复合纹理**：Sedna 8×8 连接图，支持 5 张来源拼接、128×128 整图拆分与重新导出。
- **色彩拓展**：色阶、材质球与调色板辅助。
- **自定义纹理**：1–512 像素的自定义画布。

### 整理与检索

- 工作区 / 大类别 / 文件夹三级收纳。
- 作品库、最近打开、回收站、搜索、排序、网格/列表视图。
- 可折叠、可拖拽宽度的左右侧栏；布局自动记忆。
- 多选、全选、文件夹展开，便于批量处理。

### 换色与批量变种

- **一键换色**：读取纹理颜色，使用 Blockbench 默认 40 / Endesga 64 / 材质色阶等色板替换；原图/结果并排预览，可逐色取色微调、保存写回或导出 PNG。
- **变种工坊**：20 套内置材质六色阶 + 2–8 色标自定义色阶，矩阵预览、批量生成、PNG ZIP 或写回仓库。

### AI 助手（可选，接入你的大模型）

- **自带 API key**：在「工具 → AI 助手」或设置里配置模型服务商与密钥，支持 OpenAI 兼容（OpenAI / DeepSeek / Moonshot / 智谱 / 硅基流动 / 通义 / Ollama / LM Studio 等）、Anthropic、Gemini；密钥只存本机浏览器，默认仅内存、可选口令加密记住，不上传、不记录日志。
- **工具化创作**：AI 通过工具调用真正操作平台——查工作区 / 纹理、读取颜色、查素材库、一键换色、套材质色阶、批量变种、像素绘制（填充 / 矩形 / 直线 / 噪点 / 渐变）、写回纹理、新建纹理卡片、导出资源包 ZIP；破坏性操作逐项征求同意，调用日志透明，预览图实时展示。
- **AI 生成模型**：按立方体规格直接生成合法 Blockbench `.bbmodel`（多格式 / 分组 / 多纹理，实时等距预览），纹理可用素材库或 AI 画的预览；模型库 CRUD、`namespace`、全库导出导入；一键送官方 web Blockbench 编辑再同步回库（Clastar Bridge 插件，不修改 BB 本体）。
- **本地 LLM 代理**：`python serve.py` 提供可选同源 `/api/llm` 代理解决浏览器直连大模型的 CORS（host 白名单防 SSRF + Origin 校验 + 限流 + 流式回传，不记录密钥）；GitHub Pages 纯静态模式自动降级为直连（仅 CORS 友好的服务商可用）。

### 导入、打包与工作流

- **智能 ZIP 导入**：识别 `assets/<namespace>/textures/...`，自动按资源类型分类，保留原始路径与动画 `.mcmeta`。
- **多选导出资源包**：设置资源包名称、命名空间、目标版本与纹理归类，自动生成 `pack.mcmeta`、`pack.png`，动画自动附带 `.mcmeta`。
- **快捷键中心**：搜索、分组、录制改键、冲突检测、导入/导出配置。
- **扩展注册表**：工具与编辑器扩展统一定义、启停与持久化。
- **可选插件 / 扩展中心**：官方可选扩展按需安装，支持 GitHub raw / release ZIP / 本地 ZIP；插件在 sandbox iframe 中运行，经宿主 API 访问仓库。
- **素材库**：独立存放原版 / 模组纹理，支持 PNG、文件夹、jar/ZIP 导入；按 namespace / 分类浏览，可设为编辑器参考图或复制到工作区。
- **本地原版纹理**：从本机原版客户端 jar 生成 `local/vanilla`，自动加载 3000+ 张原版方块 / 物品 / 实体 / 界面纹理，不写入 GitHub。
- **机械动力方块扩展**：本地内容包自动加载；解析 blockstate / multipart / item 模型，按独立分支切换 3D 预览与分支纹理；支持 OBJ / MTL 只读几何预览；可导入仓库或导出变种包。
- **本地内容包**：把 Create jar / 原版客户端 jar 放进 `local/inbox/`，用 `准备本地素材.bat` 一键生成，素材与插件均不上传资产。
- **一键启动**：`启动像素工坊.bat` 自动启动本地服务并打开无边框 kiosk 窗口；`tools/create_shortcut.ps1` 可生成桌面快捷方式。
- **检查更新**：设置中读取 GitHub 最新 Release，有新版本时可直接打开下载页。
- **PWA / 移动端**：可安装到桌面/主屏幕，触屏布局与安全区适配。

## 快速开始

要求：Python 3.9+。没有 npm、编译或数据库依赖。

```bash
git clone https://github.com/lyingice/ClastarStudio.git
cd ClastarStudio
python serve.py
```

打开 <http://127.0.0.1:8766/>。

局域网 / 手机调试：

```bash
HOST=0.0.0.0 PORT=8766 python serve.py
```

> 只建议在可信局域网使用 `HOST=0.0.0.0`。应用没有登录与权限系统，不要直接暴露到公网。

## 本地素材内容包（可选，不上传）

把 Create 模组 jar、原版 Minecraft 客户端 jar 或对应资源包 ZIP 放进：

```text
local/inbox/
```

然后双击项目根目录的 `准备本地素材.bat`。脚本会生成：

```text
local/create-pack.zip        Create 扩展自动读取
local/vanilla/               素材库原版纹理目录
```

`local/` 被 `.gitignore` 忽略，不会进入 GitHub、Pages 或发行包。没有本地包时仍可手动导入 jar/ZIP 或单张 PNG。

启动方式：

```text
双击 启动像素工坊.bat
```

它会自动启动 `serve.py` 并打开无边框 kiosk 窗口；按 `Alt+F4` 退出。也可以继续使用 `python serve.py`。

## 发行包


从 [Releases](https://github.com/lyingice/ClastarStudio/releases) 下载 v0.18.0 发行包。发行包是可直接运行的静态源码包：

```bash
unzip ClastarStudio-v0.18.0.zip
cd ClastarStudio-v0.18.0
python serve.py
```

## 项目结构

```text
index.html              应用入口 / 静态壳
plugin.json             官方可选插件的仓库根清单
manifest.json           PWA manifest
sw.js                   PWA 离线缓存
serve.py                本地静态服务器
plugins/                官方可选插件包（机械动力方块扩展）
integrations/           Blockbench 桥接插件
local/                  本地素材内容包（gitignore，不上传）
tools/                  构建、启动、素材准备与仓库检查脚本
准备本地素材.bat
启动像素工坊.bat
icon-192.png
icon-512.png
src/
  shell/                工作区、仓库、编辑器桥接、ZIP、换色、变种、快捷键、插件框架、素材库等
  embedded/             六类编辑器的内嵌 base64 文档
styles/                 应用与工具样式
docs/                   架构与开发文档
.github/                CI 与 issue/PR 模板
```

更详细的模块说明见 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)。

## 素材库

素材库是独立于项目工作区的参考素材工具：

- 入口：左侧「工具 → 素材库」
- 导入：PNG、文件夹、vanilla / mod jar、资源包 ZIP
- 自动分类：`assets/<namespace>/textures/<category>`，保留原始路径与 `.mcmeta`
- 浏览：搜索、原版 / 模组 / 本地 / 收藏筛选、命名空间 / 分类筛选、按名称 / 最近 / 尺寸排序
- 详情：大图预览、尺寸、路径、来源包、动画标记
- 操作：
  - 设为当前 / 最近一次纹理或动画编辑器的参考图
  - 复制到当前项目工作区
  - 复制原始路径
  - 收藏 / 删除
- 素材库工作区不会出现在项目工作区列表；现有仓库素材选择器会自动读取
- 数据与项目共用浏览器 localStorage，大量素材建议分批导入或优先使用缩略/参考尺寸

## 可选插件

扩展中心入口在「设置 → 扩展中心」，也可以从左侧「工具」打开已安装的插件。

- 当前官方可选插件：**机械动力方块扩展**（`plugins/create-texture/`）
- 插件包：`plugin.json`（或 `manifest.json`）+ 自包含 `plugin.html`
- 安装来源：GitHub 仓库根目录 `plugin.json`、raw 文件地址、release ZIP、本地 ZIP
- 安装前显示权限；插件运行在 `sandbox` iframe 中，不能直接访问主页面 DOM 或 localStorage
- 宿主 API 提供仓库读写、ZIP 读取、下载与插件独立存储
- 插件包由根目录 `plugin.json` 与 `plugins/<id>/` 组成
- Create 卡片可继续参与多选资源包导出，纹理按原始 `assets/create/textures/...` 路径写入

## 数据与隐私

- 工作区与素材库数据保存在浏览器 `localStorage`，键名前缀为 `pixelWorkshop_`。
- 应用不包含上传接口、账号系统或云同步；插件默认 `connect-src 'none'`，不能自行联网。
- 插件通过宿主 API 访问工作区；安装前会显示所需权限，第三方插件请只安装可信来源。
- 备份与迁移请使用资源包 ZIP 导出，或在设置中导出/导入 JSON 数据。
- 清除浏览器站点数据会同时清除本地工作区、素材库和已安装插件。

## 兼容性说明

资源包导出对话框提供以下目标版本：`1.21.9 / 1.21.10`、`1.21.7 / 1.21.8`、`1.21.5`、`1.21.4`。实际可用性以界面选项与目标 Minecraft 版本为准；本项目不对未在界面中列出的版本作兼容保证。

## 开发与测试

项目没有前端构建步骤，使用原生 HTML / CSS / JavaScript。

```bash
python -m py_compile serve.py tools/check_repo.py
python tools/check_repo.py
node --check sw.js
for f in src/shell/*.js src/embedded/*.js; do node --check "$f"; done
python serve.py
```

CI 配置见 [.github/workflows/ci.yml](.github/workflows/ci.yml)。

## 已知边界

- 数据是本机浏览器存储，不提供多人协作、云同步或账号体系。
- 不是 Minecraft 官方产品，也不包含 Minecraft 本体资源。
- 版本兼容性与资源包格式以实际界面选项为准；提交 issue 时请附版本、浏览器与复现步骤。
- 插件框架当前以工具页 / 导入器为主；编辑器内部面板、预览渲染器等贡献点尚未开放。
- 机械动力扩展当前覆盖扫描、分组、CT 识别和导入 MVP，完整 3D 机器预览与整族变种导出仍在后续计划中。

## 贡献

欢迎 issue 与 pull request。请先阅读 [CONTRIBUTING.md](CONTRIBUTING.md)、[CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) 和 [SECURITY.md](SECURITY.md)。

## 许可证与声明

项目代码采用 [MIT License](LICENSE)。Minecraft 是 Mojang Studios / Microsoft 的商标；本项目与 Mojang / Microsoft 无隶属或官方背书关系。

部分交互与“一键换色”算法参考了 Blockbench 及其 `color_replacer.js` 插件。第三方名称、商标与代码权利归各自所有者；详见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。

---

<details>
<summary>English overview</summary>

**Pixel Workshop** is a local-first Minecraft texture workspace that runs entirely in the browser. It combines workspaces, six embedded editors, one-click recoloring, variant generation, smart ZIP import, multi-select resource-pack export, and optional sandboxed plugins. Data stays in browser `localStorage`; no account or cloud service is required.

Run with `python serve.py` and open <http://127.0.0.1:8766/>. Source code is released under the MIT License.

</details>
