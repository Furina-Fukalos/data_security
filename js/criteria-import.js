// ============================================
// 评估准则Excel导入
// 支持导入《数据安全评估评估准则*.xlsx》：
//   ① 更新评估准则模板（补充「评估位置」「评估实施」提示，修正「适用对象」标注）
//   ② 导入为评估项目（填充文件中的评估记录与判定结果）
// 依赖：vendor/xlsx-js-style.min.js（全局 XLSX）
// ============================================

// localStorage 键：已导入准则覆盖数据
const CRITERIA_STORAGE_KEY = 'data_security_criteria_v1';

// 内置准则快照（在应用任何覆盖之前捕获，用于「恢复内置准则」）
const BUILTIN_TEMPLATE = TEMPLATE.map(t => ({
    l1: t.l1, l2: t.l2, l3: t.l3,
    guidance: t.guidance, applicable: t.applicable,
    position: t.position, implement: t.implement
}));

// ---------- 工具 ----------
function _cv(v) {
    if (v === null || v === undefined) return '';
    if (typeof v === 'number') return String(v);
    return String(v).trim();
}

/**
 * 判定结果归一化：基本符合 → 部分符合（与系统口径一致）
 */
function normalizeCriteriaResult(v) {
    const s = _cv(v);
    if (!s) return '';
    if (s === '基本符合') return '部分符合';
    if (s === '符合' || s === '部分符合' || s === '不符合' || s === '不适用') return s;
    if (s.indexOf('部分') >= 0 && s.indexOf('符合') >= 0) return '部分符合';
    if (s.indexOf('符合') >= 0) return '符合';
    return s;
}

// ---------- 1. 解析 xlsx ----------
/**
 * 将工作表解析为矩阵，并前向填充合并单元格（一/二/三级指标等列是纵向合并的）
 */
function criteriaSheetToRows(ws) {
    const cellMap = {};
    Object.keys(ws).forEach(key => {
        if (key.charAt(0) === '!') return; // 跳过 !ref/!merges 等元数据
        const cell = ws[key];
        if (cell && cell.v !== undefined && cell.v !== null && _cv(cell.v) !== '') {
            const addr = XLSX.utils.decode_cell(key);
            cellMap[addr.r + ',' + addr.c] = cell.v;
        }
    });
    (ws['!merges'] || []).forEach(m => {
        const tl = m.s.r + ',' + m.s.c;
        if (cellMap[tl] !== undefined) {
            const v = cellMap[tl];
            for (let R = m.s.r; R <= m.e.r; R++) {
                for (let C = m.s.c; C <= m.e.c; C++) {
                    cellMap[R + ',' + C] = v;
                }
            }
        }
    });
    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
    const rows = [];
    for (let R = range.s.r; R <= range.e.r; R++) {
        const row = [];
        for (let C = range.s.c; C <= range.e.c; C++) row.push(cellMap[R + ',' + C]);
        rows.push(row);
    }
    return rows;
}

/**
 * 表头行 → 列名到列索引(0-based)的映射
 */
function criteriaMapColumns(headerRow) {
    const cm = {};
    headerRow.forEach((v, i) => {
        const s = _cv(v);
        if (s) cm[s] = i;
    });
    return cm;
}

/**
 * 解析整个工作簿，返回结构化准则数据
 * @returns {{sourceName:string, sheets:Array<{name:string, items:Array<Object>}>, totalRows:number}}
 */
