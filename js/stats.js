// ============================================
// 判定结果与统计口径（唯一数据源）
// 说明：所有模块的判定分类、配色、徽章、评分统计统一从这里取，
//       避免同一套口径散落在 30+ 处 if/else 中（口径漂移 + 重复计算）。
// ============================================

const RESULT = {
    PASS: '符合',
    PARTIAL: '部分符合',
    FAIL: '不符合',
    NA: '不适用',
    NONE: ''
};

// 判定结果元数据：徽章样式 / 颜色 / 下拉标签
const RESULT_META = {
    '符合':     { cls: 'pass',    color: '#2e7d32', label: '✅ 符合' },
    '部分符合': { cls: 'partial', color: '#ed6c02', label: '⚠️ 部分符合' },
    '不符合':   { cls: 'fail',    color: '#c62828', label: '❌ 不符合' },
    '不适用':   { cls: 'na',      color: '#607d8b', label: '⛔ 不适用' },
    '':         { cls: 'pending', color: '#999999', label: '待评估' }
};

// 判定下拉选项顺序（含空值）
const RESULT_OPTIONS = ['', '符合', '部分符合', '不符合', '不适用'];

function getResultMeta(result) {
    return RESULT_META[result] || RESULT_META[''];
}

function getResultStatusClass(result) {
    return getResultMeta(result).cls;
}

function getResultColor(result) {
    return getResultMeta(result).color;
}

/** 是否已给出判定（含「不适用」） */
function isAssessed(result) {
    return !!result;
}

/** 是否计入评分（符合 / 部分符合 / 不符合；不适用与未评估不计入） */
function isScored(result) {
    return result === RESULT.PASS || result === RESULT.PARTIAL || result === RESULT.FAIL;
}

/** 评分公式：S = 100 × (X + 0.5Y) / (X + Y + Z) */
function scoreFormula(pass, partial, denominator) {
    return denominator > 0 ? Math.round(100 * (pass + 0.5 * partial) / denominator) : 0;
}

// ---------- 统计缓存 ----------
// 同一轮渲染中（保存后连续调用统计/图表/评分）只遍历一次 477 项。
// 缓存键 = 项目ID + 数据版本号（saveProject 时递增）。
const _EMPTY_STATS = { total: 0, pass: 0, partial: 0, fail: 0, na: 0, unassessed: 0, assessed: 0, scored: 0, score: 0 };
let _itemStatsCache = { key: null, value: null };
let _l1StatsCache = { key: null, value: null };

function _statsCacheKey(project) {
    const rev = (typeof getProjectRev === 'function') ? getProjectRev() : 0;
    return project.id + '#' + rev;
}

/**
 * 项目整体统计
 * @returns {{total:number, pass:number, partial:number, fail:number, na:number,
 *            unassessed:number, assessed:number, scored:number, score:number}}
 */
function computeItemStats(project, useCache) {
    if (!project || !project.items) return Object.assign({}, _EMPTY_STATS);
    const key = _statsCacheKey(project);
    if (useCache !== false && _itemStatsCache.key === key && _itemStatsCache.value) {
        return _itemStatsCache.value;
    }

    const s = Object.assign({}, _EMPTY_STATS);
    const items = Object.values(project.items);
    s.total = items.length;
    items.forEach(item => {
        const r = item && item.result;
        if (r === RESULT.PASS) s.pass++;
        else if (r === RESULT.PARTIAL) s.partial++;
        else if (r === RESULT.FAIL) s.fail++;
        else if (r === RESULT.NA) s.na++;
        else s.unassessed++;
    });
    s.assessed = s.pass + s.partial + s.fail + s.na;
    s.scored = s.pass + s.partial + s.fail;
    s.score = scoreFormula(s.pass, s.partial, s.scored);

    if (useCache !== false) {
        _itemStatsCache = { key: key, value: s };
    }
    return s;
}

/**
 * 按一级指标（维度）统计
 * total = 该维度全部指标数（含不适用），scored = 参与评分的指标数（total - na）
 * 说明：返回全部维度；「全部指标均为不适用」的维度 scored=0，
 *       调用方（评分卡/报告）按 scored>0 过滤，与历史口径一致；图表则保留该维度。
 * @returns {Object<string, {total:number, pass:number, partial:number, fail:number,
 *                          na:number, scored:number, score:number}>}
 */
function computeL1Stats(project, useCache) {
    const out = {};
    if (!project || !project.items) return out;
    const key = _statsCacheKey(project);
    if (useCache !== false && _l1StatsCache.key === key && _l1StatsCache.value) {
        return _l1StatsCache.value;
    }

    const items = project.items;
    const criteria = (typeof getProjectCriteria === 'function') ? getProjectCriteria(project) : TEMPLATE;
    criteria.forEach((tpl, idx) => {
        if (!out[tpl.l1]) {
            out[tpl.l1] = { total: 0, pass: 0, partial: 0, fail: 0, na: 0, scored: 0, score: 0 };
        }
        const d = out[tpl.l1];
        const r = items[idx] && items[idx].result;
        d.total++;
        if (r === RESULT.PASS) d.pass++;
        else if (r === RESULT.PARTIAL) d.partial++;
        else if (r === RESULT.FAIL) d.fail++;
        else if (r === RESULT.NA) d.na++;
    });
    Object.values(out).forEach(d => {
        d.scored = d.total - d.na;
        d.score = scoreFormula(d.pass, d.partial, d.scored);
    });

    if (useCache !== false) {
        _l1StatsCache = { key: key, value: out };
    }
    return out;
}

/** 清空统计缓存（切换项目等场景） */
function invalidateStatsCache() {
    _itemStatsCache = { key: null, value: null };
    _l1StatsCache = { key: null, value: null };
}
