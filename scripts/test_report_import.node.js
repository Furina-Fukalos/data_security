// Node 端回归测试：报告导入（PDF 解析 → 指标记录识别 → 项目构建）
// 运行： node scripts/test_report_import.node.js
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');

// ---- pdf.js（浏览器 UMD 版在 Node 下可用，需最小 DOM 桩）----
global.window = global;
global.document = {
    currentScript: { src: '' }, documentElement: { style: {} },
    createElement: () => ({ style: {}, getContext: () => null, setAttribute() {} }),
    getElementsByTagName: () => []
};
const pdfjsLib = require(path.join(ROOT, 'vendor', 'pdf.min.js'));
pdfjsLib.GlobalWorkerOptions.workerSrc = path.join(ROOT, 'vendor', 'pdf.worker.min.js');
global.pdfjsLib = pdfjsLib;

// ---- 运行环境桩 ----
const TEMPLATE = JSON.parse(fs.readFileSync(path.join(ROOT, 'js', 'template.js'), 'utf-8')
    .match(/const TEMPLATE\s*=\s*(\[.*\])\s*;?\s*$/s)[1]);
global.TEMPLATE = TEMPLATE;
global.STORAGE_KEY = 'test_projects';
let rev = 1;
global.getProjectRev = () => rev;
global.RESULT_META = null;

// 载入被测模块（stats 提供 RESULT/元数据；storage 提供 getProjectCriteria）
['stats.js', 'storage.js', 'report-import.js'].forEach(f => {
    vm.runInThisContext(fs.readFileSync(path.join(ROOT, 'js', f), 'utf-8'), { filename: f });
});
// report-import.js 末尾未使用 loadLib；此处直接注入已加载的 pdfjs
global.loadLib = () => Promise.resolve(pdfjsLib);

let failed = 0;
function assert(cond, msg) {
    if (cond) console.log('✓', msg);
    else { console.error('✗ FAIL:', msg); failed++; }
}

