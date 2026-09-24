// ============================================
// 评估报告导入（PDF）
// 识别报告中的单位名称、系统信息与测评指标记录（评估项/评估记录/评估结果），
// 以「报告测评项」作为该项目的专属准则导入，可继续修改。
// 只导入系统已有的字段，系统没有的字段（如风险源描述、风险等级等）不导入。
// 依赖：vendor/pdf.min.js + vendor/pdf.worker.min.js（按需加载）
// ============================================

// 报告表格列（顺序即列顺序）
const REPORT_TABLE_COLS = ['序号', '一级指标', '二级指标', '评估项', '评估记录', '评估结果', '风险源描述'];
const REPORT_HEADER_HINTS = ['序号', '一级指标', '二级指标', '评估项', '评估记录', '评估结果'];

// 报告判定结果 → 系统判定结果
function normalizeReportResult(v) {
    const s = String(v || '').replace(/\s/g, '');
    if (!s || s === '/' || s === '—' || s === '-') return '';
    if (s === '基本符合') return RESULT.PARTIAL;
    if (s === '符合' || s === '部分符合' || s === '不符合' || s === '不适用') return s;
    if (s.indexOf('部分') >= 0 && s.indexOf('符合') >= 0) return RESULT.PARTIAL;
    if (s.indexOf('符合') >= 0) return RESULT.PASS;
    if (s.indexOf('不适用') >= 0) return RESULT.NA;
    return '';
}

// ---------- 1. 坐标工具 ----------
function clusterValues(values, tol) {
    const out = [];
    values.slice().sort((a, b) => a - b).forEach(v => {
        if (out.length && v - out[out.length - 1] <= tol) {
            out[out.length - 1] = (out[out.length - 1] + v) / 2;
        } else {
            out.push(v);
        }
    });
    return out.map(v => Math.round(v * 10) / 10);
}

function _mulMatrix(m1, m2) {
    return [
        m1[0] * m2[0] + m1[2] * m2[1],
        m1[1] * m2[0] + m1[3] * m2[1],
        m1[0] * m2[2] + m1[2] * m2[3],
        m1[1] * m2[2] + m1[3] * m2[3],
        m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
        m1[1] * m2[4] + m1[3] * m2[5] + m1[5]
    ];
}

// ---------- 2. 单页提取：文本 + 矢量线 ----------
async function extractPdfPage(page) {
    const vp = page.getViewport({ scale: 1 });
    const spans = [];
    const tc = await page.getTextContent();
    tc.items.forEach(it => {
        if (!it.str || !it.str.trim()) return;
        const tx = pdfjsLib.Util.transform(vp.transform, it.transform);
        const fh = Math.hypot(tx[2], tx[3]) || it.height || 10;
        spans.push({
            t: it.str.trim(),
            x0: tx[4],
            x1: tx[4] + (it.width || 0),
            y: tx[5] - fh * 0.32,   // 行中心（近似）
            yb: tx[5],              // 基线
            h: fh
        });
    });

    // 矢量线段（表格边框）：按笔画时的 CTM 直接变换到页面坐标
    const vLines = [], hLines = [];
    const pushSeg = (p1, p2, m) => {
        const a = pdfjsLib.Util.applyTransform(p1, m);
        const b = pdfjsLib.Util.applyTransform(p2, m);
        if (Math.abs(a[0] - b[0]) < 0.6) vLines.push({ x: (a[0] + b[0]) / 2, len: Math.abs(b[1] - a[1]) });
        else if (Math.abs(a[1] - b[1]) < 0.6) {
            hLines.push({ y: (a[1] + b[1]) / 2, x0: Math.min(a[0], b[0]), x1: Math.max(a[0], b[0]) });
        }
    };
    try {
        const opList = await page.getOperatorList();
        const OPS = pdfjsLib.OPS;
        let ctm = vp.transform.slice();
        let path = [];
        for (let i = 0; i < opList.fnArray.length; i++) {
            const fn = opList.fnArray[i], args = opList.argsArray[i];
            if (fn === OPS.transform) { ctm = _mulMatrix(ctm, args); continue; }
            if (fn === OPS.constructPath) {
                const ops = args[0], coords = args[1];
                let k = 0;
                for (let j = 0; j < ops.length; j++) {
                    const op = ops[j];
                    if (op === OPS.moveTo) { path.push({ t: 'M', p: [coords[k++], coords[k++]] }); }
                    else if (op === OPS.lineTo) { path.push({ t: 'L', p: [coords[k++], coords[k++]] }); }
                    else if (op === OPS.rectangle) {
                        const x = coords[k++], y = coords[k++], w = coords[k++], h = coords[k++];
                        path.push({ t: 'R', r: [x, y, w, h] });
                    } else if (op === OPS.curveTo) { k += 6; }
                    else if (op === OPS.curveTo2 || op === OPS.curveTo3) { k += 4; }
                }
                continue;
            }
            if (fn === OPS.stroke || fn === OPS.closeStroke || fn === OPS.fill || fn === OPS.eoFill) {
                let last = null;
                path.forEach(item => {
                    if (item.t === 'M') last = item.p;
                    else if (item.t === 'L') { if (last) pushSeg(last, item.p, ctm); last = item.p; }
                    else if (item.t === 'R') {
                        const [x, y, w, h] = item.r;
                        pushSeg([x, y], [x + w, y], ctm);
                        pushSeg([x + w, y], [x + w, y + h], ctm);
                        pushSeg([x + w, y + h], [x, y + h], ctm);
                        pushSeg([x, y + h], [x, y], ctm);
                        last = null;
                    }
                });
                path = [];
            }
        }
    } catch (e) {
        console.warn('提取页面矢量线失败（将退化为仅文本解析）:', e.message);
    }

    const text = spans.map(s => s.t).join('');
    return { page: page.pageNumber, spans, vLines, hLines, text, width: vp.width, height: vp.height };
}

