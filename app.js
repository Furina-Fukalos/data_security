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

function renderChart(project, chartType) {
    const chartDom = document.getElementById('chart');
    if (!chartDom) return;
    
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
        
        const option = {
            tooltip: {},
            legend: { data: ['评估得分', '满分'], top: 5 },
            radar: {
                indicator: indicator,
                shape: 'polygon',
                splitNumber: 4,
                axisName: { color: '#333', fontSize: 11 }
            },
            series: [{
                type: 'radar',
                data: [
                    { value: completedData, name: '评估得分', areaStyle: { color: 'rgba(26,35,126,0.3)' }, lineStyle: { color: '#1a237e' }, itemStyle: { color: '#1a237e' } },
                    { value: totalData, name: '满分', areaStyle: { color: 'rgba(200,200,200,0.2)' }, lineStyle: { color: '#999', type: 'dashed' }, itemStyle: { color: '#999' } }
                ]
            }]
        };
        chartInstance.setOption(option);
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