# 数据安全风险评估测评系统

基于浏览器的单页数据安全管理评估工具（Data Security Management Evaluation System）。按照《数据安全管理评估表（优化版）》中的 477 项评估指引，对评估对象进行逐项评估、自动评分与风险源分析，并可导出样式化的 Excel 评估表与文本报告。

## 功能特性

- **项目管理**：创建、编辑、删除评估项目，数据保存在浏览器 localStorage，支持整库备份与导入
- **报告导入（PDF）**：导入《数据安全风险评估报告》PDF，自动识别**单位名称、系统信息**与**测评指标记录**
  （评估项 / 评估记录 / 判定结果），生成可继续修改的评估项目
  - 测评项作为**该项目专属的指标清单**（不影响内置 477 项准则与其他项目）
  - 只导入系统已有字段；报告中有、系统无对应字段的信息（风险源描述、风险等级等）不导入
- **项目专属准则**：项目可自带指标清单（由报告导入生成），评分、图表、树形评估、Excel/报告导出均按项目准则计算
- **准则导入**：一键导入《数据安全评估评估准则v1-20260525.xlsx》等准则文件——
  - 更新评估准则模板：为 477 项评估指标补充「评估位置」「评估实施」提示、修正「适用对象」标注（localStorage 持久化，可一键恢复内置）
  - 导入为评估项目：将文件中的评估记录与判定结果建成新项目（基本符合 → 部分符合，支持「不适用」）
- **树形评估**：按「评估维度（L1）→ 章节（L2）→ 指标（L3）」三级结构逐项填写评估记录与结果
- **自动评分**：按 符合 / 部分符合 / 不符合 三类结果计算总分与各维度得分（不适用项不计入评分）
  - 总分公式：`S = 100 × (X + 0.5Y) / (X + Y + Z)`
- **图表分析**：柱状图、雷达图、饼图（ECharts）
- **风险源分析**：可能性 × 危害程度 → 风险等级矩阵，输出风险源清单与文本报告
- **智能整改建议**：内置 70+ 条整改规则库，按「维度 + 指标关键词」为每一项不符合/部分符合指标
  匹配问题描述、整改措施与规范依据（数据安全法、个人信息保护法、网络数据安全管理条例、GB/T 系列标准）
- **导出能力**：
  - 浏览器端直接导出样式化 Excel（xlsx-js-style）与文本报告
  - **评估报告（含测评结论与整改建议）**：依据实际评估结果自动生成
    测评结论（符合/基本符合/部分符合/不符合 + 总体风险等级 + 判定依据 + 各维度结论）、
    不符合项与部分符合项的**逐项整改建议**（问题描述、整改措施、规范依据、优先级与时限），
    支持 Markdown 与可打印 HTML（另存 PDF）两种格式，并保留原有简版文本报告
  - `scripts/export_excel.py` 基于 openpyxl 精确复刻《数据安全管理评估表（优化版）》样式
- **快捷录入**：指标弹窗支持 `1-4` 快速判定、`Ctrl+S` 保存、`Alt+↑/↓` 跳到未评估项、`Ctrl+←/→` 上下翻项；项目页提供粘性区块导航

## 性能与结构优化

在不减少任何功能的前提下完成的一轮精简（详见 `docs/系统优化说明.md`）：

| 优化项 | 效果 |
|---|---|
| 重型库按需加载（ECharts / SheetJS / Mammoth） | 首屏同步体积由 ~2.22MB 降至 ~124KB（**-94%**）；用 Excel/图表/Word 时才加载 |
| 判定与统计口径统一（`js/stats.js`） | 原先散落 4 个文件、35 处重复判定逻辑收敛为唯一数据源，消除口径漂移 |
| 统计结果缓存（按数据版本号失效） | 保存一次指标只遍历一次 477 项，评分/图表复用同一份统计 |
| 保存与渲染优化 | 内容未变更时不落盘不重绘；树搜索输入防抖；图表实例复用（不再每次销毁重建） |
| 批量操作合并 | L1/L2/L3 三套重复批量逻辑合并为一个实现 |
| 模板数据单一来源 | `data/template_data.json` 为唯一数据源，`scripts/sync_template.py` 生成 `js/template.js`，不再需要人工同步两份 |
| 用户管理页瘦身 | 移除该页面从未使用的 1.4MB 库引用 |

## 目录结构

