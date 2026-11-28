package com.clastar.pixelworkshop;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.DownloadManager;
import android.content.ContentValues;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.view.ViewGroup;
import android.webkit.ConsoleMessage;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.Toast;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

/**
 * 像素工坊 Android 外壳。
 * 直接加载 Web 版（GitHub Pages），复用同一套前端与数据；只补充三件原生能力：
 *   1) 文件选择（导入 PNG / ZIP）
 *   2) 下载保存（导出资源包 / GIF）
 *   3) 返回键与生命周期
 */
public class MainActivity extends Activity {

    private static final String START_URL = "https://lyingice.github.io/ClastarStudio/";
    private static final int REQ_FILE = 1001;

    private WebView web;
    private ValueCallback<Uri[]> pendingFiles;
    private String hookJs = "";

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    @Override
    protected void onCreate(Bundle saved) {
        super.onCreate(saved);
        hookJs = readAsset("pw-hook.js");

        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.parseColor("#1a1a1a"));

        web = new WebView(this);
        web.setBackgroundColor(Color.parseColor("#1a1a1a"));

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowContentAccess(true);
        s.setAllowFileAccess(false);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setJavaScriptCanOpenWindowsAutomatically(true);
        s.setSupportMultipleWindows(false);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);
        s.setTextZoom(100);

        CookieManager.getInstance().setAcceptCookie(true);
        web.addJavascriptInterface(new Bridge(), "PWAndroid");

        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
                Uri u = req.getUrl();
                String scheme = u.getScheme() == null ? "" : u.getScheme();
                String host = u.getHost() == null ? "" : u.getHost();
                boolean isHttp = "http".equals(scheme) || "https".equals(scheme);
                if (isHttp && host.endsWith("github.io")) return false;
                try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (Exception ignored) {}
                return true;
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                if (hookJs != null && hookJs.length() > 0) view.evaluateJavascript(hookJs, null);
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest req, WebResourceError err) {
                if (req != null && req.isForMainFrame()) {
                    showNetworkError(err.getDescription() == null ? "" : err.getDescription().toString());
                }
            }
        });

        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> cb, FileChooserParams params) {
                if (pendingFiles != null) { pendingFiles.onReceiveValue(null); pendingFiles = null; }
                pendingFiles = cb;
                try {
                    startActivityForResult(params.createIntent(), REQ_FILE);
                    return true;
                } catch (Exception e) {
                    pendingFiles = null;
                    return false;
                }
            }

            @Override
            public boolean onConsoleMessage(ConsoleMessage m) {
                return true;
            }
        });

        web.setDownloadListener((url, userAgent, contentDisposition, mimeType, len) -> {
            try {
                Uri u = Uri.parse(url);
                String scheme = u.getScheme() == null ? "" : u.getScheme();
                if (!"http".equals(scheme) && !"https".equals(scheme)) {
                    toast("这种下载方式在 App 里不支持");
                    return;
                }
                DownloadManager.Request r = new DownloadManager.Request(u);
                r.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
                r.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS,
                        android.webkit.URLUtil.guessFileName(url, contentDisposition, mimeType));
                DownloadManager dm = (DownloadManager) getSystemService(DOWNLOAD_SERVICE);
                if (dm != null) dm.enqueue(r);
                toast("已开始下载");
            } catch (Exception e) {
                toast("下载失败：" + e.getMessage());
            }
        });

        root.addView(web, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        setContentView(root);

        web.loadUrl(START_URL);
    }

    @Override
    protected void onActivityResult(int req, int res, Intent data) {
        if (req == REQ_FILE) {
            if (pendingFiles != null) {
                Uri[] uris = null;
                if (res == RESULT_OK && data != null) {
                    if (data.getClipData() != null) {
                        int n = data.getClipData().getItemCount();
                        uris = new Uri[n];
                        for (int i = 0; i < n; i++) uris[i] = data.getClipData().getItemAt(i).getUri();
                    } else if (data.getData() != null) {
                        uris = new Uri[]{ data.getData() };
                    }
                }
                pendingFiles.onReceiveValue(uris);
                pendingFiles = null;
            }
            return;
        }
        super.onActivityResult(req, res, data);
    }

    @Override
    public void onBackPressed() {
        if (web != null && web.canGoBack()) { web.goBack(); return; }
        super.onBackPressed();
    }

    @Override
    protected void onPause() {
        if (web != null) web.onPause();
        super.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (web != null) web.onResume();
    }

    @Override
    protected void onDestroy() {
        if (web != null) { web.destroy(); web = null; }
        super.onDestroy();
    }

    /* ---------------- 原生桥：把 data:/blob: 的下载存进系统「下载」目录 ---------------- */

    private class Bridge {
        @JavascriptInterface
        public void saveDataUrl(String name, String dataUrl) {
            try {
                if (dataUrl == null || !dataUrl.startsWith("data:")) throw new IllegalArgumentException("不是 data URL");
                int comma = dataUrl.indexOf(',');
                if (comma < 0) throw new IllegalArgumentException("data URL 格式不对");
                String head = dataUrl.substring(5, comma);
                String payload = dataUrl.substring(comma + 1);
                boolean isB64 = head.contains(";base64");
                String mime = "application/octet-stream";
                int semi = head.indexOf(';');
                if (semi > 0) mime = head.substring(0, semi);
                else if (head.length() > 0) mime = head;

                byte[] bytes = isB64
                        ? Base64.decode(payload, Base64.DEFAULT)
                        : Uri.decode(payload).getBytes(StandardCharsets.UTF_8);

                String safe = sanitize(name);
                if (safe.indexOf('.') < 0) safe = safe + guessExt(mime);

                ContentValues cv = new ContentValues();
                cv.put(MediaStore.Downloads.DISPLAY_NAME, safe);
                cv.put(MediaStore.Downloads.MIME_TYPE, mime);
                Uri item = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, cv);
                if (item == null) throw new IllegalStateException("无法创建文件");
                try (OutputStream os = getContentResolver().openOutputStream(item)) {
                    if (os == null) throw new IllegalStateException("无法写入文件");
                    os.write(bytes);
                    os.flush();
                }
                final String shown = safe;
                runOnUiThread(() -> toast("已保存到「下载」：" + shown));
            } catch (Throwable t) {
                final String msg = t.getMessage() == null ? t.getClass().getSimpleName() : t.getMessage();
                runOnUiThread(() -> toast("保存失败：" + msg));
            }
        }

        @JavascriptInterface
        public void toastMsg(String msg) {
            final String m = msg == null ? "" : msg;
            runOnUiThread(() -> toast(m));
        }
    }

    private static String sanitize(String name) {
        String base = (name == null || name.trim().isEmpty()) ? "pixel-workshop" : name.trim();
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < base.length(); i++) {
            char c = base.charAt(i);
            boolean bad = "\\/:*?\"<>|".indexOf(c) >= 0 || c < 32;
            sb.append(bad ? '_' : c);
        }
        return sb.toString();
    }

    private static String guessExt(String mime) {
        String m = mime == null ? "" : mime.toLowerCase();
        if (m.contains("png")) return ".png";
        if (m.contains("gif")) return ".gif";
        if (m.contains("jpeg") || m.contains("jpg")) return ".jpg";
        if (m.contains("webp")) return ".webp";
        if (m.contains("zip")) return ".zip";
        if (m.contains("json")) return ".json";
        if (m.contains("plain")) return ".txt";
        return ".bin";
    }

    /* ---------------- 工具 ---------------- */

    private String readAsset(String name) {
        try (InputStream is = getAssets().open(name)) {
            ByteArrayOutputStream bos = new ByteArrayOutputStream();
            byte[] buf = new byte[8192];
            int n;
            while ((n = is.read(buf)) > 0) bos.write(buf, 0, n);
            return new String(bos.toByteArray(), StandardCharsets.UTF_8);
        } catch (Exception e) {
            return "";
        }
    }

    private void showNetworkError(String detail) {
        String html = "<html><head><meta name='viewport' content='width=device-width,initial-scale=1'>"
                + "<style>body{background:#1a1a1a;color:#eaeaea;font-family:system-ui,'Microsoft YaHei',sans-serif;"
                + "padding:32px 22px;line-height:1.9}h3{margin:0 0 10px;font-size:17px}p{font-size:13.5px;color:#b9b9b9}"
                + "small{display:block;margin-top:14px;color:#6f6f6f;font-size:11.5px;word-break:break-all}"
                + "a{display:inline-block;margin-top:22px;background:#4c9a2a;color:#fff;text-decoration:none;"
                + "padding:11px 22px;font-size:14px}</style></head><body>"
                + "<h3>打不开页面</h3><p>请检查手机网络后重试。</p>"
                + "<a href='" + START_URL + "'>重新加载</a>"
                + "<small>" + escapeHtml(detail) + "</small></body></html>";
        web.loadDataWithBaseURL(null, html, "text/html", "utf-8", null);
    }

    private static String escapeHtml(String s) {
        if (s == null) return "";
        return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;");
    }

    private void toast(String msg) {
        Toast.makeText(this, msg, Toast.LENGTH_SHORT).show();
    }
}
