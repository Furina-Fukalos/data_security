// ============================================
// 项目详情：树形评估、评分、报告导出、批量设置
// ============================================

function openProject(id) {
    try {
        currentProjectId = id;
        const project = getProject(id);
        if (!project) return;

        document.getElementById('dashboardView').style.display = 'none';
        document.getElementById('projectView').style.display = 'block';
        document.getElementById('projectTitle').textContent = project.name;
        
        // Add JSON export button (避免重复添加)
        const cardHeaderRight = document.querySelector('#projectView .card-header > div:last-child');
        if (cardHeaderRight && !cardHeaderRight.querySelector('.backup-btn')) {
            const jsonBtn = document.createElement('button');
            jsonBtn.className = 'btn btn-default btn-sm backup-btn';
            jsonBtn.style.marginLeft = '8px';
            jsonBtn.textContent = '💾 备份项目';
            jsonBtn.onclick = exportSingleProject;
            cardHeaderRight.appendChild(jsonBtn);
        }
        
        document.getElementById('projectInfo').innerHTML = `
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;font-size:13px;">
                <div><strong>评估对象：</strong>${escapeHtml(project.target)}</div>
                <div><strong>评估人员：</strong>${escapeHtml(project.evaluator || '-')}</div>
                <div><strong>评估日期：</strong>${project.date || '-'}</div>
                <div><strong>适用对象：</strong>${project.applicable || '全部适用对象'}</div>
                ${project.desc ? `<div style="grid-column:1/-1;"><strong>项目描述：</strong>${escapeHtml(project.desc)}</div>` : ''}
            </div>
        `;
        
        // 权限控制：评估人员隐藏删除项目按钮
        const isPrivileged = hasPermission('delete') || hasPermission('all');
        if (!isPrivileged) {
            const deleteBtn = document.querySelector('#projectView button[onclick="deleteCurrentProject()"]');
            if (deleteBtn) deleteBtn.style.display = 'none';
            const backupBtn = document.querySelector('.backup-btn');
            if (backupBtn) backupBtn.style.display = 'none';
        }
        
        // Auto-set filter based on project's applicable setting
        if (project.applicable) {
            document.getElementById('filterApplicable').value = project.applicable;
        }

        // Setup filter dropdowns
        const filterL1 = document.getElementById('filterL1');
        const l1Categories = [...new Set(TEMPLATE.map(t => t.l1))];
        filterL1.innerHTML = '<option value="">全部一级指标</option>' + 
            l1Categories.map(l1 => `<option value="${l1}">${l1}</option>`).join('');
        
        // Project stats
        renderProjectStats(project);
        
        // Render chart
        setTimeout(() => {
            try { renderChart(project, 'bar'); } catch(e) { console.error('图表渲染失败:', e); }
        }, 100);
        
        // Show score card
        generateFinalScore();
        
        // Show risk card
        renderRiskSources();
        
        // Render tree
        renderTree();
    } catch (err) {
        console.error('打开项目失败:', err);
        alert('打开项目失败: ' + err.message);
        backToDashboard();
    }
}

function backToDashboard() {
    currentProjectId = null;
    document.getElementById('dashboardView').style.display = 'block';
    document.getElementById('projectView').style.display = 'none';
    renderProjectList();
}

function renderProjectStats(project) {
    const items = Object.values(project.items);
    let total = items.length;
    let completed = 0;
    let pass = 0;
    let partial = 0;
    let fail = 0;
    
    items.forEach(item => {
        if (item.result === '符合') { completed++; pass++; }
        else if (item.result === '部分符合') { completed++; partial++; }
        else if (item.result === '不符合') { completed++; fail++; }
    });

    const pct = total > 0 ? Math.round(completed / total * 100) : 0;

    document.getElementById('projectStats').innerHTML = `
        <div class="stat-card">
            <div class="stat-value">${total}</div>
            <div class="stat-label">评估项总数</div>
        </div>
        <div class="stat-card">
            <div class="stat-value stat-success">${pass}</div>
            <div class="stat-label">符合项</div>
        </div>
        <div class="stat-card">
            <div class="stat-value stat-warn">${partial}</div>
            <div class="stat-label">部分符合</div>
        </div>
        <div class="stat-card">
            <div class="stat-value stat-danger">${fail}</div>
            <div class="stat-label">不符合</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${pct}%</div>
            <div class="stat-label">完成进度</div>
        </div>
    `;
}

