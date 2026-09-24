# -*- coding: utf-8 -*-
"""
数据安全评估准则 Excel 导入工具（离线版）

用法：
    python scripts/import_criteria.py <准则Excel路径> [--emit-json] [--emit-js]

功能：
    1. 解析《数据安全评估评估准则*.xlsx》中的四个维度工作表（自动处理合并单元格），
       得到与系统内置模板一一对应的 477 条评估项；
    2. 与 js/template.js 按顺序校验对齐情况（一级/二级/三级指标、评估指引）；
    3. 生成“覆盖字段”：评估位置(position)、评估实施(implement)、适用对象(applicable)；
    4. --emit-json：将合并后的准则写入 data/template_data.json（供 scripts/export_excel.py 使用）；
    5. --emit-js  ：将合并后的准则写入 js/template.js（覆盖内置准则，请谨慎使用）。

说明：
    - 浏览器内的「📥 导入准则Excel」功能同样支持导入本项目，且可将文件导入为评估项目
      （填充评估记录与判定结果）。本脚本只处理“准则模板”部分。
    - 判定结果归一化：基本符合 -> 部分符合；不适用 保留（系统已支持该判定值）。
"""
import sys
import io
import os
import re
import json
import argparse

import openpyxl

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

ROOT = os.path.normpath(os.path.join(os.path.dirname(__file__), '..'))
TEMPLATE_JS = os.path.join(ROOT, 'js', 'template.js')
TEMPLATE_DATA_JSON = os.path.join(ROOT, 'data', 'template_data.json')


# ---------- 解析 ----------
def sheet_to_rows(ws):
    """解析工作表为矩阵，并前向填充合并单元格（一/二/三级指标列为纵向合并）。"""
    cells = {}
    for row in ws.iter_rows():
        for c in row:
            if c.value is not None and str(c.value).strip() != '':
                cells[(c.row, c.column)] = c.value
    for rng in ws.merged_cells.ranges:
        tl = (rng.min_row, rng.min_col)
        if tl in cells:
            v = cells[tl]
            for r in range(rng.min_row, rng.max_row + 1):
                for c in range(rng.min_col, rng.max_col + 1):
                    cells.setdefault((r, c), v)
    rows = []
    for r in range(1, ws.max_row + 1):
        rows.append([cells.get((r, c)) for c in range(1, ws.max_column + 1)])
    return rows


def colmap(header):
    cm = {}
    for i, v in enumerate(header, start=1):
        s = str(v).strip() if v else ''
        if s:
            cm[s] = i
    return cm


def parse_workbook(path):
    wb = openpyxl.load_workbook(path, data_only=True)
    items = []
    sheets = []
    for ws in wb.worksheets:
        if ws.title.startswith('结果统计'):
            continue
        rows = sheet_to_rows(ws)
        if not rows:
            continue
        header = [str(v).strip() if v else '' for v in rows[0]]
        cm = colmap(header)
        if '评估指引' not in cm:
            continue
        sheet_items = []
        for vals in rows[1:]:
            def g(name):
                idx = cm.get(name)
                if not idx or idx - 1 >= len(vals):
                    return ''
                v = vals[idx - 1]
                return str(v).strip() if v is not None else ''
            guidance = g('评估指引')
            if not guidance:
                continue
            sheet_items.append({
                'seq': g('序号'),
                'l1': g('一级指标'), 'l2': g('二级指标'), 'l3': g('三级指标'),
                'guidance': guidance,
                'position': g('评估位置'), 'implement': g('评估实施'),
                'applicable': g('适用对象'),
                'record': g('评估记录'),
                'result': normalize_result(g('判定结果')),
            })
        if sheet_items:
            sheets.append({'name': ws.title, 'items': sheet_items})
            items.extend(sheet_items)
    return sheets, items


def normalize_result(v):
    if v == '基本符合':
        return '部分符合'
    return v


# ---------- 模板 ----------
def load_template_js(path):
    src = open(path, encoding='utf-8').read()
    m = re.search(r'const TEMPLATE\s*=\s*(\[.*\])\s*;?\s*$', src, re.S)
    if not m:
        raise SystemExit('无法解析 ' + path)
    return json.loads(m.group(1))


def build_enriched(items, template):
    """按顺序合并：position/implement 取自文件，applicable 以文件为准（结构匹配时）。"""
    enriched = []
    overrides = 0
    for idx, tpl in enumerate(template):
        entry = dict(tpl)
        if idx < len(items):
            it = items[idx]
            if (it['l1'], it['l2'], it['l3']) != (tpl.get('l1'), tpl.get('l2'), tpl.get('l3')):
                enriched.append(entry)  # 结构不匹配，保留内置
                continue
            if it['position']:
                entry['position'] = it['position']
            if it['implement']:
                entry['implement'] = it['implement']
            if it['applicable'] != (tpl.get('applicable') or ''):
                entry['applicable'] = it['applicable']
                overrides += 1
        enriched.append(entry)
    return enriched, overrides


