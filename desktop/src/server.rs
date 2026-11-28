// 内嵌回环 HTTP 服务：静态文件 + /api/llm 代理。
// 安全模型与 serve.py 对齐：host 白名单、Origin 校验、限流、体积上限、不记录密钥。
use std::collections::HashMap;
use std::io::Read;
use std::net::TcpListener;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::{Duration, Instant};

use tiny_http::{Header, Method, Response, Server, StatusCode};

const ALLOWED_HOSTS: &[&str] = &[
    "api.openai.com",
    "api.anthropic.com",
    "generativelanguage.googleapis.com",
    "api.deepseek.com",
    "api.moonshot.cn",
    "api.siliconflow.cn",
    "open.bigmodel.cn",
    "dashscope.aliyuncs.com",
    "localhost",
    "127.0.0.1",
    "::1",
];
const LOOPBACK: &[&str] = &["localhost", "127.0.0.1", "::1"];
const MAX_BODY: usize = 8 * 1024 * 1024;
const RATE_LIMIT: usize = 120;
const RATE_WINDOW: Duration = Duration::from_secs(60);
const UPSTREAM_TIMEOUT: Duration = Duration::from_secs(180);

type RateMap = Mutex<HashMap<String, Vec<Instant>>>;

const PREFERRED_PORTS: &[u16] = &[28766, 28767, 28768, 28769, 28770];

fn bind_loopback_listener() -> Result<TcpListener, std::io::Error> {
    if let Ok(raw) = std::env::var("CLASTAR_DESKTOP_PORT") {
        if let Ok(p) = raw.trim().parse::<u16>() {
            if p > 0 {
                if let Ok(l) = TcpListener::bind(("127.0.0.1", p)) {
                    return Ok(l);
                }
            }
        }
    }
    for &p in PREFERRED_PORTS {
        if let Ok(l) = TcpListener::bind(("127.0.0.1", p)) {
            return Ok(l);
        }
    }
    TcpListener::bind("127.0.0.1:0")
}

pub fn start(
    dist: PathBuf,
) -> Result<(u16, std::thread::JoinHandle<()>), Box<dyn std::error::Error + Send + Sync>> {
    let listener = bind_loopback_listener()?;
    let port = listener.local_addr()?.port();
    let server = Server::from_listener(listener, None)?;
    let rate: RateMap = Mutex::new(HashMap::new());

    let handle = std::thread::spawn(move || {
        for req in server.incoming_requests() {
            let path = req.url().split('?').next().unwrap_or("/").to_string();
            let method = req.method().clone();
            if path == "/api/llm/health" && method == Method::Get {
                health(req);
            } else if path == "/api/llm" && method == Method::Post {
                proxy(req, &rate);
            } else if path == "/api/llm" && method == Method::Options {
                preflight(req);
            } else if path == "/api/dsh/health" && method == Method::Get {
                dsh_health(req);
            } else if path == "/api/dsh/assets" && method == Method::Get {
                dsh_get(req);
            } else if path == "/api/dsh/assets" && method == Method::Post {
                dsh_sync(req);
            } else if path == "/api/dsh/assets" && method == Method::Options {
                preflight(req);
            } else if method == Method::Get || method == Method::Head {
                serve_static(req, &dist, &path);
            } else {
                let _ = req.respond(Response::from_string("not found").with_status_code(404));
            }
        }
    });
    Ok((port, handle))
}

// ── Static files ────────────────────────────────────────────────────────
fn serve_static(req: tiny_http::Request, dist: &Path, path: &str) {
    let rel = if path == "/" { "index.html" } else { path.trim_start_matches('/') };
    // 防路径穿越
    let file = dist.join(rel);
    let canon = match file.canonicalize() {
        Ok(c) => c,
        Err(_) => {
            let _ = req.respond(Response::from_string("not found").with_status_code(404));
            return;
        }
    };
    let dist_canon = dist.canonicalize().unwrap_or_else(|_| dist.to_path_buf());
    if !canon.starts_with(&dist_canon) || !canon.is_file() {
        let _ = req.respond(Response::from_string("not found").with_status_code(404));
        return;
    }
    let mime = mime_for(&canon);
    let data = match std::fs::read(&canon) {
        Ok(d) => d,
        Err(_) => {
            let _ = req.respond(Response::from_string("read error").with_status_code(500));
            return;
        }
    };
    let len = data.len();
    let resp = Response::from_data(data)
        .with_header(Header::from_bytes("Content-Type", mime).unwrap())
        .with_header(Header::from_bytes("Cache-Control", "no-store").unwrap())
        .with_header(Header::from_bytes("Content-Length", len.to_string()).unwrap());
    let _ = req.respond(resp);
}

