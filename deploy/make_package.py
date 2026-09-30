# -*- coding: utf-8 -*-
"""
数据安全管理评估系统 —— 部署包打包工具

用法：
    python deploy/make_package.py                 # 生成 dist/data_security_site.tar.gz 与 .zip
    python deploy/make_package.py --zip-only      # 只生成 zip
    python deploy/make_package.py --out D:\\tmp

产物结构（自包含，解压即可部署）：
    data_security_site/
    ├── index.html  user-management.html
    ├── css/  js/  vendor/  assets/        # 站点运行文件
    ├── nginx.conf                         # 站点配置
    ├── deploy.sh                          # ECS 一键部署脚本（LF 行尾，可直接 bash 执行）
    └── 部署说明.md                        # 部署指南
"""
import io
import os
import re
import shutil
import sys
import tarfile
import tempfile
import zipfile
import argparse

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
PKG_NAME = 'data_security_site'

# 站点运行必需的文件/目录
SITE_ITEMS = ['index.html', 'user-management.html', 'css', 'js', 'vendor', 'assets']
# 附加文件：(源路径, 包内路径)
EXTRA_FILES = [
    ('deploy/nginx.conf', 'nginx.conf'),
    ('deploy/deploy.sh', 'deploy.sh'),
    ('start_server.py', 'start_server.py'),
    ('docs/阿里云ECS部署指南.md', '部署说明.md'),
]
# 需要改写路径的 Docker 部署文件（仓库布局 → 包内布局）
REWRITE_FILES = [
    ('deploy/Dockerfile', 'Dockerfile'),
    ('docker-compose.yml', 'docker-compose.yml'),
]
# 路径改写规则：包内去掉了 deploy/ 前缀
PATH_REWRITES = [('deploy/nginx.conf', 'nginx.conf'), ('deploy/Dockerfile', 'Dockerfile')]
# 必须存在（否则打包视为失败）
REQUIRED = [
    'index.html', 'css/style.css', 'js/template.js', 'js/report-import.js',
    'vendor/pdf.min.js', 'vendor/pdf.worker.min.js', 'assets/logo1-default.png',
]
# 需要统一为 LF 行尾的文件（Linux 下直接执行/加载）
LF_FILES = {'deploy.sh', 'nginx.conf'}


def human(n):
    for unit in ('B', 'KB', 'MB', 'GB'):
        if n < 1024 or unit == 'GB':
            return f'{n:,.1f} {unit}' if unit != 'B' else f'{n:,} B'
        n /= 1024.0


def check_required():
    missing = [p for p in REQUIRED if not os.path.exists(os.path.join(ROOT, p))]
    if missing:
        print('[错误] 缺少站点必需文件：')
        for m in missing:
            print('   -', m)
        return False
    return True


def _copy_file(src, dst):
    """复制单个文件；shell/配置类文件统一 LF 行尾"""
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    if os.path.basename(src) in LF_FILES:
        with open(src, 'rb') as f:
            data = f.read().replace(b'\r\n', b'\n')
        with open(dst, 'wb') as f:
            f.write(data)
    else:
        shutil.copy2(src, dst)


def copy_tree(src, dst):
    """把 src（文件或目录）复制为完整目标路径 dst"""
    if os.path.isfile(src):
        _copy_file(src, dst)
        return
    os.makedirs(dst, exist_ok=True)
    for entry in sorted(os.listdir(src)):
        if entry.startswith('.'):
            continue
        copy_tree(os.path.join(src, entry), os.path.join(dst, entry))


def list_files(base):
    out = []
    for dirpath, _dirnames, filenames in os.walk(base):
        for fn in filenames:
            full = os.path.join(dirpath, fn)
            out.append((os.path.relpath(full, base), os.path.getsize(full)))
    return sorted(out)


def make_tar(stage_parent, target):
    with tarfile.open(target, 'w:gz') as tar:
        tar.add(os.path.join(stage_parent, PKG_NAME), arcname=PKG_NAME)


def make_zip(stage_parent, target):
    root_dir = os.path.join(stage_parent, PKG_NAME)
    with zipfile.ZipFile(target, 'w', zipfile.ZIP_DEFLATED) as zf:
        for dirpath, _dirnames, filenames in os.walk(root_dir):
            for fn in sorted(filenames):
                full = os.path.join(dirpath, fn)
                zf.write(full, os.path.relpath(full, stage_parent))


