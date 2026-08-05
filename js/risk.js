// ============================================
// 风险源分析功能
// ============================================

let editingRiskId = null;
function calculateRiskLevel(impact, probability) {
    if (!impact || !probability) return '';
    return RISK_MATRIX[probability]?.[impact] || '';
}

function getProjectRiskSources() {
    const project = getProject(currentProjectId);
    if (!project) return [];
    if (!project.riskSources) project.riskSources = [];
    return project.riskSources;
}

function showAddRiskModal(riskId) {
    editingRiskId = riskId || null;
    const modal = document.getElementById('riskModal');
    const title = document.getElementById('riskModalTitle');
    
    // Reset form
    document.getElementById('riskName').value = '';
    document.getElementById('riskDesc').value = '';
    document.getElementById('riskCategory').value = '组织权益';
    document.getElementById('riskImpact').value = '';
    document.getElementById('riskProbability').value = '';
    document.getElementById('riskSuggestion').value = '';
    document.getElementById('riskLevelPreview').innerHTML = '请选择危害程度和可能性后自动计算';
    document.getElementById('riskLevelPreview').style.color = '#999';
    
    if (riskId) {
        const risks = getProjectRiskSources();
        const risk = risks.find(r => r.id === riskId);
        if (risk) {
            title.textContent = '编辑风险源';
            document.getElementById('riskName').value = risk.name || '';
            document.getElementById('riskDesc').value = risk.desc || '';
            document.getElementById('riskCategory').value = risk.category || '组织权益';
            document.getElementById('riskImpact').value = risk.impact || '';
            document.getElementById('riskProbability').value = risk.probability || '';
            document.getElementById('riskSuggestion').value = risk.suggestion || '';
            updateRiskLevelPreview();
        }
    } else {
        title.textContent = '添加风险源';
    }
    
    modal.style.display = 'flex';
}

function hideRiskModal() {
    document.getElementById('riskModal').style.display = 'none';
    editingRiskId = null;
}

function updateRiskLevelPreview() {
    const impact = document.getElementById('riskImpact').value;
    const probability = document.getElementById('riskProbability').value;
    const preview = document.getElementById('riskLevelPreview');
    
    if (!impact || !probability) {
        preview.innerHTML = '请选择危害程度和可能性后自动计算';
        preview.style.color = '#999';
        preview.style.background = '#f5f5f5';
        return;
    }
    
    const level = calculateRiskLevel(impact, probability);
    const colors = RISK_LEVEL_COLORS[level] || { bg: '#999', text: '#fff' };
    preview.innerHTML = `${level}`;
    preview.style.color = colors.text;
    preview.style.background = colors.bg;
}

function saveRiskSource() {
    const project = getProject(currentProjectId);
    if (!project) return;
    
    const name = document.getElementById('riskName').value.trim();
    if (!name) {
        alert('请填写风险源名称！');
        return;
    }
    
    const desc = document.getElementById('riskDesc').value.trim();
    const category = document.getElementById('riskCategory').value;
    const impact = document.getElementById('riskImpact').value;
    const probability = document.getElementById('riskProbability').value;
    const suggestion = document.getElementById('riskSuggestion').value.trim();
    
    if (!impact || !probability) {
        alert('请选择风险危害程度和风险发生可能性！');
        return;
    }
    
    const level = calculateRiskLevel(impact, probability);
    
    if (!project.riskSources) project.riskSources = [];
    
    if (editingRiskId) {
        const idx = project.riskSources.findIndex(r => r.id === editingRiskId);
        if (idx >= 0) {
            project.riskSources[idx] = {
                ...project.riskSources[idx],
                name, desc, category, impact, probability, level, suggestion
            };
        }
    } else {
        project.riskSources.push({
            id: Date.now().toString(),
            name, desc, category, impact, probability, level, suggestion,
            createdAt: new Date().toISOString()
        });
    }
    
    saveProject(project);
    hideRiskModal();
    renderRiskSources();
}

function deleteRiskSource(riskId) {
    if (!hasPermission('manage_risks') && !hasPermission('all')) {
        alert('您没有删除风险源的权限！');
        return;
    }
    if (!confirm('确定要删除这个风险源吗？')) return;
    const project = getProject(currentProjectId);
    if (!project || !project.riskSources) return;
    project.riskSources = project.riskSources.filter(r => r.id !== riskId);
    saveProject(project);
    renderRiskSources();
}

