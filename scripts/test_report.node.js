// Node 端回归测试：报告生成（测评结论 + 整改建议）
// 运行： node scripts/test_report.node.js
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');

// xlsx-js-style 的 Node 分支需要 cpexcel，用空桩替代
const Module = require('module');
const _origLoad = Module._load;
Module._load = function (request) {
    if (request === './cpexcel.js') return {};
    return _origLoad.apply(this, arguments);
};
const XLSX = require(path.join(ROOT, 'vendor', 'xlsx-js-style.min.js'));
global.XLSX = XLSX;

// 模板与运行环境桩
const TEMPLATE = JSON.parse(fs.readFileSync(path.join(ROOT, 'js', 'template.js'), 'utf-8')
    .match(/const TEMPLATE\s*=\s*(\[.*\])\s*;?\s*$/s)[1]);
global.TEMPLATE = TEMPLATE;
let rev = 1;
global.getProjectRev = () => rev;

// 载入被测模块（report.js 依赖 storage.js 的 getProjectCriteria）
['stats.js', 'storage.js', 'criteria-import.js', 'report.js'].forEach(f => {
    vm.runInThisContext(fs.readFileSync(path.join(ROOT, 'js', f), 'utf-8'), { filename: f });
});

let failed = 0;
function assert(cond, msg) {
    if (cond) console.log('✓', msg);
    else { console.error('✗ FAIL:', msg); failed++; }
}

function loadProjectFromXlsx() {
    const file = path.join(ROOT, '数据安全评估评估准则v1-20260525.xlsx');
    const buf = fs.readFileSync(file);
    const parsed = parseCriteriaWorkbook(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
    parsed.sourceName = path.basename(file);
    const project = buildProjectFromCriteria(parsed, {
        name: '准则导入示例项目', target: '某某单位', evaluator: '测试员', date: '2026-08-19'
    });
    project.id = 'report-test';
    return project;
}

function exitCodeOf() { return failed === 0 ? 0 : 1; }

// ===== 场景一：真实准则数据（含 7 项不符合、263 项部分符合）=====
console.log('\n--- 场景一：导入准则 Excel 的项目 ---');
const project = loadProjectFromXlsx();
rev++;
const model = buildReportModel(project);
const s = model.stats;

assert(s.fail === 7 && s.partial === 263, `统计正确（不符合 ${s.fail}，部分符合 ${s.partial}）`);
assert(model.plan.all.length === s.fail + s.partial, `整改清单覆盖全部不符合与部分符合项（${model.plan.all.length} 项）`);
assert(model.plan.p1.length + model.plan.p2.length + model.plan.p3.length === model.plan.all.length,
    `优先级分组数量守恒（P1 ${model.plan.p1.length} / P2 ${model.plan.p2.length} / P3 ${model.plan.p3.length}）`);
assert(model.plan.p3.length === s.partial, '部分符合项全部归入 P3 持续改进');
assert(['符合', '基本符合', '部分符合', '不符合'].includes(model.conclusion.label),
    `得出测评结论：${model.conclusion.label} / 风险等级 ${model.conclusion.risk}（得分 ${s.score}）`);
assert(model.conclusion.reasons.length >= 3, `结论包含判定依据（${model.conclusion.reasons.length} 条）`);
assert(model.dimensions.length >= 4, `包含各维度结论（${model.dimensions.length} 个维度）`);

// 每一条整改项都必须有：问题描述、至少1条措施、至少1条依据、合法优先级、可追溯原文
let badEntry = null;
model.plan.all.forEach(e => {
    if (!e.issue || !e.actions.length || !e.basis.length || !['P1', 'P2', 'P3'].includes(e.priority)
        || !e.guidance || !e.l1 || !e.l2 || !e.l3) {
        if (!badEntry) badEntry = e;
    }
});
assert(!badEntry, '每条整改项均含问题描述/整改措施/规范依据/优先级/指标原文' +
    (badEntry ? `（异常项 ${badEntry.seq}）` : ''));

// 依据键必须都能解析成可读引用
const rawBasisKeys = [];
model.plan.all.forEach(e => e.basis.forEach(b => {
    if (!CITE[b] && !REPORT_STANDARDS[b]) rawBasisKeys.push(b);
}));
assert(rawBasisKeys.length === 0, `规范依据全部可解析（未解析: ${rawBasisKeys.slice(0, 5).join(',') || '无'}）`);

// 关键词命中质量：抽样检查若干条是否命中专项规则（而非全部落到基线兜底）
const baselineIds = ['base-gov', 'base-act', 'base-tech', 'base-pi', 'base-any'];
const specific = model.plan.all.filter(e => !e.ruleIds.every(id => baselineIds.includes(id)));
assert(specific.length / model.plan.all.length > 0.8,
    `专项规则命中率 ${(specific.length / model.plan.all.length * 100).toFixed(1)}%（${specific.length}/${model.plan.all.length}）`);

// 渲染
const md = renderReportMarkdown(model);
const html = renderReportHtml(model);
assert(md.includes('## 二、测评结论') && md.includes('整改措施') && md.includes('规范依据'),
    'Markdown 报告包含结论与整改建议章节');
assert(md.includes('P1 立即整改') && md.includes('P3 持续改进'), 'Markdown 报告包含优先级分组');
assert(!/undefined|null\]/.test(md), 'Markdown 报告无 undefined 泄漏');
assert(html.startsWith('<!DOCTYPE html>') && html.includes('</html>'), 'HTML 报告结构完整');
assert(html.includes('测评结论') && html.includes('整改措施') && html.includes('规范依据'), 'HTML 报告包含结论与整改建议');
assert(!html.includes('undefined'), 'HTML 报告无 undefined 泄漏');
assert((html.match(/<table>/g) || []).length === (html.match(/<\/table>/g) || []).length, 'HTML 表格标签配对');
assert((html.match(/<div/g) || []).length === (html.match(/<\/div>/g) || []).length, 'HTML div 标签配对');
console.log(`   报告规模：Markdown ${(md.length / 1024).toFixed(1)} KB / HTML ${(html.length / 1024).toFixed(1)} KB`);

