// Node 端验证：使用 vendored xlsx-js-style 解析《数据安全评估评估准则v1-20260525.xlsx》，
// 并校验 js/criteria-import.js 的解析/对齐/覆盖逻辑。
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');

// xlsx-js-style 的 Node 分支会 require('./cpexcel.js')（浏览器端不需要），测试时用空桩替代
const Module = require('module');
const _origLoad = Module._load;
Module._load = function (request, parent, isMain) {
    if (request === './cpexcel.js') return {};
    return _origLoad.apply(this, arguments);
};

const XLSX = require(path.join(ROOT, 'vendor', 'xlsx-js-style.min.js'));
global.XLSX = XLSX;

// 1) 提取内置模板
const tplSrc = fs.readFileSync(path.join(ROOT, 'js', 'template.js'), 'utf-8');
const m = tplSrc.match(/const TEMPLATE\s*=\s*(\[.*\])\s*;?\s*$/s);
if (!m) throw new Error('cannot parse template.js');
const TEMPLATE = JSON.parse(m[1]);
global.TEMPLATE = TEMPLATE;

// 2) 加载 criteria-import.js（仅顶层使用 TEMPLATE 快照）
const ciSrc = fs.readFileSync(path.join(ROOT, 'js', 'criteria-import.js'), 'utf-8');
vm.runInThisContext(ciSrc, { filename: 'criteria-import.js' });

// 3) 解析 xlsx
const xlsxPath = path.join(ROOT, '数据安全评估评估准则v1-20260525.xlsx');
const buf = fs.readFileSync(xlsxPath);
const parsed = parseCriteriaWorkbook(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
parsed.sourceName = path.basename(xlsxPath);

console.log('sheets:', parsed.sheets.map(s => `${s.name}=${s.items.length}`).join(', '));
console.log('totalRows:', parsed.totalRows);

const report = matchCriteriaToTemplate(parsed);
console.log('report:', JSON.stringify(report, null, 1));

const overrides = buildCriteriaOverrides(parsed);
console.log('override entries:', Object.keys(overrides).length);

// 校验关键断言
const assert = (cond, msg) => { if (!cond) { console.error('✗ FAIL:', msg); process.exitCode = 1; } else { console.log('✓', msg); } };

assert(parsed.totalRows === 477, 'totalRows = 477');
assert(parsed.sheets.length === 4, '4 dimension sheets');
assert(parsed.sheets[0].items.length === 134 && parsed.sheets[1].items.length === 163
    && parsed.sheets[2].items.length === 94 && parsed.sheets[3].items.length === 86,
    'sheet counts 134/163/94/86');
assert(report.aligned === true, 'aligned with built-in template');
assert(report.treeMismatch === 0, 'no tree mismatch');
assert(report.guidanceMismatch === 0, 'no guidance mismatch');
assert(report.positionCount === 391, 'position count 391');
assert(report.implementCount === 13, 'implement count 13');
assert(report.applicableDiff === 12, 'applicable diff 12');
assert(report.resultDist['部分符合'] === 263, '基本符合→部分符合 = 263');
assert(report.resultDist['符合'] === 47 && report.resultDist['不符合'] === 7
    && report.resultDist['不适用'] === 55 && report.resultDist[''] === 105,
    'result distribution 47/263/7/55/105');
assert(overrides['0'] && overrides['0'].applicable === '', 'idx0 applicable override removes note');
assert(overrides['43'] && overrides['43'].applicable === '重要数据和核心数据处理者', 'idx43 applicable added');
assert(overrides['0'].position && overrides['0'].position.includes('方针'), 'idx0 position present');

// 4) 校验 评估位置/评估实施 注入模板后的效果
const merged = TEMPLATE.map((t, i) => Object.assign({}, t, overrides[i] || {}));
assert(merged[0].position && merged[0].implement !== undefined, 'merged idx0 has position');

// 5) 校验导入为评估项目
const proj = buildProjectFromCriteria(parsed, { name: '测试项目', target: 'XX科技' });
const pItems = Object.values(proj.items);
assert(pItems.length === 477, 'project has 477 items');
assert(pItems.filter(i => i.result).length === 372, '372 items with result');
assert(pItems.filter(i => i.result === '不适用').length === 55, '55 不适用 items');
assert(proj.items[0].result === '符合', 'idx0 result 符合 (record 为空)');
assert(proj.items[137].result === '不适用', 'flat idx137 (seq 138) 不适用');

// 6) 校验 保存覆盖 → 应用 → 恢复 闭环
const store = new Map();
global.localStorage = {
    getItem: k => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: k => store.delete(k)
};
saveCriteriaOverride(parsed, '数据安全评估评估准则v1-20260525.xlsx');
assert(store.has(CRITERIA_STORAGE_KEY), 'override persisted to localStorage');
assert(applyStoredCriteria() === true, 'applyStoredCriteria applies overrides');
assert(TEMPLATE[0].position && TEMPLATE[0].position.indexOf('方针') >= 0, 'TEMPLATE[0].position applied');
assert(TEMPLATE[0].applicable === '', 'TEMPLATE[0].applicable cleared (note removed)');
assert(TEMPLATE[43].applicable === '重要数据和核心数据处理者', 'TEMPLATE[43].applicable applied');
assert(TEMPLATE[477 - 1].implement === undefined, 'last item no implement (sheet4)');
resetTemplateFromBuiltin();
assert(TEMPLATE[0].position === undefined, 'TEMPLATE[0].position restored to builtin');
assert(TEMPLATE[0].applicable === '（有标注的仅适用于特定对象，未作标注的适用于所有对象）　', 'TEMPLATE[0].applicable restored');
assert(TEMPLATE[43].applicable === '', 'TEMPLATE[43].applicable restored');
console.log('\nDONE');
