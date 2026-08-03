# -*- coding: utf-8 -*-
"""
数据安全管理评估系统 - Excel导出工具
精确匹配《数据安全管理评估表（优化版）》样式
"""

import openpyxl
from openpyxl.styles import Font, Alignment, Border, Side, PatternFill
from openpyxl.utils import get_column_letter
import json
import math
import os
import sys
from datetime import datetime

# 加载模板数据
TEMPLATE_DATA_PATH = os.path.join(os.path.dirname(__file__), 'template_data.json')
with open(TEMPLATE_DATA_PATH, 'r', encoding='utf-8') as f:
    TEMPLATE = json.load(f)


def _estimate_row_height(tpl, record='', result=''):
    """根据内容估算行高（匹配优化版的行高风格）"""
    max_lines = 1
    # D列(评估指引)宽度52，约26个中文字符/行
    guidance = tpl.get('guidance', '')
    d_lines = max(1, math.ceil(len(guidance) / 24))
    max_lines = max(max_lines, d_lines)
    # E列(适用对象)宽度14，约7个中文字符/行
    applicable = tpl.get('applicable', '')
    if applicable:
        e_lines = max(1, math.ceil(len(applicable) / 7))
        max_lines = max(max_lines, e_lines)
    # F列(评估记录)宽度19，约9个中文字符/行
    if record:
        f_lines = max(1, math.ceil(len(record) / 9))
        max_lines = max(max_lines, f_lines)
    # 每行约15磅 + 8磅padding，最小30
    return max(30, max_lines * 15 + 8)


