// ============================================
// 仪表盘：统计、项目列表、创建项目、批量操作
// ============================================

function showCreateProjectModal() {
    if (!requirePermission('create', '创建项目')) return;
    document.getElementById('createProjectModal').style.display = 'flex';
    document.getElementById('projectDate').valueAsDate = new Date();
    // 自动填充评估人员为当前登录用户
    const user = getCurrentUser();
    if (user) {
        document.getElementById('projectEvaluator').value = user.name;
    }
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
                    ${(hasPermission('delete') || hasPermission('all')) ? `<button class="btn btn-danger btn-sm" onclick="deleteProjectConfirm('${p.id}')">删除</button>` : ''}
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
    if (!requirePermission('delete', '删除项目')) return;
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
    downloadBlob(blob, `批量备份_${selected.length}个项目_${new Date().toISOString().slice(0,10)}.json`);
}

function selectAllProjects() {
    const projects = getProjects();
    selectedProjectIds = new Set(projects.map(p => p.id));
    renderProjectList();
}