function renderRiskSources() {
    const project = getProject(currentProjectId);
    if (!project) return;
    const risks = getProjectRiskSources();
    
    document.getElementById('riskCard').style.display = 'block';
    
    // Summary
    const summaryEl = document.getElementById('riskSummary');
    if (risks.length === 0) {
        summaryEl.innerHTML = '<div style="text-align:center;padding:30px;color:#999;font-size:14px;">暂无风险源记录，点击"添加风险源"开始分析</div>';
        document.getElementById('riskMatrix').innerHTML = '';
        document.getElementById('riskList').innerHTML = '';
        return;
    }
    
    // Count by level
    const levelCount = {};
    RISK_LEVEL_ORDER.forEach(l => levelCount[l] = 0);
    risks.forEach(r => { if (levelCount[r.level] !== undefined) levelCount[r.level]++; });
    
    let summaryHtml = '<div style="display:flex;gap:12px;flex-wrap:wrap;">';
    RISK_LEVEL_ORDER.forEach(level => {
        const colors = RISK_LEVEL_COLORS[level];
        summaryHtml += `
            <div style="flex:1;min-width:100px;padding:12px;border-radius:8px;background:${colors.light};border:1px solid ${colors.bg}33;text-align:center;">
                <div style="font-size:28px;font-weight:800;color:${colors.bg};">${levelCount[level]}</div>
                <div style="font-size:12px;color:${colors.bg};margin-top:4px;">${level}</div>
            </div>
        `;
    });
    summaryHtml += `<div style="flex:1;min-width:100px;padding:12px;border-radius:8px;background:#f5f5f5;border:1px solid #ddd;text-align:center;">
        <div style="font-size:28px;font-weight:800;color:#333;">${risks.length}</div>
        <div style="font-size:12px;color:#666;margin-top:4px;">风险源总数</div>
    </div>`;
    summaryHtml += '</div>';
    summaryEl.innerHTML = summaryHtml;
    
    // Risk Matrix visualization
    renderRiskMatrix(risks);
    
    // Risk List
    const listEl = document.getElementById('riskList');
    const sortedRisks = [...risks].sort((a, b) => {
        return RISK_LEVEL_ORDER.indexOf(a.level) - RISK_LEVEL_ORDER.indexOf(b.level);
    });
    
    let listHtml = '<h4 style="margin:16px 0 12px;font-size:15px;">📋 风险源清单</h4>';
    sortedRisks.forEach(risk => {
        const colors = RISK_LEVEL_COLORS[risk.level] || { bg: '#999', light: '#f5f5f5' };
        listHtml += `
            <div style="padding:14px 16px;border:1px solid #e0e0e0;border-left:4px solid ${colors.bg};border-radius:6px;margin-bottom:10px;background:white;">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:8px;">
                    <div style="flex:1;">
                        <div style="font-size:15px;font-weight:600;color:#333;margin-bottom:4px;">${escapeHtml(risk.name)}</div>
                        <div style="font-size:12px;color:#888;">影响对象：${escapeHtml(risk.category)}</div>
                    </div>
                    <span style="padding:4px 12px;border-radius:12px;background:${colors.bg};color:${colors.text};font-size:12px;font-weight:600;white-space:nowrap;">${risk.level}</span>
                </div>
                ${risk.desc ? `<div style="font-size:13px;color:#555;line-height:1.6;margin-bottom:8px;">${escapeHtml(risk.desc)}</div>` : ''}
                <div style="display:flex;gap:16px;font-size:12px;color:#666;margin-bottom:8px;">
                    <span>危害程度: <strong>${risk.impact}</strong></span>
                    <span>可能性: <strong>${risk.probability}</strong></span>
                </div>
                ${risk.suggestion ? `<div style="padding:8px 12px;background:${colors.light};border-radius:4px;font-size:13px;color:#444;line-height:1.6;">💡 ${escapeHtml(risk.suggestion)}</div>` : ''}
                <div style="display:flex;gap:8px;margin-top:10px;">
                    <button class="btn btn-sm btn-default" onclick="showAddRiskModal('${risk.id}')">✏️ 编辑</button>
                    <button class="btn btn-sm btn-danger" onclick="deleteRiskSource('${risk.id}')">🗑 删除</button>
                </div>
            </div>
        `;
    });
    listEl.innerHTML = listHtml;
}

