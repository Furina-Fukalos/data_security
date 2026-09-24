// ============================================
// Word调研表导入：解析.docx并自动填充项目信息
// ============================================

/**
 * 从Word调研表中提取信息
 * @param {ArrayBuffer} arrayBuffer - .docx文件的ArrayBuffer
 * @returns {Promise<Object>} 解析后的结构化数据
 */
async function parseWordSurveyForm(arrayBuffer) {
    const result = await mammoth.convertToHtml({ arrayBuffer: arrayBuffer });
    const html = result.value;

    // 创建临时DOM解析HTML
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const tables = doc.querySelectorAll('table');

    const parsed = {
        basicInfo: {},      // 评估基本信息
        systemDesc: '',     // 系统功能描述
        dataAssets: [],     // 数据资产情况
        dataClassification: [] // 数据分类分级情况
    };

    // Word文档中所有内容在一张大表里，按section分割
    // 也可能分成多张表，需要兼容处理
    let allRows = [];
    tables.forEach(table => {
        const rows = table.querySelectorAll('tr');
        rows.forEach(row => allRows.push(row));
    });

    let currentSection = '';
    let dataAssetHeaders = [];
    let dataClassificationHeaders = [];

    allRows.forEach((row, idx) => {
        const cells = Array.from(row.querySelectorAll('td,th')).map(td => td.textContent.trim());

        // 检测section标题行（单列且包含章节标题）
        if (cells.length === 1) {
            const text = cells[0];
            if (text.includes('评估基本信息')) {
                currentSection = 'basicInfo';
            } else if (text.includes('业务和信息系统情况')) {
                currentSection = 'systemDesc';
            } else if (text.includes('数据资产情况')) {
                currentSection = 'dataAssets';
            } else if (text.includes('数据分类分级情况')) {
                currentSection = 'dataClassification';
            }
            return;
        }

        // 根据当前section处理
        if (currentSection === 'basicInfo' && cells.length >= 2) {
            // label-value对，格式: [label, value, label, value, label, value]
            for (let i = 0; i < cells.length; i += 2) {
                const label = cells[i];
                const value = cells[i + 1] || '';
                if (label) {
                    parsed.basicInfo[label] = value;
                }
            }
        } else if (currentSection === 'systemDesc' && cells.length >= 2) {
            // [label, value]
            if (cells[0] && cells[0].includes('系统功能描述')) {
                parsed.systemDesc = cells[1] || '';
            }
        } else if (currentSection === 'dataAssets') {
            // 第一行是header
            if (dataAssetHeaders.length === 0 && cells.some(c => c.includes('数据资产名称'))) {
                dataAssetHeaders = cells;
            } else if (dataAssetHeaders.length > 0) {
                // 数据行
                if (cells.some(c => c.trim() !== '')) {
                    const item = {};
                    dataAssetHeaders.forEach((h, i) => {
                        if (h) item[h] = cells[i] || '';
                    });
                    parsed.dataAssets.push(item);
                }
            }
        } else if (currentSection === 'dataClassification') {
            // 第一行是header
            if (dataClassificationHeaders.length === 0 && cells.some(c => c.includes('数据级别'))) {
                dataClassificationHeaders = cells;
            } else if (dataClassificationHeaders.length > 0) {
                // 数据行
                if (cells.some(c => c.trim() !== '')) {
                    const item = {};
                    dataClassificationHeaders.forEach((h, i) => {
                        if (h) item[h] = cells[i] || '';
                    });
                    parsed.dataClassification.push(item);
                }
            }
        }
    });

    return parsed;
}

/**
 * 将解析的Word数据映射到项目创建表单
 * @param {Object} parsed - parseWordSurveyForm返回的结构化数据
 */
