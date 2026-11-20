#!/usr/bin/env python3
"""Start the local Clastar Studio server and open it in a borderless kiosk window.

Double-click the desktop shortcut (or run with pyw.exe) for normal use.
Use `python tools/launch_kiosk.py --check` to validate the setup without opening
the browser, and `--dry-run` to print the browser command line.
"""
from pathlib import Path
import ctypes
import json
import os
import shutil
import socket
import subprocess
import sys
import time
import urllib.request

ROOT = Path(__file__).resolve().parent.parent
HOST = '127.0.0.1'
PORT = int(os.environ.get('CLASTAR_PORT', '8766'))
URL = 'http://%s:%d/' % (HOST, PORT)
LOCAL = Path(os.environ.get('LOCALAPPDATA') or (Path.home() / 'AppData' / 'Local'))
DATA = LOCAL / 'ClastarStudio'
PROFILE = DATA / 'kiosk-profile'
LOG = DATA / 'launcher.log'
CREATE_NO_WINDOW = 0x08000000 if os.name == 'nt' else 0


def log(msg):
    try:
        DATA.mkdir(parents=True, exist_ok=True)
        with LOG.open('a', encoding='utf-8') as f:
            f.write(time.strftime('%Y-%m-%d %H:%M:%S ') + str(msg) + '\n')
    except Exception:
        pass


def message(text, error=False):
    log(text)
    if os.name == 'nt':
        try:
            flags = 0x10 if error else 0x40
            ctypes.windll.user32.MessageBoxW(0, str(text), '像素工坊', flags)
            return
        except Exception:
            pass
    print(text, file=sys.stderr if error else sys.stdout)


def port_open():
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.settimeout(0.35)
    try:
        return s.connect_ex((HOST, PORT)) == 0
    except Exception:
        return False
    finally:
        try:
            s.close()
        except Exception:
            pass


def server_ok():
    try:
        opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
        with opener.open(URL, timeout=1.0) as r:
            body = r.read(4096)
            return r.status == 200 and b'PIXEL WORKSHOP' in body
    except Exception:
        return False


def wait_server(proc, timeout=15):
    deadline = time.time() + timeout
    while time.time() < deadline:
        if server_ok():
            return True
        if proc is not None and proc.poll() is not None:
            return False
        time.sleep(0.2)
    return server_ok()


def start_server():
    env = os.environ.copy()
    env['HOST'] = HOST
    env['PORT'] = str(PORT)
    exe = sys.executable or 'pythonw.exe'
    log('starting server: %s %s' % (exe, ROOT / 'serve.py'))
    return subprocess.Popen(
        [exe, str(ROOT / 'serve.py')],
        cwd=str(ROOT),
        env=env,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        creationflags=CREATE_NO_WINDOW,
    )


def stop_server(proc):
    if not proc or proc.poll() is not None:
        return
    try:
        proc.terminate()
        proc.wait(timeout=3)
    except Exception:
        try:
            proc.kill()
        except Exception:
            pass


def find_browser():
    override = os.environ.get('CLASTAR_BROWSER')
    if override and Path(override).exists():
        return Path(override)
    for name in ('chrome.exe', 'msedge.exe'):
        hit = shutil.which(name)
        if hit:
            return Path(hit)
    env = os.environ
    candidates = [
        Path(env.get('PROGRAMFILES', 'C:/Program Files')) / 'Google/Chrome/Application/chrome.exe',
        Path(env.get('PROGRAMFILES(X86)', 'C:/Program Files (x86)')) / 'Google/Chrome/Application/chrome.exe',
        Path(env.get('LOCALAPPDATA', '')) / 'Google/Chrome/Application/chrome.exe',
        Path(env.get('PROGRAMFILES(X86)', 'C:/Program Files (x86)')) / 'Microsoft/Edge/Application/msedge.exe',
        Path(env.get('PROGRAMFILES', 'C:/Program Files')) / 'Microsoft/Edge/Application/msedge.exe',
        Path(env.get('LOCALAPPDATA', '')) / 'Microsoft/Edge/Application/msedge.exe',
    ]
    for p in candidates:
        try:
            if p.exists():
                return p
        except Exception:
            pass
    return None


