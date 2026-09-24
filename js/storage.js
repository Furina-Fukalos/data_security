// ============================================
// 项目数据存储（localStorage CRUD）
// ============================================

// 数据版本号：每次落盘递增，用于统计结果缓存失效判断（避免同一轮渲染重复遍历全部指标）
let _projectRev = 0;

function getProjectRev() {
    return _projectRev;
}

function getProjects() {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
}

function saveProjects(projects) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
    _projectRev++;
}

function getProject(id) {
    const projects = getProjects();
    return projects.find(p => p.id === id);
}

/**
 * 取项目使用的评估准则（指标清单）
 * - 默认使用系统内置模板 TEMPLATE（477 项）
 * - 若项目自带 criteria（如由报告导入生成），则使用项目专属准则，互不影响其他项目
 * @param {Object} project
 * @returns {Array} 指标数组 [{l1,l2,l3,guidance,applicable,...}]
 */
function getProjectCriteria(project) {
    if (project && Array.isArray(project.criteria) && project.criteria.length > 0) {
        return project.criteria;
    }
    return TEMPLATE;
}

/** 项目是否使用专属准则（非内置模板） */
function hasCustomCriteria(project) {
    return !!(project && Array.isArray(project.criteria) && project.criteria.length > 0);
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
