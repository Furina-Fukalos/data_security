# -*- coding: utf-8 -*-
"""
评估模板数据同步工具（单一数据源）

数据源：data/template_data.json   （唯一需要维护的文件）
生成物：js/template.js            （浏览器同步加载，由本脚本生成）

用法：
    python scripts/sync_template.py            # 由 JSON 生成 js/template.js
    python scripts/sync_template.py --check    # 仅校验两者是否一致（不写文件）

说明：
    历史做法是「手工维护 template.js 与 template_data.json 两份，需保持一致」。
    现改为单一数据源 + 生成，避免两份数据漂移：
        - 准则导入（import_criteria.py --emit-json / 浏览器导入）更新 JSON；
        - 本脚本把 JSON 生成为浏览器用的 template.js。
"""
import io
import os
import re
import sys
import json
import argparse

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

ROOT = os.path.normpath(os.path.join(os.path.dirname(__file__), '..'))
JSON_PATH = os.path.join(ROOT, 'data', 'template_data.json')
JS_PATH = os.path.join(ROOT, 'js', 'template.js')

REQUIRED_KEYS = ('l1', 'l2', 'l3', 'guidance')


def load_json():
    with open(JSON_PATH, 'r', encoding='utf-8') as f:
        return json.load(f)


def validate(items):
    errors = []
    if not isinstance(items, list):
        return ['模板数据根节点必须是数组']
    if len(items) == 0:
        errors.append('模板数据为空')
    for i, it in enumerate(items):
        for k in REQUIRED_KEYS:
            if k not in it:
                errors.append(f'第 {i} 项缺少字段 {k}')
        if not it.get('guidance'):
            errors.append(f'第 {i} 项评估指引为空')
    return errors


def render_js(items):
    # 紧凑格式（与 data/template_data.json 一致，体积更小）
    body = ',\n'.join(json.dumps(i, ensure_ascii=False, separators=(',', ':')) for i in items)
    return 'const TEMPLATE = [\n' + body + '\n];\n'


def read_js_items():
    """从现有 js/template.js 中解析出数组（用于 --check 比对）"""
    with open(JS_PATH, 'r', encoding='utf-8') as f:
        src = f.read()
    m = re.search(r'const TEMPLATE\s*=\s*(\[.*\])\s*;?\s*$', src, re.S)
    if not m:
        return None
    try:
        return json.loads(m.group(1))
    except json.JSONDecodeError:
        return None


def summarize(items, title):
    from collections import Counter
    l1 = Counter(it.get('l1', '') for it in items)
    pos = sum(1 for it in items if it.get('position'))
    impl = sum(1 for it in items if it.get('implement'))
    print(f'{title}: {len(items)} 项')
    for k, v in l1.items():
        print(f'    - {k}: {v} 项')
    print(f'    含评估位置提示: {pos} 项 | 含评估实施提示: {impl} 项')


def main():
    ap = argparse.ArgumentParser(description='评估模板数据同步工具（JSON → template.js）')
    ap.add_argument('--check', action='store_true', help='仅校验是否一致，不写文件')
    args = ap.parse_args()

    print('=' * 60)
    print('评估模板数据同步')
    print('=' * 60)

    items = load_json()
    errors = validate(items)
    if errors:
        print('\n[错误] data/template_data.json 校验未通过：')
        for e in errors[:20]:
            print('  -', e)
        return 1
    summarize(items, '数据源 data/template_data.json')

    expected = render_js(items)
    current = None
    if os.path.exists(JS_PATH):
        with open(JS_PATH, 'r', encoding='utf-8') as f:
            current = f.read()

    if args.check:
        same = current == expected
        print(f'\njs/template.js 与数据源{"一致 ✓" if same else "不一致 ✗"}')
        if not same:
            js_items = read_js_items()
            if js_items is not None and len(js_items) != len(items):
                print(f'  条目数不同：template.js {len(js_items)} vs JSON {len(items)}')
            print('  请运行 python scripts/sync_template.py 重新生成')
        return 0 if same else 1

    if current == expected:
        print('\njs/template.js 已是最新，无需变更。')
        return 0

    with open(JS_PATH, 'w', encoding='utf-8') as f:
        f.write(expected)
    print(f'\n✓ 已由数据源生成 js/template.js（{len(items)} 项，{len(expected.encode("utf-8")):,} 字节）')
    return 0


if __name__ == '__main__':
    sys.exit(main())
