// ============================================
// 数据安全管理评估系统 - 应用逻辑
// ============================================

const STORAGE_KEY = 'data_security_projects';
let currentProjectId = null;
let chartInstance = null;

// ============================================
// 项目管理
// ============================================

function getProjects() {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
}

function saveProjects(projects) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
}

function getProject(id) {
    const projects = getProjects();
    return projects.find(p => p.id === id);
}

function saveProject(project) {
    const projects = getProjects();
    const idx = projects.findIndex(p => p.id === project.id);
    if (idx >= 0) {
        projects[idx] = project;
    } else {
        projects.push(project);
    }
    saveProjects(projects);
}

function deleteProject(id) {
    const projects = getProjects();
    const filtered = projects.filter(p => p.id !== id);
    saveProjects(filtered);
}

function showCreateProjectModal() {
    document.getElementById('createProjectModal').style.display = 'flex';
    document.getElementById('projectDate').valueAsDate = new Date();
}

function hideCreateProjectModal() {
    document.getElementById('createProjectModal').style.display = 'none';
}

function createProject() {
    try {
        const name = document.getElementById('projectName').value.trim();
        const target = document.getElementById('projectTarget').value.trim();
        const evaluator = document.getElementById('projectEvaluator').value.trim();
        const date = document.getElementById('projectDate').value;
        const desc = document.getElementById('projectDesc').value.trim();
        const applicable = document.getElementById('projectApplicable').value;

        if (!name || !target) {
            alert('请填写项目名称和评估对象！');
            return;
        }

        // 检查 localStorage 是否可用
        if (typeof localStorage === 'undefined' || !localStorage) {
            alert('浏览器不支持本地存储，无法保存项目数据！');
            return;
        }

        const project = {
            id: Date.now().toString(),
            name: name,
            target: target,
            evaluator: evaluator,
            date: date,
            desc: desc,
            applicable: applicable,
            createdAt: new Date().toISOString(),
            items: {}
        };

        // Initialize all template items with empty responses
        TEMPLATE.forEach((tpl, idx) => {
            project.items[idx] = {
                record: '',
                result: '',
                applicable_override: ''
            };
        });

        saveProject(project);
        hideCreateProjectModal();
        
        // Clear form
        document.getElementById('projectName').value = '';
        document.getElementById('projectTarget').value = '';
        document.getElementById('projectEvaluator').value = '';
        document.getElementById('projectDesc').value = '';
        
        renderProjectList();
        openProject(project.id);
    } catch (err) {
        console.error('创建项目失败:', err);
        alert('创建项目失败: ' + err.message + '\n\n请将此错误信息反馈给开发者。');
    }
}

// ============================================
// 视图渲染
// ============================================

function updateDashboardStats() {
    const projects = getProjects();
    let totalItems = 0;
    let completedItems = 0;
    
    projects.forEach(p => {
        const items = p.items ? Object.values(p.items) : [];
        items.forEach(item => {
            totalItems++;
            if (item && (item.result === '符合' || item.result === '不符合' || item.result === '部分符合')) {
                completedItems++;
            }
        });
    });

    const completedProjects = projects.filter(p => {
        const items = p.items ? Object.values(p.items) : [];
        if (items.length === 0) return false;
        const done = items.filter(i => i && i.result).length;
        return done >= items.length * 0.9;
    }).length;

    document.getElementById('statProjects').textContent = projects.length;
    document.getElementById('statCompleted').textContent = completedProjects;
    document.getElementById('statInProgress').textContent = projects.length - completedProjects;
    document.getElementById('statIndicators').textContent = TEMPLATE.length;
}

let selectedProjectIds = new Set();