function generateFinalScore() {
    const project = getProject(currentProjectId);
    if (!project) return;
    
    const items = project.items;
    let X = 0, Y = 0, Z = 0;
    
    Object.values(items).forEach(item => {
        if (item.result === '符合') X++;
        else if (item.result === '部分符合') Y++;
        else if (item.result === '不符合') Z++;
    });
    
    const total = X + Y + Z;
    const hasUnassessed = Object.values(items).some(i => !i.result);
    
    // Overall score: 100 * (X + 0.5Y) / (X + Y + Z)
    const overallScore = total > 0 ? Math.round(100 * (X + 0.5 * Y) / total) : 0;
    const passThreshold = 80;
    const overallResult = overallScore >= passThreshold ? '通过' : '不通过';
    
    // Per-L1 scores
    const l1Data = {};
    TEMPLATE.forEach((tpl, idx) => {
        if (!l1Data[tpl.l1]) l1Data[tpl.l1] = { X: 0, Y: 0, Z: 0, total: 0 };
        l1Data[tpl.l1].total++;
        const item = items[idx];
        if (item) {
            if (item.result === '符合') l1Data[tpl.l1].X++;
            else if (item.result === '部分符合') l1Data[tpl.l1].Y++;
            else if (item.result === '不符合') l1Data[tpl.l1].Z++;
        }
    });
    
    const l1Scores = {};
    Object.entries(l1Data).forEach(([l1, d]) => {
        const score = d.total > 0 ? Math.round(100 * (d.X + 0.5 * d.Y) / d.total) : 0;
        l1Scores[l1] = {
            score: score,
            X: d.X, Y: d.Y, Z: d.Z, total: d.total,
            result: score >= passThreshold ? '通过' : '不通过'
        };
    });
    
    // Generate improvement suggestions
    const suggestions = generateSuggestions(l1Scores, overallScore, project);
    
    // Render score card
    const scoreCard = document.getElementById('scoreCard');
    const scoreResult = document.getElementById('scoreResult');
    scoreCard.style.display = 'block';
    
    let l1ScoreHtml = '';
    Object.entries(l1Scores).forEach(([l1, data]) => {
        const shortName = l1.replace(/^[一二三四五六七八九十]+、/, '');
        const scoreColor = data.score >= 80 ? '#2e7d32' : (data.score >= 60 ? '#ed6c02' : '#c62828');
        const progressColor = data.score >= 80 ? '#2e7d32' : (data.score >= 60 ? '#ed6c02' : '#c62828');
        const resultBadge = data.result === '通过' 
            ? '<span class="badge badge-success">✓ 通过</span>' 
            : '<span class="badge badge-danger">✗ 不通过</span>';
        
        l1ScoreHtml += `
            <div class="l1-score-item" style="padding:12px 16px;border:1px solid #e0e0e0;border-radius:6px;margin-bottom:10px;background:#fafafa;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                    <strong style="font-size:14px;">${escapeHtml(shortName)}</strong>
                    <div style="display:flex;align-items:center;gap:12px;">
                        ${resultBadge}
                        <span style="font-size:20px;font-weight:700;color:${scoreColor};">${data.score}</span>
                        <span style="font-size:12px;color:#999;">分</span>
                    </div>
                </div>
                <div class="progress-bar" style="height:6px;margin-bottom:8px;">
                    <div class="fill" style="width:${data.score}%;background:${progressColor};"></div>
                </div>
                <div style="display:flex;gap:16px;font-size:12px;color:#666;">
                    <span>✅ 符合: <strong>${data.X}</strong></span>
                    <span>⚠️ 部分符合: <strong>${data.Y}</strong></span>
                    <span>❌ 不符合: <strong>${data.Z}</strong></span>
                    <span>📊 总计: <strong>${data.total}</strong></span>
                    <span>📐 公式: 100×(X+0.5Y)/(X+Y+Z)</span>
                </div>
            </div>
        `;
    });
    
    const scoreColor = overallScore >= 80 ? '#2e7d32' : (overallScore >= 60 ? '#ed6c02' : '#c62828');
    const overallResultBadge = overallResult === '通过'
        ? '<span class="badge badge-success" style="font-size:14px;padding:4px 12px;">✓ 风险识别通过</span>'
        : '<span class="badge badge-danger" style="font-size:14px;padding:4px 12px;">✗ 风险识别不通过</span>';
    
    const unassessedWarning = hasUnassessed 
        ? '<div style="margin-top:12px;padding:10px 14px;background:#fff3e0;border-radius:4px;border-left:4px solid #ed6c02;font-size:13px;color:#e65100;">⚠️ 注意：存在未评估项，建议完成全部评估后获取准确评分。当前评分仅基于已评估项计算。</div>'
        : '';
    
    let suggestionsHtml = '';
    if (suggestions.length > 0) {
        suggestionsHtml = `
            <div style="margin-top:24px;padding:16px;background:#f5f7fa;border-radius:8px;border:1px solid #e0e0e0;">
                <h4 style="margin:0 0 12px;font-size:15px;color:#1a237e;">💡 改进建议</h4>
                ${suggestions.map((s, i) => `
                    <div style="margin-bottom:${i < suggestions.length - 1 ? '12px' : '0'};padding:10px 14px;background:white;border-radius:4px;border-left:3px solid ${s.color};">
                        <div style="font-size:13px;font-weight:600;margin-bottom:4px;color:${s.color};">${s.title}</div>
                        <div style="font-size:13px;color:#555;line-height:1.6;">${s.content}</div>
                    </div>
                `).join('')}
            </div>
        `;
    }
    
    scoreResult.innerHTML = `
        <div style="text-align:center;padding:20px;background:linear-gradient(135deg, #f5f7fa 0%, #e4e8ec 100%);border-radius:10px;margin-bottom:20px;">
            <div style="font-size:13px;color:#666;margin-bottom:8px;">最终评估评分</div>
            <div style="display:inline-flex;align-items:center;gap:10px;">
                <span style="font-size:56px;font-weight:800;color:${scoreColor};line-height:1;">${overallScore}</span>
                <span style="font-size:18px;color:#999;">/ 100</span>
            </div>
            <div style="margin-top:12px;">${overallResultBadge}</div>
            <div style="margin-top:10px;font-size:12px;color:#888;">
                计算公式：S = 100 × (X + 0.5Y) / (X + Y + Z)，其中 X=符合，Y=部分符合，Z=不符合
            </div>
            <div style="margin-top:6px;font-size:12px;color:#888;">
                通过标准：S ≥ 80 且满足正当必要性 → 通过
            </div>
            <div style="margin-top:12px;display:flex;justify-content:center;gap:24px;font-size:13px;">
                <span>✅ 符合: <strong style="color:#2e7d32;">${X}</strong></span>
                <span>⚠️ 部分符合: <strong style="color:#ed6c02;">${Y}</strong></span>
                <span>❌ 不符合: <strong style="color:#c62828;">${Z}</strong></span>
                <span>📊 评估率: <strong>${Math.round(total / Object.values(items).length * 100)}%</strong></span>
            </div>
            ${unassessedWarning}
        </div>
        
        <h4 style="margin:0 0 12px;font-size:15px;color:#333;">📊 各维度评分详情</h4>
        ${l1ScoreHtml}
        
        ${suggestionsHtml}
    `;
}