```
data_security/
├── index.html               # 单页入口
├── css/
│   └── style.css            # 全部样式
├── js/
│   ├── template.js          # 评估模板数据（477 项，由 data/template_data.json 生成）
│   ├── constants.js         # 全局常量（存储键、风险矩阵、风险等级）
│   ├── state.js             # 全局共享状态
│   ├── storage.js           # localStorage 项目 CRUD（含数据版本号）
│   ├── stats.js             # 判定结果与统计口径（唯一数据源，含缓存）
│   ├── libs.js              # 重型第三方库按需加载
│   ├── utils.js             # 通用工具（HTML 转义、Blob 下载）
│   ├── dashboard.js         # 仪表盘：统计、项目列表、创建项目、批量操作
│   ├── project.js           # 项目详情：树形评估、评分、报告导出、批量设置、快捷键
│   ├── report.js            # 评估报告生成：测评结论 + 整改建议（规范依据库 + 规则库）
│   ├── risk.js              # 风险源分析
│   ├── charts.js            # ECharts 图表渲染（按需加载）
│   ├── excel.js             # 浏览器端 Excel 导出（按需加载）
│   ├── import-export.js     # JSON 备份、导入、单项目导出
│   ├── word-import.js       # Word 调研表导入（按需加载）
│   ├── criteria-import.js   # 评估准则 Excel 导入（模板更新 + 导入为项目）
│   ├── report-import.js     # 评估报告 PDF 导入（单位/系统信息 + 测评记录 → 项目专属准则）
│   └── init.js              # 初始化与全局事件
├── vendor/                  # 第三方库（本地文件，无 CDN 依赖，按需加载）
│   ├── echarts.min.js
│   ├── xlsx-js-style.min.js
│   ├── mammoth.browser.min.js
│   ├── pdf.min.js           # pdf.js（报告 PDF 解析）
│   └── pdf.worker.min.js    # pdf.js worker
├── data/
│   └── template_data.json   # 模板数据唯一数据源（Python 与生成脚本读取）
├── scripts/
│   ├── export_excel.py      # Python Excel 导出工具
│   ├── import_criteria.py   # Python 准则导入/同步工具（--emit-json / --emit-js）
│   ├── sync_template.py     # 数据源 → js/template.js 生成/校验（--check）
│   ├── check_wiring.node.js # 静态检查：HTML 事件处理函数是否都有定义
│   ├── test_stats.node.js   # 统计口径回归测试（与重构前实现逐项比对）
│   ├── test_report.node.js  # 报告生成回归测试（结论/整改清单/渲染）
│   ├── test_report_import.node.js    # 报告 PDF 导入回归测试（端到端，真实报告）
│   ├── generate_sample_report.node.js # 生成示例报告到 docs/
│   └── test_criteria_import.node.js  # Node 端准则解析回归测试
├── start_server.py          # 一键启动器（本地HTTP服务+自动打开浏览器，可创建桌面快捷方式）
├── 启动系统.bat             # 双击即启动（推荐）
├── 创建桌面快捷方式.bat     # 双击一次，在桌面创建启动快捷方式
├── docs/
│   ├── 数据安全评估准则导入设计.md      # 准则导入设计说明
│   ├── 评估报告导入设计.md              # 报告 PDF 导入设计说明（版面解析/字段映射）
│   ├── 系统优化说明.md                  # 性能与结构优化说明
│   ├── 评估报告与整改建议设计.md        # 报告结论口径与整改规则库设计
│   ├── 示例报告_数据安全评估.html       # 示例报告（可双击查看/打印）
│   └── 示例报告_数据安全评估.md         # 示例报告（Markdown）
├── assets/
│   └── logo1-default.png
```

## 使用方式

### 快速启动（推荐）

双击 **`启动系统.bat`** 即可：自动启动本地服务并打开浏览器访问系统，无需输入任何命令。
关闭该窗口即停止服务（端口 8000 被占用时会自动改用其他端口）。

可选：双击一次 **`创建桌面快捷方式.bat`**，之后直接从桌面图标启动。

手动方式（等效）：

```bash
python start_server.py                # 启动服务并自动打开浏览器
python start_server.py --port 9000    # 指定端口
python start_server.py --host 0.0.0.0 # 允许局域网/手机访问
```

> 说明：也可直接用浏览器打开 `index.html`（file:// 方式），但部分浏览器对 file:// 下的
> localStorage 支持不稳定，建议通过上面的本地服务方式访问。

Python 导出工具：

```bash
python scripts/export_excel.py <项目JSON文件> [输出Excel路径]
```

项目 JSON 文件可通过页面右上角「📦 备份数据」导出。

## 开发说明

- **模板数据单一来源**：只维护 `data/template_data.json`，运行 `python scripts/sync_template.py` 生成浏览器端 `js/template.js`；
  用 `python scripts/sync_template.py --check` 可校验两者是否一致。准则导入（`import_criteria.py --emit-json`）会自动同步。
- **按需加载**：ECharts / SheetJS / Mammoth / pdf.js 不在首屏同步加载，通过 `js/libs.js` 的 `loadLib('echarts'|'xlsx'|'mammoth'|'pdfjs')` 在首次使用时拉取；
  新增用到这些库的功能时，请在调用前 `await loadLib(...)`。
- **统计口径唯一**：所有判定分类、配色、评分一律使用 `js/stats.js` 的 `RESULT` / `computeItemStats()` / `computeL1Stats()`，
  不要在业务代码里再写 result 字符串比较；统计结果按「项目ID + 数据版本号」缓存，`saveProject()` 会递增版本号自动失效。
- **项目准则取值**：涉及"项目用了哪些指标"的代码（统计、树形、评分、图表、Excel/报告导出）一律使用
  `getProjectCriteria(project)`，不要直接用全局 `TEMPLATE`——项目可能携带专属准则（报告导入生成）。
- 为兼容 file:// 直接打开，脚本采用传统全局函数方式按依赖顺序加载（不使用 ES Module），模块之间通过全局函数与全局状态协作。
- 各 JS 模块在 `index.html` 末尾按依赖顺序引用：常量/状态/工具 → 存储/统计 → 各功能模块 → 初始化。

## 自检命令

```bash
python scripts/sync_template.py --check     # 模板数据源与生成文件是否一致
node scripts/check_wiring.node.js           # HTML 事件处理函数是否都有定义
node scripts/test_stats.node.js             # 统计/评分口径回归测试
node scripts/test_report.node.js            # 报告生成回归测试（结论/整改清单/渲染）
node scripts/test_report_import.node.js     # 报告 PDF 导入回归测试（端到端，真实报告）
node scripts/test_criteria_import.node.js   # 准则 Excel 解析与映射回归测试
node scripts/generate_sample_report.node.js # 生成示例报告（docs/示例报告_数据安全评估.html）
```
