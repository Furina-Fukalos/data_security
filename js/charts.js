// ============================================
// 图表渲染（ECharts）
// ============================================

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
