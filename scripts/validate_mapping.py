# -*- coding: utf-8 -*-
"""Validate mapping between 数据安全评估评估准则v1-20260525.xlsx and js/template.js."""
import sys, io, re, json
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
import openpyxl

XLSX = r'C:\data_security\数据安全评估评估准则v1-20260525.xlsx'
TEMPLATE_JS = r'C:\data_security\js\template.js'

# ---- load template.js ----
src = open(TEMPLATE_JS, encoding='utf-8').read()
m = re.search(r'const TEMPLATE\s*=\s*(\[.*\])\s*;?\s*$', src, re.S)
template = json.loads(m.group(1))
print('TEMPLATE items:', len(template))

# ---- load xlsx with merged-cell resolution ----
def sheet_to_rows(ws):
    """Resolve merges (top-left value copied to all cells in range) and return list of dict rows."""
    # build cell map
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
        rowvals = [cells.get((r, c)) for c in range(1, ws.max_column + 1)]
        rows.append(rowvals)
    return rows

def colmap(header):
    """Map header names to column indices (1-based)."""
    hmap = {}
    for i, v in enumerate(header, start=1):
        if v:
            hmap[str(v).strip()] = i
    return hmap

wb = openpyxl.load_workbook(XLSX, data_only=True)
dim_sheets = [ws for ws in wb.worksheets if not ws.title.startswith('结果统计')]
all_rows = []  # merged list of dicts across dimension sheets
for ws in dim_sheets:
    rows = sheet_to_rows(ws)
    header = [str(v).strip() if v else '' for v in rows[0]]
    cm = colmap(header)
    print(f"\nSheet {ws.title}: header={header}")
    print(f"  colmap={cm}")
    sheet_items = []
    for r in range(1, len(rows)):
        vals = rows[r]
        def g(name):
            idx = cm.get(name)
            if not idx: return ''
            v = vals[idx - 1] if idx - 1 < len(vals) else None
            return str(v).strip() if v is not None else ''
        guidance = g('评估指引')
        if not guidance:
            continue
        sheet_items.append({
            'seq': g('序号'), 'l1': g('一级指标'), 'l2': g('二级指标'), 'l3': g('三级指标'),
            'guidance': guidance, 'position': g('评估位置'), 'implement': g('评估实施'),
            'applicable': g('适用对象'), 'record': g('评估记录'), 'result': g('判定结果')
        })
    print(f"  data rows: {len(sheet_items)}")
    all_rows.extend(sheet_items)

print('\nTotal xlsx criteria rows:', len(all_rows))
# seq continuity
seqs = [r['seq'] for r in all_rows if r['seq']]
print('seq first/last:', seqs[0], seqs[-1], '| count with seq:', len(seqs), '| continuous:', all(int(a) == int(b) + 1 for a, b in zip(seqs[1:], seqs[:-1])))

# ---- compare with template in order ----
print('\n--- per-sheet order comparison vs TEMPLATE ---')
l1s = [r['l1'] for r in all_rows]
print('l1 sequence:', l1s[0], '...', l1s[-1])
mismatch_l1l2l3 = 0
mismatch_guidance = 0
guidance_notes = []
pos_count = sum(1 for r in all_rows if r['position'])
impl_count = sum(1 for r in all_rows if r['implement'])
rec_count = sum(1 for r in all_rows if r['record'])
res_count = sum(1 for r in all_rows if r['result'])
print('position filled:', pos_count, '| implement filled:', impl_count, '| record filled:', rec_count, '| result filled:', res_count)
from collections import Counter
print('result distribution:', Counter(r['result'] for r in all_rows))
print('applicable distribution:', Counter(r['applicable'] for r in all_rows))

if len(all_rows) == len(template):
    for i, (r, t) in enumerate(zip(all_rows, template)):
        if (r['l1'], r['l2'], r['l3']) != (t['l1'], t['l2'], t['l3']):
            mismatch_l1l2l3 += 1
            if mismatch_l1l2l3 <= 5:
                print(f"  [L1/L2/L3 mismatch] idx {i}: xlsx=({r['l1']}|{r['l2']}|{r['l3']}) tpl=({t['l1']}|{t['l2']}|{t['l3']})")
        if r['guidance'] != t['guidance']:
            mismatch_guidance += 1
            if len(guidance_notes) < 8:
                guidance_notes.append((i, t['guidance'][:40], r['guidance'][:40]))
    print('l1/l2/l3 mismatches:', mismatch_l1l2l3)
    print('guidance mismatches:', mismatch_guidance)
    for i, a, b in guidance_notes:
        print(f'  idx {i}: tpl="{a}" vs xlsx="{b}"')
else:
    print('!!! ROW COUNT MISMATCH', len(all_rows), 'vs', len(template))

# applicable differences
print('\n--- applicable differences (xlsx vs template) ---')
diff_count = 0
for i, (r, t) in enumerate(zip(all_rows, template)):
    if r['applicable'] != t['applicable']:
        diff_count += 1
        if diff_count <= 10:
            print(f'  idx {i}: tpl="{t["applicable"]}" xlsx="{r["applicable"]}"')
print('applicable diffs:', diff_count)
