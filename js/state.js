// ============================================
// 全局共享状态
// ============================================

let currentProjectId = null;
let chartInstance = null;
// 当前图表类型（bar/radar/pie），保存指标后重绘时保持用户所选类型
let currentChartType = 'bar';