function renderProjectList() {
    updateDashboardStats();
    const projects = getProjects();
    const searchTerm = (document.getElementById('searchBox')?.value || '').toLowerCase();
    
    const container = document.getElementById('projectList');
    const toolbar = document.getElementById('batchToolbar');
    
    if (projects.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="icon">📋</div>
                <p>暂无评估项目</p>
                <p style="font-size:12px;margin-top:8px;">点击右上角"新建评估项目"开始创建</p>
            </div>
        `;
        toolbar.style.display = 'none';
        return;
    }

    const filtered = projects.filter(p => 
        !searchTerm || 
        p.name.toLowerCase().includes(searchTerm) ||
        p.target.toLowerCase().includes(searchTerm)
    );

    let html = '<table><thead><tr>' +
        '<th style="width:40px;"><input type="checkbox" id="selectAll" onchange="toggleSelectAll(this)"></th>' +
        '<th>项目名称</th><th>评估对象</th><th>评估人员</th><th>日期</th><th>进度</th><th>操作</th></tr></thead><tbody>';
    
    filtered.forEach(p => {
        const items = p.items ? Object.values(p.items) : [];
        const done = items.filter(i => i && i.result).length;
        const pct = items.length > 0 ? Math.round(done / items.length * 100) : 0;
        
        let progressClass = 'progress-fill-success';
        if (pct < 60) progressClass = 'progress-fill-danger';
        else if (pct < 90) progressClass = 'progress-fill-warn';
        
        const checked = selectedProjectIds.has(p.id) ? 'checked' : '';
        html += `
            <tr>
                <td><input type="checkbox" class="project-checkbox" data-id="${p.id}" ${checked} onchange="updateSelection(this)"></td>
                <td><strong>${escapeHtml(p.name)}</strong></td>
                <td>${escapeHtml(p.target)}</td>
                <td>${escapeHtml(p.evaluator || '-')}</td>
                <td>${p.date || '-'}</td>
                <td style="min-width:150px;">
                    <div style="font-size:12px;margin-bottom:4px;">${done}/${items.length} (${pct}%)</div>
                    <div class="progress-bar"><div class="fill ${progressClass}" style="width:${pct}%"></div></div>
                </td>
                <td>
                    <button class="btn btn-primary btn-sm" onclick="openProject('${p.id}')">打开</button>
                    <button class="btn btn-success btn-sm" onclick="exportProjectToExcel('${p.id}')">导出</button>
                    <button class="btn btn-danger btn-sm" onclick="deleteProjectConfirm('${p.id}')">删除</button>
                </td>
            </tr>
        `;
    });
    
    html += '</tbody></table>';
    container.innerHTML = html;
    updateToolbar();
}

function toggleSelectAll(checkbox) {
    const checkboxes = document.querySelectorAll('.project-checkbox');
    selectedProjectIds.clear();
    checkboxes.forEach(cb => {
        cb.checked = checkbox.checked;
        if (checkbox.checked) selectedProjectIds.add(cb.dataset.id);
    });
    updateToolbar();
}

function updateSelection(checkbox) {
    if (checkbox.checked) {
        selectedProjectIds.add(checkbox.dataset.id);
    } else {
        selectedProjectIds.delete(checkbox.dataset.id);
    }
    updateToolbar();
}

function updateToolbar() {
    const toolbar = document.getElementById('batchToolbar');
    const count = selectedProjectIds.size;
    document.getElementById('selectedCount').textContent = count;
    toolbar.style.display = count > 0 ? 'flex' : 'none';
    
    // Update select-all state
    const selectAll = document.getElementById('selectAll');
    if (selectAll) {
        const checkboxes = document.querySelectorAll('.project-checkbox');
        if (checkboxes.length > 0) {
            const allChecked = Array.from(checkboxes).every(cb => cb.checked);
            selectAll.checked = allChecked;
        }
    }
}

function clearSelection() {
    selectedProjectIds.clear();
    renderProjectList();
}

function batchDeleteProjects() {
    if (selectedProjectIds.size === 0) return;
    if (!confirm(`确定要删除 ${selectedProjectIds.size} 个项目吗？此操作不可恢复！`)) return;
    
    const projects = getProjects();
    const remaining = projects.filter(p => !selectedProjectIds.has(p.id));
    saveProjects(remaining);
    alert(`已删除 ${selectedProjectIds.size} 个项目`);
    selectedProjectIds.clear();
    renderProjectList();
}

function batchExportExcel() {
    if (selectedProjectIds.size === 0) return;
    const projects = getProjects();
    const selected = projects.filter(p => selectedProjectIds.has(p.id));
    
    // Export each as a separate Excel file
    selected.forEach(p => {
        exportProjectToExcel(p.id);
    });
    alert(`已导出 ${selected.length} 个项目的Excel文件`);
}

function batchExportJSON() {
    if (selectedProjectIds.size === 0) return;
    const projects = getProjects();
    const selected = projects.filter(p => selectedProjectIds.has(p.id));
    
    const dataStr = JSON.stringify(selected, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `批量备份_${selected.length}个项目_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

function selectAllProjects() {
    const projects = getProjects();
    selectedProjectIds = new Set(projects.map(p => p.id));
    renderProjectList();
}

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
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `评估报告_${project.target}_${project.date || new Date().toISOString().slice(0,10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
}

// ============================================
// 风险源分析功能
// ============================================

// 风险等级矩阵（基于文档表4：可能性×危害程度→风险等级）
const RISK_MATRIX = {
    '高': { '很高': '重大风险', '高': '重大风险', '中': '中风险', '低': '低风险', '很低': '轻微风险' },
    '中': { '很高': '重大风险', '高': '高风险',   '中': '中风险', '低': '低风险', '很低': '轻微风险' },
    '低': { '很高': '高风险',   '高': '中风险',   '中': '低风险', '低': '轻微风险','很低': '轻微风险' }
};

const RISK_LEVEL_COLORS = {
    '重大风险': { bg: '#c62828', text: '#fff', light: '#ffebee' },
    '高风险':   { bg: '#e65100', text: '#fff', light: '#fff3e0' },
    '中风险':   { bg: '#ed6c02', text: '#fff', light: '#fff8e1' },
    '低风险':   { bg: '#1565c0', text: '#fff', light: '#e3f2fd' },
    '轻微风险': { bg: '#2e7d32', text: '#fff', light: '#e8f5e9' }
};

const RISK_LEVEL_ORDER = ['重大风险', '高风险', '中风险', '低风险', '轻微风险'];

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
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `风险源分析报告_${project.target}_${project.date || new Date().toISOString().slice(0,10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
}

function renderChart(project, chartType) {
    const chartDom = document.getElementById('chart');
    if (!chartDom) return;
    
    // Adjust container class based on chart type
    if (chartType === 'radar') {
        chartDom.classList.add('radar-chart');
    } else {
        chartDom.classList.remove('radar-chart');
    }
    
    if (chartInstance) {
        chartInstance.dispose();
    }
    chartInstance = echarts.init(chartDom);

    // Build data by L1
    const l1Data = {};
    TEMPLATE.forEach((tpl, idx) => {
        if (!l1Data[tpl.l1]) {
            l1Data[tpl.l1] = { total: 0, pass: 0, partial: 0, fail: 0 };
        }
        l1Data[tpl.l1].total++;
        const item = project.items[idx];
        if (item) {
            if (item.result === '符合') l1Data[tpl.l1].pass++;
            else if (item.result === '部分符合') l1Data[tpl.l1].partial++;
            else if (item.result === '不符合') l1Data[tpl.l1].fail++;
        }
    });

    const categories = Object.keys(l1Data);
    
    if (chartType === 'radar') {
        // Radar chart
        const indicator = categories.map(c => ({
            name: c.replace(/^[一二三四五六七八九十]+、/, '').replace(/[（）()]/g, ''),
            max: l1Data[c].total
        }));
        
        const completedData = categories.map(c => l1Data[c].pass + l1Data[c].partial * 0.5);
        const totalData = categories.map(c => l1Data[c].total);
        
        // Calculate scores per dimension for tooltip
        const dimensionScores = categories.map((c, i) => {
            const total = l1Data[c].total;
            const score = total > 0 ? Math.round(100 * (l1Data[c].pass + 0.5 * l1Data[c].partial) / total) : 0;
            return Math.min(100, score);
        });

        const option = {
            tooltip: {
                trigger: 'item',
                formatter: function(params) {
                    if (params.seriesName === '评估得分') {
                        let html = '<div style="font-weight:600;margin-bottom:8px;">各维度得分率</div>';
                        indicator.forEach((ind, i) => {
                            const rate = totalData[i] > 0 ? (completedData[i] / totalData[i] * 100).toFixed(1) : '0.0';
                            html += `<div style="display:flex;justify-content:space-between;gap:20px;font-size:12px;">
                                <span>${ind.name}</span>
                                <span style="color:${dimensionScores[i] >= 80 ? '#2e7d32' : '#c62828'};font-weight:600;">${rate}%</span>
                            </div>`;
                        });
                        return html;
                    }
                    return `${params.seriesName}`;
                }
            },
            legend: { 
                data: ['评估得分', '满分基准'], 
                top: 5,
                textStyle: { fontSize: 12 }
            },
            radar: {
                indicator: indicator.map((ind, i) => ({
                    ...ind,
                    name: `${ind.name} (${dimensionScores[i]}分)`
                })),
                shape: 'polygon',
                splitNumber: 4,
                center: ['50%', '54%'],
                radius: '60%',
                axisName: { 
                    color: '#333', 
                    fontSize: 12,
                    fontWeight: 500
                },
                axisNameGap: 15
            },
            series: [{
                type: 'radar',
                symbol: 'circle',
                symbolSize: 6,
                data: [
                    { 
                        value: completedData, 
                        name: '评估得分', 
                        areaStyle: { color: 'rgba(26,35,126,0.25)' }, 
                        lineStyle: { color: '#1a237e', width: 2 }, 
                        itemStyle: { color: '#1a237e' } 
                    },
                    { 
                        value: totalData, 
                        name: '满分基准', 
                        lineStyle: { color: '#bdbdbd', type: 'dashed', width: 1.5 }, 
                        itemStyle: { color: '#999' },
                        areaStyle: { color: 'rgba(189,189,189,0.1)' }
                    }
                ]
            }]
        };
        chartInstance.setOption(option, true);
    } else if (chartType === 'pie') {
        // Pie chart showing overall distribution
        let pass = 0, partial = 0, fail = 0, unassessed = 0;
        Object.values(project.items).forEach(item => {
            if (item.result === '符合') pass++;
            else if (item.result === '部分符合') partial++;
            else if (item.result === '不符合') fail++;
            else unassessed++;
        });
        
        const option = {
            tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
            legend: { orient: 'vertical', left: 'left' },
            series: [{
                type: 'pie',
                radius: ['40%', '70%'],
                avoidLabelOverlap: false,
                itemStyle: { borderRadius: 8, borderColor: '#fff', borderWidth: 2 },
                label: { show: true, formatter: '{b}: {c}' },
                data: [
                    { value: pass, name: '符合', itemStyle: { color: '#2e7d32' } },
                    { value: partial, name: '部分符合', itemStyle: { color: '#ed6c02' } },
                    { value: fail, name: '不符合', itemStyle: { color: '#c62828' } },
                    { value: unassessed, name: '未评估', itemStyle: { color: '#bdbdbd' } }
                ]
            }]
        };
        chartInstance.setOption(option);
    } else {
        // Bar chart (default)
        const passData = categories.map(c => l1Data[c].pass);
        const partialData = categories.map(c => l1Data[c].partial);
        const failData = categories.map(c => l1Data[c].fail);
        const totalData = categories.map(c => l1Data[c].total);

        const option = {
            tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
            legend: { data: ['符合', '部分符合', '不符合', '总数'], top: 5 },
            grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
            xAxis: { type: 'category', data: categories, axisLabel: { fontSize: 11, interval: 0 } },
            yAxis: { type: 'value', name: '数量' },
            series: [
                { name: '符合', type: 'bar', stack: 'total', data: passData, itemStyle: { color: '#2e7d32' } },
                { name: '部分符合', type: 'bar', stack: 'total', data: partialData, itemStyle: { color: '#ed6c02' } },
                { name: '不符合', type: 'bar', stack: 'total', data: failData, itemStyle: { color: '#c62828' } },
                { name: '总数', type: 'line', data: totalData, itemStyle: { color: '#1a237e' }, lineStyle: { width: 2 } }
            ]
        };
        chartInstance.setOption(option);
    }
}

function switchChartType(type) {
    const project = getProject(currentProjectId);
    if (!project) return;
    document.querySelectorAll('.chart-tab').forEach(t => t.classList.remove('active'));
    event.target.classList.add('active');
    renderChart(project, type);
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
    });

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
                    const resultClass = item.result ? `result${item.result}` : '';
                    const applicableBadge = tpl.applicable ? 
                        `<div class="applicable">📍 适用对象: ${escapeHtml(tpl.applicable)}</div>` : '';
                    const placeholder = getRecordPlaceholder(tpl);
                    const hint = getRecordHint(tpl);
                    
                    html += `
                        <div class="tree-item">
                            <div class="guidance">${escapeHtml(tpl.guidance)}</div>
                            ${applicableBadge}
                            <div class="item-hint" style="font-size:12px;color:#666;background:#f5f5f5;padding:6px 10px;border-radius:4px;margin-bottom:8px;">${hint}</div>
                            <div class="item-actions">
                                <select onchange="updateItem(${idx}, 'result', this.value)">
                                    <option value="">-- 判定结果 --</option>
                                    <option value="符合" ${item.result === '符合' ? 'selected' : ''}>✅ 符合</option>
                                    <option value="部分符合" ${item.result === '部分符合' ? 'selected' : ''}>⚠️ 部分符合</option>
                                    <option value="不符合" ${item.result === '不符合' ? 'selected' : ''}>❌ 不符合</option>
                                </select>
                                <span class="${resultClass}" style="font-size:12px;margin-left:8px;">${item.result ? '当前: ' + item.result : ''}</span>
                            </div>
                            <textarea placeholder="${escapeHtml(placeholder)}" onchange="updateItem(${idx}, 'record', this.value)">${escapeHtml(item.record || '')}</textarea>
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

function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// ============================================
// Excel 导出
// ============================================

function exportProjectToExcel(projectId) {
    const pid = projectId || currentProjectId;
    const project = getProject(pid);
    if (!project) {
        alert('项目不存在！');
        return;
    }

    const wb = XLSX.utils.book_new();

    // ===== 列宽（匹配优化版）=====
    const colWidths = [{ wch: 12 }, { wch: 13 }, { wch: 17 }, { wch: 52 }, { wch: 14 }, { wch: 19 }, { wch: 12 }];

    // ===== 样式定义 =====
    const thinBorder = {
        top: { style: 'thin', color: { rgb: '000000' } },
        bottom: { style: 'thin', color: { rgb: '000000' } },
        left: { style: 'thin', color: { rgb: '000000' } },
        right: { style: 'thin', color: { rgb: '000000' } }
    };

    // 表头：方正黑体_GBK 9号 粗体 白字 深蓝底(1F4E79)
    const headerStyle = {
        font: { name: '方正黑体_GBK', sz: 9, bold: true, color: { rgb: 'FFFFFF' } },
        fill: { fgColor: { rgb: '1F4E79' } },
        alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
        border: thinBorder
    };

    // 一级指标：方正仿宋_GBK 9号 粗体 白字 中蓝底(2E75B6)
    const l1Style = {
        font: { name: '方正仿宋_GBK', sz: 9, bold: true, color: { rgb: 'FFFFFF' } },
        fill: { fgColor: { rgb: '2E75B6' } },
        alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
        border: thinBorder
    };

    // 二级指标：Times New Roman 8号 粗体 深蓝字(1F4E79) 浅蓝底(DEEBF7)
    const l2Style = {
        font: { name: 'Times New Roman', sz: 8, bold: true, color: { rgb: '1F4E79' } },
        fill: { fgColor: { rgb: 'DEEBF7' } },
        alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
        border: thinBorder
    };

    // 三级指标：方正仿宋_GBK 8号 深灰字(333333) 极浅蓝底(F2F8FC)
    const l3Style = {
        font: { name: '方正仿宋_GBK', sz: 8, color: { rgb: '333333' } },
        fill: { fgColor: { rgb: 'F2F8FC' } },
        alignment: { horizontal: 'left', vertical: 'center', wrapText: true },
        border: thinBorder
    };

    // 评估指引：Times New Roman 8号 深灰字(333333) 无填充
    const guidanceStyle = {
        font: { name: 'Times New Roman', sz: 8, color: { rgb: '333333' } },
        alignment: { horizontal: 'left', vertical: 'center', wrapText: true },
        border: thinBorder
    };

    // 适用对象：方正仿宋_GBK 8号 棕橙字(BF6900) 浅黄底(FFF8E7)
    const applicableStyle = {
        font: { name: '方正仿宋_GBK', sz: 8, color: { rgb: 'BF6900' } },
        fill: { fgColor: { rgb: 'FFF8E7' } },
        alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
        border: thinBorder
    };

    // 评估记录：方正仿宋_GBK 8号 深灰字(333333) 无填充
    const recordStyle = {
        font: { name: '方正仿宋_GBK', sz: 8, color: { rgb: '333333' } },
        alignment: { horizontal: 'left', vertical: 'center', wrapText: true },
        border: thinBorder
    };

    // 判定结果：方正仿宋_GBK 8号 粗体
    const resultBaseStyle = {
        font: { name: '方正仿宋_GBK', sz: 8, bold: true, color: { rgb: '333333' } },
        alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
        border: thinBorder
    };

    // ===== 构建数据行（只写非合并首行值，其余留空）=====
    const headerRow = ['一级指标', '二级指标', '三级指标', '评估指引', '适用对象', '评估记录', '判定结果'];
    const rows = [headerRow];

    let curL1 = '', curL2 = '', curL3 = '';
    TEMPLATE.forEach((tpl, idx) => {
        const item = project.items[idx] || { record: '', result: '' };
        const l1Val = tpl.l1 !== curL1 ? tpl.l1 : '';
        const l2Val = tpl.l2 !== curL2 ? tpl.l2 : '';
        const l3Val = tpl.l3 !== curL3 ? tpl.l3 : '';
        curL1 = tpl.l1; curL2 = tpl.l2; curL3 = tpl.l3;
        rows.push([
            l1Val, l2Val, l3Val,
            tpl.guidance,
            tpl.applicable || '',
            item.record || '',
            item.result || ''
        ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = colWidths;

    // ===== 合并单元格 =====
    const merges = [];
    let currentL1 = TEMPLATE[0].l1;
    let currentL2 = TEMPLATE[0].l2;
    let currentL3 = TEMPLATE[0].l3;
    let currentApplicable = TEMPLATE[0].applicable || '';
    let l1Start = 1, l2Start = 1, l3Start = 1, appStart = 1;

    for (let i = 0; i < TEMPLATE.length; i++) {
        const tpl = TEMPLATE[i];
        const rowIdx = i + 1; // 0-based row in sheet (header is row 0)

        if (tpl.l1 !== currentL1) {
            if (rowIdx - 1 > l1Start) merges.push({ s: { r: l1Start, c: 0 }, e: { r: rowIdx - 1, c: 0 } });
            l1Start = rowIdx;
            currentL1 = tpl.l1;
        }
        if (tpl.l2 !== currentL2) {
            if (rowIdx - 1 > l2Start) merges.push({ s: { r: l2Start, c: 1 }, e: { r: rowIdx - 1, c: 1 } });
            l2Start = rowIdx;
            currentL2 = tpl.l2;
        }
        if (tpl.l3 !== currentL3) {
            if (rowIdx - 1 > l3Start) merges.push({ s: { r: l3Start, c: 2 }, e: { r: rowIdx - 1, c: 2 } });
            l3Start = rowIdx;
            currentL3 = tpl.l3;
        }
        const appVal = tpl.applicable || '';
        if (appVal !== currentApplicable) {
            if (currentApplicable !== '' && rowIdx - 1 > appStart) {
                merges.push({ s: { r: appStart, c: 4 }, e: { r: rowIdx - 1, c: 4 } });
            }
            appStart = rowIdx;
            currentApplicable = appVal;
        }
    }
    const lastRowIdx = TEMPLATE.length;
    if (lastRowIdx > l1Start) merges.push({ s: { r: l1Start, c: 0 }, e: { r: lastRowIdx, c: 0 } });
    if (lastRowIdx > l2Start) merges.push({ s: { r: l2Start, c: 1 }, e: { r: lastRowIdx, c: 1 } });
    if (lastRowIdx > l3Start) merges.push({ s: { r: l3Start, c: 2 }, e: { r: lastRowIdx, c: 2 } });
    if (lastRowIdx > appStart && currentApplicable) merges.push({ s: { r: appStart, c: 4 }, e: { r: lastRowIdx, c: 4 } });
    ws['!merges'] = merges;

    // ===== 应用样式 =====
    for (let R = 0; R < rows.length; R++) {
        for (let C = 0; C < 7; C++) {
            const cellRef = XLSX.utils.encode_cell({ r: R, c: C });
            if (!ws[cellRef]) ws[cellRef] = { t: 's', v: '' };

            if (R === 0) {
                // 表头
                ws[cellRef].s = headerStyle;
            } else {
                const tpl = TEMPLATE[R - 1];
                const item = project.items[R - 1] || { record: '', result: '' };
                switch (C) {
                    case 0: ws[cellRef].s = l1Style; break;
                    case 1: ws[cellRef].s = l2Style; break;
                    case 2: ws[cellRef].s = l3Style; break;
                    case 3: ws[cellRef].s = guidanceStyle; break;
                    case 4: ws[cellRef].s = applicableStyle; break;
                    case 5: ws[cellRef].s = recordStyle; break;
                    case 6: {
                        const val = item.result || '';
                        let style = Object.assign({}, resultBaseStyle);
                        if (val === '符合') style.font = Object.assign({}, style.font, { color: { rgb: '2E7D32' } });
                        else if (val === '部分符合') style.font = Object.assign({}, style.font, { color: { rgb: 'ED6C02' } });
                        else if (val === '不符合') style.font = Object.assign({}, style.font, { color: { rgb: 'C62828' } });
                        ws[cellRef].s = style;
                        break;
                    }
                }
            }
        }
    }

    // ===== 行高 =====
    ws['!rows'] = [{ hpt: 32 }];
    for (let i = 0; i < TEMPLATE.length; i++) {
        const tpl = TEMPLATE[i];
        const item = project.items[i] || { record: '', result: '' };
        const guidanceLines = Math.max(1, Math.ceil(tpl.guidance.length / 24));
        const appLines = tpl.applicable ? Math.max(1, Math.ceil(tpl.applicable.length / 7)) : 1;
        const recLines = item.record ? Math.max(1, Math.ceil(item.record.length / 9)) : 1;
        const maxLines = Math.max(guidanceLines, appLines, recLines);
        ws['!rows'].push({ hpt: Math.max(30, maxLines * 15 + 8) });
    }

    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');

    // ===== 项目信息页 =====
    const passCount = Object.values(project.items).filter(i => i.result === '符合').length;
    const partialCount = Object.values(project.items).filter(i => i.result === '部分符合').length;
    const failCount = Object.values(project.items).filter(i => i.result === '不符合').length;
    const unassessedCount = Object.values(project.items).filter(i => !i.result).length;

    const infoData = [
        ['评估项目信息'],
        ['项目名称', project.name],
        ['评估对象', project.target],
        ['评估人员', project.evaluator || ''],
        ['评估日期', project.date || ''],
        ['适用对象', project.applicable || '全部适用对象'],
        ['项目描述', project.desc || ''],
        ['', ''],
        ['评估统计'],
        ['评估项总数', TEMPLATE.length],
        ['符合', passCount],
        ['部分符合', partialCount],
        ['不符合', failCount],
        ['未评估', unassessedCount]
    ];

    const infoWs = XLSX.utils.aoa_to_sheet(infoData);
    infoWs['!cols'] = [{ wch: 15 }, { wch: 50 }];
    infoWs['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 1 } },
        { s: { r: 8, c: 0 }, e: { r: 8, c: 1 } }
    ];

    const titleStyle = {
        font: { name: '微软雅黑', sz: 14, bold: true, color: { rgb: 'FFFFFF' } },
        fill: { fgColor: { rgb: '1F4E79' } },
        alignment: { horizontal: 'center', vertical: 'center' },
        border: thinBorder
    };
    const statHeaderStyle = {
        font: { name: '微软雅黑', sz: 12, bold: true, color: { rgb: 'FFFFFF' } },
        fill: { fgColor: { rgb: '2E75B6' } },
        alignment: { horizontal: 'center', vertical: 'center' },
        border: thinBorder
    };
    const labelStyle = {
        font: { name: '微软雅黑', sz: 11, bold: true, color: { rgb: '1F4E79' } },
        fill: { fgColor: { rgb: 'DEEBF7' } },
        alignment: { horizontal: 'left', vertical: 'center', wrapText: true },
        border: thinBorder
    };
    const valueStyle = {
        font: { name: '微软雅黑', sz: 11, color: { rgb: '333333' } },
        alignment: { horizontal: 'left', vertical: 'center', wrapText: true },
        border: thinBorder
    };

    for (let R = 0; R < infoData.length; R++) {
        for (let C = 0; C < 2; C++) {
            const cellRef = XLSX.utils.encode_cell({ r: R, c: C });
            if (!infoWs[cellRef]) infoWs[cellRef] = { t: 's', v: '' };
            if (R === 0) infoWs[cellRef].s = titleStyle;
            else if (R === 8) infoWs[cellRef].s = statHeaderStyle;
            else if (C === 0) infoWs[cellRef].s = labelStyle;
            else infoWs[cellRef].s = valueStyle;
        }
    }

    infoWs['!rows'] = [{ hpt: 35 }];
    for (let i = 1; i < infoData.length; i++) infoWs['!rows'].push({ hpt: 28 });

    XLSX.utils.book_append_sheet(wb, infoWs, '项目信息');

    const fileName = `数据安全评估_${project.target}_${project.date || new Date().toISOString().slice(0,10)}.xlsx`;
    XLSX.writeFile(wb, fileName);
}

// ============================================
// 批量操作
// ============================================

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

// ============================================
// 其他操作
// ============================================

function deleteCurrentProject() {
    if (!currentProjectId) return;
    deleteProjectConfirm(currentProjectId);
}

function deleteProjectConfirm(id) {
    if (!confirm('确定要删除此评估项目吗？此操作不可恢复！')) return;
    deleteProject(id);
    if (id === currentProjectId) {
        backToDashboard();
    } else {
        renderProjectList();
    }
}

// ============================================
// 数据导入导出
// ============================================

function exportAllData() {
    const projects = getProjects();
    if (projects.length === 0) {
        alert('暂无项目数据可导出！');
        return;
    }
    const dataStr = JSON.stringify(projects, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `评估系统备份_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

function importAllData() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const imported = JSON.parse(event.target.result);
                let projectsToImport = [];
                
                if (Array.isArray(imported)) {
                    // 批量备份格式
                    projectsToImport = imported;
                } else if (imported && typeof imported === 'object' && imported.id) {
                    // 单个项目格式
                    projectsToImport = [imported];
                } else {
                    throw new Error('文件格式不正确');
                }
                
                if (!confirm(`将导入 ${projectsToImport.length} 个项目。\n\n是 = 合并导入（保留现有项目）\n取消 = 替换现有数据`)) {
                    const existing = getProjects();
                    saveProjects([...existing, ...projectsToImport]);
                    alert(`成功导入 ${projectsToImport.length} 个项目！`);
                } else {
                    saveProjects(projectsToImport);
                    alert(`成功导入 ${projectsToImport.length} 个项目（已替换现有数据）！`);
                }
                renderProjectList();
            } catch (err) {
                alert('导入失败：' + err.message);
            }
        };
        reader.readAsText(file);
    };
    input.click();
}

function exportSingleProject() {
    if (!currentProjectId) return;
    const project = getProject(currentProjectId);
    if (!project) return;
    const dataStr = JSON.stringify(project, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.name}_${project.date || ''}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

// ============================================
// 初始化
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    renderProjectList();
    
    // Add import/export buttons to dashboard
    const headerRight = document.querySelector('.header');
    const exportBtn = document.createElement('button');
    exportBtn.className = 'btn btn-default';
    exportBtn.style.marginLeft = '8px';
    exportBtn.textContent = '📦 备份数据';
    exportBtn.onclick = exportAllData;
    
    const importBtn = document.createElement('button');
    importBtn.className = 'btn btn-default';
    importBtn.style.marginLeft = '8px';
    importBtn.textContent = '📂 导入数据';
    importBtn.onclick = importAllData;
    
    headerRight.lastElementChild.appendChild(exportBtn);
    headerRight.lastElementChild.appendChild(importBtn);
});

window.addEventListener('resize', () => {
    if (chartInstance) {
        chartInstance.resize();
    }
});