def create_evaluation_excel(project_data, output_path=None):
    """
    创建评估Excel文档（匹配优化版样式）

    Args:
        project_data: 项目数据字典
        output_path: 输出文件路径
    """
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Sheet1"

    # ===== 样式定义（匹配优化版）=====
    # 边框
    thin_border = Border(
        left=Side(style='thin', color='000000'),
        right=Side(style='thin', color='000000'),
        top=Side(style='thin', color='000000'),
        bottom=Side(style='thin', color='000000')
    )

    # 表头样式：方正黑体_GBK, 9号, 白色字, 深蓝底(1F4E79)
    header_font = Font(name='方正黑体_GBK', size=9, bold=True, color='FFFFFFFF')
    header_fill = PatternFill(start_color='FF1F4E79', end_color='FF1F4E79', fill_type='solid')
    header_alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)

    # 一级指标样式：方正仿宋_GBK, 9号, 粗体, 白色字, 中蓝底(2E75B6)
    l1_font = Font(name='方正仿宋_GBK', size=9, bold=True, color='FFFFFFFF')
    l1_fill = PatternFill(start_color='FF2E75B6', end_color='FF2E75B6', fill_type='solid')

    # 二级指标样式：Times New Roman, 8号, 粗体, 深蓝字(1F4E79), 浅蓝底(DEEBF7)
    l2_font = Font(name='Times New Roman', size=8, bold=True, color='FF1F4E79')
    l2_fill = PatternFill(start_color='FFDEEBF7', end_color='FFDEEBF7', fill_type='solid')

    # 三级指标样式：方正仿宋_GBK, 8号, 深灰字(333333), 极浅蓝底(F2F8FC)
    l3_font = Font(name='方正仿宋_GBK', size=8, bold=False, color='FF333333')
    l3_fill = PatternFill(start_color='FFF2F8FC', end_color='FFF2F8FC', fill_type='solid')

    # 评估指引样式：Times New Roman, 8号, 深灰字(333333), 无填充
    guidance_font = Font(name='Times New Roman', size=8, bold=False, color='FF333333')

    # 适用对象样式：方正仿宋_GBK, 8号, 棕橙字(BF6900), 浅黄底(FFF8E7)
    applicable_font = Font(name='方正仿宋_GBK', size=8, bold=False, color='FFBF6900')
    applicable_fill = PatternFill(start_color='FFFFF8E7', end_color='FFFFF8E7', fill_type='solid')

    # 评估记录样式：方正仿宋_GBK, 8号, 深灰字(333333), 无填充
    record_font = Font(name='方正仿宋_GBK', size=8, bold=False, color='FF333333')

    # 判定结果样式
    result_font_normal = Font(name='方正仿宋_GBK', size=8, bold=True, color='FF333333')
    result_font_pass = Font(name='方正仿宋_GBK', size=8, bold=True, color='FF2E7D32')
    result_font_partial = Font(name='方正仿宋_GBK', size=8, bold=True, color='FFED6C02')
    result_font_fail = Font(name='方正仿宋_GBK', size=8, bold=True, color='FFC62828')

    center_align = Alignment(horizontal='center', vertical='center', wrap_text=True)
    left_align = Alignment(horizontal='left', vertical='center', wrap_text=True)

    # ===== 列宽（匹配优化版）=====
    col_widths = {'A': 12, 'B': 13, 'C': 17, 'D': 52, 'E': 14, 'F': 19, 'G': 12}
    for col, width in col_widths.items():
        ws.column_dimensions[col].width = width

    # ===== 表头 =====
    headers = ['一级指标', '二级指标', '三级指标', '评估指引', '适用对象', '评估记录', '判定结果']
    for col, header in enumerate(headers, 1):
        cell = ws.cell(row=1, column=col, value=header)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = header_alignment
        cell.border = thin_border
    ws.row_dimensions[1].height = 32

    # ===== 数据行 =====
    items = project_data.get('items', {})
    current_l1 = None
    current_l2 = None
    current_l3 = None
    current_applicable = None
    l1_start = 2
    l2_start = 2
    l3_start = 2
    applicable_start = 2

    for idx, tpl in enumerate(TEMPLATE):
        row_num = idx + 2
        item_result = items.get(str(idx), {})
        record = item_result.get('record', '')
        result = item_result.get('result', '')

        # --- 列D: 评估指引 ---
        cell_d = ws.cell(row=row_num, column=4, value=tpl['guidance'])
        cell_d.font = guidance_font
        cell_d.alignment = left_align
        cell_d.border = thin_border

        # --- 列E: 适用对象 ---
        applicable_val = tpl.get('applicable', '')
        cell_e = ws.cell(row=row_num, column=5, value=applicable_val)
        cell_e.font = applicable_font
        cell_e.fill = applicable_fill
        cell_e.alignment = center_align
        cell_e.border = thin_border

        # --- 列F: 评估记录 ---
        cell_f = ws.cell(row=row_num, column=6, value=record)
        cell_f.font = record_font
        cell_f.alignment = left_align
        cell_f.border = thin_border

        # --- 列G: 判定结果 ---
        cell_g = ws.cell(row=row_num, column=7, value=result)
        if result == '符合':
            cell_g.font = result_font_pass
        elif result == '部分符合':
            cell_g.font = result_font_partial
        elif result == '不符合':
            cell_g.font = result_font_fail
        else:
            cell_g.font = result_font_normal
        cell_g.alignment = center_align
        cell_g.border = thin_border

        # --- 一级指标合并 ---
        if tpl['l1'] != current_l1:
            if current_l1 is not None and row_num - 1 > l1_start:
                ws.merge_cells(start_row=l1_start, start_column=1, end_row=row_num - 1, end_column=1)
            current_l1 = tpl['l1']
            l1_start = row_num
        cell_a = ws.cell(row=row_num, column=1, value=tpl['l1'] if tpl['l1'] == current_l1 and row_num == l1_start else None)
        if row_num == l1_start:
            cell_a = ws.cell(row=row_num, column=1, value=tpl['l1'])
        cell_a.font = l1_font
        cell_a.fill = l1_fill
        cell_a.alignment = center_align
        cell_a.border = thin_border

        # --- 二级指标合并 ---
        if tpl['l2'] != current_l2:
            if current_l2 is not None and row_num - 1 > l2_start:
                ws.merge_cells(start_row=l2_start, start_column=2, end_row=row_num - 1, end_column=2)
            current_l2 = tpl['l2']
            l2_start = row_num
        cell_b = ws.cell(row=row_num, column=2)
        if row_num == l2_start:
            cell_b.value = tpl['l2']
        cell_b.font = l2_font
        cell_b.fill = l2_fill
        cell_b.alignment = center_align
        cell_b.border = thin_border

        # --- 三级指标合并 ---
        if tpl['l3'] != current_l3:
            if current_l3 is not None and row_num - 1 > l3_start:
                ws.merge_cells(start_row=l3_start, start_column=3, end_row=row_num - 1, end_column=3)
            current_l3 = tpl['l3']
            l3_start = row_num
        cell_c = ws.cell(row=row_num, column=3)
        if row_num == l3_start:
            cell_c.value = tpl['l3']
        cell_c.font = l3_font
        cell_c.fill = l3_fill
        cell_c.alignment = left_align
        cell_c.border = thin_border

        # --- 适用对象合并（连续相同值时合并）---
        if applicable_val != current_applicable:
            if current_applicable is not None and current_applicable != '' and row_num - 1 > applicable_start:
                ws.merge_cells(start_row=applicable_start, start_column=5, end_row=row_num - 1, end_column=5)
            current_applicable = applicable_val
            applicable_start = row_num

        # --- 行高 ---
        ws.row_dimensions[row_num].height = _estimate_row_height(tpl, record, result)

    # 完成最后的合并
    last_row = len(TEMPLATE) + 1
    if last_row > l1_start:
        ws.merge_cells(start_row=l1_start, start_column=1, end_row=last_row, end_column=1)
    if last_row > l2_start:
        ws.merge_cells(start_row=l2_start, start_column=2, end_row=last_row, end_column=2)
    if last_row > l3_start:
        ws.merge_cells(start_row=l3_start, start_column=3, end_row=last_row, end_column=3)
    if last_row > applicable_start and current_applicable:
        ws.merge_cells(start_row=applicable_start, start_column=5, end_row=last_row, end_column=5)

    # 冻结首行
    ws.freeze_panes = 'A2'

    # 为合并单元格内的所有单元格设置边框（合并后只有首格有内容，但边框需全覆盖）
    for row_num in range(2, last_row + 1):
        for col_num in range(1, 4):
            cell = ws.cell(row=row_num, column=col_num)
            cell.border = thin_border
        # E列也要确保边框
        ws.cell(row=row_num, column=5).border = thin_border

    # ===== 项目信息页 =====
    ws2 = wb.create_sheet('项目信息')
    info_data = [
        ['评估项目信息'],
        ['项目名称', project_data.get('name', '')],
        ['评估对象', project_data.get('target', '')],
        ['评估人员', project_data.get('evaluator', '')],
        ['评估日期', project_data.get('date', '')],
        ['适用对象', project_data.get('applicable', '全部适用对象')],
        ['项目描述', project_data.get('desc', '')],
        ['', ''],
        ['评估统计'],
        ['评估项总数', len(TEMPLATE)],
        ['符合', sum(1 for item in items.values() if item.get('result') == '符合')],
        ['部分符合', sum(1 for item in items.values() if item.get('result') == '部分符合')],
        ['不符合', sum(1 for item in items.values() if item.get('result') == '不符合')],
        ['未评估', sum(1 for item in items.values() if not item.get('result'))],
    ]
    title_font = Font(name='微软雅黑', size=14, bold=True, color='FFFFFFFF')
    title_fill = PatternFill(start_color='FF1F4E79', end_color='FF1F4E79', fill_type='solid')
    label_font = Font(name='微软雅黑', size=11, bold=True, color='FF1F4E79')
    label_fill = PatternFill(start_color='FFDEEBF7', end_color='FFDEEBF7', fill_type='solid')
    value_font = Font(name='微软雅黑', size=11, color='FF333333')
    stat_font = Font(name='微软雅黑', size=12, bold=True, color='FFFFFFFF')
    stat_fill = PatternFill(start_color='FF2E75B6', end_color='FF2E75B6', fill_type='solid')

    for row_idx, row_data in enumerate(info_data, 1):
        for col_idx, value in enumerate(row_data, 1):
            cell = ws2.cell(row=row_idx, column=col_idx, value=value)
            cell.alignment = Alignment(horizontal='left', vertical='center', wrap_text=True)
            cell.border = thin_border
            if row_idx == 1:
                cell.font = title_font
                cell.fill = title_fill
                cell.alignment = center_align
            elif row_idx == 9:
                cell.font = stat_font
                cell.fill = stat_fill
                cell.alignment = center_align
            elif col_idx == 1:
                cell.font = label_font
                cell.fill = label_fill
            else:
                cell.font = value_font

    ws2.merge_cells(start_row=1, start_column=1, end_row=1, end_column=2)
    ws2.merge_cells(start_row=9, start_column=1, end_row=9, end_column=2)
    ws2.column_dimensions['A'].width = 15
    ws2.column_dimensions['B'].width = 50
    ws2.row_dimensions[1].height = 35
    for r in range(2, len(info_data) + 1):
        ws2.row_dimensions[r].height = 28

    # 保存
    if not output_path:
        target = project_data.get('target', '未命名')
        date = project_data.get('date', datetime.now().strftime('%Y-%m-%d'))
        output_path = f"数据安全评估_{target}_{date}.xlsx"
    wb.save(output_path)
    return output_path


def export_from_json_file(json_path, output_path=None):
    """从JSON文件导出Excel"""
    with open(json_path, 'r', encoding='utf-8') as f:
        project_data = json.load(f)
    return create_evaluation_excel(project_data, output_path)


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("用法: python export_excel.py <项目JSON文件> [输出Excel路径]")
        print("项目JSON文件格式: 由评估系统导出的备份数据")
        sys.exit(1)
    json_path = sys.argv[1]
    output_path = sys.argv[2] if len(sys.argv) > 2 else None
    try:
        result = export_from_json_file(json_path, output_path)
        print(f"✅ Excel导出成功: {result}")
    except Exception as e:
        print(f"❌ 导出失败: {e}")
