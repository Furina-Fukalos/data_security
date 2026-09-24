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
                ${hasCustomCriteria(project) ? `<div style="grid-column:1/-1;"><strong>评估准则：</strong>项目专属准则（${project.criteria.length} 项，来源：${escapeHtml(project.criteriaSource || '报告导入')}）</div>` : ''}
                ${project.desc ? `<div style="grid-column:1/-1;"><strong>项目描述：</strong>${escapeHtml(project.desc)}</div>` : ''}
            </div>
            ${renderWordSurveyData(project)}
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
        const l1Categories = [...new Set(getProjectCriteria(project).map(t => t.l1))];
        filterL1.innerHTML = '<option value="">全部一级指标</option>' + 
            l1Categories.map(l1 => `<option value="${l1}">${l1}</option>`).join('');
        
        // 统计 / 评分（复用同一次遍历的缓存）
        renderProjectStats(project);
        generateFinalScore();
        
        // 图表：按需加载 echarts 后渲染
        preloadLib('echarts');
        renderChart(project, currentChartType);
        
        // Show risk card
        renderRiskSources();
        
        // Render tree
        renderTree();
        
        // 重置到项目页顶部与区块导航状态
        window.scrollTo({ top: 0, behavior: 'auto' });
        setupSectionNav();
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
    const s = computeItemStats(project);
    const pct = s.total > 0 ? Math.round(s.assessed / s.total * 100) : 0;

    document.getElementById('projectStats').innerHTML = `
        <div class="stat-card">
            <div class="stat-value">${s.total}</div>
            <div class="stat-label">评估项总数</div>
        </div>
        <div class="stat-card">
            <div class="stat-value stat-success">${s.pass}</div>
            <div class="stat-label">符合项</div>
        </div>
        <div class="stat-card">
            <div class="stat-value stat-warn">${s.partial}</div>
            <div class="stat-label">部分符合</div>
        </div>
        <div class="stat-card">
            <div class="stat-value stat-danger">${s.fail}</div>
            <div class="stat-label">不符合</div>
        </div>
        <div class="stat-card">
            <div class="stat-value" style="color:${RESULT_META['不适用'].color};">${s.na}</div>
            <div class="stat-label">不适用</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${pct}%</div>
            <div class="stat-label">完成进度</div>
        </div>
    `;
}

/** 保存后统一刷新统计/图表/评分（避免多处重复三连调用） */
function refreshProjectViews(project, opts) {
    opts = opts || {};
    renderProjectStats(project);
    try {
        const p = renderChart(project); // 图表按需加载，返回 Promise
        if (p && typeof p.catch === 'function') p.catch(e => console.error('图表渲染失败:', e));
    } catch (e) {
        console.error('图表渲染失败:', e);
    }
    if (opts.score !== false) generateFinalScore();
}