fn mime_for(p: &Path) -> &'static str {
    match p.extension().and_then(|e| e.to_str()).unwrap_or("") {
        "html" => "text/html; charset=utf-8",
        "css" => "text/css; charset=utf-8",
        "js" => "application/javascript; charset=utf-8",
        "json" => "application/json; charset=utf-8",
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "svg" => "image/svg+xml",
        "ico" => "image/x-icon",
        "webp" => "image/webp",
        "zip" => "application/zip",
        "woff" => "font/woff",
        "woff2" => "font/woff2",
        "mcmeta" => "application/json; charset=utf-8",
        _ => "application/octet-stream",
    }
}

// ── /api/llm/health ─────────────────────────────────────────────────────
fn health(req: tiny_http::Request) {
    let hosts = allowed_hosts();
    let body = serde_json::json!({
        "ok": true,
        "desktop": true,
        "proxy": true,
        "loopback": true,
        "allowHosts": hosts,
        "lanEnabled": false,
    });
    let _ = req.respond(json_response(200, &body));
}

// ── /api/llm OPTIONS ────────────────────────────────────────────────────
fn preflight(req: tiny_http::Request) {
    let origin = req.headers().iter()
        .find(|h| h.field.equiv("origin"))
        .map(|h| h.value.as_str().to_string());
    let mut resp = Response::empty(204)
        .with_header(Header::from_bytes("Allow", "GET, POST, OPTIONS").unwrap());
    if let Some(o) = origin {
        resp = resp.with_header(Header::from_bytes("Access-Control-Allow-Origin", o).unwrap());
    }
    let _ = req.respond(resp);
}

// ── /api/llm POST proxy ─────────────────────────────────────────────────
fn proxy(mut req: tiny_http::Request, rate: &RateMap) {
    let ip = req.remote_addr().map(|a| a.ip().to_string()).unwrap_or_default();
    if !rate_ok(rate, &ip) {
        let _ = req.respond(json_response(429, &serde_json::json!({"error": "rate limit exceeded"})));
        return;
    }
    // Origin 校验（与 serve.py 一致：缺失 Origin 放行，否则须等于 http://Host）
    let origin = header_val(&req, "origin");
    let host = header_val(&req, "host");
    if let Some(o) = &origin {
        let expected = format!("http://{}", host.unwrap_or_default());
        if o.trim_end_matches('/').to_lowercase() != expected.to_lowercase() {
            let _ = req.respond(json_response(403, &serde_json::json!({"error": "origin mismatch"})));
            return;
        }
    }
    // 读取并解析请求体
    let mut raw = Vec::new();
    if req.as_reader().take(MAX_BODY as u64 + 1).read_to_end(&mut raw).is_err() || raw.len() > MAX_BODY {
        let _ = req.respond(json_response(413, &serde_json::json!({"error": "request body too large"})));
        return;
    }
    let payload: serde_json::Value = match serde_json::from_slice(&raw) {
        Ok(v) => v,
        Err(_) => {
            let _ = req.respond(json_response(400, &serde_json::json!({"error": "invalid json"})));
            return;
        }
    };
    let target = match payload.get("url").and_then(|v| v.as_str()) {
        Some(u) if !u.is_empty() => u.to_string(),
        _ => {
            let _ = req.respond(json_response(400, &serde_json::json!({"error": "invalid url"})));
            return;
        }
    };
    // 解析目标 URL，校验 scheme 与 host 白名单
    let parsed = match url::Url::parse(&target) {
        Ok(u) => u,
        Err(_) => {
            let _ = req.respond(json_response(400, &serde_json::json!({"error": "invalid url"})));
            return;
        }
    };
    let hostname = parsed.host_str().unwrap_or("").to_lowercase();
    let scheme = parsed.scheme();
    let loopback_target = LOOPBACK.contains(&hostname.as_str());
    if hostname.is_empty()
        || (scheme != "https" && !(scheme == "http" && loopback_target))
        || !allowed_hosts().iter().any(|h| h.eq_ignore_ascii_case(&hostname))
    {
        let _ = req.respond(json_response(403, &serde_json::json!({"error": "host not allowed"})));
        return;
    }
    // 构造上游请求
    let body_bytes = match payload.get("body") {
        None | Some(serde_json::Value::Null) => Vec::new(),
        Some(serde_json::Value::String(s)) => s.as_bytes().to_vec(),
        Some(v) => serde_json::to_vec(v).unwrap_or_default(),
    };
    if body_bytes.len() > MAX_BODY {
        let _ = req.respond(json_response(413, &serde_json::json!({"error": "request body too large"})));
        return;
    }
    let mut upstream = ureq::post(&target).timeout(UPSTREAM_TIMEOUT);
    // 转发 headers（丢弃 hop-by-hop 与 proxy-*，拒绝 CR/LF）
    let mut has_ct = false;
    if let Some(headers) = payload.get("headers").and_then(|v| v.as_object()) {
        for (k, v) in headers {
            let kl = k.to_lowercase();
            let vs = match v.as_str() { Some(s) => s, None => continue };
            if kl == "host" || kl == "connection" || kl == "content-length"
                || kl == "transfer-encoding" || kl == "keep-alive" || kl == "te"
                || kl == "trailer" || kl == "upgrade" || kl.starts_with("proxy-")
                || k.contains('\r') || k.contains('\n') || vs.contains('\r') || vs.contains('\n')
            { continue; }
            if kl == "content-type" { has_ct = true; }
            upstream = upstream.set(k, vs);
        }
    }
    if !has_ct { upstream = upstream.set("Content-Type", "application/json"); }

    match upstream.send_bytes(&body_bytes) {
        Ok(resp) => relay(req, resp),
        Err(ureq::Error::Status(code, resp)) => relay_status(req, code, resp),
        Err(e) => {
            let reason = e.to_string().replace(['\r', '\n'], " ");
            let short: String = reason.chars().take(200).collect();
            let _ = req.respond(json_response(502, &serde_json::json!({"error": format!("upstream unreachable: {}", short)})));
        }
    }
}