function renderRiskMatrix(risks) {
    const matrixEl = document.getElementById('riskMatrix');
    const impacts = ['很高', '高', '中', '低', '很低'];
    const probabilities = ['高', '中', '低'];
    
    // Count risks in each cell
    const cellData = {};
    probabilities.forEach(p => {
        impacts.forEach(i => {
            cellData[`${p}-${i}`] = risks.filter(r => r.probability === p && r.impact === i);
        });
    });
    
    let html = '<h4 style="margin:16px 0 10px;font-size:15px;">📊 风险评价矩阵</h4>';
    html += '<div style="overflow-x:auto;"><table style="border-collapse:collapse;font-size:12px;width:100%;max-width:600px;">';
    html += '<tr><td style="padding:8px;border:1px solid #ddd;background:#f5f5f5;text-align:center;font-weight:600;">可能性<br>↓<br>危害程度→</td>';
    impacts.forEach(i => {
        html += `<td style="padding:8px;border:1px solid #ddd;background:#e8eaf6;text-align:center;font-weight:600;width:16%;">${i}</td>`;
    });
    html += '</tr>';
    
    probabilities.forEach(p => {
        html += `<tr><td style="padding:8px;border:1px solid #ddd;background:#e8eaf6;text-align:center;font-weight:600;">${p}</td>`;
        impacts.forEach(i => {
            const cellRisks = cellData[`${p}-${i}`];
            const level = calculateRiskLevel(i, p);
            const colors = RISK_LEVEL_COLORS[level] || { bg: '#fff', text: '#333', light: '#fff' };
            const count = cellRisks.length;
            const names = cellRisks.map(r => r.name).join('；');
            html += `<td style="padding:8px;border:1px solid #ddd;background:${colors.light};text-align:center;vertical-align:middle;position:relative;" title="${escapeHtml(names)}">
                <div style="font-size:10px;color:${colors.bg};margin-bottom:2px;">${level}</div>
                <div style="font-size:20px;font-weight:700;color:${colors.bg};">${count > 0 ? count : '-'}</div>
            </td>`;
        });
        html += '</tr>';
    });
    html += '</table></div>';
    html += '<div style="font-size:11px;color:#999;margin-top:6px;">单元格数字表示该风险等级的风险源数量，鼠标悬停可查看风险源名称</div>';
    matrixEl.innerHTML = html;
}