function generateFinalScore() {
    const project = getProject(currentProjectId);
    if (!project) return;
    
    const s = computeItemStats(project);
    const X = s.pass, Y = s.partial, Z = s.fail, NA = s.na;
    const total = s.scored;
    const assessed = s.assessed;
    const hasUnassessed = s.unassessed > 0;
    const overallScore = s.score;
    const passThreshold = 80;
    const overallResult = overallScore >= passThreshold ? '通过' : '不通过';
    
    // Per-L1 scores（total 口径与该维度参与评分的指标数一致；整维度均不适用的不计入）
    const l1Stats = computeL1Stats(project);
    const l1Scores = {};
    Object.entries(l1Stats).forEach(([l1, d]) => {
        if (d.scored === 0) return;
        l1Scores[l1] = {
            score: d.score,
            X: d.pass, Y: d.partial, Z: d.fail, total: d.scored,
            result: d.score >= passThreshold ? '通过' : '不通过'
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
                <span>⛔ 不适用: <strong style="color:#607d8b;">${NA}</strong></span>
                <span>📊 评估率: <strong>${Math.round(assessed / (s.total || 1) * 100)}%</strong></span>
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
            getProjectCriteria(project).forEach((tpl, idx) => {
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
    
    const s = computeItemStats(project);
    const X = s.pass, Y = s.partial, Z = s.fail, NA = s.na;
    const score = s.score;
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
    report += `计算公式：S = 100 × (X + 0.5Y) / (X + Y + Z)（不适用项不计入评分）\n`;
    report += `符合项数（X）：${X}\n`;
    report += `部分符合项数（Y）：${Y}\n`;
    report += `不符合项数（Z）：${Z}\n`;
    report += `不适用项数：${NA}\n`;
    report += `已评估项数：${s.assessed}\n`;
    report += `未评估项数：${s.unassessed}\n\n`;
    
    // Per-L1 scores
    report += `----------------------------------------\n`;
    report += `         各维度评分详情\n`;
    report += `----------------------------------------\n\n`;
    
    const l1Stats = computeL1Stats(project);
    Object.entries(l1Stats).forEach(([l1, d]) => {
        if (d.scored === 0) return; // 整维度均不适用的不计入报告明细
        const l1Result = d.score >= 80 ? '通过' : '不通过';
        const shortName = l1.replace(/^[一二三四五六七八九十]+、/, '');
        report += `${shortName}：\n`;
        report += `  评分：${d.score} 分  结论：${l1Result}\n`;
        report += `  符合: ${d.pass}  部分符合: ${d.partial}  不符合: ${d.fail}  不适用: ${d.na}  总计: ${d.scored}\n\n`;
    });
    
    report += `========================================\n`;
    report += `     报告结束\n`;
    report += `========================================\n`;
    
    const blob = new Blob([report], { type: 'text/plain;charset=utf-8' });
    downloadBlob(blob, `评估报告_${project.target}_${project.date || new Date().toISOString().slice(0,10)}.txt`);
}
// 搜索/筛选输入防抖：477 项全量重绘时避免逐字符卡顿
let _treeRenderTimer = null;
function scheduleRenderTree(delay) {
    if (_treeRenderTimer) clearTimeout(_treeRenderTimer);
    _treeRenderTimer = setTimeout(() => {
        _treeRenderTimer = null;
        renderTree();
    }, delay === undefined ? 220 : delay);
}

/** 项目页区块锚点跳转（长页面快速定位，不改变任何内容） */
function scrollToSection(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// 区块导航高亮（滚动时自动标记当前所在区块）
let _sectionObserver = null;
function setupSectionNav() {
    const links = Array.from(document.querySelectorAll('#projectSectionNav [data-section]'));
    if (links.length === 0) return;
    if (_sectionObserver) { _sectionObserver.disconnect(); _sectionObserver = null; }
    if (!('IntersectionObserver' in window)) return;

    const map = {};
    links.forEach(a => { map[a.dataset.section] = a; });
    _sectionObserver = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (!entry.isIntersecting) return;
            links.forEach(a => a.classList.toggle('active', a.dataset.section === entry.target.id));
        });
    }, { rootMargin: '-15% 0px -75% 0px', threshold: 0 });
    links.forEach(a => {
        const el = document.getElementById(a.dataset.section);
        if (el) _sectionObserver.observe(el);
    });
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
    getProjectCriteria(project).forEach((tpl, idx) => {
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
        let l1Total = 0, l1Done = 0, l1Pass = 0, l1Partial = 0, l1Fail = 0, l1Na = 0;
        Object.values(l2s).forEach(l2 => {
            Object.values(l2).forEach(l3 => {
                l3.forEach(entry => {
                    l1Total++;
                    const r = entry.item.result;
                    if (isAssessed(r)) l1Done++;
                    if (r === RESULT.PASS) l1Pass++;
                    else if (r === RESULT.PARTIAL) l1Partial++;
                    else if (r === RESULT.FAIL) l1Fail++;
                    else if (r === RESULT.NA) l1Na++;
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
                <span class="badge" style="background:#eceff1;color:#607d8b;">${l1Na}</span>
            </span>` : '';

        html += `
            <div class="tree-l1">
                <span>${l1}</span>
                ${statsHtml}
                <span style="margin-left:auto;">
                    <button class="btn btn-sm btn-default" onclick="batchSetByL1('${l1}', '符合')">全部符合</button>
                    <button class="btn btn-sm btn-default" onclick="batchSetByL1('${l1}', '部分符合')">全部部分符合</button>
                    <button class="btn btn-sm btn-default" onclick="batchSetByL1('${l1}', '不符合')">全部不符合</button>
                    <button class="btn btn-sm btn-default" onclick="batchSetByL1('${l1}', '不适用')">全部不适用</button>
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
                    const statusClass = getResultStatusClass(item.result);
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
    
    const tpl = getProjectCriteria(project)[idx];
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
    
    const resultOptions = RESULT_OPTIONS.map(v => ({ value: v, label: getResultMeta(v).label }));
    
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
        ${tpl.position ? `<div class="item-info-section position"><h4>📍 评估位置（取证位置）</h4><div class="item-info-text">${escapeHtml(tpl.position)}</div></div>` : ''}
        ${tpl.implement ? `<div class="item-info-section implement"><h4>🔧 评估实施方法</h4><div class="item-info-text">${escapeHtml(tpl.implement)}</div></div>` : ''}
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
    const item = project.items[_currentItemIdx];
    // 未发生变化时不落盘、不重绘（切换指标/点击空白处等高频场景）
    if (item.result === result && item.record === record) return;
    
    item.result = result;
    item.record = record;
    saveProject(project);
    
    // 局部更新该指标的徽章，避免整树重绘
    updateTreeItemBadge(_currentItemIdx, result, record);
    refreshProjectViews(project);
}

function updateTreeItemBadge(idx, result, record) {
    const items = document.querySelectorAll('.tree-item');
    items.forEach(el => {
        const onclick = el.getAttribute('onclick') || '';
        if (onclick.includes(`openItemModal(${idx})`)) {
            const badge = el.querySelector('.status-badge');
            const icon = el.querySelector('.item-num');
            if (badge) {
                const statusClass = getResultStatusClass(result);
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

// 快捷键：ESC 关闭 / Ctrl+←→ 上下一条 / Alt+↑↓ 跳未评估 / 1-4 快速判定 / Ctrl+S 保存
document.addEventListener('keydown', function(e) {
    const modal = document.getElementById('itemModal');
    if (!modal || !modal.classList.contains('active')) return;

    const tag = (e.target && e.target.tagName) || '';
    const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

    if (e.key === 'Escape') {
        closeItemModal();
        renderTree();
        return;
    }
    if (e.ctrlKey && e.key === 'ArrowLeft') { e.preventDefault(); navigateItem(-1); return; }
    if (e.ctrlKey && e.key === 'ArrowRight') { e.preventDefault(); navigateItem(1); return; }
    if (e.ctrlKey && (e.key === 's' || e.key === 'S')) { e.preventDefault(); saveAndCloseItem(); return; }
    if (e.altKey && (e.key === 'ArrowDown' || e.key === 'ArrowRight')) { e.preventDefault(); navigateUnassessed(1); return; }
    if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowLeft')) { e.preventDefault(); navigateUnassessed(-1); return; }

    // 数字键快速判定（1=符合 2=部分符合 3=不符合 4=不适用），输入框内不拦截
    if (!typing && !e.ctrlKey && !e.altKey && RESULT_OPTIONS[e.key]) {
        const select = document.getElementById('itemResultSelect');
        if (select) {
            select.value = RESULT_OPTIONS[e.key];
            select.focus();
            e.preventDefault();
        }
    }
});

/** 跳到上/下一条「未评估」指标（现场评估提速） */
function navigateUnassessed(direction) {
    const visibleIndices = window._visibleItemIndices || [];
    if (visibleIndices.length === 0 || _currentItemIdx === null) return;
    const project = getProject(currentProjectId);
    if (!project) return;

    const start = visibleIndices.indexOf(_currentItemIdx);
    for (let i = start + direction; i >= 0 && i < visibleIndices.length; i += direction) {
        const item = project.items[visibleIndices[i]];
        if (!item || !isAssessed(item.result)) {
            saveCurrentItemSilently();
            openItemModal(visibleIndices[i]);
            return;
        }
    }
    alert('已没有其他未评估的指标了。');
}

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
    refreshProjectViews(project);
    renderTree();
}
function toggleNode(el) {
    const next = el.nextElementSibling;
    if (next) {
        next.style.display = next.style.display === 'none' ? 'block' : 'none';
    }
}

/** 批量设置判定结果的统一实现（L1/L2/L3 共用，避免三份重复逻辑） */
function batchSetByResult(matchFn, result) {
    const project = getProject(currentProjectId);
    if (!project) return;
    let changed = 0;
    getProjectCriteria(project).forEach((tpl, idx) => {
        if (!matchFn(tpl)) return;
        if (!project.items[idx]) project.items[idx] = { record: '', result: '', applicable_override: '' };
        if (project.items[idx].result !== result) {
            project.items[idx].result = result;
            changed++;
        }
    });
    if (changed === 0) return; // 无变化则不落盘、不重绘
    saveProject(project);
    refreshProjectViews(project);
    renderTree();
}

function batchSetByL1(l1, result) {
    batchSetByResult(tpl => tpl.l1 === l1, result);
}

function batchSetByL2(l1, l2, result) {
    batchSetByResult(tpl => tpl.l1 === l1 && tpl.l2 === l2, result);
}

function batchSetByL3(l1, l2, l3, result) {
    batchSetByResult(tpl => tpl.l1 === l1 && tpl.l2 === l2 && tpl.l3 === l3, result);
}

// 渲染Word调研表导入的数据
function renderWordSurveyData(project) {
    if (!project.wordSurveyData) return '';
    const wd = project.wordSurveyData;
    let html = '<div style="margin-top:16px;padding:12px;background:#f5f7ff;border-radius:8px;border:1px solid #e8eaf6;">';
    html += '<div style="font-weight:600;color:#1a237e;margin-bottom:8px;font-size:13px;">📋 调研表数据（从Word导入）</div>';

    // 基本信息
    const bi = wd.basicInfo || {};
    const basicFields = [
        ['统一社会信用代码', '统一社会信用代码'],
        ['所属行业领域', '所属行业领域*'],
        ['经营范围规模', '经营范围规模'],
        ['组织机构代码', '组织机构代码'],
        ['业务地区', '业务地区'],
        ['上市情况', '上市情况'],
        ['行政许可情况', '行政许可情况'],
        ['运营控制情况', '运营控制情况'],
        ['综合得分', '综合得分*'],
        ['评估结论', '评估结论*'],
        ['评估结论描述', '评估结论描述']
    ];
    const filledBasic = basicFields.filter(([_, key]) => bi[key]);
    if (filledBasic.length > 0) {
        html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:6px 16px;font-size:12px;margin-bottom:8px;">';
        filledBasic.forEach(([label, key]) => {
            html += `<div><span style="color:#888;">${label}:</span> <strong>${escapeHtml(bi[key])}</strong></div>`;
        });
        html += '</div>';
    }

    // 系统功能描述
    if (wd.systemDesc) {
        html += `<div style="font-size:12px;margin-bottom:8px;"><span style="color:#888;">系统功能描述:</span> ${escapeHtml(wd.systemDesc)}</div>`;
    }

    // 数据资产表
    if (wd.dataAssets && wd.dataAssets.length > 0) {
        html += `<div style="font-size:12px;font-weight:600;margin-top:8px;margin-bottom:4px;">数据资产情况（${wd.dataAssets.length}条）</div>`;
        html += '<div style="overflow-x:auto;"><table style="font-size:11px;width:100%;border-collapse:collapse;">';
        const headers = Object.keys(wd.dataAssets[0]);
        html += '<tr>' + headers.map(h => `<th style="border:1px solid #ddd;padding:4px;background:#e3f2fd;text-align:left;">${escapeHtml(h)}</th>`).join('') + '</tr>';
        wd.dataAssets.forEach(item => {
            html += '<tr>' + headers.map(h => `<td style="border:1px solid #ddd;padding:4px;">${escapeHtml(item[h] || '')}</td>`).join('') + '</tr>';
        });
        html += '</table></div>';
    }

    // 数据分类分级表
    if (wd.dataClassification && wd.dataClassification.length > 0) {
        html += `<div style="font-size:12px;font-weight:600;margin-top:8px;margin-bottom:4px;">数据分类分级情况（${wd.dataClassification.length}条）</div>`;
        html += '<div style="overflow-x:auto;"><table style="font-size:11px;width:100%;border-collapse:collapse;">';
        const headers = Object.keys(wd.dataClassification[0]);
        html += '<tr>' + headers.map(h => `<th style="border:1px solid #ddd;padding:4px;background:#e8f5e9;text-align:left;">${escapeHtml(h)}</th>`).join('') + '</tr>';
        wd.dataClassification.forEach(item => {
            html += '<tr>' + headers.map(h => `<td style="border:1px solid #ddd;padding:4px;">${escapeHtml(item[h] || '')}</td>`).join('') + '</tr>';
        });
        html += '</table></div>';
    }

    html += '</div>';
    return html;
}

function batchSetByL3(l1, l2, l3, result) {
    batchSetByResult(tpl => tpl.l1 === l1 && tpl.l2 === l2 && tpl.l3 === l3, result);
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