def main():
    ap = argparse.ArgumentParser(description='生成 ECS 部署包')
    ap.add_argument('--out', default=os.path.join(ROOT, 'dist'), help='输出目录（默认 dist/）')
    ap.add_argument('--tar-only', action='store_true', help='只生成 tar.gz')
    ap.add_argument('--zip-only', action='store_true', help='只生成 zip')
    args = ap.parse_args()

    print('=' * 62)
    print(' 数据安全管理评估系统 —— 部署包打包')
    print('=' * 62)
    print(f' 项目根目录: {ROOT}')
    if not check_required():
        return 1

    stage_parent = tempfile.mkdtemp(prefix='ds_pack_')
    stage = os.path.join(stage_parent, PKG_NAME)
    os.makedirs(stage, exist_ok=True)
    try:
        # 1) 站点运行文件
        for item in SITE_ITEMS:
            src = os.path.join(ROOT, item)
            if not os.path.exists(src):
                print(f'[警告] 跳过不存在的项: {item}')
                continue
            copy_tree(src, os.path.join(stage, item))

        # 2) 部署脚本 / 配置 / 说明
        for src_rel, dst_rel in EXTRA_FILES:
            src = os.path.join(ROOT, src_rel)
            if not os.path.exists(src):
                print(f'[警告] 缺少附加文件: {src_rel}（已跳过）')
                continue
            _copy_file(src, os.path.join(stage, dst_rel))

        # 3) Docker 部署文件（改写为包内布局，使 tar 包同时支持 Nginx 与 Docker 部署）
        for src_rel, dst_rel in REWRITE_FILES:
            src = os.path.join(ROOT, src_rel)
            if not os.path.exists(src):
                print(f'[警告] 缺少 Docker 文件: {src_rel}（已跳过）')
                continue
            with open(src, 'r', encoding='utf-8') as f:
                text = f.read()
            for old, new in PATH_REWRITES:
                text = text.replace(old, new)
            with open(os.path.join(stage, dst_rel), 'w', encoding='utf-8', newline='\n') as f:
                f.write(text)

        files = list_files(stage)
        total = sum(sz for _p, sz in files)
        print(f'\n 打包内容: {len(files)} 个文件，解压后 {human(total)}')
        for name, size in files[:6]:
            print(f'   - {name}  ({human(size)})')
        if len(files) > 6:
            print(f'   ... 其余 {len(files) - 6} 个文件')

        # 3) 生成压缩包
        out_dir = args.out
        os.makedirs(out_dir, exist_ok=True)
        made = []
        if not args.zip_only:
            tar_path = os.path.join(out_dir, PKG_NAME + '.tar.gz')
            make_tar(stage_parent, tar_path)
            made.append(tar_path)
        if not args.tar_only:
            zip_path = os.path.join(out_dir, PKG_NAME + '.zip')
            make_zip(stage_parent, zip_path)
            made.append(zip_path)

        print('\n 生成的部署包:')
        for p in made:
            print(f'   ✓ {p}  ({human(os.path.getsize(p))})')

        print('\n 下一步（三选一）:')
        print('   A) 上传到 ECS 用 Nginx 部署（推荐）:')
        print(f'        scp {os.path.basename(made[0])} root@<ECS公网IP>:/root/')
        print( '        ssh root@<ECS公网IP>')
        print(f'        tar -xzf {os.path.basename(made[0])} && cd {PKG_NAME}')
        print( '        sudo bash deploy.sh 8080        # 端口可换，如 80')
        print('   B) ECS 已装 Docker:')
        print(f'        tar -xzf {os.path.basename(made[0])} && cd {PKG_NAME}')
        print( '        docker compose up -d --build    # 默认 8080 端口')
        print('   C) 只想本地/临时验证: 解压后 python3 start_server.py --host 0.0.0.0 --port 8080')
        print('\n 提醒: 无论哪种方式，都要在阿里云「安全组」入方向放行所用端口。')
        return 0
    finally:
        shutil.rmtree(stage_parent, ignore_errors=True)


if __name__ == '__main__':
    sys.exit(main())