function parseCriteriaWorkbook(arrayBuffer) {
    const wb = XLSX.read(arrayBuffer, { type: 'array' });
    const result = { sourceName: '', sheets: [], totalRows: 0 };

    wb.SheetNames.forEach(name => {
        // 跳过统计工作表（结果统计-一级指标 / 结果统计-二级指标）
        if (name.indexOf('结果统计') >= 0) return;

        const ws = wb.Sheets[name];
        if (!ws) return;
        const rows = criteriaSheetToRows(ws);
        if (rows.length === 0) return;

        // 在前 5 行内定位表头（包含「评估指引」的行）
        let headerIdx = -1, colMap = null;
        for (let i = 0; i < Math.min(rows.length, 5); i++) {
            const cm = criteriaMapColumns(rows[i]);
            if (cm['评估指引'] !== undefined) { headerIdx = i; colMap = cm; break; }
        }
        if (headerIdx < 0) return;

        const items = [];
        for (let i = headerIdx + 1; i < rows.length; i++) {
            const row = rows[i];
            const get = (cn) => (colMap[cn] !== undefined ? _cv(row[colMap[cn]]) : '');
            const guidance = get('评估指引');
            if (!guidance) continue; // 跳过空行
            items.push({
                seq: get('序号'),
                l1: get('一级指标'),
                l2: get('二级指标'),
                l3: get('三级指标'),
                guidance: guidance,
                position: get('评估位置'),
                implement: get('评估实施'),
                applicable: get('适用对象'),
                record: get('评估记录'),
                result: normalizeCriteriaResult(get('判定结果'))
            });
        }
        if (items.length > 0) {
            result.sheets.push({ name: name, items: items });
            result.totalRows += items.length;
        }
    });

    return result;
}

// ---------- 2. 与内置模板对齐校验 ----------
/**
 * 按工作表顺序与内置模板逐条对齐，返回校验报告
 */
function matchCriteriaToTemplate(parsed) {
    const flat = [];
    parsed.sheets.forEach(s => s.items.forEach(it => flat.push(it)));

    const report = {
        total: flat.length,
        templateCount: TEMPLATE.length,
        aligned: false,
        treeMismatch: 0,
        guidanceMismatch: 0,
        positionCount: 0,
        implementCount: 0,
        applicableDiff: 0,
        recordCount: 0,
        resultDist: { '符合': 0, '部分符合': 0, '不符合': 0, '不适用': 0, '': 0 },
        examples: []
    };

    flat.forEach((it, idx) => {
        const tpl = TEMPLATE[idx];
        if (!tpl) return;
        const treeOk = it.l1 === tpl.l1 && it.l2 === tpl.l2 && it.l3 === tpl.l3;
        const guiOk = it.guidance === tpl.guidance;
        if (!treeOk) {
            report.treeMismatch++;
            if (report.examples.length < 5) {
                report.examples.push({ idx: idx, xlsx: [it.l1, it.l2, it.l3], tpl: [tpl.l1, tpl.l2, tpl.l3] });
            }
        }
        if (!guiOk) report.guidanceMismatch++;
        if (it.position) report.positionCount++;
        if (it.implement) report.implementCount++;
        if (it.applicable !== (tpl.applicable || '')) report.applicableDiff++;
        if (it.record) report.recordCount++;
        report.resultDist[it.result] = (report.resultDist[it.result] || 0) + 1;
    });

    report.aligned = report.total === TEMPLATE.length && report.treeMismatch === 0;
    return report;
}

// ---------- 3. 模板覆盖：构建 / 保存 / 应用 / 恢复 ----------
/**
 * 构建按索引的模板覆盖（仅记录与内置不同的字段，且仅当树结构匹配时）
 */
function buildCriteriaOverrides(parsed) {
    const flat = [];
    parsed.sheets.forEach(s => s.items.forEach(it => flat.push(it)));
    const overrides = {};
    flat.forEach((it, idx) => {
        const tpl = TEMPLATE[idx];
        if (!tpl) return;
        if (it.l1 !== tpl.l1 || it.l2 !== tpl.l2 || it.l3 !== tpl.l3) return; // 结构不匹配则跳过
        const o = {};
        if (it.position) o.position = it.position;
        if (it.implement) o.implement = it.implement;
        if (it.applicable !== (tpl.applicable || '')) o.applicable = it.applicable;
        if (it.guidance && it.guidance !== tpl.guidance) o.guidance = it.guidance;
        if (Object.keys(o).length > 0) overrides[idx] = o;
    });
    return overrides;
}

