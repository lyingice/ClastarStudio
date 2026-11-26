# 像素工坊桌面壳（Tauri v2）

同仓单主干：`main` 分支的 HTML/CSS/JS 是唯一开发源，本目录只是薄壳打包层，
**不修改 `src/`、`styles/`、`plugins/`、`integrations/` 下任何网页代码**。

## 工作原理

1. `prepare_dist.py` 读取 `tools/static_manifest.json`，把网页静态产物复制到 `desktop/dist/`。
2. Tauri 把 `dist/` 打入安装包资源。
3. 运行时 `src/server.rs` 在 `127.0.0.1` 随机端口启动内嵌 HTTP 服务：
   - 静态文件服务（与 `serve.py` 行为一致，`Cache-Control: no-store`）
   - `GET /api/llm/health` + `POST /api/llm` 代理（安全模型对齐 `serve.py`：
     host 白名单、Origin 校验、限流、8 MiB 上限、不记录密钥）
4. WebView2 窗口加载 `http://127.0.0.1:<port>/`。

使用回环 HTTP 而非 `file://` 或 `tauri://` 的原因：
- `src/shell/init.js` 仅在 `http:`/`https:` 协议下注册 Service Worker；
- Blockbench 桥接 `allowedOrigin()` 只放行 `https://lyingice.github.io` 与 localhost；
- `/api/llm` 代理需要 HTTP 语义。

因此桌面端与网页端行为完全一致，无需为 EXE 写分支逻辑。

## 本地构建

前置：Rust（MSVC target）、Node 20+、Python 3.9+、WebView2 Runtime（Win10/11 自带）。
首次需安装 Tauri CLI：

```bash
cargo install tauri-cli --version "^2"
```

开发运行：

```bash
cd desktop
python prepare_dist.py
cargo tauri dev
```

打包安装包（NSIS）：

```bash
cd desktop
cargo tauri build
```

产物位于 `desktop/target/release/bundle/nsis/`。

## CI 自动打包

`.github/workflows/desktop.yml` 在打 `v*` tag 时自动构建 Windows 安装包并上传到 Release。
静态产物清单与 GitHub Pages 共用 `tools/static_manifest.json`，保证两端一致。

## 图标

`icons/icon.ico` 由仓库根 `clastar.ico` 复制而来。如需多尺寸 PNG，可用
`cargo tauri icon ../clastar.ico` 生成。

## 目录说明

```
desktop/
  Cargo.toml          Rust 依赖（tauri 2 / tiny_http / ureq / url）
  tauri.conf.json     Tauri v2 配置（frontendDist、resources、NSIS）
  build.rs            tauri_build::build()
  prepare_dist.py     按共享清单复制静态产物到 dist/
  src/main.rs         入口：启动服务 + 创建窗口
  src/server.rs       内嵌 HTTP：静态服务 + /api/llm 代理
  dist/               构建时生成（gitignore）
  target/             Cargo 构建产物（gitignore）
```