fn relay(req: tiny_http::Request, resp: ureq::Response) {
    let ct = resp.header("Content-Type").unwrap_or("application/json").to_string();
    let status = resp.status();
    let reader = resp.into_reader();
    let r = Response::new(StatusCode(status), vec![
        Header::from_bytes("Content-Type", ct).unwrap(),
        Header::from_bytes("Cache-Control", "no-store").unwrap(),
    ], reader, None, None);
    let _ = req.respond(r);
}

fn relay_status(req: tiny_http::Request, code: u16, resp: ureq::Response) {
    let ct = resp.header("Content-Type").unwrap_or("application/json").to_string();
    let reader = resp.into_reader();
    let r = Response::new(StatusCode(code), vec![
        Header::from_bytes("Content-Type", ct).unwrap(),
    ], reader, None, None);
    let _ = req.respond(r);
}

// ── Helpers ─────────────────────────────────────────────────────────────
fn allowed_hosts() -> Vec<String> {
    let mut hosts: Vec<String> = ALLOWED_HOSTS.iter().map(|s| s.to_string()).collect();
    if let Ok(extra) = std::env::var("CLASTAR_LLM_ALLOW_HOSTS") {
        for h in extra.split(',') {
            let h = h.trim().to_lowercase();
            if !h.is_empty() { hosts.push(h); }
        }
    }
    hosts.sort();
    hosts
}

fn rate_ok(rate: &RateMap, ip: &str) -> bool {
    let now = Instant::now();
    let mut map = rate.lock().unwrap();
    let hits = map.entry(ip.to_string()).or_default();
    hits.retain(|t| now.duration_since(*t) < RATE_WINDOW);
    if hits.len() >= RATE_LIMIT { return false; }
    hits.push(now);
    if map.len() > 4096 { map.retain(|_, v| !v.is_empty()); }
    true
}

fn header_val(req: &tiny_http::Request, name: &'static str) -> Option<String> {
    req.headers().iter()
        .find(|h| h.field.equiv(name))
        .map(|h| h.value.as_str().to_string())
}

fn json_response(code: u16, body: &serde_json::Value) -> Response<std::io::Cursor<Vec<u8>>> {
    let data = serde_json::to_vec(body).unwrap_or_default();
    let len = data.len();
    Response::from_data(data)
        .with_status_code(code)
        .with_header(Header::from_bytes("Content-Type", "application/json; charset=utf-8").unwrap())
        .with_header(Header::from_bytes("Content-Length", len.to_string()).unwrap())
        .with_header(Header::from_bytes("Cache-Control", "no-store").unwrap())
}