function generateSuggestions(l1Scores, overallScore, project) {
    const suggestions = [];
    
    // 1. Overall score suggestion
    if (overallScore < 80) {
        suggestions.push({
            color: '#c62828',
            title: '整体风险识别未通过',
            content: `当前评分 ${overallScore} 分，未达到 80 分的通过标准。建议重点关注不符合的评估项，分析根因并制定整改方案。可采用逐项整改方式，优先解决高风险领域的问题。`
        });
    } else if (overallScore < 90) {
        suggestions.push({
            color: '#ed6c02',
            title: '整体评分处于中等水平',
            content: `当前评分 ${overallScore} 分，已通过但仍有提升空间。建议针对部分符合和不符合的指标进行改进，目标将评分提升至 90 分以上。`
        });
    }
    
    // 2. Per-dimension suggestions
    Object.entries(l1Scores).forEach(([l1, data]) => {
        const shortName = l1.replace(/^[一二三四五六七八九十]+、/, '');
        
        if (data.score < 80) {
            // Find specific failing items
            const failingItems = [];
            TEMPLATE.forEach((tpl, idx) => {
                if (tpl.l1 === l1) {
                    const item = project.items[idx];
                    if (item && item.result === '不符合') {
                        failingItems.push(tpl.guidance.substring(0, 30));
                    }
                }
            });
            
            const suggestionMap = {
                '数据安全管理': {
                    prefix: '建议从以下方面加强数据安全管理体系建设：',
                    actions: [
                        '完善数据安全管理制度体系，确保制度覆盖所有数据处理环节',
                        '建立数据安全组织架构，明确数据安全管理责任人',
                        '加强数据分类分级管理，建立数据资产台账',
                        '定期开展数据安全培训和意识教育',
                        '建立数据安全应急响应机制'
                    ]
                },
                '数据处理活动': {
                    prefix: '建议规范数据处理活动全流程：',
                    actions: [
                        '确保数据收集的合法性，取得充分授权',
                        '建立数据存储加密机制和访问控制策略',
                        '规范数据共享和对外转让的审批流程',
                        '建立数据定期清理和销毁机制'
                    ]
                },
                '数据安全技术': {
                    prefix: '建议强化数据安全技术防护能力：',
                    actions: [
                        '部署数据加密技术，覆盖存储和传输环节',
                        '实施数据脱敏/匿名化技术',
                        '建立数据访问审计和监控告警体系',
                        '部署数据防泄漏（DLP）系统',
                        '定期进行安全评估和漏洞扫描'
                    ]
                },
                '个人信息保护': {
                    prefix: '建议加强个人信息保护合规建设：',
                    actions: [
                        '完善隐私政策和告知同意机制',
                        '严格遵循最小必要原则收集个人信息',
                        '建立个人信息主体权利响应机制',
                        '加强敏感个人信息的特殊保护措施',
                        '开展个人信息保护影响评估'
                    ]
                }
            };
            
            const info = suggestionMap[shortName] || {
                prefix: '建议加强该领域的合规建设：',
                actions: ['完善相关制度和流程', '加强技术防护措施', '定期开展自查和评估']
            };
            
            let content = `${info.prefix}\n`;
            if (failingItems.length > 0) {
                content += `<span style="color:#c62828;">需重点整改项：${failingItems.slice(0, 5).join('、')}${failingItems.length > 5 ? '等' : ''}</span>\n`;
            }
            content += info.actions.slice(0, 4).map((a, i) => `${i + 1}. ${a}`).join('\n');
            
            suggestions.push({
                color: '#c62828',
                title: `「${shortName}」维度不通过（${data.score}分）`,
                content: content.replace(/\n/g, '<br>')
            });
        } else if (data.score < 90) {
            suggestions.push({
                color: '#ed6c02',
                title: `「${shortName}」维度待优化（${data.score}分）`,
                content: `该维度评分 ${data.score} 分，基本通过但仍有改进空间。建议对部分符合的 ${data.Y} 项指标进行优化，争取达到完全符合状态。`
            });
        }
    });
    
    // 3. Cross-cutting suggestions
    const totalFail = Object.values(l1Scores).reduce((sum, d) => sum + d.Z, 0);
    if (totalFail > 0) {
        suggestions.push({
            color: '#1565c0',
            title: '系统性改进建议',
            content: `共有 ${totalFail} 项评估指标判定为"不符合"，建议：<br>1. 成立专项整改小组，明确整改责任人<br>2. 制定详细的整改计划和时间表<br>3. 建立整改跟踪和验证机制<br>4. 整改完成后重新开展评估<br>5. 将整改成果纳入制度体系，防止问题复发`
        });
    }
    
    return suggestions;
}

