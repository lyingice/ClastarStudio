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

当前版本：**v0.12.0**<br>
运行方式：`python serve.py`，打开 `http://127.0.0.1:8766/`。

## 功能亮点

### 一个工作台，六类编辑器

- **纹理 / 动画**：像素画布、图层、帧、调色板、对称、撤销/重做、参照画布、`.mcmeta` 预览与导出。
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

- **一键换色**：读取纹理颜色，使用预设或调色板替换；原图/结果并排预览，可逐色微调、保存写回或导出 PNG。
- **变种工坊**：14 套内置材质色阶 + 自定义色阶，矩阵预览、批量生成、PNG ZIP 或写回仓库。

### 导入、打包与工作流

- **智能 ZIP 导入**：识别 `assets/<namespace>/textures/...`，自动按资源类型分类，保留原始路径与动画 `.mcmeta`。
- **多选导出资源包**：设置资源包名称、命名空间、目标版本与纹理归类，自动生成 `pack.mcmeta`、`pack.png`，动画自动附带 `.mcmeta`。
- **快捷键中心**：搜索、分组、录制改键、冲突检测、导入/导出配置。
- **扩展注册表**：工具与编辑器扩展统一定义、启停与持久化。
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

## 发行包

从 [Releases](https://github.com/lyingice/ClastarStudio/releases) 下载 v0.12.0 发行包。发行包是可直接运行的静态源码包：

```bash
unzip ClastarStudio-v0.12.0.zip
cd ClastarStudio-v0.12.0
python serve.py
```

## 项目结构

```text
index.html              应用入口 / 静态壳
manifest.json           PWA manifest
sw.js                   PWA 离线缓存
serve.py                本地静态服务器
icon-192.png
icon-512.png
src/
  shell/                工作区、仓库、编辑器桥接、ZIP、换色、变种、快捷键等
  embedded/             六类编辑器的内嵌 base64 文档
styles/                 应用与工具样式
docs/                   架构与开发文档
tools/                  仓库自检脚本
.github/                CI 与 issue/PR 模板
```

更详细的模块说明见 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)。

## 数据与隐私

- 工作区数据保存在浏览器 `localStorage`，键名前缀为 `pixelWorkshop_`。
- 应用不包含上传接口、账号系统或云同步。
- 备份与迁移请使用资源包 ZIP 导出，或在设置中导出/导入 JSON 数据。
- 清除浏览器站点数据会同时清除本地工作区。

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

## 贡献

欢迎 issue 与 pull request。请先阅读 [CONTRIBUTING.md](CONTRIBUTING.md)、[CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) 和 [SECURITY.md](SECURITY.md)。

## 许可证与声明

项目代码采用 [MIT License](LICENSE)。Minecraft 是 Mojang Studios / Microsoft 的商标；本项目与 Mojang / Microsoft 无隶属或官方背书关系。

部分交互与“一键换色”算法参考了 Blockbench 及其 `color_replacer.js` 插件。第三方名称、商标与代码权利归各自所有者；详见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。

---

<details>
<summary>English overview</summary>

**Pixel Workshop** is a local-first Minecraft texture workspace that runs entirely in the browser. It combines workspaces, six embedded editors, one-click recoloring, variant generation, smart ZIP import, and multi-select resource-pack export. Data stays in browser `localStorage`; no account or cloud service is required.

Run with `python serve.py` and open <http://127.0.0.1:8766/>. Source code is released under the MIT License.

</details>
