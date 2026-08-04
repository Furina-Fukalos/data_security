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