function exportScoreReport() {
    const project = getProject(currentProjectId);
    if (!project) return;
    
    const items = project.items;
    let X = 0, Y = 0, Z = 0, unassessed = 0;
    Object.values(items).forEach(item => {
        if (item.result === '符合') X++;
        else if (item.result === '部分符合') Y++;
        else if (item.result === '不符合') Z++;
        else unassessed++;
    });
    
    const total = X + Y + Z;
    const score = total > 0 ? Math.round(100 * (X + 0.5 * Y) / total) : 0;
    const result = score >= 80 ? '通过' : '不通过';
    
    let report = `========================================\n`;
    report += `    数据安全管理评估报告\n`;
    report += `========================================\n\n`;
    report += `项目名称：${project.name}\n`;
    report += `评估对象：${project.target}\n`;
    report += `评估人员：${project.evaluator || '-'}\n`;
    report += `评估日期：${project.date || '-'}\n`;
    report += `生成时间：${new Date().toLocaleString('zh-CN')}\n\n`;
    report += `----------------------------------------\n`;
    report += `           评估评分结果\n`;
    report += `----------------------------------------\n\n`;
    report += `最终评分：${score} / 100\n`;
    report += `评估结论：${result}\n\n`;
    report += `计算公式：S = 100 × (X + 0.5Y) / (X + Y + Z)\n`;
    report += `符合项数（X）：${X}\n`;
    report += `部分符合项数（Y）：${Y}\n`;
    report += `不符合项数（Z）：${Z}\n`;
    report += `已评估项数：${total}\n`;
    report += `未评估项数：${unassessed}\n\n`;
    
    // Per-L1 scores
    report += `----------------------------------------\n`;
    report += `         各维度评分详情\n`;
    report += `----------------------------------------\n\n`;
    
    const l1Data = {};
    TEMPLATE.forEach((tpl, idx) => {
        if (!l1Data[tpl.l1]) l1Data[tpl.l1] = { X: 0, Y: 0, Z: 0, total: 0 };
        l1Data[tpl.l1].total++;
        const item = items[idx];
        if (item) {
            if (item.result === '符合') l1Data[tpl.l1].X++;
            else if (item.result === '部分符合') l1Data[tpl.l1].Y++;
            else if (item.result === '不符合') l1Data[tpl.l1].Z++;
        }
    });
    
    Object.entries(l1Data).forEach(([l1, d]) => {
        const l1Score = d.total > 0 ? Math.round(100 * (d.X + 0.5 * d.Y) / d.total) : 0;
        const l1Result = l1Score >= 80 ? '通过' : '不通过';
        const shortName = l1.replace(/^[一二三四五六七八九十]+、/, '');
        report += `${shortName}：\n`;
        report += `  评分：${l1Score} 分  结论：${l1Result}\n`;
        report += `  符合: ${d.X}  部分符合: ${d.Y}  不符合: ${d.Z}  总计: ${d.total}\n\n`;
    });
    
    report += `========================================\n`;
    report += `     报告结束\n`;
    report += `========================================\n`;
    
    const blob = new Blob([report], { type: 'text/plain;charset=utf-8' });
    downloadBlob(blob, `评估报告_${project.target}_${project.date || new Date().toISOString().slice(0,10)}.txt`);
}
function renderTree() {
    const project = getProject(currentProjectId);
    if (!project) return;

    const filterL1 = document.getElementById('filterL1').value;
    const filterResult = document.getElementById('filterResult').value;
    const filterApplicable = document.getElementById('filterApplicable').value;
    const searchTerm = (document.getElementById('itemSearch')?.value || '').toLowerCase();

    // Build tree structure
    let tree = {};
    let visibleIndices = [];
    TEMPLATE.forEach((tpl, idx) => {
        if (filterL1 && tpl.l1 !== filterL1) return;
        if (filterApplicable && tpl.applicable && !tpl.applicable.includes(filterApplicable)) return;
        if (searchTerm && !tpl.guidance.toLowerCase().includes(searchTerm)) return;
        
        const item = project.items[idx] || {};
        if (filterResult) {
            const itemResult = item.result || '未评估';
            if (filterResult === '未评估' && item.result) return;
            if (filterResult !== '未评估' && itemResult !== filterResult) return;
        }

        if (!tree[tpl.l1]) tree[tpl.l1] = {};
        if (!tree[tpl.l1][tpl.l2]) tree[tpl.l1][tpl.l2] = {};
        if (!tree[tpl.l1][tpl.l2][tpl.l3]) tree[tpl.l1][tpl.l2][tpl.l3] = [];
        tree[tpl.l1][tpl.l2][tpl.l3].push({ idx, tpl, item });
        visibleIndices.push(idx);
    });

    // Store visible indices for navigation
    window._visibleItemIndices = visibleIndices;

    // Render HTML
    let html = '';
    for (const [l1, l2s] of Object.entries(tree)) {
        // Count stats for L1
        let l1Total = 0, l1Done = 0, l1Pass = 0, l1Partial = 0, l1Fail = 0;
        Object.values(l2s).forEach(l2 => {
            Object.values(l2).forEach(l3 => {
                l3.forEach(entry => {
                    l1Total++;
                    const r = entry.item.result;
                    if (r) l1Done++;
                    if (r === '符合') l1Pass++;
                    if (r === '部分符合') l1Partial++;
                    if (r === '不符合') l1Fail++;
                });
            });
        });

        const l1Pct = l1Total > 0 ? Math.round(l1Done / l1Total * 100) : 0;
        const statsHtml = l1Total > 0 ? 
            `<span style="font-size:12px;color:#666;margin-left:12px;">
                进度: ${l1Done}/${l1Total} (${l1Pct}%) 
                <span class="badge badge-success">${l1Pass}</span>
                <span class="badge badge-warn">${l1Partial}</span>
                <span class="badge badge-danger">${l1Fail}</span>
            </span>` : '';

        html += `
            <div class="tree-l1">
                <span>${l1}</span>
                ${statsHtml}
                <span style="margin-left:auto;">
                    <button class="btn btn-sm btn-default" onclick="batchSetByL1('${l1}', '符合')">全部符合</button>
                    <button class="btn btn-sm btn-default" onclick="batchSetByL1('${l1}', '部分符合')">全部部分符合</button>
                    <button class="btn btn-sm btn-default" onclick="batchSetByL1('${l1}', '不符合')">全部不符合</button>
                    <button class="btn btn-sm btn-default" onclick="batchSetByL1('${l1}', '')">清除</button>
                </span>
            </div>
        `;

        for (const [l2, l3s] of Object.entries(l2s)) {
            let l2Total = 0, l2Done = 0;
            Object.values(l3s).forEach(l3 => {
                l2Total += l3.length;
                l3.forEach(entry => { if (entry.item.result) l2Done++; });
            });
            const l2Pct = l2Total > 0 ? Math.round(l2Done / l2Total * 100) : 0;

            const l2Key = l1 + '|' + l2;
            html += `
                <div class="tree-node">
                    <div class="tree-l2" onclick="toggleNode(this)">
                        <span>${l2}</span>
                        <span style="font-size:12px;color:#666;margin-right:8px;">${l2Done}/${l2Total} (${l2Pct}%)</span>
                        <span style="float:right;">
                            <button class="btn btn-sm" style="padding:2px 6px;font-size:11px;" onclick="event.stopPropagation();batchSetByL2('${l1}', '${l2}', '符合')">✓</button>
                            <button class="btn btn-sm" style="padding:2px 6px;font-size:11px;" onclick="event.stopPropagation();batchSetByL2('${l1}', '${l2}', '部分符合')">◐</button>
                            <button class="btn btn-sm" style="padding:2px 6px;font-size:11px;" onclick="event.stopPropagation();batchSetByL2('${l1}', '${l2}', '不符合')">✗</button>
                            <button class="btn btn-sm" style="padding:2px 6px;font-size:11px;" onclick="event.stopPropagation();batchSetByL2('${l1}', '${l2}', '')">↺</button>
                        </span>
                    </div>
                    <div style="display:block;">
            `;

            for (const [l3, entries] of Object.entries(l3s)) {
                let l3Done = entries.filter(e => e.item.result).length;
                let l3Total = entries.length;
                const l3Pct = l3Total > 0 ? Math.round(l3Done / l3Total * 100) : 0;

                html += `
                    <div class="tree-node">
                        <div class="tree-l3" onclick="toggleNode(this)">
                            <span>${l3}</span>
                            <span style="font-size:12px;color:#666;margin-right:8px;">${l3Done}/${l3Total}</span>
                            <span style="float:right;">
                                <button class="btn btn-sm" style="padding:1px 5px;font-size:10px;" onclick="event.stopPropagation();batchSetByL3('${l1}', '${l2}', '${l3}', '符合')">✓</button>
                                <button class="btn btn-sm" style="padding:1px 5px;font-size:10px;" onclick="event.stopPropagation();batchSetByL3('${l1}', '${l2}', '${l3}', '部分符合')">◐</button>
                                <button class="btn btn-sm" style="padding:1px 5px;font-size:10px;" onclick="event.stopPropagation();batchSetByL3('${l1}', '${l2}', '${l3}', '不符合')">✗</button>
                            </span>
                        </div>
                        <div class="tree-items" style="display:block;">
                `;

                entries.forEach(entry => {
                    const { idx, tpl, item } = entry;
                    const statusClass = !item.result ? 'pending' : (item.result === '符合' ? 'pass' : (item.result === '部分符合' ? 'partial' : 'fail'));
                    const statusText = !item.result ? '待评估' : item.result;
                    const applicableTag = tpl.applicable ? `<span class="item-applicable-tag">📍 ${escapeHtml(tpl.applicable)}</span>` : '';
                    const recordIcon = item.record ? '📝' : '';
                    
                    html += `
                        <div class="tree-item" onclick="openItemModal(${idx})">
                            <div class="item-title">
                                <span class="item-num">${recordIcon}</span>
                                ${escapeHtml(tpl.guidance)}
                            </div>
                            <div class="item-status">
                                ${applicableTag}
                                <span class="status-badge ${statusClass}">${statusText}</span>
                            </div>
                        </div>
                    `;
                });

                html += '</div></div>';
            }

            html += '</div></div>';
        }
    }

    if (!html) {
        html = '<div class="empty-state"><p>没有符合筛选条件的评估项</p></div>';
    }

    document.getElementById('treeContainer').innerHTML = html;
}