function showRiskReference() {
    const refBody = document.getElementById('riskRefBody');
    
    let html = '';
    
    // 1. 风险危害程度
    html += '<h4 style="color:#1a237e;margin-bottom:10px;">一、风险危害程度（5级）</h4>';
    html += '<div style="font-size:13px;color:#555;margin-bottom:12px;line-height:1.6;">风险危害程度从低到高分为很低、低、中、高、很高5个级别。考虑数据价值、数据重要性、风险源严重程度三个因素。</div>';
    html += '<table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:20px;"><thead><tr style="background:#1a237e;color:white;"><th style="padding:8px;border:1px solid #ddd;">影响对象</th><th style="padding:8px;border:1px solid #ddd;">危害程度</th><th style="padding:8px;border:1px solid #ddd;">参考说明</th></tr></thead><tbody>';
    
    const impactRef = [
        ['国家安全', '很高', '直接危害国家安全重点领域，如政治安全。'],
        ['国家安全', '高', '关系国家安全重点领域，或对任一领域国家安全造成严重威胁。'],
        ['国家安全', '中', '对任一领域国家安全造成威胁。'],
        ['经济运行', '很高', '关系国民经济命脉，严重影响重要行业运行和发展，可导致大面积业务中断。'],
        ['经济运行', '高', '直接影响宏观经济运行，或影响地级市/行业内多个企业，对核心业务造成严重影响。'],
        ['经济运行', '中', '对单个行业领域造成一般危害，受影响范围较小、持续时间较短。'],
        ['社会秩序', '很高', '关系重要民生，可导致特别重大突发事件，引起省级大部分地区社会恐慌。'],
        ['社会秩序', '高', '可导致重大突发事件，影响地市大部分地区社会稳定，严重影响政务职能。'],
        ['社会秩序', '中', '对人民群众日常生活秩序造成一般影响，影响企事业单位经营秩序。'],
        ['公共利益', '很高', '导致省级大部分地区公共资源供应长期瘫痪，1000万人以上无法使用公共服务。'],
        ['公共利益', '高', '直接危害公共健康安全，导致地市大部分地区公共资源较长期中断，100万人以上受影响。'],
        ['公共利益', '中', '对公共利益产生一般危害，影响小范围社会成员使用公共服务。'],
        ['组织权益', '中', '可能导致组织遭严重处罚（取消经营资格等），重大经济或技术损失，面临破产。'],
        ['组织权益', '低', '可能导致组织遭处罚（暂停业务等），较大经济或技术损失，破坏声誉。'],
        ['组织权益', '很低', '可能导致个别诉讼，部分业务中断，经济利益、声誉轻微受损。'],
        ['个人权益', '中', '个人信息主体遭受重大、不可消除的影响，可能导致死亡、长期疾病等。'],
        ['个人权益', '低', '个人信息主体遭受较大影响，如诈骗、资金被盗、信用受损、被解雇等。'],
        ['个人权益', '很低', '个人信息主体遭受困扰但可克服，如额外成本、产生误解、较小疾病等。'],
    ];
    
    impactRef.forEach((row, i) => {
        const bg = i % 2 === 0 ? '#f9f9f9' : '#fff';
        const levelColor = row[1] === '很高' ? '#c62828' : row[1] === '高' ? '#e65100' : row[1] === '中' ? '#ed6c02' : row[1] === '低' ? '#1565c0' : '#2e7d32';
        html += `<tr style="background:${bg};"><td style="padding:6px 8px;border:1px solid #ddd;">${row[0]}</td><td style="padding:6px 8px;border:1px solid #ddd;color:${levelColor};font-weight:600;">${row[1]}</td><td style="padding:6px 8px;border:1px solid #ddd;">${row[2]}</td></tr>`;
    });
    html += '</tbody></table>';
    
    // 2. 风险发生可能性
    html += '<h4 style="color:#1a237e;margin-bottom:10px;margin-top:20px;">二、风险发生可能性（3级）</h4>';
    html += '<div style="font-size:13px;color:#555;margin-bottom:12px;line-height:1.6;">主要考虑风险源发生频率、安全措施有效性和完备性、风险源关联性。等级越高代表措施越不完备，风险越可能发生。</div>';
    html += '<table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:20px;"><thead><tr style="background:#1a237e;color:white;"><th style="padding:8px;border:1px solid #ddd;width:80px;">等级</th><th style="padding:8px;border:1px solid #ddd;">描述</th></tr></thead><tbody>';
    
    const probRef = [
        ['高', '涉及违法违规行为、缺少数据安全措施或安全措施有效性较弱，被评估对象或同类组织多次高频发生相关风险源，或容易与其他风险源结合引发风险，风险隐患发生可能性高。'],
        ['中', '有一定数据安全措施，但有效性不足，被评估对象或同类组织发生相关风险源，或有一定概率与其他风险源结合引发风险，风险隐患发生可能性一般。'],
        ['低', '数据安全措施比较到位、完备，被评估对象或同类组织很少发生相关风险源，或很难与其他风险源结合引发风险，风险隐患发生可能性低。'],
    ];
    
    probRef.forEach((row, i) => {
        const bg = i % 2 === 0 ? '#f9f9f9' : '#fff';
        const levelColor = row[0] === '高' ? '#c62828' : row[0] === '中' ? '#ed6c02' : '#2e7d32';
        html += `<tr style="background:${bg};"><td style="padding:6px 8px;border:1px solid #ddd;color:${levelColor};font-weight:600;text-align:center;">${row[0]}</td><td style="padding:6px 8px;border:1px solid #ddd;">${row[1]}</td></tr>`;
    });
    html += '</tbody></table>';
    
    // 3. 风险评价矩阵
    html += '<h4 style="color:#1a237e;margin-bottom:10px;margin-top:20px;">三、数据安全风险评价矩阵</h4>';
    html += '<div style="font-size:13px;color:#555;margin-bottom:12px;line-height:1.6;">综合风险危害程度及风险发生可能性对安全风险进行综合评价，结果分为：重大风险、高风险、中风险、低风险、轻微风险。</div>';
    
    const impacts = ['很高', '高', '中', '低', '很低'];
    const probabilities = ['高', '中', '低'];
    
    html += '<table style="width:100%;border-collapse:collapse;font-size:12px;max-width:600px;"><thead><tr><th style="padding:8px;border:1px solid #ddd;background:#e8eaf6;">可能性<br>危害程度</th>';
    impacts.forEach(i => {
        html += `<th style="padding:8px;border:1px solid #ddd;background:#e8eaf6;">${i}</th>`;
    });
    html += '</tr></thead><tbody>';
    
    probabilities.forEach(p => {
        html += `<tr><td style="padding:8px;border:1px solid #ddd;background:#e8eaf6;text-align:center;font-weight:600;">${p}</td>`;
        impacts.forEach(i => {
            const level = calculateRiskLevel(i, p);
            const colors = RISK_LEVEL_COLORS[level];
            html += `<td style="padding:10px;border:1px solid #ddd;background:${colors.bg};color:${colors.text};text-align:center;font-weight:600;">${level}</td>`;
        });
        html += '</tr>';
    });
    html += '</tbody></table>';
    
    // Risk level descriptions
    html += '<h4 style="color:#1a237e;margin-bottom:10px;margin-top:20px;">四、风险等级说明</h4>';
    const levelDescs = [
        ['重大风险', '#c62828', '可能直接影响国家安全的数据安全风险。'],
        ['高风险', '#e65100', '可能直接影响经济运行、社会稳定、公共健康安全，或对国家安全造成间接影响。'],
        ['中风险', '#ed6c02', '可能直接对企业合法权益造成较严重影响，或对自然人造成严重侵害，或对经济运行、社会稳定造成较严重间接影响。'],
        ['低风险', '#1565c0', '可能直接对企业合法权益造成一般影响，或对自然人造成侵害，或对社会公众权益有一定影响。'],
        ['轻微风险', '#2e7d32', '可能对企业权益造成较小影响，或对自然人不造成侵害或仅产生较轻微危害。'],
    ];
    levelDescs.forEach(([name, color, desc]) => {
        html += `<div style="display:flex;gap:10px;align-items:flex-start;margin-bottom:8px;padding:8px 12px;background:#f9f9f9;border-radius:4px;">
            <span style="padding:2px 10px;border-radius:10px;background:${color};color:white;font-size:11px;font-weight:600;white-space:nowrap;">${name}</span>
            <span style="font-size:12px;color:#555;line-height:1.5;">${desc}</span>
        </div>`;
    });
    
    refBody.innerHTML = html;
    document.getElementById('riskRefModal').style.display = 'flex';
}

