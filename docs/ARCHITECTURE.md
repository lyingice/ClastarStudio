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

`serve.py` 只是一个带禁用缓存的 `SimpleHTTPRequestHandler`。它不做鉴权、不存数据，也不提供上传接口。

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
| `src/shell/extensions.js` | 工具/扩展注册表、启停、设置面板与编辑器同步 |
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
          ├─ anim / mcmeta
          └─ packPath / packNs
```

其他本地状态：

| 键 | 内容 |
| --- | --- |
| `pixelWorkshop_sidebar_v1` | 左右栏宽度、折叠、抽屉状态 |
| `pixelWorkshop_recolor_v1` | 换色预设、模式、容差等 |
| `pixelWorkshop_shortcuts_v1` | 自定义快捷键 |
| `pixelWorkshop_extensions_v1` | 工具/扩展启停 |
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

## 安全边界

- 这是单用户本地应用，没有账号、权限或远程 API。
- 导入的 PNG / ZIP 在浏览器沙箱内处理；对外部 ZIP 仍需谨慎，不要导入不可信来源的文件。
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
