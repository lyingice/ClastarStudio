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

pub fn start(
    dist: PathBuf,
) -> Result<(u16, std::thread::JoinHandle<()>), Box<dyn std::error::Error + Send + Sync>> {
    let listener = TcpListener::bind("127.0.0.1:0")?;
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
        .with_header(Header::from_bytes("Allow", "POST, OPTIONS").unwrap());
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