function fillProjectFormFromWord(parsed) {
    const bi = parsed.basicInfo;

    // 映射字段到表单
    const fieldMap = {
        'projectName': bi['评估项目名称*'] || bi['评估项目名称'] || '',
        'projectTarget': bi['被评估对象*'] || bi['被评估对象'] || '',
        'projectEvaluator': bi['评估机构*'] || bi['评估机构'] || '',
        'projectDesc': parsed.systemDesc || ''
    };

    // 处理日期：项目提交时间
    const submitDate = bi['项目提交时间*'] || bi['项目提交时间'] || '';
    if (submitDate) {
        // 尝试解析各种日期格式
        const dateStr = normalizeDate(submitDate);
        if (dateStr) {
            fieldMap['projectDate'] = dateStr;
        }
    }

    // 填充表单
    Object.keys(fieldMap).forEach(id => {
        const el = document.getElementById(id);
        if (el && fieldMap[id]) {
            el.value = fieldMap[id];
        }
    });

    // 行业领域映射到适用对象
    const industry = bi['所属行业领域*'] || bi['所属行业领域'] || '';
    if (industry) {
        // 如果行业领域匹配预设选项则自动选择，否则保留默认
        const selectEl = document.getElementById('projectApplicable');
        if (selectEl) {
            for (const option of selectEl.options) {
                if (industry.includes(option.value) || option.value.includes(industry)) {
                    selectEl.value = option.value;
                    break;
                }
            }
        }
    }

    // 返回额外数据用于预览和存储
    return {
        basicInfo: bi,
        systemDesc: parsed.systemDesc,
        dataAssets: parsed.dataAssets,
        dataClassification: parsed.dataClassification
    };
}

/**
 * 标准化日期格式为 YYYY-MM-DD
 */
function normalizeDate(dateStr) {
    if (!dateStr) return '';
    // 尝试解析 YYYY年MM月DD日
    const cnMatch = dateStr.match(/(\d{4})年(\d{1,2})月(\d{1,2})日?/);
    if (cnMatch) {
        return `${cnMatch[1]}-${String(cnMatch[2]).padStart(2, '0')}-${String(cnMatch[3]).padStart(2, '0')}`;
    }
    // 尝试解析 YYYY/MM/DD 或 YYYY-MM-DD
    const slashMatch = dateStr.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
    if (slashMatch) {
        return `${slashMatch[1]}-${String(slashMatch[2]).padStart(2, '0')}-${String(slashMatch[3]).padStart(2, '0')}`;
    }
    // 尝试直接解析
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
        return d.toISOString().slice(0, 10);
    }
    return '';
}

/**
 * 渲染Word导入预览
 * @param {Object} wordData - fillProjectFormFromWord返回的数据
 */
function renderWordImportPreview(wordData) {
    let html = '<div style="margin-top:12px;padding:12px;background:#f0f7ff;border-radius:8px;border:1px solid #b3d9ff;">';
    html += '<div style="font-weight:600;color:#1a237e;margin-bottom:8px;">📄 Word调研表导入预览</div>';

    // 基本信息
    const bi = wordData.basicInfo;
    const basicFields = [
        ['评估项目名称', '评估项目名称*'],
        ['被评估对象', '被评估对象*'],
        ['评估机构', '评估机构*'],
        ['所属行业领域', '所属行业领域*'],
        ['统一社会信用代码', '统一社会信用代码'],
        ['组织机构代码', '组织机构代码'],
        ['经营范围规模', '经营范围规模'],
        ['业务地区', '业务地区'],
        ['上市情况', '上市情况'],
        ['行政许可情况', '行政许可情况'],
        ['运营控制情况', '运营控制情况'],
        ['项目提交时间', '项目提交时间*'],
        ['综合得分', '综合得分*'],
        ['评估结论', '评估结论*'],
        ['评估结论描述', '评估结论描述']
    ];

    const filledBasic = basicFields.filter(([_, key]) => bi[key]);
    if (filledBasic.length > 0) {
        html += '<div style="margin-bottom:8px;"><strong>基本信息：</strong></div>';
        html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 16px;font-size:12px;color:#444;">';
        filledBasic.forEach(([label, key]) => {
            html += `<div><span style="color:#888;">${label}:</span> <strong>${escapeHtml(bi[key])}</strong></div>`;
        });
        html += '</div>';
    }

    // 系统功能描述
    if (wordData.systemDesc) {
        html += `<div style="margin-top:8px;font-size:12px;color:#444;"><span style="color:#888;">系统功能描述:</span> ${escapeHtml(wordData.systemDesc.substring(0, 100))}${wordData.systemDesc.length > 100 ? '...' : ''}</div>`;
    }

    // 数据资产
    if (wordData.dataAssets.length > 0) {
        html += `<div style="margin-top:8px;"><strong>数据资产（${wordData.dataAssets.length}条）：</strong></div>`;
        html += '<div style="overflow-x:auto;margin-top:4px;"><table class="word-preview-table" style="font-size:11px;width:100%;border-collapse:collapse;">';
        const headers = Object.keys(wordData.dataAssets[0]);
        html += '<tr>' + headers.map(h => `<th style="border:1px solid #ddd;padding:4px;background:#e3f2fd;">${escapeHtml(h)}</th>`).join('') + '</tr>';
        wordData.dataAssets.slice(0, 5).forEach(item => {
            html += '<tr>' + headers.map(h => `<td style="border:1px solid #ddd;padding:4px;">${escapeHtml(item[h] || '')}</td>`).join('') + '</tr>';
        });
        if (wordData.dataAssets.length > 5) {
            html += `<tr><td colspan="${headers.length}" style="border:1px solid #ddd;padding:4px;text-align:center;color:#888;">... 共 ${wordData.dataAssets.length} 条</td></tr>`;
        }
        html += '</table></div>';
    }

    // 数据分类分级
    if (wordData.dataClassification.length > 0) {
        html += `<div style="margin-top:8px;"><strong>数据分类分级（${wordData.dataClassification.length}条）：</strong></div>`;
        html += '<div style="overflow-x:auto;margin-top:4px;"><table class="word-preview-table" style="font-size:11px;width:100%;border-collapse:collapse;">';
        const headers = Object.keys(wordData.dataClassification[0]);
        html += '<tr>' + headers.map(h => `<th style="border:1px solid #ddd;padding:4px;background:#e8f5e9;">${escapeHtml(h)}</th>`).join('') + '</tr>';
        wordData.dataClassification.slice(0, 5).forEach(item => {
            html += '<tr>' + headers.map(h => `<td style="border:1px solid #ddd;padding:4px;">${escapeHtml(item[h] || '')}</td>`).join('') + '</tr>';
        });
        if (wordData.dataClassification.length > 5) {
            html += `<tr><td colspan="${headers.length}" style="border:1px solid #ddd;padding:4px;text-align:center;color:#888;">... 共 ${wordData.dataClassification.length} 条</td></tr>`;
        }
        html += '</table></div>';
    }

    html += '</div>';
    return html;
}