// ── /api/dsh/* 资产索引本地桥接 ─────────────────────────────────────────────
const DSH_MAX_BODY: usize = 32 * 1024 * 1024;

fn dsh_bridge_dir() -> PathBuf {
    if let Ok(raw) = std::env::var("CLASTAR_DSH_BRIDGE_DIR") {
        let trimmed = raw.trim();
        if !trimmed.is_empty() {
            return PathBuf::from(trimmed);
        }
    }
    let home = std::env::var("USERPROFILE")
        .or_else(|_| std::env::var("HOME"))
        .unwrap_or_else(|_| ".".to_string());
    PathBuf::from(home).join(".clastar-studio").join("dsh-bridge")
}

fn safe_rel_path(raw: &str) -> Option<PathBuf> {
    let norm = raw.replace('\\', "/");
    let trimmed = norm.trim();
    if trimmed.is_empty() || trimmed.starts_with('/') || trimmed.contains(':') || trimmed.contains('\0') {
        return None;
    }
    let mut rel = PathBuf::new();
    for seg in trimmed.split('/') {
        if seg.is_empty() {
            continue;
        }
        if seg == "." || seg == ".." {
            return None;
        }
        rel.push(seg);
    }
    if rel.as_os_str().is_empty() { None } else { Some(rel) }
}

fn decode_b64(input: &str) -> Result<Vec<u8>, ()> {
    let mut out = Vec::with_capacity(input.len() * 3 / 4);
    let mut buf: u32 = 0;
    let mut bits: u8 = 0;
    for b in input.bytes() {
        if b.is_ascii_whitespace() {
            continue;
        }
        if b == b'=' {
            break;
        }
        let val = match b {
            b'A'..=b'Z' => b - b'A',
            b'a'..=b'z' => b - b'a' + 26,
            b'0'..=b'9' => b - b'0' + 52,
            b'+' => 62,
            b'/' => 63,
            _ => return Err(()),
        };
        buf = (buf << 6) | (val as u32);
        bits += 6;
        if bits >= 8 {
            bits -= 8;
            out.push(((buf >> bits) & 0xFF) as u8);
        }
    }
    Ok(out)
}

fn dsh_health(req: tiny_http::Request) {
    let dir = dsh_bridge_dir();
    let idx = dir.join("index.json");
    let mut assets_count = 0usize;
    let mut models_count = 0usize;
    let mut generated_at = serde_json::Value::Null;
    let index_exists = idx.is_file();
    if index_exists {
        if let Ok(text) = std::fs::read_to_string(&idx) {
            if let Ok(val) = serde_json::from_str::<serde_json::Value>(&text) {
                assets_count = val["counts"]["assets"]
                    .as_u64()
                    .map(|n| n as usize)
                    .unwrap_or_else(|| val["assets"].as_array().map(|a| a.len()).unwrap_or(0));
                models_count = val["counts"]["models"]
                    .as_u64()
                    .map(|n| n as usize)
                    .unwrap_or_else(|| val["models"].as_array().map(|a| a.len()).unwrap_or(0));
                generated_at = val["generatedAt"].clone();
            }
        }
    }
    let body = serde_json::json!({
        "ok": true,
        "dir": dir.to_string_lossy(),
        "indexExists": index_exists,
        "assetsCount": assets_count,
        "modelsCount": models_count,
        "generatedAt": generated_at,
    });
    let _ = req.respond(json_response(200, &body));
}

fn dsh_get(req: tiny_http::Request) {
    let dir = dsh_bridge_dir();
    let idx = dir.join("index.json");
    if !idx.is_file() {
        let _ = req.respond(json_response(404, &serde_json::json!({"error": "index not synced yet"})));
        return;
    }
    match std::fs::read_to_string(&idx).ok().and_then(|s| serde_json::from_str::<serde_json::Value>(&s).ok()) {
        Some(val) => {
            let _ = req.respond(json_response(200, &serde_json::json!({
                "ok": true,
                "dir": dir.to_string_lossy(),
                "index": val,
            })));
        }
        None => {
            let _ = req.respond(json_response(500, &serde_json::json!({"error": "failed to read index"})));
        }
    }
}

