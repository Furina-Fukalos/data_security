# -*- coding: utf-8 -*-
"""
数据安全评估系统 —— 一键启动器

在系统根目录启动本地 HTTP 服务，并自动打开浏览器访问系统页面。
支持从「启动系统.bat」双击调用，也可手动运行：

    python start_server.py [--port 8000] [--host 127.0.0.1] [--no-browser]

说明：
    - 服务仅监听本机（默认 127.0.0.1），如需手机/局域网访问请加 --host 0.0.0.0；
    - 关闭运行窗口（或按 Ctrl+C）即停止服务；
    - 端口被占用时自动向后寻找可用端口。
"""
import os
import sys
import socket
import threading
import webbrowser
import argparse
import subprocess
from http.server import HTTPServer, SimpleHTTPRequestHandler

ROOT = os.path.dirname(os.path.abspath(__file__))


def create_shortcut():
    """在桌面创建「启动系统.bat」的快捷方式（通过环境变量传参，避免编码问题）"""
    try:
        import win32com  # noqa: F401  (unused; check importability)
        use_pythoncom = True
    except ImportError:
        use_pythoncom = False

    shortcut_path = os.path.join(os.path.expanduser('~'), 'Desktop', '数据安全评估系统.lnk')
    target = os.path.join(ROOT, '启动系统.bat')

    if use_pythoncom:
        # 优先用 pywin32（如已安装），否则退回 PowerShell
        import pythoncom
        from win32com.client import Dispatch
        pythoncom.CoInitialize()
        shell = Dispatch('WScript.Shell')
        lnk = shell.CreateShortCut(shortcut_path)
        lnk.Targetpath = target
        lnk.WorkingDirectory = ROOT
        lnk.IconLocation = r'%SystemRoot%\System32\shell32.dll,134'
        lnk.Description = '数据安全评估系统 - 一键启动'
        lnk.save()
    else:
        ps = r"""
$ws = New-Object -ComObject WScript.Shell
$lnk = $ws.CreateShortcut($env:DSH_SC_PATH)
$lnk.TargetPath = $env:DSH_SC_TARGET
$lnk.WorkingDirectory = $env:DSH_SC_WORKDIR
$lnk.IconLocation = "$env:SystemRoot\System32\shell32.dll,134"
$lnk.Description = "Data Security Evaluation System - launcher"
$lnk.Save()
"""
        env = os.environ.copy()
        env['DSH_SC_PATH'] = shortcut_path
        env['DSH_SC_TARGET'] = target
        env['DSH_SC_WORKDIR'] = ROOT
        subprocess.run(
            ['powershell', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', ps],
            env=env, check=True, capture_output=True)

    print('已在桌面创建快捷方式：「数据安全评估系统」')
    print('以后双击桌面图标即可启动系统。')
    return 0


class Handler(SimpleHTTPRequestHandler):
    # 补充常见文件类型的 MIME（保证中文与二进制文件正确加载/下载）
    extensions_map = dict(SimpleHTTPRequestHandler.extensions_map, **{
        '.js': 'text/javascript; charset=utf-8',
        '.mjs': 'text/javascript; charset=utf-8',
        '.json': 'application/json; charset=utf-8',
        '.html': 'text/html; charset=utf-8',
        '.css': 'text/css; charset=utf-8',
        '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        '.png': 'image/png',
    })

    def end_headers(self):
        # 开发用途：禁用缓存，修改代码后刷新即可生效
        self.send_header('Cache-Control', 'no-cache')
        super().end_headers()

    def log_message(self, fmt, *args):
        try:
            sys.stdout.write('[%s] %s\n' % (self.log_date_time_string(), fmt % args))
            sys.stdout.flush()
        except Exception:
            pass


def find_free_port(start):
    for port in range(start, start + 20):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            try:
                s.bind(('127.0.0.1', port))
                return port
            except OSError:
                continue
    return None


def main():
    ap = argparse.ArgumentParser(description='数据安全评估系统 一键启动器')
    ap.add_argument('--port', type=int, default=8000, help='起始端口（默认 8000，被占用自动后移）')
    ap.add_argument('--host', default='127.0.0.1', help='监听地址（默认 127.0.0.1，局域网访问用 0.0.0.0）')
    ap.add_argument('--no-browser', action='store_true', help='不自动打开浏览器')
    ap.add_argument('--create-shortcut', action='store_true', help='在桌面创建启动快捷方式后退出')
    args = ap.parse_args()

    if args.create_shortcut:
        return create_shortcut()

    os.chdir(ROOT)

    port = find_free_port(args.port)
    if port is None:
        print('[错误] 端口 %d-%d 均被占用，请关闭占用程序后重试。' % (args.port, args.port + 19))
        input('按回车键退出...')
        return 1

    display_host = '127.0.0.1' if args.host in ('127.0.0.1', 'localhost') else args.host
    url = 'http://%s:%d/index.html' % (display_host, port)

    try:
        server = HTTPServer((args.host, port), Handler)
    except OSError as e:
        print('[错误] 无法启动服务：%s' % e)
        input('按回车键退出...')
        return 1

    if not args.no_browser:
        threading.Timer(0.6, lambda: webbrowser.open(url)).start()

    print('=' * 54)
    print('   数据安全评估系统 已启动')
    print('   访问地址: %s' % url)
    if args.host not in ('127.0.0.1', 'localhost'):
        print('   本机地址: http://127.0.0.1:%d/index.html' % port)
    print('   关闭本窗口即可停止服务')
    print('=' * 54)

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
    return 0


if __name__ == '__main__':
    sys.exit(main())
