# -*- coding: utf-8 -*-
"""
数据安全管理评估系统 - Excel导出工具
用于将评估项目数据导出为格式化的Excel文档
匹配原始模板格式
"""

import openpyxl
from openpyxl.styles import Font, Alignment, Border, Side, PatternFill
from openpyxl.utils import get_column_letter
import json
import os
import sys
from datetime import datetime

# 加载模板数据
TEMPLATE_DATA_PATH = os.path.join(os.path.dirname(__file__), 'template_data.json')
with open(TEMPLATE_DATA_PATH, 'r', encoding='utf-8') as f:
    TEMPLATE = json.load(f)

def create_evaluation_excel(project_data, output_path=None):
    """
    创建评估Excel文档
    
    Args:
        project_data: 项目数据字典，包含:
            - name: 项目名称
            - target: 评估对象
            - evaluator: 评估人员
            - date: 评估日期
            - applicable: 适用对象
            - desc: 项目描述
            - items: 评估项结果 {index: {record: str, result: str}}
        output_path: 输出文件路径
    """
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "数据安全管理评估表"
    
    # 样式定义
    header_font = Font(name='微软雅黑', size=11, bold=True, color='FFFFFF')
    header_fill = PatternFill(start_color='1A237E', end_color='1A237E', fill_type='solid')
    header_alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)
    
    l1_font = Font(name='微软雅黑', size=11, bold=True)
    l1_fill = PatternFill(start_color='E8EAF6', end_color='E8EAF6', fill_type='solid')
    
    l2_font = Font(name='微软雅黑', size=10, bold=True)
    l2_fill = PatternFill(start_color='F3E5F5', end_color='F3E5F5', fill_type='solid')
    
    l3_font = Font(name='微软雅黑', size=10, bold=True)
    l3_fill = PatternFill(start_color='E3F2FD', end_color='E3F2FD', fill_type='solid')
    
    normal_font = Font(name='微软雅黑', size=10)
    normal_alignment = Alignment(horizontal='left', vertical='center', wrap_text=True)
    center_alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)
    
    pass_font = Font(name='微软雅黑', size=10, color='2E7D32', bold=True)
    fail_font = Font(name='微软雅黑', size=10, color='C62828', bold=True)
    partial_font = Font(name='微软雅黑', size=10, color='ED6C02', bold=True)
    
    thin_border = Border(
        left=Side(style='thin', color='000000'),
        right=Side(style='thin', color='000000'),
        top=Side(style='thin', color='000000'),
        bottom=Side(style='thin', color='000000')
    )
    
    # 写入表头
    headers = ['一级指标', '二级指标', '三级指标', '评估指引', '适用对象', '评估记录', '判定结果']
    for col, header in enumerate(headers, 1):
        cell = ws.cell(row=1, column=col, value=header)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = header_alignment
        cell.border = thin_border
    
    # 设置列宽
    col_widths = [18, 22, 25, 60, 30, 40, 12]
    for i, width in enumerate(col_widths, 1):
        ws.column_dimensions[get_column_letter(i)].width = width
    
    # 写入数据行
    items = project_data.get('items', {})
    current_l1 = None
    current_l2 = None
    current_l3 = None
    l1_start = 2
    l2_start = 2
    l3_start = 2
    
    for idx, tpl in enumerate(TEMPLATE):
        row_num = idx + 2
        item_result = items.get(str(idx), {})
        record = item_result.get('record', '')
        result = item_result.get('result', '')
        
        # 写入评估指引、适用对象、评估记录、判定结果
        ws.cell(row=row_num, column=4, value=tpl['guidance']).font = normal_font
        ws.cell(row=row_num, column=4).alignment = normal_alignment
        ws.cell(row=row_num, column=4).border = thin_border
        
        ws.cell(row=row_num, column=5, value=tpl.get('applicable', '')).font = normal_font
        ws.cell(row=row_num, column=5).alignment = normal_alignment
        ws.cell(row=row_num, column=5).border = thin_border
        
        ws.cell(row=row_num, column=6, value=record).font = normal_font
        ws.cell(row=row_num, column=6).alignment = normal_alignment
        ws.cell(row=row_num, column=6).border = thin_border
        
        result_cell = ws.cell(row=row_num, column=7, value=result)
        if result == '符合':
            result_cell.font = pass_font
        elif result == '不符合':
            result_cell.font = fail_font
        elif result == '部分符合':
            result_cell.font = partial_font
        else:
            result_cell.font = normal_font
        result_cell.alignment = center_alignment
        result_cell.border = thin_border
        
        # 处理一级指标合并
        if tpl['l1'] != current_l1:
            if current_l1 is not None and row_num - 1 > l1_start:
                ws.merge_cells(start_row=l1_start, start_column=1, end_row=row_num-1, end_column=1)
            current_l1 = tpl['l1']
            l1_start = row_num
        
        # 处理二级指标合并
        if tpl['l2'] != current_l2:
            if current_l2 is not None and row_num - 1 > l2_start:
                ws.merge_cells(start_row=l2_start, start_column=2, end_row=row_num-1, end_column=2)
            current_l2 = tpl['l2']
            l2_start = row_num
        
        # 处理三级指标合并
        if tpl['l3'] != current_l3:
            if current_l3 is not None and row_num - 1 > l3_start:
                ws.merge_cells(start_row=l3_start, start_column=3, end_row=row_num-1, end_column=3)
            current_l3 = tpl['l3']
            l3_start = row_num
    
    # 完成最后的合并
    last_row = len(TEMPLATE) + 1
    if last_row > l1_start:
        ws.merge_cells(start_row=l1_start, start_column=1, end_row=last_row, end_column=1)
    if last_row > l2_start:
        ws.merge_cells(start_row=l2_start, start_column=2, end_row=last_row, end_column=2)
    if last_row > l3_start:
        ws.merge_cells(start_row=l3_start, start_column=3, end_row=last_row, end_column=3)
    
    # 设置合并单元格的样式
    for row in range(2, last_row + 1):
        for col in range(1, 4):
            cell = ws.cell(row=row, column=col)
            cell.border = thin_border
            cell.alignment = center_alignment
        
        # 设置数据行高
        ws.row_dimensions[row].height = 45
    
    ws.row_dimensions[1].height = 30
    
    # 创建项目信息页
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
    
    for row_idx, row_data in enumerate(info_data, 1):
        for col_idx, value in enumerate(row_data, 1):
            cell = ws2.cell(row=row_idx, column=col_idx, value=value)
            cell.font = normal_font
            cell.alignment = Alignment(horizontal='left', vertical='center', wrap_text=True)
            cell.border = thin_border
    
    # 标题样式
    title_font = Font(name='微软雅黑', size=14, bold=True, color='FFFFFF')
    title_fill = PatternFill(start_color='1A237E', end_color='1A237E', fill_type='solid')
    cell = ws2.cell(row=1, column=1)
    cell.font = title_font
    cell.fill = title_fill
    cell.alignment = center_alignment
    
    # 合并标题行
    ws2.merge_cells(start_row=1, start_column=1, end_row=1, end_column=2)
    
    # 设置统计部分样式
    stat_font = Font(name='微软雅黑', size=12, bold=True)
    stat_fill = PatternFill(start_color='E8EAF6', end_color='E8EAF6', fill_type='solid')
    for r in [9]:
        for c in [1, 2]:
            cell = ws2.cell(row=r, column=c)
            cell.font = stat_font
            cell.fill = stat_fill
    
    # 合并统计行
    ws2.merge_cells(start_row=9, start_column=1, end_row=9, end_column=2)
    
    # 列宽
    ws2.column_dimensions['A'].width = 15
    ws2.column_dimensions['B'].width = 50
    
    # 行高
    ws2.row_dimensions[1].height = 35
    for r in range(2, len(info_data) + 1):
        ws2.row_dimensions[r].height = 25
    
    # 保存
    if not output_path:
        output_path = f"数据安全评估_{project_data.get('target', '未命名')}_{project_data.get('date', datetime.now().strftime('%Y-%m-%d'))}.xlsx"
    
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