// ---------- 3. 表格定位与解析 ----------
function isReportTablePage(p) {
    // 需同时含表头列名（表格页每页重复表头）
    return p.text.indexOf('一级指标') >= 0 && p.text.indexOf('二级指标') >= 0 &&
        p.text.indexOf('评估项') >= 0 && p.text.indexOf('评估记录') >= 0 && p.text.indexOf('评估结果') >= 0;
}

/** 由各页竖线求列边界（长竖线 = 表格列分隔线） */
function deriveColumnBounds(tablePages) {
    const LONG_MIN = 200, LONG_MAX = 5000;
    const pageWidth = tablePages[0].width || 595;
    const inContentArea = x => x > 40 && x < pageWidth - 40; // 排除页面边框线
    const all = [];
    const pageSets = tablePages.map(p => {
        const xs = clusterValues(
            p.vLines.filter(v => v.len >= LONG_MIN && v.len <= LONG_MAX && inContentArea(v.x)).map(v => v.x), 1.5);
        all.push(...xs);
        return xs;
    });
    const centers = clusterValues(all, 1.5);
    const minPages = Math.max(2, Math.ceil(tablePages.length * 0.5));
    return centers.filter(c =>
        pageSets.filter(xs => xs.some(x => Math.abs(x - c) <= 1.5)).length >= minPages);
}

/** 由横线求行分隔（跨表宽的水平线） */
function deriveRowBands(page, colX) {
    const tableX0 = colX[0], tableX1 = colX[colX.length - 1];
    const tableW = tableX1 - tableX0;
    const ys = clusterValues(
        page.hLines.filter(h => (h.x1 - h.x0) >= tableW * 0.7 &&
            h.x0 <= tableX0 + tableW * 0.15 && h.x1 >= tableX1 - tableW * 0.15).map(h => h.y), 1.5);
    const bands = [];
    for (let i = 0; i + 1 < ys.length; i++) bands.push([ys[i], ys[i + 1]]);
    return bands;
}

/** 将一页中某行带内的文本按列聚合 */
function assignRowCells(page, colX, y0, y1) {
    const colCount = REPORT_TABLE_COLS.length;
    const cells = [];
    for (let i = 0; i < colCount; i++) cells.push([]);
    page.spans.forEach(s => {
        if (s.y < y0 || s.y >= y1) return;
        if (s.h >= 14.5) return;                 // 过滤章节标题（如「附录B 技术测试详情」）
        if (/^(标识号|附录|表\s*A-|表\s*B-)/.test(s.t)) return;
        if (/^第\s*\d+\s*页/.test(s.t)) return;
        const xc = (s.x0 + s.x1) / 2;
        let ci = -1;
        for (let i = 0; i < colX.length - 1; i++) {
            if (xc >= colX[i] && xc < colX[i + 1]) { ci = i; break; }
        }
        if (ci < 0 || ci >= colCount) return; // 超出已知列范围则忽略
        cells[ci].push(s);
    });
    return cells.map(list => {
        list.sort((a, b) => (a.y - b.y) || (a.x0 - b.x0));
        return list.map(s => s.t).join('').replace(/\s+/g, ' ').trim();
    });
}