function saveCriteriaOverride(parsed, sourceName) {
    const meta = {
        version: 1,
        source: sourceName,
        importedAt: new Date().toISOString(),
        itemCount: parsed.totalRows,
        overrides: buildCriteriaOverrides(parsed)
    };
    localStorage.setItem(CRITERIA_STORAGE_KEY, JSON.stringify(meta));
    return meta;
}

function getCriteriaMeta() {
    try {
        return JSON.parse(localStorage.getItem(CRITERIA_STORAGE_KEY) || 'null');
    } catch (e) {
        return null;
    }
}

/**
 * 将已保存的准则覆盖应用到全局 TEMPLATE（启动时与导入时调用）
 */
function applyStoredCriteria() {
    const meta = getCriteriaMeta();
    if (!meta || !meta.overrides) return false;
    let applied = 0;
    Object.keys(meta.overrides).forEach(k => {
        const idx = Number(k);
        const o = meta.overrides[k];
        const tpl = TEMPLATE[idx];
        if (!tpl) return;
        if (o.position !== undefined) tpl.position = o.position;
        if (o.implement !== undefined) tpl.implement = o.implement;
        if (o.applicable !== undefined) tpl.applicable = o.applicable;
        if (o.guidance !== undefined) tpl.guidance = o.guidance;
        applied++;
    });
    return applied > 0;
}

/**
 * 将全局 TEMPLATE 还原为内置快照（不操作 localStorage）
 */
function resetTemplateFromBuiltin() {
    TEMPLATE.forEach((tpl, i) => {
        const b = BUILTIN_TEMPLATE[i];
        if (!b) return;
        tpl.guidance = b.guidance;
        tpl.applicable = b.applicable;
        if (b.position !== undefined) tpl.position = b.position; else delete tpl.position;
        if (b.implement !== undefined) tpl.implement = b.implement; else delete tpl.implement;
    });
}

function restoreBuiltinCriteria() {
    if (!confirm('确定恢复内置评估准则吗？\n\n已导入的「评估位置 / 评估实施 / 适用对象」将还原为系统内置内容。')) return;
    localStorage.removeItem(CRITERIA_STORAGE_KEY);
    resetTemplateFromBuiltin();
    refreshCriteriaStatus();
    if (currentProjectId) renderTree(); else renderProjectList();
    alert('已恢复内置评估准则。');
}

// ---------- 4. 导入为评估项目 ----------
function buildProjectFromCriteria(parsed, fields) {
    const flat = [];
    parsed.sheets.forEach(s => s.items.forEach(it => flat.push(it)));

    const project = {
        id: Date.now().toString(),
        name: fields.name,
        target: fields.target,
        evaluator: fields.evaluator || '',
        date: fields.date || '',
        desc: fields.desc || '',
        applicable: fields.applicable || '',
        createdAt: new Date().toISOString(),
        items: {}
    };

    flat.forEach((it, idx) => {
        const tpl = TEMPLATE[idx];
        if (tpl && (it.l1 !== tpl.l1 || it.l2 !== tpl.l2 || it.l3 !== tpl.l3)) return; // 结构不匹配，保留未评估
        project.items[idx] = {
            record: it.record || '',
            result: it.result || '',
            applicable_override: ''
        };
    });

    // 补齐剩余指标为未评估
    TEMPLATE.forEach((_, idx) => {
        if (!project.items[idx]) project.items[idx] = { record: '', result: '', applicable_override: '' };
    });

    project.criteriaSource = parsed.sourceName || '';
    return project;
}