// ============================================
// 浮框评估功能
// ============================================

let _currentItemIdx = null;

function openItemModal(idx) {
    _currentItemIdx = idx;
    const project = getProject(currentProjectId);
    if (!project) return;
    
    const tpl = TEMPLATE[idx];
    if (!tpl) return;
    
    const item = project.items[idx] || { record: '', result: '' };
    const placeholder = getRecordPlaceholder(tpl);
    const hint = getRecordHint(tpl);
    
    // Find position in visible list
    const visibleIndices = window._visibleItemIndices || [];
    const posInList = visibleIndices.indexOf(idx);
    const totalVisible = visibleIndices.length;
    
    // Build metadata info
    const metaParts = [tpl.l1, tpl.l2, tpl.l3].filter(Boolean);
    const metaHtml = metaParts.map((m, i) => {
        const icons = ['📋', '📁', '📄'];
        return `<span class="meta-chip">${icons[i] || '•'} ${escapeHtml(m)}</span>`;
    }).join('');
    
    const applicableChip = tpl.applicable ? 
        `<span class="meta-chip applicable">📍 ${escapeHtml(tpl.applicable)}</span>` : '';
    
    const resultOptions = [
        { value: '', label: '-- 判定结果 --' },
        { value: '符合', label: '✅ 符合' },
        { value: '部分符合', label: '⚠️ 部分符合' },
        { value: '不符合', label: '❌ 不符合' }
    ];
    
    const selectHtml = resultOptions.map(opt => 
        `<option value="${opt.value}" ${item.result === opt.value ? 'selected' : ''}>${opt.label}</option>`
    ).join('');
    
    // Title
    const shortName = (tpl.l2 || '').replace(/^\d+\./, '').trim();
    document.getElementById('itemModalTitle').textContent = `评估：${shortName} - ${(tpl.l3 || '').replace(/^\d+\./, '').trim()}`;
    
    // Body
    document.getElementById('itemModalBody').innerHTML = `
        <div class="item-meta-row">
            ${metaHtml}
            ${applicableChip}
        </div>
        <div class="item-guidance-section">
            <h4>📖 评估指引</h4>
            <div class="item-guidance-text">${escapeHtml(tpl.guidance)}</div>
        </div>
        <div class="item-hint-box">${hint}</div>
        <div class="item-form-section">
            <label>判定结果</label>
            <select id="itemResultSelect">
                ${selectHtml}
            </select>
        </div>
        <div class="item-form-section">
            <label>评估记录</label>
            <textarea id="itemRecordInput" placeholder="${escapeHtml(placeholder)}">${escapeHtml(item.record || '')}</textarea>
        </div>
    `;
    
    // Show modal
    document.getElementById('itemModal').classList.add('active');
    
    // Update navigation
    updateNavButtons();
}