/**
 * 解析报告测评指标表
 * @returns {{records:Array, tablePages:number[], colX:number[]}}
 */
function parseReportTable(pages) {
    const tablePages = pages.filter(isReportTablePage);
    if (tablePages.length === 0) {
        return { records: [], tablePages: [], colX: [] };
    }
    // 表格页范围（含中间续页）
    const firstIdx = pages.indexOf(tablePages[0]);
    const lastIdx = pages.indexOf(tablePages[tablePages.length - 1]);
    const range = pages.slice(firstIdx, lastIdx + 1);

    const colX = deriveColumnBounds(tablePages);
    if (colX.length < 3) {
        return { records: [], tablePages: tablePages.map(p => p.page), colX: colX };
    }

    const records = [];
    let cur = null;
    range.forEach(page => {
        // 章标题（如「附录B 技术测试详情」）之后的内容不属于本表，停止解析该页后续行带
        const headings = page.spans.filter(s => s.h >= 14.5 && s.y > page.height * 0.2).map(s => s.y);
        const stopY = headings.length ? Math.min.apply(null, headings) : Infinity;

        deriveRowBands(page, colX).forEach(([y0, y1]) => {
            if (y0 >= stopY) return;
            const cells = assignRowCells(page, colX, y0, y1);
            const joined = cells.join('');
            if (!joined) return;
            // 表头行
            if (REPORT_HEADER_HINTS.filter(h => joined.indexOf(h) >= 0).length >= 3) return;
            const seq = /^(\d{1,3})$/.exec(cells[0]);
            if (seq) {
                cur = {
                    seq: parseInt(seq[1], 10), l1: '', l2: '', item: '', record: '',
                    result: '', risk: ''
                };
                records.push(cur);
            }
            if (!cur) return;
            const append = (key, val, force) => {
                if (!val || val === '/') return;
                // 一/二级指标为竖排短标签，拼接时不加空格
                const compact = (key === 'l1' || key === 'l2');
                if (compact) val = val.replace(/\s+/g, '');
                if (!val) return;
                if (force) { cur[key] = val; return; }
                cur[key] = cur[key] ? (cur[key] + (compact ? '' : ' ') + val) : val;
            };
            if (seq) {
                append('l1', cells[1], true); append('l2', cells[2], true);
                append('item', cells[3], true); append('record', cells[4], true);
                append('result', cells[5], true); append('risk', cells[6], true);
            } else { // 跨页续行
                append('l1', cells[1]); append('l2', cells[2]);
                append('item', cells[3]); append('record', cells[4]);
                append('result', cells[5]); append('risk', cells[6]);
            }
        });
    });

    return { records: records, tablePages: tablePages.map(p => p.page), colX: colX, range: [range[0].page, range[range.length - 1].page] };
}

// ---------- 4. 单位 / 系统信息提取 ----------
const META_LABELS = ['系统名称', '委托单位', '被评估单位', '单位名称', '统一社会信用代码', '单位地址',
    '邮政编码', '所属部门', '联系人', '姓名', '职务', '联系方式', '评估机构', '编制人', '审核人', '批准人', '日期'];

function groupSpansToLines(spans, tol) {
    const lines = [];
    spans.slice().sort((a, b) => (a.y - b.y) || (a.x0 - b.x0)).forEach(s => {
        const hit = lines.find(l => Math.abs(l.y - s.y) <= (tol || 4));
        if (hit) { hit.spans.push(s); hit.y = Math.min(hit.y, s.y); }
        else lines.push({ y: s.y, spans: [s] });
    });
    lines.forEach(l => l.spans.sort((a, b) => a.x0 - b.x0));
    return lines.sort((a, b) => a.y - b.y);
}

