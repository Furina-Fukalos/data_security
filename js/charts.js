// ============================================
// 图表渲染（ECharts，按需加载）
// 数据统一来自 stats.js，避免各图表重复统计口径
// ============================================

/**
 * 渲染评估进度图
 * @param {Object} project 项目
 * @param {'bar'|'radar'|'pie'} [chartType] 图表类型，缺省沿用当前类型
 */
async function renderChart(project, chartType) {
    const chartDom = document.getElementById('chart');
    if (!chartDom) return;
    if (!project) project = getProject(currentProjectId);
    if (!project) return;

    const type = chartType || currentChartType || 'bar';

    // 图表库按需加载（首次进入项目页时才拉取 echarts）
    let echartsLib;
    try {
        echartsLib = await loadLib('echarts');
    } catch (err) {
        console.error('图表库加载失败:', err);
        return;
    }
    if (!document.getElementById('chart')) return; // 等待期间可能已离开项目页

    // 调整容器类名（雷达图需要更高的容器）
    if (type === 'radar') {
        chartDom.classList.add('radar-chart');
    } else {
        chartDom.classList.remove('radar-chart');
    }

    // 复用实例：仅切换图表类型或实例已销毁时重建，避免每次编辑指标都销毁重建
    const prevType = currentChartType;
    if (chartInstance && (chartInstance.isDisposed() || type !== prevType)) {
        chartInstance.dispose();
        chartInstance = null;
    }
    if (!chartInstance) {
        chartInstance = echartsLib.init(chartDom);
    } else {
        chartInstance.resize();
    }
    currentChartType = type;

    // 同步图表切换页签的高亮状态
    const TABS = ['bar', 'radar', 'pie'];
    document.querySelectorAll('.chart-tab').forEach((tab, i) => {
        tab.classList.toggle('active', TABS[i] === type);
    });

    const l1Stats = computeL1Stats(project);
    const categories = Object.keys(l1Stats);

    if (type === 'radar') {
        // Radar chart
        const indicator = categories.map(c => ({
            name: c.replace(/^[一二三四五六七八九十]+、/, '').replace(/[（）()]/g, ''),
            max: Math.max(1, l1Stats[c].scored)
        }));

        const completedData = categories.map(c => l1Stats[c].pass + l1Stats[c].partial * 0.5);
        const totalData = categories.map(c => l1Stats[c].scored); // 不适用项不计入评分基数
        const dimensionScores = categories.map(c => Math.min(100, l1Stats[c].score));

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
    } else if (type === 'pie') {
        // Pie chart showing overall distribution
        const s = computeItemStats(project);

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
                    { value: s.pass, name: '符合', itemStyle: { color: getResultColor('符合') } },
                    { value: s.partial, name: '部分符合', itemStyle: { color: getResultColor('部分符合') } },
                    { value: s.fail, name: '不符合', itemStyle: { color: getResultColor('不符合') } },
                    { value: s.na, name: '不适用', itemStyle: { color: getResultColor('不适用') } },
                    { value: s.unassessed, name: '未评估', itemStyle: { color: '#bdbdbd' } }
                ]
            }]
        };
        chartInstance.setOption(option, true);
    } else {
        // Bar chart (default)
        const passData = categories.map(c => l1Stats[c].pass);
        const partialData = categories.map(c => l1Stats[c].partial);
        const failData = categories.map(c => l1Stats[c].fail);
        const naData = categories.map(c => l1Stats[c].na);
        const totalData = categories.map(c => l1Stats[c].total);

        const option = {
            tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
            legend: { data: ['符合', '部分符合', '不符合', '不适用', '总数'], top: 5 },
            grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
            xAxis: { type: 'category', data: categories, axisLabel: { fontSize: 11, interval: 0 } },
            yAxis: { type: 'value', name: '数量' },
            series: [
                { name: '符合', type: 'bar', stack: 'total', data: passData, itemStyle: { color: getResultColor('符合') } },
                { name: '部分符合', type: 'bar', stack: 'total', data: partialData, itemStyle: { color: getResultColor('部分符合') } },
                { name: '不符合', type: 'bar', stack: 'total', data: failData, itemStyle: { color: getResultColor('不符合') } },
                { name: '不适用', type: 'bar', stack: 'total', data: naData, itemStyle: { color: getResultColor('不适用') } },
                { name: '总数', type: 'line', data: totalData, itemStyle: { color: '#1a237e' }, lineStyle: { width: 2 } }
            ]
        };
        chartInstance.setOption(option, true);
    }
}

function switchChartType(type) {
    const project = getProject(currentProjectId);
    if (!project) return;
    renderChart(project, type); // 页签高亮由 renderChart 统一同步
}