function closeItemModal() {
    document.getElementById('itemModal').classList.remove('active');
    _currentItemIdx = null;
}

function navigateItem(direction) {
    const visibleIndices = window._visibleItemIndices || [];
    if (visibleIndices.length === 0 || _currentItemIdx === null) return;
    
    const pos = visibleIndices.indexOf(_currentItemIdx);
    const newPos = pos + direction;
    
    if (newPos < 0 || newPos >= visibleIndices.length) return;
    
    // Save current item first
    saveCurrentItemSilently();
    
    // Open new item
    openItemModal(visibleIndices[newPos]);
}

function updateNavButtons() {
    const visibleIndices = window._visibleItemIndices || [];
    const pos = visibleIndices.indexOf(_currentItemIdx);
    const total = visibleIndices.length;
    
    document.getElementById('itemNavCounter').textContent = total > 0 ? `${pos + 1} / ${total}` : '-';
    document.getElementById('prevItemBtn').disabled = pos <= 0;
    document.getElementById('nextItemBtn').disabled = pos >= total - 1;
}

function saveCurrentItemSilently() {
    if (_currentItemIdx === null) return;
    
    const result = document.getElementById('itemResultSelect')?.value || '';
    const record = document.getElementById('itemRecordInput')?.value || '';
    
    const project = getProject(currentProjectId);
    if (!project) return;
    
    if (!project.items[_currentItemIdx]) {
        project.items[_currentItemIdx] = { record: '', result: '', applicable_override: '' };
    }
    project.items[_currentItemIdx].result = result;
    project.items[_currentItemIdx].record = record;
    saveProject(project);
    
    // Targeted DOM update: update just this item's badge without full re-render
    updateTreeItemBadge(_currentItemIdx, result, record);
    
    // Update global UI
    renderProjectStats(project);
    renderChart(project);
    if (result) generateFinalScore();
}