(async () => {
    const pdfPath = path.join(ROOT, '数据安全风险评估报告v1.6.pdf');
    const buf = fs.readFileSync(pdfPath);
    const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);

    console.log('--- 解析报告 PDF ---');
    const t0 = Date.now();
    const report = await parseReportPdf(ab);
    const secs = ((Date.now() - t0) / 1000).toFixed(1);
    report.sourceName = path.basename(pdfPath);

    const records = report.records.filter(r => r.item);
    console.log(`   页数 ${report.pageCount}，表格页 ${report.range ? report.range[0] + '-' + report.range[1] : '-'}，` +
        `测评项 ${records.length} 条，耗时 ${secs}s`);

    assert(report.pageCount === 112, 'PDF 页数识别正确（112 页）');
    assert(records.length === 101, `识别测评项 101 条（实际 ${records.length}）`);
    assert(report.records.every(r => r.seq >= 1) &&
        Math.max(...report.records.map(r => r.seq)) === 101 &&
        new Set(report.records.map(r => r.seq)).size === 101, '序号 1-101 完整且无重复');

    // 字段完整性
    const emptyItem = records.filter(r => !r.item).length;
    const emptyRecord = records.filter(r => !r.record).length;
    const emptyResult = records.filter(r => !normalizeReportResult(r.result)).length;
    console.log(`   评估项缺失 ${emptyItem} 条，评估记录缺失 ${emptyRecord} 条，判定结果未识别 ${emptyResult} 条`);
    assert(emptyItem === 0, '每条记录的评估项均已解析');
    assert(emptyResult <= 3, `判定结果识别率 >= 97%（未识别 ${emptyResult} 条）`);

    // 维度与结果分布
    const l1 = {}, res = {};
    records.forEach(r => {
        l1[r.l1] = (l1[r.l1] || 0) + 1;
        const n = normalizeReportResult(r.result) || '未填写';
        res[n] = (res[n] || 0) + 1;
    });
    console.log('   维度分布:', JSON.stringify(l1));
    console.log('   判定分布:', JSON.stringify(res));
    assert((l1['数据安全管理'] || 0) >= 25 && (l1['数据处理活动'] || 0) >= 45, '一级指标解析正常');
    assert(Object.keys(l1).length === 4, `一级指标仅 4 个维度、无噪声（实际 ${Object.keys(l1).length} 个）`);
    assert(records.every(r => !/\s/.test(r.l1) && r.l1.length <= 8), '一级指标无空格/噪声字符');
    assert(records.every(r => r.l2.length <= 12), '二级指标长度正常');
    assert(records[100] && normalizeReportResult(records[100].result), '第 101 条（末页最后一条）解析完整');

    // 元信息
    const m = report.meta;
    console.log('   元信息:', JSON.stringify(m).slice(0, 240));
    assert(m.unitName.indexOf('重庆数字资源集团') >= 0, `识别被评估单位：${m.unitName}`);
    assert(m.systemName.indexOf('数字重庆OA') >= 0, `识别系统名称：${m.systemName}`);
    assert(m.creditCode === '91500000MA60G3R48R', `识别统一社会信用代码：${m.creditCode}`);
    assert(/^\d{4}-\d{2}-\d{2}$/.test(m.reportDate), `识别报告日期：${m.reportDate}`);
    assert(m.reportId.length > 8, `识别报告编号：${m.reportId}`);

    // ---- 构建项目 ----
    console.log('\n--- 构建项目 ---');
    const project = buildProjectFromReport(report, {
        name: m.systemName + '数据安全风险评估',
        target: m.unitName,
        evaluator: '测试员',
        date: m.reportDate,
        desc: m.description
    });
    project.id = 'pdf-import-test';

    assert(Array.isArray(project.criteria) && project.criteria.length === records.length,
        `项目专属准则 ${project.criteria.length} 项`);
    assert(Object.keys(project.items).length === records.length, `项目指标记录 ${Object.keys(project.items).length} 条`);
    assert(project.criteriaSource.indexOf('.pdf') > 0, '记录准则来源为报告文件');

    // 项目统计（应使用项目专属准则，不受内置 477 项影响）
    const s = computeItemStats(project);
    const l1s = computeL1Stats(project);
    console.log('   项目统计:', JSON.stringify(s));
    assert(s.total === records.length, `统计口径 = 项目专属准则（${s.total} 项，非 477）`);
    assert(Object.keys(l1s).length >= 4, `维度统计 ${Object.keys(l1s).length} 个`);
    assert(s.assessed === records.length, '全部测评项均带判定状态或记录');

    // 内置模板未受影响
    assert(TEMPLATE.length === 477, '系统内置 477 项准则不受影响');
    assert(getProjectCriteria(project).length === records.length, 'getProjectCriteria 返回项目专属准则');
    assert(getProjectCriteria({ id: 'x', items: {} }).length === 477, '普通项目仍使用内置准则');

    // 抽样核对记录内容
    console.log('\n--- 抽样核对 ---');
    [0, 1, 50, 98].forEach(i => {
        const r = records[i];
        console.log(`  #${r.seq} [${r.l1}/${r.l2}] ${r.item.slice(0, 40)}…  判定=${normalizeReportResult(r.result) || '未填写'}`);
        console.log(`      记录: ${(r.record || '').slice(0, 60)}…`);
    });
    const first = project.items[0];
    assert(first.record.length > 20 && first.result === '符合', '第 1 条记录与判定已写入项目');

    // 报告中的风险源描述等系统没有的字段不应出现在项目里
    const raw = JSON.stringify(project);
    assert(raw.indexOf('风险源描述') < 0 && !/risk\s*:/.test(raw), '系统没有的字段（风险源描述）未导入');

    // ---- 集成：导入的项目可直接生成整改报告（含结论与整改建议）----
    console.log('\n--- 集成：由导入项目生成整改报告 ---');
    vm.runInThisContext(fs.readFileSync(path.join(ROOT, 'js', 'report.js'), 'utf-8'), { filename: 'report.js' });
    rev++;
    const model = buildReportModel(project);
    const md = renderReportMarkdown(model);
    const html = renderReportHtml(model);
    console.log(`   结论：${model.conclusion.label} / ${model.conclusion.risk}　得分 ${model.stats.score}　` +
        `整改清单 ${model.plan.all.length} 项（P1 ${model.plan.p1.length} / P2 ${model.plan.p2.length} / P3 ${model.plan.p3.length}）`);
    assert(['符合', '基本符合', '部分符合', '不符合'].includes(model.conclusion.label), '基于导入数据得出测评结论');
    assert(model.plan.all.length === s.fail + s.partial, `整改清单覆盖不符合+部分符合（${model.plan.all.length} 项）`);
    assert(md.indexOf('## 二、测评结论') >= 0 && !/undefined/.test(md), 'Markdown 报告正常生成');
    assert(html.indexOf('</html>') > 0 && !html.includes('undefined'), 'HTML 报告正常生成');

    console.log(failed === 0 ? '\nALL PASS' : `\n${failed} FAILED`);
    process.exit(failed === 0 ? 0 : 1);
})().catch(e => { console.error('ERR:', e); process.exit(1); });
