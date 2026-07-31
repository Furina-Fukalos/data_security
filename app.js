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
}

// ============================================
// 视图渲染
// ============================================

function updateDashboardStats() {
    const projects = getProjects();
    let totalItems = 0;
    let completedItems = 0;
    
    projects.forEach(p => {
        Object.values(p.items).forEach(item => {
            totalItems++;
            if (item.result === '符合' || item.result === '不符合' || item.result === '部分符合') {
                completedItems++;
            }
        });
    });

    const completedProjects = projects.filter(p => {
        const items = Object.values(p.items);
        if (items.length === 0) return false;
        const done = items.filter(i => i.result).length;
        return done >= items.length * 0.9;
    }).length;

    document.getElementById('statProjects').textContent = projects.length;
    document.getElementById('statCompleted').textContent = completedProjects;
    document.getElementById('statInProgress').textContent = projects.length - completedProjects;
    document.getElementById('statIndicators').textContent = TEMPLATE.length;
}

function renderProjectList() {
    updateDashboardStats();
    const projects = getProjects();
    const searchTerm = (document.getElementById('searchBox')?.value || '').toLowerCase();
    
    const container = document.getElementById('projectList');
    
    if (projects.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="icon">📋</div>
                <p>暂无评估项目</p>
                <p style="font-size:12px;margin-top:8px;">点击右上角"新建评估项目"开始创建</p>
            </div>
        `;
        return;
    }

    const filtered = projects.filter(p => 
        !searchTerm || 
        p.name.toLowerCase().includes(searchTerm) ||
        p.target.toLowerCase().includes(searchTerm)
    );

    let html = '<table><thead><tr><th>项目名称</th><th>评估对象</th><th>评估人员</th><th>日期</th><th>进度</th><th>操作</th></tr></thead><tbody>';
    
    filtered.forEach(p => {
        const items = Object.values(p.items);
        const done = items.filter(i => i.result).length;
        const pct = items.length > 0 ? Math.round(done / items.length * 100) : 0;
        
        let progressClass = 'progress-fill-success';
        if (pct < 60) progressClass = 'progress-fill-danger';
        else if (pct < 90) progressClass = 'progress-fill-warn';
        
        html += `
            <tr>
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
}

function openProject(id) {
    currentProjectId = id;
    const project = getProject(id);
    if (!project) return;

    document.getElementById('dashboardView').style.display = 'none';
    document.getElementById('projectView').style.display = 'block';
    document.getElementById('projectTitle').textContent = project.name;
    
    // Add JSON export button
    const actionDiv = document.querySelector('#projectView .card-header .card-header div');
    const jsonBtn = document.createElement('button');
    jsonBtn.className = 'btn btn-default btn-sm';
    jsonBtn.style.marginLeft = '8px';
    jsonBtn.textContent = '💾 备份项目';
    jsonBtn.onclick = exportSingleProject;
    const cardHeaderRight = document.querySelector('#projectView .card-header > div:last-child');
    if (cardHeaderRight) {
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
    setTimeout(() => renderChart(project, 'bar'), 100);
    
    // Render tree
    renderTree();
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
                    
                    html += `
                        <div class="tree-item">
                            <div class="guidance">${escapeHtml(tpl.guidance)}</div>
                            ${applicableBadge}
                            <div class="item-actions">
                                <select onchange="updateItem(${idx}, 'result', this.value)">
                                    <option value="">-- 判定结果 --</option>
                                    <option value="符合" ${item.result === '符合' ? 'selected' : ''}>✅ 符合</option>
                                    <option value="部分符合" ${item.result === '部分符合' ? 'selected' : ''}>⚠️ 部分符合</option>
                                    <option value="不符合" ${item.result === '不符合' ? 'selected' : ''}>❌ 不符合</option>
                                </select>
                                <span class="${resultClass}" style="font-size:12px;margin-left:8px;">${item.result ? '当前: ' + item.result : ''}</span>
                            </div>
                            <textarea placeholder="📝 评估记录..." onchange="updateItem(${idx}, 'record', this.value)">${escapeHtml(item.record || '')}</textarea>
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
    
    const headerRow = ['一级指标', '二级指标', '三级指标', '评估指引', '适用对象', '评估记录', '判定结果'];
    const rows = [headerRow];
    
    TEMPLATE.forEach((tpl, idx) => {
        const item = project.items[idx] || { record: '', result: '' };
        rows.push([
            tpl.l1,
            tpl.l2,
            tpl.l3,
            tpl.guidance,
            tpl.applicable || '',
            item.record || '',
            item.result || ''
        ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(rows);
    
    ws['!cols'] = [
        { wch: 18 }, { wch: 22 }, { wch: 25 }, { wch: 60 },
        { wch: 30 }, { wch: 40 }, { wch: 12 }
    ];

    const merges = [];
    let currentL1 = TEMPLATE[0].l1;
    let currentL2 = TEMPLATE[0].l2;
    let currentL3 = TEMPLATE[0].l3;
    let l1Start = 1, l2Start = 1, l3Start = 1;

    for (let i = 0; i < TEMPLATE.length; i++) {
        const tpl = TEMPLATE[i];
        const rowIdx = i + 2;
        
        if (tpl.l1 !== currentL1) {
            if (rowIdx - 1 > l1Start) merges.push({ s: { r: l1Start, c: 0 }, e: { r: rowIdx - 2, c: 0 } });
            l1Start = rowIdx;
            currentL1 = tpl.l1;
        }
        if (tpl.l2 !== currentL2) {
            if (rowIdx - 1 > l2Start) merges.push({ s: { r: l2Start, c: 1 }, e: { r: rowIdx - 2, c: 1 } });
            l2Start = rowIdx;
            currentL2 = tpl.l2;
        }
        if (tpl.l3 !== currentL3) {
            if (rowIdx - 1 > l3Start) merges.push({ s: { r: l3Start, c: 2 }, e: { r: rowIdx - 2, c: 2 } });
            l3Start = rowIdx;
            currentL3 = tpl.l3;
        }
    }
    if (TEMPLATE.length + 1 > l1Start) merges.push({ s: { r: l1Start, c: 0 }, e: { r: TEMPLATE.length, c: 0 } });
    if (TEMPLATE.length + 1 > l2Start) merges.push({ s: { r: l2Start, c: 1 }, e: { r: TEMPLATE.length, c: 1 } });
    if (TEMPLATE.length + 1 > l3Start) merges.push({ s: { r: l3Start, c: 2 }, e: { r: TEMPLATE.length, c: 2 } });
    ws['!merges'] = merges;

    // Set cell styles
    const borderStyle = { top: { style: 'thin', color: { rgb: '000000' } }, 
                          bottom: { style: 'thin', color: { rgb: '000000' } },
                          left: { style: 'thin', color: { rgb: '000000' } }, 
                          right: { style: 'thin', color: { rgb: '000000' } } };
    
    for (let R = 0; R < rows.length; R++) {
        for (let C = 0; C < 7; C++) {
            const cellRef = XLSX.utils.encode_cell({ r: R, c: C });
            if (!ws[cellRef]) {
                ws[cellRef] = { t: 's', v: '' };
            }
            ws[cellRef].s = {
                border: borderStyle,
                alignment: { horizontal: C >= 3 ? 'left' : 'center', vertical: 'center', wrapText: true },
                font: { sz: 10 }
            };
            if (R === 0) {
                ws[cellRef].s.font = { bold: true, sz: 11, color: { rgb: 'FFFFFF' } };
                ws[cellRef].s.fill = { fgColor: { rgb: '1A237E' } };
                ws[cellRef].s.alignment = { horizontal: 'center', vertical: 'center', wrapText: true };
            }
            if (R > 0 && C === 6) {
                const val = ws[cellRef].v;
                if (val === '符合') ws[cellRef].s.font = { color: { rgb: '2E7D32' }, bold: true, sz: 10 };
                else if (val === '不符合') ws[cellRef].s.font = { color: { rgb: 'C62828' }, bold: true, sz: 10 };
                else if (val === '部分符合') ws[cellRef].s.font = { color: { rgb: 'ED6C02' }, bold: true, sz: 10 };
            }
        }
    }

    ws['!rows'] = [{ hpt: 30 }];
    for (let i = 1; i < rows.length; i++) {
        ws['!rows'].push({ hpt: 45 });
    }

    XLSX.utils.book_append_sheet(wb, ws, '数据安全管理评估表');

    // Project Info Sheet
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
    infoWs['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }];
    
    // Style info sheet
    for (let R = 0; R < infoData.length; R++) {
        for (let C = 0; C < 2; C++) {
            const cellRef = XLSX.utils.encode_cell({ r: R, c: C });
            if (!infoWs[cellRef]) infoWs[cellRef] = { t: 's', v: '' };
            infoWs[cellRef].s = {
                border: borderStyle,
                alignment: { horizontal: 'left', vertical: 'center', wrapText: true },
                font: { sz: 11 }
            };
            if (R === 0) {
                infoWs[cellRef].s.font = { bold: true, sz: 14, color: { rgb: 'FFFFFF' } };
                infoWs[cellRef].s.fill = { fgColor: { rgb: '1A237E' } };
                infoWs[cellRef].s.alignment = { horizontal: 'center', vertical: 'center' };
            }
            if (infoData[R][0] === '评估统计' || infoData[R][0] === '评估项目信息') {
                infoWs[cellRef].s.font = { bold: true, sz: 12 };
                infoWs[cellRef].s.fill = { fgColor: { rgb: 'E8EAF6' } };
            }
        }
    }
    
    infoWs['!rows'] = [{ hpt: 35 }];
    for (let i = 1; i < infoData.length; i++) infoWs['!rows'].push({ hpt: 25 });

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
                if (!Array.isArray(imported)) throw new Error('格式错误');
                const existing = getProjects();
                if (existing.length > 0) {
                    if (!confirm('导入将覆盖现有数据，是否继续？')) return;
                }
                saveProjects(imported);
                alert('数据导入成功！');
                renderProjectList();
            } catch (err) {
                alert('导入失败：文件格式错误');
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