function updateTreeItemBadge(idx, result, record) {
    const items = document.querySelectorAll('.tree-item');
    items.forEach(el => {
        const onclick = el.getAttribute('onclick') || '';
        if (onclick.includes(`openItemModal(${idx})`)) {
            const badge = el.querySelector('.status-badge');
            const icon = el.querySelector('.item-num');
            if (badge) {
                const statusClass = !result ? 'pending' : (result === '符合' ? 'pass' : (result === '部分符合' ? 'partial' : 'fail'));
                const statusText = !result ? '待评估' : result;
                badge.className = 'status-badge ' + statusClass;
                badge.textContent = statusText;
            }
            if (icon) {
                icon.textContent = record ? '📝' : '';
            }
        }
    });
}

function saveAndCloseItem() {
    saveCurrentItemSilently();
    closeItemModal();
    // Re-render tree to update status badges
    renderTree();
}

// ESC key to close modal
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && document.getElementById('itemModal')?.classList.contains('active')) {
        closeItemModal();
        renderTree();
    }
    if (e.key === 'ArrowLeft' && document.getElementById('itemModal')?.classList.contains('active') && e.ctrlKey) {
        navigateItem(-1);
    }
    if (e.key === 'ArrowRight' && document.getElementById('itemModal')?.classList.contains('active') && e.ctrlKey) {
        navigateItem(1);
    }
});

// Click outside to close
document.addEventListener('click', function(e) {
    if (e.target.classList.contains('item-modal-overlay')) {
        if (_currentItemIdx !== null) {
            saveCurrentItemSilently();
        }
        closeItemModal();
        renderTree();
    }
});

function getRecordPlaceholder(tpl) {
    const { l1, l2, l3, guidance } = tpl;
    const topic = (l2 || '').replace(/^\d+\./, '').trim();
    
    const templates = [
        { l1: '数据安全管理', keywords: ['制度', '体系', '规划', '方针'], placeholder: '请描述相关制度/规划的制定情况，包括制度名称、发布时间、覆盖范围等...' },
        { l1: '数据安全管理', keywords: ['落实', '执行', '监督'], placeholder: '请描述制度落实情况，包括执行记录、监督检查结果、问题整改情况等...' },
        { l1: '数据安全管理', keywords: ['组织', '机构', '岗位'], placeholder: '请描述组织架构设置、岗位职责分配、人员配备情况等...' },
        { l1: '数据安全管理', keywords: ['分类分级', '资产'], placeholder: '请描述数据资产台账、分类分级标准、识别覆盖情况等...' },
        { l1: '数据安全管理', keywords: ['培训', '教育', '意识'], placeholder: '请描述培训计划、培训次数、覆盖人数、考核结果等...' },
        { l1: '数据安全管理', keywords: ['应急', '响应', '处置'], placeholder: '请描述应急预案、演练情况、事件处置流程等...' },
        { l1: '数据处理活动', keywords: ['收集', '采集'], placeholder: '请描述数据收集的目的、范围、方式、合法性依据等...' },
        { l1: '数据处理活动', keywords: ['存储', '保存', '备份'], placeholder: '请描述数据存储位置、加密方式、备份策略、保存期限等...' },
        { l1: '数据处理活动', keywords: ['使用', '分析', '处理'], placeholder: '请描述数据使用场景、处理流程、访问控制、日志记录等...' },
        { l1: '数据处理活动', keywords: ['共享', '转让', '开放'], placeholder: '请描述数据共享/对外转让的审批流程、合同约定、安全措施等...' },
        { l1: '数据处理活动', keywords: ['销毁', '删除', '清除'], placeholder: '请描述数据销毁方式、销毁记录、审批流程等...' },
        { l1: '数据安全技术', keywords: ['加密', '密码'], placeholder: '请描述加密算法、密钥管理、加密范围、实施情况等...' },
        { l1: '数据安全技术', keywords: ['脱敏', '匿名', '假名'], placeholder: '请描述脱敏/匿名化规则、实施工具、验证机制等...' },
        { l1: '数据安全技术', keywords: ['访问', '权限', '控制'], placeholder: '请描述访问控制策略、权限审批、最小权限原则落实等...' },
        { l1: '数据安全技术', keywords: ['审计', '日志', '监控'], placeholder: '请描述审计日志内容、留存期限、监控告警机制等...' },
        { l1: '数据安全技术', keywords: ['防泄漏', 'DLP', '泄漏'], placeholder: '请描述数据防泄漏措施、检测规则、处置流程等...' },
        { l1: '数据安全技术', keywords: ['备份', '恢复', '容灾'], placeholder: '请描述备份策略、备份频率、恢复测试、容灾方案等...' },
        { l1: '数据安全技术', keywords: ['安全审计', '漏洞', '扫描'], placeholder: '请描述安全审计执行情况、漏洞扫描结果、修复情况等...' },
        { l1: '个人信息保护', keywords: ['告知', '同意', '授权'], placeholder: '请描述告知方式、同意获取方式、授权管理机制等...' },
        { l1: '个人信息保护', keywords: ['收集', '最小', '必要'], placeholder: '请描述收集的必要性评估、最小必要原则落实情况等...' },
        { l1: '个人信息保护', keywords: ['存储', '保存', '期限'], placeholder: '请描述个人信息存储期限、到期删除机制等...' },
        { l1: '个人信息保护', keywords: ['共享', '转让', '对外'], placeholder: '请描述个人信息对外共享/转让的告知、同意、评估情况等...' },
        { l1: '个人信息保护', keywords: ['权利', '访问', '更正', '删除'], placeholder: '请描述个人信息主体权利响应机制、处理流程、时限等...' },
        { l1: '个人信息保护', keywords: ['儿童', '未成年人'], placeholder: '请描述儿童个人信息保护的特殊措施、监护人同意机制等...' },
        { l1: '个人信息保护', keywords: ['自动化', '决策', '算法'], placeholder: '请描述自动化决策的透明度保障、说明机制等...' },
    ];
    
    const l1Short = (l1 || '').replace(/^[一二三四五六七八九十]+、/, '');
    const text = (l2 || '') + (l3 || '') + (guidance || '');
    
    for (const t of templates) {
        if (l1Short.includes(t.l1) && t.keywords.some(kw => text.includes(kw))) {
            return t.placeholder;
        }
    }
    
    return '请填写评估记录，说明相关情况、存在的问题及改进建议...';
}