def compact_json(items):
    return '[\n' + ',\n'.join(json.dumps(i, ensure_ascii=False) for i in items) + '\n]\n'


def main():
    ap = argparse.ArgumentParser(description='数据安全评估准则 Excel 导入工具')
    ap.add_argument('xlsx', nargs='?', default=os.path.join(ROOT, '数据安全评估评估准则v1-20260525.xlsx'),
                    help='准则Excel文件路径')
    ap.add_argument('--emit-json', action='store_true', help='将合并后的准则写入 data/template_data.json')
    ap.add_argument('--emit-js', action='store_true', help='将合并后的准则写入 js/template.js（覆盖内置准则）')
    args = ap.parse_args()

    if not os.path.exists(args.xlsx):
        raise SystemExit(f'文件不存在: {args.xlsx}')

    print('=' * 70)
    print('数据安全评估准则 Excel 导入工具')
    print('=' * 70)
    print(f'文件: {args.xlsx}')

    sheets, items = parse_workbook(args.xlsx)
    print(f'\n识别维度工作表 {len(sheets)} 个，评估项 {len(items)} 条：')
    for s in sheets:
        print(f'  - {s["name"]}: {len(s["items"])} 项')

    template = load_template_js(TEMPLATE_JS)
    print(f'\n系统内置模板: {len(template)} 项')

    # 对齐校验
    tree_mismatch = 0
    for idx, it in enumerate(items):
        tpl = template[idx]
        if (it['l1'], it['l2'], it['l3']) != (tpl['l1'], tpl['l2'], tpl['l3']):
            tree_mismatch += 1
            if tree_mismatch <= 5:
                print(f'  [结构不一致] 第{idx}项: 文件=({it["l1"]}|{it["l2"]}|{it["l3"]}) '
                      f'内置=({tpl["l1"]}|{tpl["l2"]}|{tpl["l3"]})')
    guidance_mismatch = sum(1 for idx, it in enumerate(items)
                            if it['guidance'] != template[idx]['guidance'])
    pos_n = sum(1 for it in items if it['position'])
    impl_n = sum(1 for it in items if it['implement'])
    from collections import Counter
    res_dist = Counter(it['result'] for it in items)

    print(f'\n校验结果:')
    print(f'  条数对齐: {"✓" if len(items) == len(template) else "✗"} '
          f'({len(items)} / {len(template)})')
    print(f'  树结构一致: {"✓" if tree_mismatch == 0 else "✗"} (不一致 {tree_mismatch} 处)')
    print(f'  评估指引一致: {"✓" if guidance_mismatch == 0 else "✗"} (不一致 {guidance_mismatch} 处)')
    print(f'  评估位置提示: {pos_n} 条 | 评估实施提示: {impl_n} 条')
    print(f'  判定结果分布(归一化后): ' + ', '.join(f'{k}:{v}' for k, v in res_dist.items()))

    if len(items) != len(template) or tree_mismatch > 0:
        print('\n⚠ 文件与内置模板未完全对齐，为避免错误覆盖，已停止写入。'
              '请检查文件是否为同一套评估准则。')
        return

    enriched, app_overrides = build_enriched(items, template)
    print(f'\n适用对象标注修正: {app_overrides} 处（将以文件为准）')

    if args.emit_json or args.emit_js:
        if args.emit_json:
            with open(TEMPLATE_DATA_JSON, 'w', encoding='utf-8') as f:
                f.write(compact_json(enriched))
            print(f'✓ 已写入 data/template_data.json（{len(enriched)} 项，含 position/implement）')
            # 数据源已更新 → 自动同步浏览器端模板，避免两份数据漂移
            try:
                import sync_template
                with open(sync_template.JS_PATH, 'w', encoding='utf-8') as f:
                    f.write(sync_template.render_js(enriched))
                print(f'✓ 已同步生成 js/template.js（{len(enriched)} 项）')
            except Exception as e:
                print(f'⚠ 自动同步 js/template.js 失败（{e}），请手动运行 python scripts/sync_template.py')
        if args.emit_js:
            js_content = 'const TEMPLATE = ' + compact_json(enriched).rstrip('\n') + ';\n'
            with open(TEMPLATE_JS, 'w', encoding='utf-8') as f:
                f.write(js_content)
            print(f'✓ 已覆盖 js/template.js（内置准则已更新，请同步浏览器测试）')
    else:
        print('\n（未写入文件。如需同步到 data/template_data.json 请加 --emit-json；'
              '覆盖内置模板 js/template.js 请加 --emit-js）')


if __name__ == '__main__':
    main()
