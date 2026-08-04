# 数据安全管理评估系统

基于浏览器的单页数据安全管理评估工具（Data Security Management Evaluation System）。按照《数据安全管理评估表（优化版）》中的 477 项评估指引，对评估对象进行逐项评估、自动评分与风险源分析，并可导出样式化的 Excel 评估表与文本报告。

## 功能特性

- **项目管理**：创建、编辑、删除评估项目，数据保存在浏览器 localStorage，支持整库备份与导入
- **树形评估**：按「评估维度（L1）→ 章节（L2）→ 指标（L3）」三级结构逐项填写评估记录与结果
- **自动评分**：按 符合 / 部分符合 / 不符合 三类结果计算总分与各维度得分
  - 总分公式：`S = 100 × (X + 0.5Y) / (X + Y + Z)`
- **图表分析**：柱状图、雷达图、饼图（ECharts）
- **风险源分析**：可能性 × 危害程度 → 风险等级矩阵，输出风险源清单与文本报告
- **导出能力**：
  - 浏览器端直接导出样式化 Excel（xlsx-js-style）与文本报告
  - `scripts/export_excel.py` 基于 openpyxl 精确复刻《数据安全管理评估表（优化版）》样式

## 目录结构

```
data_security/
├── index.html               # 单页入口
├── css/
│   └── style.css            # 全部样式
├── js/
│   ├── template.js          # 评估模板数据（477 项，浏览器端使用）
│   ├── constants.js         # 全局常量（存储键、风险矩阵、风险等级）
│   ├── state.js             # 全局共享状态
│   ├── storage.js           # localStorage 项目 CRUD
│   ├── utils.js             # 通用工具（HTML 转义、Blob 下载）
│   ├── dashboard.js         # 仪表盘：统计、项目列表、创建项目、批量操作
│   ├── project.js           # 项目详情：树形评估、评分、报告导出、批量设置
│   ├── risk.js              # 风险源分析
│   ├── charts.js            # ECharts 图表渲染
│   ├── excel.js             # 浏览器端 Excel 导出
│   ├── import-export.js     # JSON 备份、导入、单项目导出
│   └── init.js              # 初始化与全局事件
├── vendor/                  # 第三方库（本地文件，无 CDN 依赖）
│   ├── echarts.min.js
│   └── xlsx-js-style.min.js
├── data/
│   └── template_data.json   # 与 template.js 同源的模板数据（Python 脚本读取）
├── scripts/
│   └── export_excel.py      # Python Excel 导出工具
├── assets/
│   └── logo1-default.png
├── 数据安全管理评估表（优化版）.xlsx  # 评估表样式参考
└── 风险危害分析.docx                  # 风险矩阵参考文档
```

## 使用方式

前端页面无需构建，直接用浏览器打开 `index.html` 即可（支持 file:// 方式打开）。

Python 导出工具：

```bash
python scripts/export_excel.py <项目JSON文件> [输出Excel路径]
```

项目 JSON 文件可通过页面右上角「📦 备份数据」导出。

## 开发说明

- 模板数据存在两份（`js/template.js` 与 `data/template_data.json`），内容相同：前者供浏览器同步加载，后者供 Python 脚本读取。修改评估条目时需保持两者一致。
- 为兼容 file:// 直接打开，脚本采用传统全局函数方式按依赖顺序加载（不使用 ES Module），模块之间通过全局函数与全局状态协作。
- 各 JS 模块在 `index.html` 末尾按依赖顺序引用：常量/状态/工具 → 存储 → 各功能模块 → 初始化。