function getRecordHint(tpl) {
    const { l1, l2 } = tpl;
    const l1Short = (l1 || '').replace(/^[一二三四五六七八九十]+、/, '');
    const topic = (l2 || '').replace(/^\d+\./, '').trim();
    
    const hintMap = {
        '数据安全管理': '💡 建议提供：制度文档名称、发布日期、版本号、覆盖范围、执行证据',
        '数据处理活动': '💡 建议提供：处理目的、数据类型、处理方式、相关审批/合同文件',
        '数据安全技术': '💡 建议提供：技术方案说明、产品型号/版本、部署位置、配置截图',
        '个人信息保护': '💡 建议提供：告知同意文本、隐私政策、权利响应流程记录'
    };
    
    for (const [key, value] of Object.entries(hintMap)) {
        if (l1Short.includes(key)) return value;
    }
    return '💡 建议提供：相关文档名称、实施日期、执行记录、存在问题及改进建议';
}

// Legacy: used by old inline-edit tree UI, kept for potential external callers
function updateItem(idx, field, value) {
    const project = getProject(currentProjectId);
    if (!project) return;
    
    if (!project.items[idx]) {
        project.items[idx] = { record: '', result: '', applicable_override: '' };
    }
    project.items[idx][field] = value;
    saveProject(project);
    
    // Update UI
    renderProjectStats(project);
    renderChart(project);
    if (field === 'result') {
        generateFinalScore();
    }
    renderTree();
}
function toggleNode(el) {
    const next = el.nextElementSibling;
    if (next) {
        next.style.display = next.style.display === 'none' ? 'block' : 'none';
    }
}

function batchSetByL1(l1, result) {
    const project = getProject(currentProjectId);
    if (!project) return;
    TEMPLATE.forEach((tpl, idx) => {
        if (tpl.l1 === l1) {
            if (!project.items[idx]) project.items[idx] = { record: '', result: '' };
            project.items[idx].result = result;
        }
    });
    saveProject(project);
    renderProjectStats(project);
    renderChart(project);
    renderTree();
}

function batchSetByL2(l1, l2, result) {
    const project = getProject(currentProjectId);
    if (!project) return;
    TEMPLATE.forEach((tpl, idx) => {
        if (tpl.l1 === l1 && tpl.l2 === l2) {
            if (!project.items[idx]) project.items[idx] = { record: '', result: '' };
            project.items[idx].result = result;
        }
    });
    saveProject(project);
    renderProjectStats(project);
    renderChart(project);
    renderTree();
}

function batchSetByL3(l1, l2, l3, result) {
    const project = getProject(currentProjectId);
    if (!project) return;
    TEMPLATE.forEach((tpl, idx) => {
        if (tpl.l1 === l1 && tpl.l2 === l2 && tpl.l3 === l3) {
            if (!project.items[idx]) project.items[idx] = { record: '', result: '' };
            project.items[idx].result = result;
        }
    });
    saveProject(project);
    renderProjectStats(project);
    renderChart(project);
    renderTree();
}
function deleteCurrentProject() {
    if (!requirePermission('delete', '删除项目')) return;
    if (!currentProjectId) return;
    deleteProjectConfirm(currentProjectId);
}

function deleteProjectConfirm(id) {
    if (!requirePermission('delete', '删除项目')) return;
    if (!confirm('确定要删除此评估项目吗？此操作不可恢复！')) return;
    deleteProject(id);
    if (id === currentProjectId) {
        backToDashboard();
    } else {
        renderProjectList();
    }
}