/**
 * 处理Word文件导入
 */
let _importedWordData = null;

async function handleWordImport(file) {
    if (!file) return;

    // 验证文件类型
    const fileName = file.name.toLowerCase();
    if (!fileName.endsWith('.docx')) {
        alert('请选择 .docx 格式的Word文档！');
        return;
    }

    // 显示加载状态
    const importBtn = document.getElementById('importWordBtn');
    const originalText = importBtn.textContent;
    importBtn.textContent = '⏳ 解析中...';
    importBtn.disabled = true;

    try {
        await loadLib('mammoth'); // Word 解析组件按需加载
        const arrayBuffer = await file.arrayBuffer();
        const parsed = await parseWordSurveyForm(arrayBuffer);
        const wordData = fillProjectFormFromWord(parsed);
        _importedWordData = wordData;

        // 显示预览
        const previewEl = document.getElementById('wordImportPreview');
        if (previewEl) {
            previewEl.innerHTML = renderWordImportPreview(wordData);
            previewEl.style.display = 'block';
        }

        // 提示成功
        const filledCount = Object.values(wordData.basicInfo).filter(v => v).length;
        alert(`导入成功！\n\n已识别并填充：\n- 基本信息 ${filledCount} 项\n- 数据资产 ${wordData.dataAssets.length} 条\n- 数据分类分级 ${wordData.dataClassification.length} 条\n\n请检查并确认表单信息。`);
    } catch (err) {
        console.error('Word导入失败:', err);
        alert('Word文档解析失败：' + err.message + '\n\n请确保使用正确的《数据安全风险评估系统信息调研表》模板。');
    } finally {
        importBtn.textContent = originalText;
        importBtn.disabled = false;
    }
}

/**
 * 触发Word文件选择
 */
function triggerWordImport() {
    const input = document.getElementById('wordFileInput');
    if (input) {
        input.click();
    }
}

/**
 * 获取已导入的Word数据（供createProject使用）
 */
function getImportedWordData() {
    return _importedWordData;
}

/**
 * 清除已导入的Word数据
 */
function clearImportedWordData() {
    _importedWordData = null;
    const previewEl = document.getElementById('wordImportPreview');
    if (previewEl) {
        previewEl.innerHTML = '';
        previewEl.style.display = 'none';
    }
}
