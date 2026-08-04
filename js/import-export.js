// ============================================
// 数据导入导出（备份/恢复/单项目导出）
// ============================================

function exportAllData() {
    const projects = getProjects();
    if (projects.length === 0) {
        alert('暂无项目数据可导出！');
        return;
    }
    const dataStr = JSON.stringify(projects, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    downloadBlob(blob, `评估系统备份_${new Date().toISOString().slice(0,10)}.json`);
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
    downloadBlob(blob, `${project.name}_${project.date || ''}.json`);
}