// ---------- 5. 界面交互 ----------
function showCriteriaImportModal() {
    if (!requirePermission('manage_projects', '导入评估准则')) return;
    document.getElementById('criteriaImportModal').style.display = 'flex';
    document.getElementById('criteriaFileName').textContent = '';
    document.getElementById('criteriaParseStatus').style.display = 'none';
    document.getElementById('criteriaSummary').style.display = 'none';
    document.getElementById('criteriaOptions').style.display = 'none';
    document.getElementById('criteriaImportConfirm').style.display = 'none';
    document.getElementById('criteriaProjectName').value = '';
    document.getElementById('criteriaProjectTarget').value = '';
    document.getElementById('criteriaProjectDate').valueAsDate = new Date();
    const user = getCurrentUser();
    if (user) document.getElementById('criteriaProjectEvaluator').value = user.name;
    refreshCriteriaStatus();
    window._criteriaParsed = null;
}

function hideCriteriaImportModal() {
    document.getElementById('criteriaImportModal').style.display = 'none';
}

function refreshCriteriaStatus() {
    const meta = getCriteriaMeta();
    const statusEl = document.getElementById('criteriaStatusText');
    const restoreBtn = document.getElementById('criteriaRestoreBtn');
    if (meta && meta.overrides && Object.keys(meta.overrides).length > 0) {
        statusEl.textContent = `已导入「${meta.source || '外部准则'}」(${Object.keys(meta.overrides).length} 项覆盖)`;
        restoreBtn.style.display = '';
    } else {
        statusEl.textContent = '内置';
        restoreBtn.style.display = 'none';
    }
}

async function handleCriteriaFile(file) {
    if (!file) return;
    const lower = file.name.toLowerCase();
    if (!lower.endsWith('.xlsx') && !lower.endsWith('.xls')) {
        alert('请选择 .xlsx / .xls 格式的Excel文件！');
        return;
    }

    const statusEl = document.getElementById('criteriaParseStatus');
    const summaryEl = document.getElementById('criteriaSummary');
    document.getElementById('criteriaFileName').textContent = file.name;
    statusEl.style.display = 'block';
    statusEl.textContent = '⏳ 正在解析文件...';
    summaryEl.style.display = 'none';
    document.getElementById('criteriaOptions').style.display = 'none';
    document.getElementById('criteriaImportConfirm').style.display = 'none';

    try {
        await loadLib('xlsx'); // Excel 组件按需加载
        const arrayBuffer = await file.arrayBuffer();
        const parsed = parseCriteriaWorkbook(arrayBuffer);
        parsed.sourceName = file.name;

        if (parsed.totalRows === 0) {
            statusEl.textContent = '❌ 未在文件中识别到评估准则工作表（需包含「评估指引」列，且工作表名称以「一、/二、/三、/四、」开头）。';
            return;
        }

        const report = matchCriteriaToTemplate(parsed);
        window._criteriaParsed = parsed;

        statusEl.textContent = `✅ 解析完成：识别 ${parsed.sheets.length} 个维度工作表，共 ${parsed.totalRows} 条评估项。`;
        renderCriteriaSummary(parsed, report);

        document.getElementById('criteriaOptions').style.display = 'block';
        document.getElementById('criteriaImportConfirm').style.display = '';

        // 预填项目名称：去掉扩展名
        const baseName = file.name.replace(/\.(xlsx|xls)$/i, '');
        document.getElementById('criteriaProjectName').value = baseName;
    } catch (err) {
        console.error('准则Excel解析失败:', err);
        statusEl.textContent = '❌ 解析失败：' + err.message;
    }
}