function exportRiskReport() {
    const project = getProject(currentProjectId);
    if (!project) return;
    const risks = getProjectRiskSources();
    
    if (risks.length === 0) {
        alert('暂无风险源数据，请先添加风险源！');
        return;
    }
    
    const levelCount = {};
    RISK_LEVEL_ORDER.forEach(l => levelCount[l] = 0);
    risks.forEach(r => { if (levelCount[r.level] !== undefined) levelCount[r.level]++; });
    
    let report = `========================================\n`;
    report += `    数据安全风险源分析报告\n`;
    report += `========================================\n\n`;
    report += `项目名称：${project.name}\n`;
    report += `评估对象：${project.target}\n`;
    report += `评估人员：${project.evaluator || '-'}\n`;
    report += `评估日期：${project.date || '-'}\n`;
    report += `生成时间：${new Date().toLocaleString('zh-CN')}\n\n`;
    report += `----------------------------------------\n`;
    report += `           风险源统计\n`;
    report += `----------------------------------------\n\n`;
    report += `风险源总数：${risks.length}\n\n`;
    RISK_LEVEL_ORDER.forEach(level => {
        report += `${level}：${levelCount[level]} 个\n`;
    });
    report += `\n`;
    
    report += `----------------------------------------\n`;
    report += `           风险评价矩阵\n`;
    report += `----------------------------------------\n\n`;
    report += `          很高    高      中      低      很低\n`;
    ['高', '中', '低'].forEach(p => {
        report += `可能性${p}  `;
        ['很高', '高', '中', '低', '很低'].forEach(i => {
            const level = calculateRiskLevel(i, p);
            const count = risks.filter(r => r.probability === p && r.impact === i).length;
            report += `${level}(${count})  `;
        });
        report += `\n`;
    });
    report += `\n`;
    
    report += `----------------------------------------\n`;
    report += `           风险源清单\n`;
    report += `----------------------------------------\n\n`;
    
    const sortedRisks = [...risks].sort((a, b) => {
        return RISK_LEVEL_ORDER.indexOf(a.level) - RISK_LEVEL_ORDER.indexOf(b.level);
    });
    
    sortedRisks.forEach((risk, i) => {
        report += `${i + 1}. ${risk.name}\n`;
        report += `   风险等级：${risk.level}\n`;
        report += `   影响对象：${risk.category}\n`;
        report += `   危害程度：${risk.impact}\n`;
        report += `   发生可能性：${risk.probability}\n`;
        if (risk.desc) report += `   描述：${risk.desc}\n`;
        if (risk.suggestion) report += `   处置建议：${risk.suggestion}\n`;
        report += `\n`;
    });
    
    report += `========================================\n`;
    report += `     报告结束\n`;
    report += `========================================\n`;
    
    const blob = new Blob([report], { type: 'text/plain;charset=utf-8' });
    downloadBlob(blob, `风险源分析报告_${project.target}_${project.date || new Date().toISOString().slice(0,10)}.txt`);
}