// 高风险项应优先
const p1Applicable = model.plan.p1.filter(e => (e.applicable || '').includes('重要数据'));
console.log(`   P1 中涉及重要数据的项：${p1Applicable.length} 项（示例：${p1Applicable[0] ? p1Applicable[0].guidance.slice(0, 30) + '…' : '无'}）`);

// ===== 场景二：全部符合 =====
console.log('\n--- 场景二：全部符合 ---');
rev++;
const okProject = { id: 'all-pass', name: '全通过', target: 'X', items: {} };
TEMPLATE.forEach((_, i) => { okProject.items[i] = { record: '', result: '符合' }; });
const okModel = buildReportModel(okProject);
assert(okModel.conclusion.label === '符合' && okModel.conclusion.risk === '低风险',
    `结论为「符合 / 低风险」（得分 ${okModel.stats.score}）`);
assert(okModel.plan.all.length === 0, '无整改项');
const okMd = renderReportMarkdown(okModel);
assert(!okMd.includes('五、P1 立即整改项'), '无整改项时不输出空章节');
assert(okMd.includes('## 二、测评结论'), '仍输出结论章节');

// ===== 场景三：全部不符合（含重要数据适用项）=====
console.log('\n--- 场景三：全部不符合 ---');
rev++;
const badProject = { id: 'all-fail', name: '全不通过', target: 'Y', items: {} };
TEMPLATE.forEach((_, i) => { badProject.items[i] = { record: '', result: '不符合' }; });
const badModel = buildReportModel(badProject);
assert(badModel.conclusion.label === '不符合' && badModel.conclusion.risk === '高风险',
    `结论为「不符合 / 高风险」（得分 ${badModel.stats.score}）`);
assert(badModel.plan.all.length === TEMPLATE.length, `全部 ${TEMPLATE.length} 项进入整改清单`);
assert(badModel.plan.p1.length > 0 && badModel.plan.p2.length > 0, `优先级区分正常（P1 ${badModel.plan.p1.length} / P2 ${badModel.plan.p2.length}）`);
assert(badModel.conclusion.importantFail > 0, `识别出涉及重要数据的不符合项 ${badModel.conclusion.importantFail} 项并上调风险等级`);

// ===== 场景四：空项目 =====
console.log('\n--- 场景四：无评估记录 ---');
rev++;
const emptyModel = buildReportModel({ id: 'empty', name: '空', target: 'Z', items: {} });
assert(emptyModel.plan.all.length === 0, '无评估记录时无整改项');
assert(emptyModel.conclusion.reasons.some(r => r.includes('未评估')), '提示存在未评估项');
assert(renderReportHtml(emptyModel).includes('</html>'), '空项目仍能生成报告');

console.log(failed === 0 ? '\nALL PASS' : `\n${failed} FAILED`);
process.exit(exitCodeOf());
