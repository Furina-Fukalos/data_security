// ============================================
// 初始化与全局事件
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
