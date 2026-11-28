// 像素工坊桌面壳：内嵌回环 HTTP 服务 + WebView2 窗口。
// 静态文件与 /api/llm 代理均由 server.rs 在 127.0.0.1 上提供，
// 保证 SW 注册（http: 协议）、Blockbench 桥接白名单（localhost）与网页端完全一致。
// 不修改 src/ 下任何网页代码。
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod server;

use tauri::Manager;

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            // 静态产物目录：开发时为 desktop/dist，打包后为资源目录下的 dist
            let dist = app
                .path()
                .resource_dir()
                .map(|d| d.join("dist"))
                .unwrap_or_else(|_| std::env::current_dir().unwrap().join("dist"));

            // 若资源目录不存在（开发模式），回退到 exe 同级 dist
            let dist = if dist.is_dir() {
                dist
            } else {
                std::env::current_exe()
                    .ok()
                    .and_then(|p| p.parent().map(|p| p.join("dist")))
                    .unwrap_or(dist)
            };

            let (port, _handle) = server::start(dist).expect("failed to start local server");
            let url = format!("http://127.0.0.1:{}/", port);

            tauri::WebviewWindowBuilder::new(
                app,
                "main",
                tauri::WebviewUrl::External(url.parse().unwrap()),
            )
            .title("像素工坊 · PIXEL WORKSHOP")
            .inner_size(1280.0, 800.0)
            .min_inner_size(900.0, 600.0)
            .disable_drag_drop_handler()
            .build()?;

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