function renderCriteriaSummary(parsed, report) {
    const summaryEl = document.getElementById('criteriaSummary');
    const dist = report.resultDist;

    let html = '<div style="padding:12px 14px;background:#f5f7fa;border:1px solid #e0e0e0;border-radius:8px;font-size:13px;line-height:1.8;">';
    html += '<div style="font-weight:600;margin-bottom:6px;">📋 识别结果</div>';

    // 工作表明细
    parsed.sheets.forEach(s => {
        html += `<div>📄 ${escapeHtml(s.name)}：${s.items.length} 项</div>`;
    });

    html += `<div style="margin-top:6px;">`;
    if (report.aligned) {
        html += `<span style="color:#2e7d32;font-weight:600;">✓ 与系统内置准则完全对齐（${report.total} / ${report.templateCount} 项，树结构与评估指引一致）</span>`;
    } else {
        html += `<span style="color:#c62828;font-weight:600;">⚠ 与内置准则未完全对齐（共 ${report.total} 项，内置 ${report.templateCount} 项，结构不一致 ${report.treeMismatch} 处）</span>`;
    }
    html += '</div>';

    html += `<div style="display:grid;grid-template-columns:1fr 1fr;gap:2px 24px;margin-top:8px;color:#444;">`;
    html += `<div>📍 评估位置提示：<strong>${report.positionCount}</strong> 条</div>`;
    html += `<div>🔧 评估实施提示：<strong>${report.implementCount}</strong> 条</div>`;
    html += `<div>🏷 适用对象标注修正：<strong>${report.applicableDiff}</strong> 处</div>`;
    html += `<div>📝 示例评估记录：<strong>${report.recordCount}</strong> 条</div>`;
    html += `</div>`;

    html += `<div style="margin-top:8px;">判定结果分布：`;
    html += `符合 <strong>${dist['符合']}</strong>｜部分符合 <strong>${dist['部分符合']}</strong>（含基本符合）｜不符合 <strong>${dist['不符合']}</strong>｜不适用 <strong>${dist['不适用']}</strong>｜未评估 <strong>${dist['']}</strong>`;
    html += '</div>';

    if (!report.aligned && report.examples.length > 0) {
        html += '<div style="margin-top:8px;color:#c62828;font-size:12px;">结构不一致示例：';
        html += report.examples.map(e => `#${e.idx} (${e.xlsx.join(' / ')})`).join('；');
        html += '</div>';
    }

    html += '</div>';
    summaryEl.innerHTML = html;
    summaryEl.style.display = 'block';
}

function confirmCriteriaImport() {
    const parsed = window._criteriaParsed;
    if (!parsed) { alert('请先选择并解析准则Excel文件！'); return; }

    const optTemplate = document.getElementById('criteriaOptTemplate').checked;
    const optProject = document.getElementById('criteriaOptProject').checked;
    if (!optTemplate && !optProject) {
        alert('请至少选择一种导入方式！');
        return;
    }

    let createdProject = null;

    // ① 更新评估准则模板
    if (optTemplate) {
        if (!requirePermission('manage_projects', '更新评估准则模板')) return;
        saveCriteriaOverride(parsed, parsed.sourceName);
        applyStoredCriteria();
    }

    // ② 导入为评估项目
    if (optProject) {
        if (!requirePermission('create', '创建评估项目')) return;
        const name = document.getElementById('criteriaProjectName').value.trim();
        const target = document.getElementById('criteriaProjectTarget').value.trim();
        if (!name || !target) {
            alert('导入为评估项目时，请填写项目名称和评估对象！');
            return;
        }
        const project = buildProjectFromCriteria(parsed, {
            name: name,
            target: target,
            evaluator: document.getElementById('criteriaProjectEvaluator').value.trim(),
            date: document.getElementById('criteriaProjectDate').value,
            desc: '',
            applicable: document.getElementById('criteriaProjectApplicable').value
        });
        saveProject(project);
        createdProject = project;
    }

    hideCriteriaImportModal();
    renderProjectList();

    const msgs = [];
    if (optTemplate) msgs.push('已更新评估准则模板（刷新后继续生效，可随时「恢复内置」）');
    if (optProject) msgs.push(`已创建评估项目「${createdProject.name}」`);
    alert('✅ 导入成功！\n\n' + msgs.join('\n'));

    if (createdProject) {
        openProject(createdProject.id);
    } else {
        refreshCriteriaStatus();
    }
}
