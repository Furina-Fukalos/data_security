// ============================================
// 初始化与全局事件
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    // 初始化认证系统
    initAuth();
    
    // 应用已导入的评估准则覆盖（如存在，导入的「评估位置/评估实施/适用对象」生效）
    try { applyStoredCriteria(); } catch (e) { console.error('应用已导入准则失败:', e); }
    
    // 只有登录后才渲染项目列表
    const user = getCurrentUser();
    if (user) {
        renderProjectList();
        setupHeaderButtons();
    }
    
    window.addEventListener('resize', () => {
        if (chartInstance) {
            chartInstance.resize();
        }
    });
});

function setupHeaderButtons() {
    const user = getCurrentUser();
    if (!user || user.role === 'evaluator') return;
    
    const headerRight = document.getElementById('headerUser');
    if (!headerRight) return;
    
    // 检查是否已添加
    if (headerRight.querySelector('.backup-btn')) return;
    
    const exportBtn = document.createElement('button');
    exportBtn.className = 'btn btn-default backup-btn';
    exportBtn.style.marginLeft = '8px';
    exportBtn.style.background = 'rgba(255,255,255,0.15)';
    exportBtn.style.color = 'white';
    exportBtn.style.border = '1px solid rgba(255,255,255,0.3)';
    exportBtn.textContent = '📦 备份数据';
    exportBtn.onclick = exportAllData;
    
    const importBtn = document.createElement('button');
    importBtn.className = 'btn btn-default import-btn';
    importBtn.style.marginLeft = '8px';
    importBtn.style.background = 'rgba(255,255,255,0.15)';
    importBtn.style.color = 'white';
    importBtn.style.border = '1px solid rgba(255,255,255,0.3)';
    importBtn.textContent = '📂 导入数据';
    importBtn.onclick = importAllData;
    
    // 在修改密码按钮之前插入
    const pwdBtn = headerRight.querySelector('button[onclick="showChangePassword()"]');
    if (pwdBtn) {
        headerRight.insertBefore(importBtn, pwdBtn);
        headerRight.insertBefore(exportBtn, importBtn);
    } else {
        headerRight.appendChild(exportBtn);
        headerRight.appendChild(importBtn);
    }
}