/** 从报告正文提取单位/系统等元信息 */
function extractReportMeta(pages) {
    const meta = {
        systemName: '', unitName: '', creditCode: '', reportId: '', reportDate: '', description: ''
    };

    // 封面：竖排标签与取值会被合并到同一行（如「系统名称数字重庆OA系统」），按标签前缀取值
    const cover = pages[0];
    if (cover) {
        const COVER_LABELS = ['系统名称', '委托单位', '被评估单位', '单位名称', '检验类型', '检验机构'];
        const lines = groupSpansToLines(cover.spans, 4)
            .map(l => l.spans.map(s => s.t).join('').replace(/\s+/g, '')).filter(Boolean);
        lines.forEach(text => {
            for (const label of COVER_LABELS) {
                if (text.indexOf(label) !== 0) continue;
                const value = text.slice(label.length).trim();
                if (!value) continue;
                if (label === '系统名称' && !meta.systemName) meta.systemName = value;
                if ((label === '委托单位' || label === '被评估单位' || label === '单位名称') && !meta.unitName) {
                    meta.unitName = value;
                }
            }
        });
        const idm = cover.text.match(/标识号[：:]\s*([A-Za-z0-9\-\.]+)/);
        if (idm) meta.reportId = idm[1];
    }

    // 基本信息表：按标签取值（标签与值同一行）
    const infoPage = pages.find(p => p.text.indexOf('统一社会信用代码') >= 0);
    if (infoPage) {
        const lines = groupSpansToLines(infoPage.spans, 4);
        let lastLabel = null;
        lines.forEach(line => {
            const texts = line.spans.map(s => s.t);
            const joined = texts.join('');
            let label = null;
            for (const lb of META_LABELS) {
                if (joined.startsWith(lb)) { label = lb; break; }
            }
            if (label) {
                const rest = joined.slice(label.length).trim();
                lastLabel = label;
                if (label === '单位名称' && !meta.unitName) meta.unitName = rest;
                if (label === '统一社会信用代码') meta.creditCode = (rest.match(/[0-9A-Z]{18}/) || [rest])[0];
                if (label === '系统名称') meta.systemName = rest || meta.systemName;
            } else if (lastLabel === '单位名称' && joined && !meta.unitName) {
                meta.unitName = joined;
            } else if (lastLabel === '统一社会信用代码' && joined && !meta.creditCode) {
                const m = joined.match(/[0-9A-Z]{18}/);
                if (m) meta.creditCode = m[0];
            }
        });
    }

    // 报告日期：正文中出现的最大日期（评估过程等）
    let maxDate = null;
    pages.slice(0, Math.min(25, pages.length)).forEach(p => {
        const re = /(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/g;
        let m;
        while ((m = re.exec(p.text))) {
            const iso = `${m[1]}-${String(m[2]).padStart(2, '0')}-${String(m[3]).padStart(2, '0')}`;
            if (!maxDate || iso > maxDate) maxDate = iso;
        }
    });
    if (maxDate) meta.reportDate = maxDate;

    // 被评估对象描述（1.4 节）
    const descPage = pages.find(p => p.text.indexOf('被评估对象描述') >= 0);
    if (descPage) {
        const idx = descPage.text.indexOf('被评估对象描述');
        const seg = descPage.text.slice(idx + '被评估对象描述'.length, idx + 420).trim();
        if (seg) meta.description = seg;
    }

    return meta;
}

// ---------- 5. 构建项目 ----------
/**
 * 以报告测评项作为项目专属准则构建项目
 * @param {Object} report {meta, records}
 * @param {Object} fields 用户确认后的项目字段
 */
function buildProjectFromReport(report, fields) {
    const records = report.records.filter(r => r.item);
    const criteria = records.map(r => ({
        l1: r.l1 || '未分类',
        l2: r.l2 || '评估项',
        l3: '评估项',
        guidance: r.item,
        applicable: ''
    }));

    const project = {
        id: Date.now().toString(),
        name: fields.name,
        target: fields.target,
        evaluator: fields.evaluator || '',
        date: fields.date || '',
        desc: fields.desc || '',
        applicable: fields.applicable || '',
        createdAt: new Date().toISOString(),
        criteria: criteria,                        // 项目专属准则（不影响内置 477 项模板）
        criteriaSource: report.sourceName || '报告导入',
        items: {}
    };

    records.forEach((r, idx) => {
        project.items[idx] = {
            record: r.record || '',
            result: normalizeReportResult(r.result),
            applicable_override: ''
        };
    });

    // 系统已有的调研信息字段（其余报告信息不导入）
    const basicInfo = {};
    if (report.meta.creditCode) basicInfo['统一社会信用代码'] = report.meta.creditCode;
    if (Object.keys(basicInfo).length > 0 || report.meta.description) {
        project.wordSurveyData = {
            basicInfo: basicInfo,
            systemDesc: report.meta.description || '',
            dataAssets: [],
            dataClassification: []
        };
    }
    return project;
}

// ---------- 6. 解析入口 ----------
async function parseReportPdf(arrayBuffer) {
    await loadLib('pdfjs');
    const doc = await pdfjsLib.getDocument({
        data: arrayBuffer, useWorkerFetch: false, isEvalSupported: false, verbosity: 0
    }).promise;
    const pages = [];
    for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i);
        pages.push(await extractPdfPage(page));
    }
    await doc.destroy();

    const table = parseReportTable(pages);
    const meta = extractReportMeta(pages);
    return {
        meta: meta,
        records: table.records,
        tablePages: table.tablePages,
        range: table.range,
        pageCount: pages.length
    };
}

