// Node 端回归测试：验证 stats.js 的统计口径与重构前的分散实现完全一致。
// 运行： node scripts/test_stats.node.js
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');

// ---- 1) 载入模板 ----
const tplSrc = fs.readFileSync(path.join(ROOT, 'js', 'template.js'), 'utf-8');
const TEMPLATE = JSON.parse(tplSrc.match(/const TEMPLATE\s*=\s*(\[.*\])\s*;?\s*$/s)[1]);
global.TEMPLATE = TEMPLATE;

// ---- 2) 数据版本号桩（对应 storage.js 的 getProjectRev）----
let rev = 1;
global.getProjectRev = () => rev;

// ---- 3) 载入被测模块 ----
vm.runInThisContext(fs.readFileSync(path.join(ROOT, 'js', 'stats.js'), 'utf-8'), { filename: 'stats.js' });

// ---- 4) 重构前的原始实现（参照物）----
const RESULTS = ['', '符合', '部分符合', '不符合', '不适用'];

function naiveItemStats(project) {
    const items = Object.values(project.items);
    let X = 0, Y = 0, Z = 0, NA = 0, unassessed = 0;
    items.forEach(item => {
        const r = item && item.result;
        if (r === '符合') X++;
        else if (r === '部分符合') Y++;
        else if (r === '不符合') Z++;
        else if (r === '不适用') NA++;
        else unassessed++;
    });
    const scored = X + Y + Z;
    return {
        total: items.length, pass: X, partial: Y, fail: Z, na: NA,
        unassessed: unassessed, assessed: X + Y + Z + NA, scored: scored,
        score: scored > 0 ? Math.round(100 * (X + 0.5 * Y) / scored) : 0
    };
}

function naiveL1Stats(project) {
    const l1Data = {};
    TEMPLATE.forEach((tpl, idx) => {
        const item = project.items[idx];
        if (item && item.result === '不适用') return;
        if (!l1Data[tpl.l1]) l1Data[tpl.l1] = { X: 0, Y: 0, Z: 0, total: 0 };
        l1Data[tpl.l1].total++;
        if (item) {
            if (item.result === '符合') l1Data[tpl.l1].X++;
            else if (item.result === '部分符合') l1Data[tpl.l1].Y++;
            else if (item.result === '不符合') l1Data[tpl.l1].Z++;
        }
    });
    Object.values(l1Data).forEach(d => {
        d.score = d.total > 0 ? Math.round(100 * (d.X + 0.5 * d.Y) / d.total) : 0;
    });
    return l1Data;
}

// ---- 5) 断言工具 ----
let failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('✓', msg); }
    else { console.error('✗ FAIL:', msg); failed++; }
}
function eq(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

// ---- 6) 场景 ----
function buildProject(fill) {
    const items = {};
    TEMPLATE.forEach((_, idx) => { items[idx] = { record: '', result: fill(idx) }; });
    return { id: 'p1', items: items };
}

// 确定性伪随机
let seed = 42;
function rnd() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }

const scenarios = {
    '随机分布': () => buildProject(() => RESULTS[Math.floor(rnd() * RESULTS.length)]),
    '全部不适用': () => buildProject(() => '不适用'),
    '全部未评估': () => buildProject(() => ''),
    '仅前100项已评估': () => buildProject(i => (i < 100 ? RESULTS[1 + (i % 3)] : '')),
    '混合(含空项目)': () => ({ id: 'p2', items: {} })
};

let scenarioIndex = 0;
Object.entries(scenarios).forEach(([name, make]) => {
    const project = make();
    project.id = 'proj-' + (++scenarioIndex);
    rev++; // 每次换项目都视为新版本

    const got = computeItemStats(project);
    const want = naiveItemStats(project);
    assert(eq(got, want), `${name}：整体统计与原始实现一致 ${JSON.stringify(got)}`);

    const gotL1 = computeL1Stats(project);
    const wantL1 = naiveL1Stats(project);
    let l1Ok = true;
    // 约定：computeL1Stats 返回全部维度；原始实现只包含「至少一项非不适用」的维度。
    // 因此：原始实现中的每个维度必须数值一致；原始实现没有的维度必须 scored === 0。
    Object.entries(wantL1).forEach(([l1, w]) => {
        const g = gotL1[l1];
        if (!g) { l1Ok = false; return; }
        if (g.pass !== w.X || g.partial !== w.Y || g.fail !== w.Z || g.scored !== w.total || g.score !== w.score) {
            l1Ok = false;
        }
    });
    Object.entries(gotL1).forEach(([l1, g]) => {
        if (!wantL1[l1] && g.scored !== 0) l1Ok = false;
    });
    assert(l1Ok, `${name}：各维度统计与原始实现一致（原始 ${Object.keys(wantL1).length} 个维度）`);
});

// ---- 7) 缓存行为 ----
const p = buildProject(() => '符合');
p.id = 'cache-test';
rev++;
const a = computeItemStats(p);
const b = computeItemStats(p);
assert(a === b, '同一版本号下命中缓存（返回同一对象，避免重复遍历 477 项）');

p.items[0].result = '不符合';
rev++; // 模拟 saveProject 递增版本号
const c = computeItemStats(p);
assert(c.pass === a.pass - 1 && c.fail === a.fail + 1, '数据变更（版本号变化）后缓存自动失效');

// ---- 8) 判定元数据 ----
assert(getResultStatusClass('符合') === 'pass' && getResultStatusClass('不适用') === 'na'
    && getResultStatusClass('') === 'pending' && getResultStatusClass('不符合') === 'fail'
    && getResultStatusClass('部分符合') === 'partial', '判定徽章样式映射正确');
assert(getResultColor('符合') === '#2e7d32' && getResultColor('不适用') === '#607d8b', '判定配色映射正确');
assert(RESULT_OPTIONS.length === 5 && RESULT_OPTIONS[4] === '不适用', '判定下拉选项完整（含不适用）');
assert(isAssessed('不适用') === true && isScored('不适用') === false, '不适用=已评估但不计入评分');

console.log(failed === 0 ? '\nALL PASS' : `\n${failed} FAILED`);
process.exit(failed === 0 ? 0 : 1);
