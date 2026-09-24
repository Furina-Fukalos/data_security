// 生成示例报告：以《数据安全评估评估准则v1-20260525.xlsx》中的示例评估数据构建演示项目，
// 输出到 docs/示例报告_数据安全评估.html（可直接双击查看/打印）。
// 运行： node scripts/generate_sample_report.node.js
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const Module = require('module');
const _origLoad = Module._load;
Module._load = function (request) {
    if (request === './cpexcel.js') return {};
    return _origLoad.apply(this, arguments);
};
global.XLSX = require(path.join(ROOT, 'vendor', 'xlsx-js-style.min.js'));

const TEMPLATE = JSON.parse(fs.readFileSync(path.join(ROOT, 'js', 'template.js'), 'utf-8')
    .match(/const TEMPLATE\s*=\s*(\[.*\])\s*;?\s*$/s)[1]);
global.TEMPLATE = TEMPLATE;
global.getProjectRev = () => 1;

['stats.js', 'criteria-import.js', 'report.js'].forEach(f => {
    vm.runInThisContext(fs.readFileSync(path.join(ROOT, 'js', f), 'utf-8'), { filename: f });
});

const xlsx = path.join(ROOT, '数据安全评估评估准则v1-20260525.xlsx');
const buf = fs.readFileSync(xlsx);
const parsed = parseCriteriaWorkbook(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
parsed.sourceName = path.basename(xlsx);

const project = buildProjectFromCriteria(parsed, {
    name: '示例：某某单位数据安全评估',
    target: '某某单位',
    evaluator: '示例评估员',
    date: new Date().toISOString().slice(0, 10),
    applicable: ''
});
project.id = 'sample';

const model = buildReportModel(project);
const html = renderReportHtml(model);
const md = renderReportMarkdown(model);

const outDir = path.join(ROOT, 'docs');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);
const htmlPath = path.join(outDir, '示例报告_数据安全评估.html');
const mdPath = path.join(outDir, '示例报告_数据安全评估.md');
fs.writeFileSync(htmlPath, html, 'utf-8');
fs.writeFileSync(mdPath, md, 'utf-8');

console.log('示例报告已生成');
console.log(`  结论：${model.conclusion.label}　得分：${model.stats.score}　风险等级：${model.conclusion.risk}`);
console.log(`  整改清单：${model.plan.all.length} 项（P1 ${model.plan.p1.length} / P2 ${model.plan.p2.length} / P3 ${model.plan.p3.length}）`);
console.log(`  HTML：${path.relative(ROOT, htmlPath)}（${(html.length / 1024).toFixed(1)} KB）`);
console.log(`  Markdown：${path.relative(ROOT, mdPath)}（${(md.length / 1024).toFixed(1)} KB）`);