// ---------- 7. 界面交互 ----------
let _parsedReport = null;

function showReportImportModal() {
    if (!requirePermission('create', '导入报告')) return;
    const modal = document.getElementById('reportImportModal');
    modal.style.display = 'flex';
    document.getElementById('reportFileName').textContent = '';
    document.getElementById('reportParseStatus').style.display = 'none';
    document.getElementById('reportPreview').style.display = 'none';
    document.getElementById('reportImportConfirm').style.display = 'none';
    document.getElementById('reportProjectName').value = '';
    document.getElementById('reportProjectTarget').value = '';
    document.getElementById('reportProjectDate').valueAsDate = new Date();
    const user = getCurrentUser();
    if (user) document.getElementById('reportProjectEvaluator').value = user.name;
    _parsedReport = null;
}

function hideReportImportModal() {
    document.getElementById('reportImportModal').style.display = 'none';
}

async function handleReportFile(file) {
    if (!file) return;
    if (!/\.pdf$/i.test(file.name)) {
        alert('目前仅支持导入 PDF 格式的评估报告。');
        return;
    }
    const statusEl = document.getElementById('reportParseStatus');
    document.getElementById('reportFileName').textContent = file.name;
    statusEl.style.display = 'block';
    statusEl.textContent = '⏳ 正在解析报告（首次需加载 PDF 组件）...';
    document.getElementById('reportPreview').style.display = 'none';
    document.getElementById('reportImportConfirm').style.display = 'none';

    try {
        const buf = await file.arrayBuffer();
        const report = await parseReportPdf(buf);
        report.sourceName = file.name;
        _parsedReport = report;

        const validRecords = report.records.filter(r => r.item);
        if (validRecords.length === 0) {
            statusEl.textContent = '❌ 未在报告中识别到测评指标表（需包含「序号/一级指标/二级指标/评估项/评估记录/评估结果」表头）。';
            return;
        }
        statusEl.textContent = `✅ 共解析 ${report.pageCount} 页；识别测评项 ${validRecords.length} 条` +
            `（表格页 ${report.range ? report.range[0] + '-' + report.range[1] : '-'}）。`;

        renderReportPreview(report);
        document.getElementById('reportPreview').style.display = 'block';
        document.getElementById('reportImportConfirm').style.display = '';

        // 预填项目字段
        const sysName = report.meta.systemName || '';
        const unit = report.meta.unitName || '';
        document.getElementById('reportProjectName').value =
            sysName ? (sysName + '数据安全风险评估') : (unit ? unit + '数据安全风险评估' : file.name.replace(/\.pdf$/i, ''));
        document.getElementById('reportProjectTarget').value = unit;
        if (report.meta.reportDate) document.getElementById('reportProjectDate').value = report.meta.reportDate;
        document.getElementById('reportProjectDesc').value = report.meta.description || '';
    } catch (err) {
        console.error('报告解析失败:', err);
        statusEl.textContent = '❌ 解析失败：' + err.message;
    }
}