def browser_args(browser):
    name = browser.name.lower()
    args = [
        str(browser),
        '--kiosk',
        URL,
        '--user-data-dir=' + str(PROFILE),
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-session-crashed-bubble',
        '--disable-infobars',
        '--disable-features=Translate,MediaRouter,OptimizationHints',
    ]
    if 'msedge' in name:
        args.append('--edge-kiosk-type=fullscreen')
    scale = os.environ.get('CLASTAR_KIOSK_SCALE')
    if scale:
        args.append('--force-device-scale-factor=' + str(scale))
    return args


def kiosk_running():
    if os.name != 'nt':
        return False
    ps = (
        "Get-CimInstance Win32_Process | Where-Object { "
        "($_.Name -eq 'chrome.exe' -or $_.Name -eq 'msedge.exe') -and "
        "$_.CommandLine -like '*ClastarStudio*kiosk-profile*' -and "
        "$_.CommandLine -like '*--kiosk*' } | "
        "Select-Object -First 1 -ExpandProperty ProcessId"
    )
    try:
        out = subprocess.run(
            ['powershell', '-NoProfile', '-Command', ps],
            capture_output=True, text=True, timeout=5,
            creationflags=CREATE_NO_WINDOW,
        )
        return bool((out.stdout or '').strip())
    except Exception:
        return False


def activate_existing():
    if os.name != 'nt':
        return False
    try:
        for title in ('像素工坊 · PIXEL WORKSHOP', '像素工坊'):
            hwnd = ctypes.windll.user32.FindWindowW(None, title)
            if hwnd:
                ctypes.windll.user32.ShowWindow(hwnd, 9)
                ctypes.windll.user32.SetForegroundWindow(hwnd)
                return True
    except Exception:
        pass
    return False


def main():
    started = False
    server = None
    try:
        if not server_ok():
            if port_open():
                message('端口 %d 已被其他程序占用，无法启动像素工坊。' % PORT, error=True)
                return 1
            server = start_server()
            started = True
            if not wait_server(server):
                message('本地服务启动失败。\n请检查 Python 是否可用，或查看：\n%s' % LOG, error=True)
                stop_server(server)
                return 1

        browser = find_browser()
        if not browser:
            message('没有找到 Chrome 或 Edge。\n也可以设置环境变量 CLASTAR_BROWSER 指向浏览器 exe。', error=True)
            if started:
                stop_server(server)
            return 1

        args = browser_args(browser)

        if '--check' in sys.argv:
            print(json.dumps({
                'url': URL,
                'browser': str(browser),
                'profile': str(PROFILE),
                'server_started': started,
                'kiosk_args': args,
            }, ensure_ascii=False, indent=2))
            if started:
                stop_server(server)
            return 0

        if '--dry-run' in sys.argv:
            print(' '.join('"%s"' % a if ' ' in a else a for a in args))
            if started:
                stop_server(server)
            return 0

        PROFILE.mkdir(parents=True, exist_ok=True)
        log('launching: ' + ' '.join(args))
        if kiosk_running():
            if activate_existing():
                log('existing kiosk activated')
            else:
                message('像素工坊已经在运行。\n如果看不到窗口，请按 Alt+F4 关闭旧的 kiosk 后再试。')
            return 0

        proc = subprocess.Popen(args, cwd=str(ROOT))
        try:
            proc.wait()
        finally:
            time.sleep(0.4)
            if started and not kiosk_running():
                stop_server(server)
        return 0
    except Exception as err:
        log('launcher error: %r' % (err,))
        message('启动失败：%s\n\n日志：%s' % (err, LOG), error=True)
        if started:
            stop_server(server)
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