fn dsh_sync(mut req: tiny_http::Request) {
    let origin = header_val(&req, "origin");
    let host = header_val(&req, "host");
    if let Some(o) = &origin {
        let expected = format!("http://{}", host.unwrap_or_default());
        if o.trim_end_matches('/').to_lowercase() != expected.to_lowercase() {
            let _ = req.respond(json_response(403, &serde_json::json!({"error": "origin mismatch"})));
            return;
        }
    }
    let mut raw = Vec::new();
    if req.as_reader().take(DSH_MAX_BODY as u64 + 1).read_to_end(&mut raw).is_err() || raw.len() > DSH_MAX_BODY {
        let _ = req.respond(json_response(413, &serde_json::json!({"error": "request body too large"})));
        return;
    }
    let payload: serde_json::Value = match serde_json::from_slice(&raw) {
        Ok(v) => v,
        Err(_) => {
            let _ = req.respond(json_response(400, &serde_json::json!({"error": "invalid json"})));
            return;
        }
    };
    if !payload["index"].is_object() {
        let _ = req.respond(json_response(400, &serde_json::json!({"error": "missing index object"})));
        return;
    }
    let dir = dsh_bridge_dir();
    let files_dir = dir.join("files");
    if std::fs::create_dir_all(&dir).is_err() {
        let _ = req.respond(json_response(500, &serde_json::json!({"error": "failed to create bridge dir"})));
        return;
    }
    let prune = payload["prune"].as_bool().unwrap_or(true);
    if prune && files_dir.exists() {
        let _ = std::fs::remove_dir_all(&files_dir);
    }
    if std::fs::create_dir_all(&files_dir).is_err() {
        let _ = req.respond(json_response(500, &serde_json::json!({"error": "failed to create files dir"})));
        return;
    }
    let mut written = 0usize;
    if let Some(files) = payload["files"].as_array() {
        for item in files {
            let rel_str = match item["path"].as_str() {
                Some(s) => s,
                None => continue,
            };
            let rel = match safe_rel_path(rel_str) {
                Some(p) => p,
                None => {
                    let _ = req.respond(json_response(400, &serde_json::json!({"error": "invalid file path"})));
                    return;
                }
            };
            let dest = files_dir.join(rel);
            if let Some(parent) = dest.parent() {
                if std::fs::create_dir_all(parent).is_err() {
                    let _ = req.respond(json_response(500, &serde_json::json!({"error": "failed to create file parent"})));
                    return;
                }
            }
            let enc = item["encoding"].as_str().unwrap_or("utf8");
            let data = item["data"].as_str().unwrap_or("");
            if enc == "base64" {
                let bytes = match decode_b64(data) {
                    Ok(b) => b,
                    Err(_) => {
                        let _ = req.respond(json_response(400, &serde_json::json!({"error": "invalid base64 data"})));
                        return;
                    }
                };
                if std::fs::write(&dest, bytes).is_err() {
                    let _ = req.respond(json_response(500, &serde_json::json!({"error": "write failed"})));
                    return;
                }
            } else if std::fs::write(&dest, data.as_bytes()).is_err() {
                let _ = req.respond(json_response(500, &serde_json::json!({"error": "write failed"})));
                return;
            }
            written += 1;
        }
    }
    let index_tmp = dir.join("index.json.tmp");
    let index_final = dir.join("index.json");
    let index_text = match serde_json::to_string_pretty(&payload["index"]) {
        Ok(s) => s,
        Err(_) => {
            let _ = req.respond(json_response(500, &serde_json::json!({"error": "serialize index failed"})));
            return;
        }
    };
    if std::fs::write(&index_tmp, index_text).is_err() || std::fs::rename(&index_tmp, &index_final).is_err() {
        let _ = req.respond(json_response(500, &serde_json::json!({"error": "write index failed"})));
        return;
    }
    let assets_count = payload["index"]["counts"]["assets"]
        .as_u64()
        .map(|n| n as usize)
        .unwrap_or_else(|| payload["index"]["assets"].as_array().map(|a| a.len()).unwrap_or(0));
    let models_count = payload["index"]["counts"]["models"]
        .as_u64()
        .map(|n| n as usize)
        .unwrap_or_else(|| payload["index"]["models"].as_array().map(|a| a.len()).unwrap_or(0));
    let _ = req.respond(json_response(200, &serde_json::json!({
        "ok": true,
        "dir": dir.to_string_lossy(),
        "indexFile": index_final.to_string_lossy(),
        "writtenFiles": written,
        "assetsCount": assets_count,
        "modelsCount": models_count,
    })));
}