function renderReportPreview(report) {
    const records = report.records.filter(r => r.item);
    const dist = { '符合': 0, '部分符合': 0, '不符合': 0, '不适用': 0, '未填写': 0 };
    records.forEach(r => {
        const n = normalizeReportResult(r.result);
        dist[n || '未填写']++;
    });
    const l1s = {};
    records.forEach(r => { l1s[r.l1 || '未分类'] = (l1s[r.l1 || '未分类'] || 0) + 1; });

    const metaRow = (label, value) =>
        `<div><b>${label}：</b>${value ? escapeHtml(value) : '<span style="color:#bbb;">未识别</span>'}</div>`;

    let html = '<div style="padding:12px 14px;background:#f5f7fa;border:1px solid #e0e0e0;border-radius:8px;font-size:13px;line-height:1.9;">';
    html += '<div style="font-weight:600;margin-bottom:6px;">📋 识别的报告信息（仅导入系统已有字段）</div>';
    html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:2px 20px;">';
    html += metaRow('系统名称', report.meta.systemName);
    html += metaRow('被评估单位', report.meta.unitName);
    html += metaRow('统一社会信用代码', report.meta.creditCode);
    html += metaRow('报告编号', report.meta.reportId);
    html += metaRow('报告日期', report.meta.reportDate);
    html += metaRow('被评估对象描述', report.meta.description ? report.meta.description.slice(0, 40) + '…' : '');
    html += '</div>';
    html += '<div style="margin-top:8px;">测评指标：<b>' + records.length + '</b> 条　';
    html += '符合 <b style="color:' + RESULT_META['符合'].color + ';">' + dist['符合'] + '</b>　';
    html += '部分符合 <b style="color:' + RESULT_META['部分符合'].color + ';">' + dist['部分符合'] + '</b>　';
    html += '不符合 <b style="color:' + RESULT_META['不符合'].color + ';">' + dist['不符合'] + '</b>　';
    html += '不适用 <b style="color:' + RESULT_META['不适用'].color + ';">' + dist['不适用'] + '</b>　';
    html += '未填写 <b>' + dist['未填写'] + '</b></div>';
    html += '<div style="margin-top:4px;color:#555;">按维度：' +
        Object.entries(l1s).map(([k, v]) => `${escapeHtml(k)} ${v} 条`).join('　') + '</div>';
    html += '<div style="margin-top:8px;color:#0d47a1;">ℹ️ 导入后，这些测评项将成为<b>该项目专属的指标清单</b>（' +
        records.length + ' 项），评估记录与判定结果原样保留，可继续修改；不影响系统内置的 477 项准则与其他项目。</div>';
    html += '</div>';

    // 前若干条预览
    html += '<div style="margin-top:10px;font-weight:600;font-size:13px;">前 8 条预览</div>';
    html += '<div style="max-height:190px;overflow:auto;border:1px solid #e0e0e0;border-radius:6px;margin-top:6px;">';
    html += '<table style="width:100%;border-collapse:collapse;font-size:12px;">';
    html += '<tr style="background:#eef1f8;"><th style="padding:6px;border:1px solid #e0e0e0;">序号</th>' +
        '<th style="padding:6px;border:1px solid #e0e0e0;">维度</th><th style="padding:6px;border:1px solid #e0e0e0;">二级指标</th>' +
        '<th style="padding:6px;border:1px solid #e0e0e0;">评估项</th><th style="padding:6px;border:1px solid #e0e0e0;">判定结果</th></tr>';
    records.slice(0, 8).forEach(r => {
        html += `<tr>
            <td style="padding:5px;border:1px solid #e0e0e0;text-align:center;">${r.seq}</td>
            <td style="padding:5px;border:1px solid #e0e0e0;">${escapeHtml(r.l1)}</td>
            <td style="padding:5px;border:1px solid #e0e0e0;">${escapeHtml(r.l2)}</td>
            <td style="padding:5px;border:1px solid #e0e0e0;">${escapeHtml(r.item.slice(0, 60))}${r.item.length > 60 ? '…' : ''}</td>
            <td style="padding:5px;border:1px solid #e0e0e0;text-align:center;">${escapeHtml(normalizeReportResult(r.result) || '未填写')}</td>
        </tr>`;
    });
    html += '</table></div>';
    document.getElementById('reportPreviewInner').innerHTML = html;
}

function confirmReportImport() {
    const report = _parsedReport;
    if (!report) { alert('请先选择并解析报告文件！'); return; }
    const records = report.records.filter(r => r.item);
    if (records.length === 0) { alert('未识别到可导入的测评项。'); return; }

    const name = document.getElementById('reportProjectName').value.trim();
    const target = document.getElementById('reportProjectTarget').value.trim();
    if (!name || !target) { alert('请填写项目名称和评估对象！'); return; }
    if (!requirePermission('create', '创建评估项目')) return;

    const project = buildProjectFromReport(report, {
        name: name,
        target: target,
        evaluator: document.getElementById('reportProjectEvaluator').value.trim(),
        date: document.getElementById('reportProjectDate').value,
        desc: document.getElementById('reportProjectDesc').value.trim(),
        applicable: ''
    });
    saveProject(project);
    hideReportImportModal();
    renderProjectList();
    alert(`✅ 报告导入成功！\n\n已创建项目「${project.name}」，含 ${records.length} 项测评指标（项目专属准则），` +
        `评估记录与判定结果已导入，可继续修改。`);
    openProject(project.id);
}
