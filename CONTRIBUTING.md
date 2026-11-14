# Contributing

感谢你愿意改进像素工坊。这个项目是一个无构建步骤的原生 HTML/CSS/JavaScript 应用，尽量保持轻量、可读和可直接运行。

## 开发环境

- Python 3.9+（仅用于本地静态服务器与仓库自检）
- Node.js 20+（仅用于 JavaScript 语法检查）

```bash
git clone https://github.com/lyingice/ClastarStudio.git
cd ClastarStudio
python serve.py
```

打开 <http://127.0.0.1:8766/>。

## 提交前检查

```bash
python -m py_compile serve.py tools/check_repo.py
python tools/check_repo.py
node --check sw.js
for f in src/shell/*.js src/embedded/*.js; do node --check "$f"; done
```

如果改动涉及 ZIP、导入/导出或 localStorage 数据结构，请额外做一次真实界面回归：

1. 新建工作区，导入一张干净的演示纹理。
2. 导出资源包，用 Python `zipfile` 检查路径、`pack.mcmeta` 与动画 `.mcmeta`。
3. 刷新页面，确认工作区和布局仍能恢复。

## 代码约定

- 保持现有原生技术栈，不引入框架或构建链，除非有明确的必要性。
- 修改 `src/shell/*.js` 时保持现有的经典脚本作用域和全局入口兼容。
- 遵循 `.editorconfig`：UTF-8、LF、2 空格缩进（Python 4 空格）。
- 不提交生成物：`renders/`、截图、录屏、导出 ZIP、`node_modules/`、日志或本地编辑器配置。
- 不在仓库中加入个人数据、真实用户工作区备份或版权不明的素材。

## Pull Request

- 描述改动目的、用户可见变化与验证方式。
- 保持范围聚焦；UI、数据结构和导出格式的改动请单独说明兼容性。
- 如果改动影响界面，建议附上简短的操作描述；不需要上传大体积截图或视频。
- 提交即表示你同意按本项目的 MIT License 提供你的贡献。

## Issue

提交 bug 前请先搜索已有 issue，并提供：

- 产品版本（当前为 v0.12.0）
- 浏览器与操作系统
- 复现步骤、期望结果、实际结果
- 控制台错误或最小复现数据（不要附真实个人工作区）
