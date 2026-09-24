// ============================================
// 评估报告生成：测评结论 + 不符合/部分符合项整改建议
// 依据：数据安全法、个人信息保护法、网络安全法、
//       网络数据安全管理条例（国务院令第790号，2025-01-01施行）
//       及 GB/T 43697-2024、GB/T 41479-2022、GB/T 35273-2020、
//       GB/T 37988-2019、GB/T 22239-2019 等标准
// ============================================

// ---------- 1. 规范依据库 ----------
const REPORT_STANDARDS = {
    'DSL': { cite: '《中华人民共和国数据安全法》', name: '数据安全法（2021-09-01施行）' },
    'PIPL': { cite: '《中华人民共和国个人信息保护法》', name: '个人信息保护法（2021-11-01施行）' },
    'CSL': { cite: '《中华人民共和国网络安全法》', name: '网络安全法' },
    'NDSR': { cite: '《网络数据安全管理条例》', name: '国务院令第790号（2025-01-01施行）' },
    'GB43697': { cite: 'GB/T 43697-2024', name: '《数据安全技术 数据安全风险评估方法》' },
    'GB41479': { cite: 'GB/T 41479-2022', name: '《信息安全技术 网络数据处理安全要求》' },
    'GB35273': { cite: 'GB/T 35273-2020', name: '《信息安全技术 个人信息安全规范》' },
    'GB37988': { cite: 'GB/T 37988-2019', name: '《信息安全技术 数据安全能力成熟度模型》' },
    'GB22239': { cite: 'GB/T 22239-2019', name: '《信息安全技术 网络安全等级保护基本要求》' },
    'GB39335': { cite: 'GB/T 39335-2020', name: '《信息安全技术 个人信息安全影响评估指南》' },
    'MIIT': { cite: '《工业和信息化领域数据安全管理办法（试行）》', name: '工信部（2023-01-01施行）' }
};

// 带具体条款的引用（用于结论与共性问题）
const CITE = {
    DSL_21: '《数据安全法》第二十一条（国家建立数据分类分级保护制度）',
    DSL_27: '《数据安全法》第二十七条（建立全流程数据安全管理制度、开展教育培训、采取技术措施）',
    DSL_29: '《数据安全法》第二十九条（开展数据处理活动应加强风险监测）',
    DSL_30: '《数据安全法》第三十条（重要数据处理者应定期开展风险评估并报送报告）',
    CSL_21: '《网络安全法》第二十一条（国家实行网络安全等级保护制度）',
    PIPL_6: '《个人信息保护法》第六条（明确合理目的、最小必要范围）',
    PIPL_13: '《个人信息保护法》第十三条（处理的合法性事由）',
    PIPL_17: '《个人信息保护法》第十七条（处理前告知事项）',
    PIPL_21: '《个人信息保护法》第二十一条（委托处理应约定目的、期限、方式、种类、保护措施并对受托人监督）',
    PIPL_24: '《个人信息保护法》第二十四条（自动化决策透明度、结果公平与便捷拒绝方式）',
    PIPL_25: '《个人信息保护法》第二十五条（不得公开处理的个人信息，取得单独同意的除外）',
    PIPL_29: '《个人信息保护法》第二十九条（处理敏感个人信息应取得单独同意）',
    PIPL_31: '《个人信息保护法》第三十一条（不满十四周岁未成年人应取得监护人同意并制定专门处理规则）',
    PIPL_44: '《个人信息保护法》第四十四条（个人对个人信息处理享有知情权、决定权）',
    PIPL_47: '《个人信息保护法》第四十七条（删除义务）',
    PIPL_51: '《个人信息保护法》第五十一条（内部管理制度、分类管理、加密去标识化、权限与培训、应急预案）',
    PIPL_52: '《个人信息保护法》第五十二条（达到规定数量的处理者应指定个人信息保护负责人）',
    PIPL_55: '《个人信息保护法》第五十五条（应进行个人信息保护影响评估的情形）',
    PIPL_56: '《个人信息保护法》第五十六条（影响评估报告与处理情况记录至少保存三年）',
    NDSR_9: '《网络数据安全管理条例》第九条（落实主体责任，建立管理制度，采取加密、备份、访问控制、安全认证等措施）',
    NDSR_10: '《网络数据安全管理条例》第十条（产品服务符合强制性国标，漏洞及时补救、告知并报告）',
    NDSR_11: '《网络数据安全管理条例》第十一条（应急预案、事件处置与通知利害关系人）',
    NDSR_12: '《网络数据安全管理条例》第十二条（提供/委托处理个人信息和重要数据应约定并监督，处理情况记录至少保存3年）',
    NDSR_14: '《网络数据安全管理条例》第十四条（因合并、分立、解散、破产等转移网络数据，接收方继续履行安全保护义务）',
    NDSR_15: '《网络数据安全管理条例》第十五条（国家机关委托建设运行维护电子政务系统应履行严格批准程序并监督受托方）',
    NDSR_16: '《网络数据安全管理条例》第十六条（为机关、关基运营者提供服务者不得未经同意访问、获取、留存、使用、泄露或关联分析）',
    NDSR_20: '《网络数据安全管理条例》第二十条（建立便捷的网络数据安全投诉举报渠道）',
    NDSR_21: '《网络数据安全管理条例》第二十一条（个人信息处理规则应集中公开展示并载明法定事项）',
    NDSR_22: '《网络数据安全管理条例》第二十二条（最小必要收集、敏感信息单独同意、变更重新取得同意等）',
    NDSR_23: '《网络数据安全管理条例》第二十三条（及时受理个人权利请求，不得设置不合理条件）',
    NDSR_24: '《网络数据安全管理条例》第二十四条（无法避免采集的非必要个人信息、注销账号等情形应删除或匿名化）',
    NDSR_27: '《网络数据安全管理条例》第二十七条（定期自行或委托专业机构开展个人信息保护合规审计）',
    NDSR_28: '《网络数据安全管理条例》第二十八条（处理1000万人以上个人信息适用重要数据处理者的相关规定）',
    NDSR_29: '《网络数据安全管理条例》第二十九条（识别申报重要数据，使用标签标识加强管理）',
    NDSR_30: '《网络数据安全管理条例》第三十条（明确网络数据安全负责人与管理机构及其职责）',
    NDSR_31: '《网络数据安全管理条例》第三十一条（提供、委托、共同处理重要数据前开展风险评估）',
    NDSR_32: '《网络数据安全管理条例》第三十二条（因合并、分立、解散、破产等影响重要数据安全应报告处置方案）',
    NDSR_33: '《网络数据安全管理条例》第三十三条（重要数据处理者每年度开展风险评估并报送主管部门）',
    NDSR_35: '《网络数据安全管理条例》第三十五条（向境外提供个人信息的合规路径）',
    NDSR_37: '《网络数据安全管理条例》第三十七条（重要数据出境应通过数据出境安全评估）',
    NDSR_42: '《网络数据安全管理条例》第四十二条（自动化决策推送应提供个性化推荐关闭选项）'
};

// ---------- 2. 整改建议知识库 ----------
// dim：适用维度（* 表示通用）；kw：命中关键词（空数组表示该维度基线规则）
const RECTIFICATION_KB = [
    // ===== 数据安全管理 =====
    {
        id: 'gov-policy', dim: '*', kw: ['总体策略', '方针', '目标和原则', '总体方针'],
        issue: '缺少数据安全总体策略/方针文件，数据安全工作的目标与原则未成文。',
        actions: ['制定并发布《数据安全总体策略/方针》，明确安全目标、基本原则与适用范围', '由管理层签署发布，明确各部门在策略下的职责分工', '建立策略的年度评审与修订机制'],
        basis: ['DSL_27', 'NDSR_9', 'GB43697'], priority: 'P1'
    },
    {
        id: 'gov-plan', dim: '*', kw: ['工作规划', '工作方案'],
        issue: '数据安全管理工作规划/方案缺失或未覆盖全部数据处理活动。',
        actions: ['编制年度数据安全工作规划，明确重点任务、责任部门、资源投入与时间节点', '将数据安全工作纳入信息化与网络安全整体规划', '建立规划执行情况的跟踪与考核机制'],
        basis: ['DSL_27', 'GB37988'], priority: 'P2'
    },
    {
        id: 'gov-system', dim: '数据安全管理', kw: ['制度建设', '制度体系', '管理制度'],
        issue: '数据安全制度体系不健全，部分必备制度缺失或内容不完整。',
        actions: ['补齐数据分类分级、数据安全评估、访问权限管理、全生命周期管理、应急响应、合作方管理、脱敏、加密、安全审计、数据资产管理等制度', '统一制度模板，明确制定、评审、发布、宣贯、废止的全流程要求', '明确各项制度的责任部门与执行记录表单'],
        basis: ['DSL_27', 'NDSR_9', 'GB41479'], priority: 'P1'
    },
    {
        id: 'gov-sop', dim: '数据安全管理', kw: ['操作规程', '操作指南'],
        issue: '关键岗位数据安全管理操作规程/指南缺失，操作要求未细化到岗位。',
        actions: ['针对数据库管理员、运维、审计、数据备份/恢复等关键岗位编制操作规程', '在规程中明确操作审批、双人复核、留痕要求', '将规程嵌入工单/运维平台，形成强制约束'],
        basis: ['DSL_27', 'GB22239'], priority: 'P2'
    },
    {
        id: 'gov-legal', dim: '数据安全管理', kw: ['法律法规', '监管要求', '合规'],
        issue: '未建立法律法规与监管要求的识别、跟踪与转化机制，制度合规性缺乏证明。',
        actions: ['建立数据安全法律法规清单，明确适用条款与责任部门', '建立季度/半年度的法规更新跟踪与差距评估机制', '形成法规要求向内部制度的转化记录（合规映射表）'],
        basis: ['DSL_27', 'NDSR_9', 'GB43697'], priority: 'P2'
    },
    {
        id: 'gov-responsibility', dim: '数据安全管理', kw: ['责任制', '责任查处', '责任落实'],
        issue: '数据安全责任制落实不到位，缺少责任分解与考核问责记录。',
        actions: ['签订数据安全责任书，将责任分解到部门与岗位', '建立数据安全考核指标并纳入绩效', '建立事件责任查处与通报机制，保留查处记录'],
        basis: ['DSL_27', 'NDSR_30'], priority: 'P1'
    },
    {
        id: 'gov-lifecycle', dim: '数据安全管理', kw: ['制定、评审、发布', '评审、发布', '流程建设'],
        issue: '制度的制定、评审、发布流程不规范，缺少版本与审批控制。',
        actions: ['建立制度全生命周期管理流程（起草—评审—审批—发布—宣贯—复审—废止）', '明确各环节责任人与审批权限', '建立制度台账，记录版本号、生效日期与修订记录'],
        basis: ['DSL_27', 'GB37988'], priority: 'P3'
    },
    {
        id: 'gov-review', dim: '数据安全管理', kw: ['定期审核', '更新情况', '复审'],
        issue: '制度未定期审核更新，存在与实际业务、法规要求脱节的情况。',
        actions: ['建立制度年度复审机制，明确复审触发条件（法规变化、业务变更、事件发生）', '保留复审记录与修订说明', '对过期/失效制度及时废止并公告'],
        basis: ['DSL_27'], priority: 'P3'
    },
    {
        id: 'gov-publish', dim: '数据安全管理', kw: ['发布范围', '发布方式'],
        issue: '制度发布范围不全面或发布方式不规范，一线人员难以获取有效版本。',
        actions: ['通过正式渠道发布并明确生效日期，确保覆盖全部相关部门与岗位', '建立制度库/知识库，保证唯一有效版本可查', '保留发布通知、签收或宣贯记录'],
        basis: ['DSL_27'], priority: 'P3'
    },
    {
        id: 'gov-records', dim: '数据安全管理', kw: ['证明材料', '记录表单', '落实情况', '落实'],
        issue: '制度落实缺少可验证的过程记录与证明材料。',
        actions: ['建立制度落实的记录表单（审批单、台账、检查表、培训记录、处置记录等）', '明确记录填写、归档、保存期限要求（建议不少于3年）', '定期抽查记录完整性并纳入考核'],
        basis: ['NDSR_12', 'GB41479'], priority: 'P2'
    },
    {
        id: 'gov-supervise', dim: '数据安全管理', kw: ['监督检查', '监督机制', '考核'],
        issue: '缺少制度落实的监督检查与考核问责机制。',
        actions: ['制定年度数据安全检查计划，明确检查项、频次与责任部门', '对检查发现的问题建立整改闭环（问题—整改—复核—关闭）', '建立考核问责与通报机制'],
        basis: ['DSL_27', 'GB41479'], priority: 'P2'
    },
    {
        id: 'gov-assess', dim: '数据安全管理', kw: ['安全评估', '风险评估', '自查'],
        issue: '未按要求定期开展数据安全风险评估，或评估范围/内容不完整。',
        actions: ['建立年度数据安全风险评估机制（重要数据/核心数据处理者至少每年1次）', '评估内容包括：基本情况、评估团队、数据处理活动分析、合规性评估、安全风险分析、评估结论及应对措施', '对发现的问题明确整改计划并跟踪复核', '按主管部门要求形成并留存评估报告'],
        basis: ['DSL_30', 'NDSR_33', 'GB43697'], priority: 'P1'
    },
    {
        id: 'gov-report-submit', dim: '数据安全管理', kw: ['报送', '报告情况', '监管部门'],
        issue: '未按规定向主管部门报送风险评估报告或报告内容不完整。',
        actions: ['明确报送责任部门、时限与模板', '报告应包含：处理重要数据的目的、种类、数量、方式、范围、存储期限与地点，制度与技术措施及有效性，发现的风险与事件处置，提供/委托/共同处理的风险评估，数据出境情况等', '保留报送凭证与主管部门反馈记录'],
        basis: ['DSL_30', 'NDSR_33'], priority: 'P1'
    },
    {
        id: 'org-structure', dim: '数据安全管理', kw: ['组织架构', '管理机构', '机构和职能'],
        issue: '数据安全管理机构未设立或职能未明确，缺乏统筹协调机制。',
        actions: ['以文件形式设立数据安全管理机构，明确其职责（制度建设、风险评估、监测处置、应急、培训、投诉受理）', '建立管理机构与业务、IT、法务、人力等部门的协作机制', '定期召开数据安全工作会议并留存纪要'],
        basis: ['NDSR_30', 'DSL_27'], priority: 'P1'
    },
    {
        id: 'org-officer', dim: '数据安全管理', kw: ['负责人', '数据安全负责人'],
        issue: '未明确数据安全负责人及其职责，重大事项缺乏决策与报告路径。',
        actions: ['明确由管理层成员担任数据安全负责人，并以文件任命', '明确其有权直接向主管部门报告数据安全情况', '明确负责人的职责清单与履职记录要求'],
        basis: ['NDSR_30'], priority: 'P1'
    },
    {
        id: 'org-executive', dim: '数据安全管理', kw: ['高层', '决策'],
        issue: '单位高层参与数据安全决策不足，重大数据安全事项缺少决策记录。',
        actions: ['将数据安全重大事项纳入办公会/安全委员会决策范围', '明确年度至少听取一次数据安全工作汇报', '保留决策会议纪要与批示记录'],
        basis: ['NDSR_30', 'GB37988'], priority: 'P2'
    },
    {
        id: 'org-monitor', dim: '数据安全管理', kw: ['安全监督', '监督的情况'],
        issue: '对内部数据安全管理执行与操作行为的安全监督不足。',
        actions: ['建立内部数据安全监督检查制度，定期开展自查与抽查', '对高权限操作、批量导出等行为实施监督与审计', '形成监督报告并跟踪问题整改'],
        basis: ['DSL_27', 'GB41479'], priority: 'P2'
    },
    {
        id: 'org-resource', dim: '数据安全管理', kw: ['人员和资源投入', '资源投入', '适应性'],
        issue: '数据安全人员与资源投入不足，难以匹配数据安全保护需求。',
        actions: ['按数据规模、敏感程度评估数据安全人力与预算需求', '配备专职数据安全管理人员并在相关部门设数据安全责任人', '将数据安全建设纳入年度预算并跟踪执行'],
        basis: ['NDSR_30', 'GB37988'], priority: 'P2'
    },
    {
        id: 'org-post', dim: '数据安全管理', kw: ['岗位设置', '职责分离', '专人专岗', '双人双岗'],
        issue: '数据安全关键岗位设置与职责分离要求落实不到位。',
        actions: ['梳理数据库管理员、操作员、审计员、运维、备份与恢复等关键岗位并形成岗位说明书', '落实职责分离与"双人双岗"，审计岗与操作岗不得兼任', '特权账号与关键数据处理岗位实行双人操作与复核'],
        basis: ['DSL_27', 'GB22239', 'GB37988'], priority: 'P1'
    },
    {
        id: 'org-roster', dim: '数据安全管理', kw: ['岗位人员名单', '名单', '任命书', '登记入册'],
        issue: '数据安全岗位人员台账/任命文件不完整，责任主体不清晰。',
        actions: ['建立数据安全岗位人员名单（部门、姓名、联系方式、职责）', '关键岗位出具任命书或岗位说明', '人员变动时及时更新台账'],
        basis: ['NDSR_30', 'GB41479'], priority: 'P3'
    },
    {
        id: 'org-firstperson', dim: '数据安全管理', kw: ['第一责任人', '直接责任人', '责任书或保密协议'],
        issue: '未明确数据安全第一责任人与直接责任人，或未签署责任书/保密协议。',
        actions: ['以文件明确法定代表人或主要负责人为数据安全第一责任人、分管领导为直接责任人', '组织关键岗位人员签署数据安全责任书或保密协议（含岗位职责、义务、处罚、注意事项）', '对责任书签署情况进行台账化管理'],
        basis: ['NDSR_30', 'DSL_27'], priority: 'P1'
    },
    {
        id: 'asset-ledger', dim: '数据安全管理', kw: ['数据资产台账', '资产清单', '数据资产管理', '梳理'],
        issue: '数据资产台账/清单不完整，未覆盖全部电子化与非电子化数据。',
        actions: ['明确数据资产梳理的目标、范围、责任部门与周期（建议至少每年一次）', '按电子化数据与非电子化数据分别形成资产清单，记录数据类别、来源、存储位置、责任部门', '采用自动化工具辅助识别个人信息与重要数据，并留存扫描记录', '建立资产变更记录与动态更新机制'],
        basis: ['NDSR_29', 'GB43697', 'GB41479'], priority: 'P1'
    },
    {
        id: 'class-level', dim: '数据安全管理', kw: ['分类分级', '分级保护', '重要数据目录', '核心数据'],
        issue: '数据分类分级制度不健全，重要数据目录未建立或未按要求备案。',
        actions: ['制定数据分类分级管理办法，明确分类维度、分级标准、变更流程', '识别并形成重要数据目录、核心数据目录，按要求履行备案/申报手续', '针对不同级别制定差异化保护策略并落实到权限申请、措施部署等环节', '对个人信息、重要数据、核心数据进行明确标识并支持自动化标识能力'],
        basis: ['DSL_21', 'NDSR_29', 'GB43697', 'GB41479'], priority: 'P1'
    },
    {
        id: 'class-mark', dim: '数据安全管理', kw: ['明确标识', '分级保护措施', '分类分级保护'],
        issue: '数据分级标识与差异化保护措施未落地，不同级别数据保护要求未区分。',
        actions: ['建立数据标识规则与工具，实现标识结果的发布与审核', '按级别配置访问控制、加密、脱敏、审计等差异化措施', '定期核查标识准确性与措施有效性'],
        basis: ['NDSR_29', 'GB41479'], priority: 'P1'
    },
    {
        id: 'hr-recruit', dim: '数据安全管理', kw: ['人员录用', '背景调查', '录用'],
        issue: '关键岗位人员录用前的背景调查与能力考核缺失。',
        actions: ['对数据安全关键岗位开展录用前背景调查并留存记录', '对关键岗位人员开展数据安全意识与专业能力考核', '对掌握特定种类、规模重要数据的关键岗位人员按规定开展安全背景审查'],
        basis: ['NDSR_30', 'DSL_27'], priority: 'P2'
    },
    {
        id: 'hr-nda', dim: '数据安全管理', kw: ['保密协议', '保密义务', '承诺书'],
        issue: '保密协议/数据安全责任承诺签署不完整，离岗后保密义务未明确。',
        actions: ['与全部涉及数据服务的人员签署安全责任承诺或保密协议', '与关键岗位签署数据安全岗位责任协议', '人员调离或终止劳动合同前书面告知继续保密义务并签署保密承诺书'],
        basis: ['DSL_27', 'PIPL_51'], priority: 'P2'
    },
    {
        id: 'hr-transfer', dim: '数据安全管理', kw: ['转岗离岗', '离岗', '调离', '终止劳动合同'],
        issue: '人员转岗/离岗时数据权限未及时回收或变更。',
        actions: ['建立人员变动与权限联动流程，转岗离岗当日终止或调整数据、系统权限', '收回账号、介质、密钥等凭据并留存交接记录', '对离职人员数据处理设备进行清理与核查'],
        basis: ['DSL_27', 'GB22239'], priority: 'P1'
    },
    {
        id: 'hr-training', dim: '数据安全管理', kw: ['培训', '教育', '意识'],
        issue: '数据安全教育培训未按频次与学时要求开展，缺少考核与记录。',
        actions: ['制定年度数据安全培训计划（覆盖全员与关键岗位）', '数据安全岗位人员每年不少于10学时，重要数据相关岗位每年不少于20学时', '培训内容覆盖法律法规、标准规范、内部制度与操作规程、安全技能', '留存培训通知、课件、签到、考核与评定记录'],
        basis: ['NDSR_30', 'DSL_27', 'GB41479'], priority: 'P2'
    },
    {
        id: 'partner-mech', dim: '数据安全管理', kw: ['合作方', '外包', '第三方', '合作方管理'],
        issue: '数据合作方/外包服务机构的安全管理机制不健全。',
        actions: ['建立合作方选择、评价、准入、监督、退出的全流程管理机制', '合作前开展数据安全能力评估并留存评估结论', '对外包人员现场服务、远程访问实施审批与监督', '建立合作方台账与年度评价记录'],
        basis: ['NDSR_12', 'DSL_27', 'GB41479'], priority: 'P1'
    },
    {
        id: 'partner-contract', dim: '数据安全管理', kw: ['合作协议', '合同', '承诺及安全保密协议', '违约责任'],
        issue: '合作协议未完整约定数据安全责任，约束力不足。',
        actions: ['在合同/协议中明确数据处理目的、方式、范围，安全保护义务、数据返还或销毁要求、保密约定及违约责任', '明确双方数据安全责任界面与违约处罚条款', '对合作方履约情况进行监督并留存记录，处理情况记录至少保存3年'],
        basis: ['NDSR_12', 'PIPL_21', 'DSL_27'], priority: 'P1'
    },
    {
        id: 'partner-access', dim: '数据安全管理', kw: ['外包人员', '访问权限', '最小必要', '测试环境'],
        issue: '外包人员数据与系统权限未按最小必要控制，存在生产数据外泄风险。',
        actions: ['对外包人员实施最小必要授权，按项目/期限设置账号有效期', '测试优先使用脱敏后的测试数据与独立测试环境，避免开放生产环境与真实数据', '对外包人员的导出、外发操作实施审批与审计', '合作结束后及时注销账号、回收数据与权限'],
        basis: ['NDSR_12', 'DSL_27', 'GB22239'], priority: 'P1'
    },
    {
        id: 'partner-third', dim: '数据安全管理', kw: ['第三方接入', '木马', '后门', '技术检测', '回收'],
        issue: '第三方接入缺少技术检测与数据回收机制。',
        actions: ['对合作方接入的系统、技术工具开展安全检测，或要求提供第三方安全评估报告', '合作结束后回收数据、要求删除并获取删除证明', '停用或下线专为合作开放的权限与接口'],
        basis: ['NDSR_12', 'NDSR_16', 'GB41479'], priority: 'P1'
    },
    {
        id: 'partner-gov', dim: '数据安全管理', kw: ['政务', '电子政务', '委托处理'],
        issue: '政务数据委托处理的批准程序与受托方监督不到位。',
        actions: ['委托建设、运维电子政务系统或存储加工政务数据前履行严格批准程序', '以合同明确受托方的数据处理权限、保护责任与禁止行为', '对受托方履行义务情况实施监督，禁止其擅自留存、使用、泄露或向他人提供政务数据'],
        basis: ['NDSR_15', 'NDSR_16'], priority: 'P1'
    },
    {
        id: 'incident-record', dim: '数据安全管理', kw: ['安全事件', '威胁', '事件信息', '处置、记录、整改和上报'],
        issue: '数据安全事件/威胁的记录、处置与上报机制不完善。',
        actions: ['建立安全事件台账，记录事件名称、影响对象、时间频次、原因、级别、处置与整改措施', '重大事件形成调查评估报告', '按规定时限向主管部门报告（涉及危害国家安全、公共利益的应在24小时内报告）', '对近期同行业威胁事件建立预警跟踪机制'],
        basis: ['NDSR_10', 'NDSR_11', 'DSL_29'], priority: 'P1'
    },
    {
        id: 'incident-plan', dim: '数据安全管理', kw: ['应急预案', '应急响应', '应急演练', '应急处置'],
        issue: '数据安全应急预案不完善，演练与处置记录不完整。',
        actions: ['编制数据安全事件应急预案，覆盖数据泄露、篡改、损毁、违规使用等场景', '按事件等级明确响应责任分工、工作流程与处置措施', '每年至少开展1次全部典型场景演练并形成演练报告', '事件处置后立即开展调查、整改与责任追究，并按要求上报'],
        basis: ['NDSR_11', 'DSL_29', 'PIPL_51'], priority: 'P1'
    },
    {
        id: 'incident-notify', dim: '数据安全管理', kw: ['通知利害关系人', '告知用户', '投诉举报'],
        issue: '事件通知利害关系人与投诉举报渠道建设不到位。',
        actions: ['事件对个人或组织造成危害时，及时以电话、短信、邮件或公告方式通知利害关系人并告知补救措施', '建立便捷的数据安全投诉举报渠道并公布方式', '留存投诉举报受理、处置与反馈记录'],
        basis: ['NDSR_11', 'NDSR_20'], priority: 'P2'
    },
    {
        id: 'devops', dim: '数据安全管理', kw: ['开发', '运维', '上线', '版本控制', '测试数据'],
        issue: '开发运维环节的数据安全管理要求落实不足。',
        actions: ['建立新应用开发的安全合规审核流程，数据处理需求须经审核', '落实开发代码与测试数据管理要求，测试使用真实数据前进行去标识化/脱敏', '实现开发测试环境与生产环境隔离，禁止生产数据直接用于测试', '对开发运维人员行为实施审计，远程运维须审批并采取防护措施', '上线前开展安全评估与第三方组件、开源软件安全核查'],
        basis: ['DSL_27', 'NDSR_9', 'GB22239'], priority: 'P1'
    },
    {
        id: 'cloud', dim: '数据安全管理', kw: ['云', '云计算', '租户', '上云'],
        issue: '云环境数据安全责任划分与管理措施不清晰。',
        actions: ['以合同明确云服务提供者、第三方厂商与云租户的数据安全责任界面', '开展上云数据安全审核，对重要数据、敏感个人信息实施增强防护', '加强云账号与权限管理、云上操作审计、私有云远程运维安全', '建立云数据备份恢复机制并定期验证，明确服务到期/欠费/终止时的数据删除与个人信息权益保障', '云平台应定期开展数据安全风险评估与云计算服务安全评估'],
        basis: ['NDSR_9', 'GB41479', 'GB43697'], priority: 'P1'
    },

    // ===== 数据处理活动 =====
    {
        id: 'act-collect', dim: '数据处理活动', kw: ['收集', '采集'],
        issue: '数据收集的合法性、正当性与最小必要要求落实不到位。',
        actions: ['明确数据收集的目的、范围、渠道、方式与存储期限，遵循合法、正当、必要原则', '公开收集规则并以通俗易懂方式告知、取得授权', '间接获取重要数据/核心数据时与提供方签署协议或承诺书，明确合作范围、目的、方式与安全责任', '留存数据收集记录（来源、时间、类型、数量、频度、流向）'],
        basis: ['PIPL_6', 'PIPL_13', 'PIPL_17', 'NDSR_22'], priority: 'P1'
    },
    {
        id: 'act-quality', dim: '数据处理活动', kw: ['质量', '清洗', '转换', '异常数据'],
        issue: '数据质量管理制度与监控手段不完善。',
        actions: ['制定数据质量管理制度，明确清洗、转换、加载等操作的规范要求', '建立数据质量监控与异常数据告警、更正机制', '定期输出数据质量报告'],
        basis: ['GB41479', 'GB37988'], priority: 'P3'
    },
    {
        id: 'act-store', dim: '数据处理活动', kw: ['存储', '保存', '存储期限'],
        issue: '数据存储环节的加密、访问控制与期限管理不足。',
        actions: ['对重要数据、敏感个人信息实施存储加密与完整性保护', '按最小必要配置访问权限并留存授权记录', '明确各类数据的存储期限与到期处理方式，定期清理超期数据', '规范存储介质管理（登记、借用、销毁）'],
        basis: ['NDSR_9', 'PIPL_51', 'GB41479'], priority: 'P1'
    },
    {
        id: 'act-media', dim: '数据处理活动', kw: ['存储介质', '介质', '移动存储', 'U盘', '光盘'],
        issue: '存储介质安全管理不到位，缺少定期检查与登记管理。',
        actions: ['建立存储介质台账，登记介质编号、责任人、存放位置与用途', '对介质进行定期或随机性安全检查，防止违规接入与私自外带', '对报废、外借介质实施数据清除或销毁并留存记录', '涉密或高敏感介质实施加密存储与专人保管'],
        basis: ['DSL_27', 'GB22239', 'GB41479'], priority: 'P1'
    },
    {
        id: 'act-transfer-monitor', dim: '数据处理活动', kw: ['异常传输', '传输检测', '传输链路', '传输安全', '传输加密'],
        issue: '数据传输过程的监测与安全防护不足，异常传输难以及时发现。',
        actions: ['对数据传输链路实施加密与完整性校验', '部署异常传输检测能力，建立告警阈值与处置流程', '留存异常传输的发现、分析与处置记录', '定期核查数据传输通道与开放的端口、接口'],
        basis: ['DSL_27', 'DSL_29', 'GB41479'], priority: 'P1'
    },
    {
        id: 'act-use', dim: '数据处理活动', kw: ['使用', '加工', '分析', '访问权限'],
        issue: '数据使用与加工环节权限控制、脱敏与留痕不足。',
        actions: ['按岗位与业务需要实施最小必要授权，严格管控高权限账号', '对展示、测试、分析等场景实施脱敏或去标识化', '记录数据使用与加工日志并定期审计'],
        basis: ['DSL_27', 'PIPL_51', 'GB41479'], priority: 'P1'
    },
    {
        id: 'act-transfer', dim: '数据处理活动', kw: ['传输', '共享', '提供', '转让', '开放', '委托处理'],
        issue: '数据对外提供/共享/转让的审批、合同约束与记录不完善。',
        actions: ['建立数据对外提供与共享的审批流程，明确审批层级与责任', '与接收方签订合同或协议，约定处理目的、方式、范围与安全保护义务并实施监督', '处理情况记录至少保存3年', '传输过程中采用加密等安全措施'],
        basis: ['NDSR_12', 'PIPL_21', 'DSL_27'], priority: 'P1'
    },
    {
        id: 'act-public', dim: '数据处理活动', kw: ['公开', '披露'],
        issue: '数据公开的审核机制缺失。',
        actions: ['建立数据公开前的内容审核与审批流程', '公开个人信息应取得单独同意并开展去标识化处理', '留存公开审核记录'],
        basis: ['NDSR_12', 'PIPL_25'], priority: 'P2'
    },
    {
        id: 'act-delete', dim: '数据处理活动', kw: ['销毁', '删除', '清除'],
        issue: '数据删除与销毁缺乏规范流程与可验证记录。',
        actions: ['制定数据销毁制度，明确销毁场景（到期、业务终止、个人请求）与方式', '采用不可恢复的销毁技术并双人监督', '留存销毁审批与销毁记录', '删除技术上难以实现时停止除存储和必要保护外的处理'],
        basis: ['PIPL_47', 'NDSR_24', 'GB41479'], priority: 'P1'
    },
    {
        id: 'act-crossborder', dim: '*', kw: ['出境', '跨境', '境外'],
        issue: '数据出境活动的合规路径与评估程序不完善。',
        actions: ['梳理数据出境场景、数据类型与规模，判定适用的合规路径（安全评估、保护认证、标准合同）', '重要数据出境应通过国家网信部门组织的数据出境安全评估', '开展数据出境风险自评估并留存评估报告', '出境活动不得超出评估明确的目的、方式、范围、种类与规模', '建立数据出境台账与年度复核机制'],
        basis: ['NDSR_35', 'NDSR_37', 'DSL', 'PIPL'], priority: 'P1'
    },
    {
        id: 'act-merge', dim: '*', kw: ['合并、分立、解散', '转移数据', '承接'],
        issue: '因合并、分立、解散、破产等转移数据时的安全措施与报告义务未落实。',
        actions: ['制定数据转移方案，明确接收方及其数据安全保护义务', '向省级以上主管部门报告重要数据处置方案与接收方信息', '确保接收方继续履行数据安全保护义务并签署承接协议'],
        basis: ['NDSR_14', 'NDSR_32'], priority: 'P1'
    },

    // ===== 数据安全技术 =====
    {
        id: 'tech-network', dim: '数据安全技术', kw: ['网络', '边界', '隔离', '拓扑', '访问控制', '安全审计', '漏洞', '攻击', '流量'],
        issue: '网络层面的防护、监测与漏洞管理措施存在不足。',
        actions: ['梳理网络拓扑与区域划分，按重要程度实施网络隔离与边界防护', '制定并定期核查网络设备安全策略与基线配置', '部署漏洞扫描与补丁管理机制，建立漏洞闭环处置流程', '部署入侵检测/防御与异常流量监测，建立告警处置记录'],
        basis: ['GB22239', 'DSL_27', 'NDSR_9'], priority: 'P1'
    },
    {
        id: 'tech-auth', dim: '数据安全技术', kw: ['身份', '认证', '口令', '密码策略', '访问控制', '权限', '账号', '登录'],
        issue: '身份鉴别与访问控制策略不完善。',
        actions: ['采用口令+生物特征/短信验证码/证书等两种以上鉴别方式保护重要系统', '配置口令复杂度与定期更换策略，口令长度不少于8位并包含多种字符组合', '配置账号锁定策略，限制口令尝试次数', '规范口令重置流程与记录，定期清理冗余、共享与长期未使用账号', '特权账号实施单独管理、审批与操作审计'],
        basis: ['GB22239', 'GB41479', 'PIPL_51'], priority: 'P1'
    },
    {
        id: 'tech-crypto', dim: '数据安全技术', kw: ['加密', '密码', '密钥'],
        issue: '数据加密与密钥管理措施不完整。',
        actions: ['明确需加密的数据范围（重要数据、敏感个人信息、传输与存储环节）与加密算法要求', '建立密钥全生命周期管理（生成、分发、存储、更换、销毁）', '定期核查加密措施有效性与覆盖范围'],
        basis: ['NDSR_9', 'PIPL_51', 'GB22239'], priority: 'P1'
    },
    {
        id: 'tech-mask', dim: '数据安全技术', kw: ['脱敏', '匿名', '去标识', '假名'],
        issue: '数据脱敏/去标识化实施不规范。',
        actions: ['制定脱敏与去标识化规则，明确不同场景下的处理要求', '在测试、开发、展示、分析等场景强制实施脱敏', '建立脱敏效果验证与复核机制'],
        basis: ['PIPL_51', 'GB35273', 'GB41479'], priority: 'P2'
    },
    {
        id: 'tech-audit', dim: '数据安全技术', kw: ['审计', '日志', '监控', '留痕'],
        issue: '数据操作审计与日志管理不完善。',
        actions: ['对重要数据操作行为（查询、导出、修改、删除）实施全量审计并留存日志', '日志保存期限不少于6个月（重要数据相关建议不少于1年）并防止篡改', '建立日志集中分析与异常行为告警机制', '定期开展审计并形成审计报告'],
        basis: ['CSL_21', 'DSL_27', 'GB22239'], priority: 'P1'
    },
    {
        id: 'tech-backup', dim: '数据安全技术', kw: ['备份', '恢复', '容灾'],
        issue: '数据备份与恢复机制不完善，未验证可恢复性。',
        actions: ['明确备份范围、策略、周期与保留份数，重要数据实施异地/离线备份', '定期开展恢复演练并记录恢复时间与结果', '对备份数据实施加密与访问控制'],
        basis: ['NDSR_9', 'GB22239', 'GB41479'], priority: 'P1'
    },
    {
        id: 'tech-dlp', dim: '数据安全技术', kw: ['防泄漏', 'DLP', '泄漏', '外发'],
        issue: '数据防泄漏措施不足，敏感数据外发缺乏管控。',
        actions: ['部署数据防泄漏（DLP）能力，覆盖终端、网络、邮件等外发通道', '对敏感数据外发实施审批、水印与审计', '建立违规外发的告警与处置流程'],
        basis: ['DSL_27', 'GB41479'], priority: 'P2'
    },
    {
        id: 'tech-interface', dim: '数据安全技术', kw: ['接口', 'API', 'SDK'],
        issue: '数据接口安全管控不足。',
        actions: ['建立接口清单并定期清查，明确接口的数据范围与调用方', '实施接口鉴权、限流、参数校验与敏感数据脱敏', '对接口调用实施日志审计与异常监测，停用无主与不符合要求的接口'],
        basis: ['DSL_27', 'GB41479'], priority: 'P1'
    },
    {
        id: 'tech-monitor', dim: '数据安全技术', kw: ['监测', '预警', '态势'],
        issue: '数据安全风险监测与预警能力不足。',
        actions: ['建立数据安全风险监测机制，覆盖数据流转、访问与异常行为', '对数据安全缺陷、漏洞等风险立即采取补救措施', '建立预警信息跟踪与处置闭环'],
        basis: ['DSL_29', 'NDSR_10'], priority: 'P2'
    },

    // ===== 个人信息保护 =====
    {
        id: 'pi-legal', dim: '个人信息保护', kw: ['合法', '诚信', '误导', '欺诈', '胁迫', '非法'],
        issue: '个人信息处理的合法性基础与诚信原则落实存在风险。',
        actions: ['梳理各项个人信息处理活动的合法性事由并留存依据', '禁止通过误导、欺诈、胁迫等方式取得同意或处理个人信息', '建立违法违规收集使用个人信息的自查与整改机制'],
        basis: ['PIPL_6', 'PIPL_13', 'NDSR_22'], priority: 'P1'
    },
    {
        id: 'pi-notice', dim: '个人信息保护', kw: ['告知', '同意', '授权', '隐私政策', '用户协议', '公开透明'],
        issue: '告知同意机制与隐私政策不完善。',
        actions: ['制定并公开个人信息处理规则（隐私政策），集中公开展示、易于访问并置于醒目位置', '规则内容应包含处理者名称与联系方式、处理目的/方式/种类、保存期限与到期处理方式、个人行使权利的方法和途径', '向第三方提供个人信息时以清单形式列明接收方信息', '取得同意应自愿、明确，处理目的/方式/种类变更时重新取得同意，不得频繁征求同意'],
        basis: ['PIPL_17', 'NDSR_21', 'GB35273'], priority: 'P1'
    },
    {
        id: 'pi-sensitive', dim: '个人信息保护', kw: ['敏感个人信息', '生物识别', '医疗健康', '金融账户', '行踪轨迹', '宗教信仰', '特定身份'],
        issue: '敏感个人信息处理未落实单独同意与增强保护要求。',
        actions: ['识别敏感个人信息处理场景并向个人告知必要性及对个人权益的影响', '处理敏感个人信息取得单独同意，法律法规要求书面同意的从其规定', '对敏感个人信息实施加密存储、严格权限控制与操作审计'],
        basis: ['PIPL_29', 'NDSR_22', 'GB35273'], priority: 'P1'
    },
    {
        id: 'pi-minor', dim: '个人信息保护', kw: ['未成年人', '儿童', '不满十四周岁'],
        issue: '未成年人个人信息保护措施不足。',
        actions: ['处理不满十四周岁未成年人个人信息应取得父母或其他监护人同意', '制定专门的个人信息处理规则', '对未成年人个人信息实施最小必要收集与增强保护'],
        basis: ['PIPL_31', 'NDSR_21', 'GB35273'], priority: 'P1'
    },
    {
        id: 'pi-rights', dim: '个人信息保护', kw: ['权利', '查阅', '复制', '更正', '删除', '注销', '撤回同意'],
        issue: '个人权利响应机制不健全。',
        actions: ['提供便捷的查阅、复制、更正、补充、删除、限制处理、注销账号与撤回同意的途径', '明确受理时限与处理流程，不得设置不合理条件限制合理请求', '留存请求受理与处理记录', '无法避免采集到非必要个人信息或依法应删除的，及时删除或匿名化处理'],
        basis: ['PIPL_44', 'PIPL_47', 'NDSR_23', 'NDSR_24'], priority: 'P2'
    },
    {
        id: 'pi-auto', dim: '个人信息保护', kw: ['自动化决策', '算法', '个性化推荐', '信息推送'],
        issue: '自动化决策的透明度与拒绝权保障不足。',
        actions: ['保证自动化决策的透明度和结果公平公正，提供便捷的拒绝方式', '通过自动化决策进行信息推送的，设置易于理解、便于访问和操作的个性化推荐关闭选项', '提供删除针对个人特征的用户标签的功能'],
        basis: ['PIPL_24', 'NDSR_42'], priority: 'P2'
    },
    {
        id: 'pi-impact', dim: '个人信息保护', kw: ['影响评估', '风险评估', '合规审计'],
        issue: '个人信息保护影响评估与合规审计未按要求开展。',
        actions: ['对处理敏感个人信息、自动化决策、委托/向他人提供、向境外提供等情形开展个人信息保护影响评估并留存报告（至少保存3年）', '定期自行或委托专业机构开展个人信息保护合规审计', '对评估/审计发现的问题建立整改闭环'],
        basis: ['PIPL_55', 'PIPL_56', 'NDSR_27', 'GB39335'], priority: 'P1'
    },
    {
        id: 'pi-scale', dim: '个人信息保护', kw: ['1000万', '数量达到'],
        issue: '处理个人信息达到规定规模时的加重义务未落实。',
        actions: ['处理1000万人以上个人信息时，落实重要数据处理者的相关义务（明确安全负责人与管理机构、年度风险评估与报送等）', '建立个人信息处理规模统计与监控机制', '对达到阈值的情形提前启动合规建设'],
        basis: ['NDSR_28', 'NDSR_30', 'NDSR_33'], priority: 'P1'
    },

    // ===== 维度基线规则（关键词未命中时兜底）=====
    {
        id: 'base-gov', dim: '数据安全管理', kw: [],
        issue: '数据安全管理体系存在薄弱环节，制度与执行记录需进一步完善。',
        actions: ['对照《数据安全法》《网络数据安全管理条例》完善数据安全管理制度体系并留存执行记录', '明确数据安全管理机构与负责人职责，落实责任制与考核', '建立数据安全风险评估与整改闭环机制'],
        basis: ['DSL_27', 'NDSR_9', 'NDSR_30'], priority: 'P2'
    },
    {
        id: 'base-act', dim: '数据处理活动', kw: [],
        issue: '数据处理活动全流程的安全管理要求需进一步落实。',
        actions: ['按数据生命周期环节梳理安全要求并落实到流程与系统配置', '对重要数据、敏感个人信息实施加密、脱敏、权限控制与审计', '涉及对外提供、委托处理、出境的，完善合同约束、审批与记录留存'],
        basis: ['DSL_27', 'NDSR_12', 'GB41479'], priority: 'P2'
    },
    {
        id: 'base-tech', dim: '数据安全技术', kw: [],
        issue: '数据安全技术防护措施存在不足，需补齐技术能力。',
        actions: ['按数据级别配置加密、脱敏、访问控制、审计等技术措施', '建立数据安全监测预警与漏洞闭环处置能力', '完善备份恢复与容灾机制并定期演练验证'],
        basis: ['NDSR_9', 'GB22239', 'GB41479'], priority: 'P2'
    },
    {
        id: 'base-pi', dim: '个人信息保护', kw: [],
        issue: '个人信息保护合规要求需进一步落实。',
        actions: ['遵循合法、正当、必要与诚信原则，落实最小必要收集', '完善告知同意机制与个人信息处理规则公开', '建立个人权利响应、影响评估与合规审计机制'],
        basis: ['PIPL_6', 'PIPL_17', 'NDSR_21'], priority: 'P2'
    },
    {
        id: 'base-any', dim: '*', kw: [],
        issue: '该项评估要求未完全满足，需结合实际情况补充完善管理制度、技术措施与执行记录。',
        actions: ['对照评估指引逐条明确差距，形成整改任务清单', '明确整改责任部门、措施与完成时限', '整改完成后留存证明材料并开展有效性复核'],
        basis: ['DSL_27', 'GB43697'], priority: 'P2'
    }
];

// 涉及重要数据/核心数据或法定关键义务时提升优先级
const HIGH_RISK_KW = ['重要数据', '核心数据', '出境', '跨境', '单独同意', '未成年人'];
const HIGH_RISK_IDS = ['incident-plan', 'act-crossborder', 'pi-sensitive', 'pi-minor', 'class-level', 'gov-assess', 'gov-report-submit', 'act-transfer', 'act-delete'];

/** 去掉维度序号前缀：一、数据安全管理 → 数据安全管理 */
function dimensionName(l1) {
    return (l1 || '').replace(/^[一二三四五六七八九十]+、/, '');
}

/** 规则与文本的匹配具体度：命中的关键词越长越具体 */
function ruleSpecificity(rule, text) {
    let best = 0;
    (rule.kw || []).forEach(k => {
        if (text.includes(k) && k.length > best) best = k.length;
    });
    return best;
}

/**
 * 为一个评估指标匹配整改建议
 * @param {Object} tpl TEMPLATE 条目
 * @param {string} result 判定结果
 * @returns {{issue:string, actions:string[], basis:string[], ruleIds:string[], priority:string}}
 */
function matchRectification(tpl, result, item) {
    const dim = dimensionName(tpl.l1);
    const text = (tpl.l2 || '') + (tpl.l3 || '') + (tpl.guidance || '') + (tpl.applicable || '');
    const isFail = result === RESULT.FAIL;

    const matched = [];
    const specific = [];
    RECTIFICATION_KB.forEach(rule => {
        const dimOk = rule.dim === '*' || rule.dim === dim;
        if (!dimOk) return;
        if (!rule.kw || rule.kw.length === 0) return; // 基线规则最后再取
        if (rule.kw.some(k => text.includes(k))) specific.push(rule);
    });

    // 优先取专项规则；命中越多、关键词越长越具体，作为"问题描述"的主规则
    if (specific.length > 0) {
        specific.sort((a, b) => ruleSpecificity(b, text) - ruleSpecificity(a, text));
        matched.push(...specific);
    } else {
        const base = RECTIFICATION_KB.find(r => r.dim === dim && (!r.kw || r.kw.length === 0));
        matched.push(base || RECTIFICATION_KB.find(r => r.id === 'base-any'));
    }

    // 合并措施（去重、限 6 条）、依据（去重）
    const actions = [];
    matched.forEach(r => r.actions.forEach(a => { if (!actions.includes(a)) actions.push(a); }));
    const basis = [];
    matched.forEach(r => r.basis.forEach(b => { if (!basis.includes(b)) basis.push(b); }));

    // 部分符合→"完善"措辞；不符合→"整改"措辞
    const raw = matched[0] ? matched[0].issue : '该项要求未落实。';
    const issue = isFail
        ? raw
        : '该项要求已部分落实，仍存在欠缺：' + raw.replace(/^(缺少|未落实|未按|未|不健全|不完善|不足|存在)/, '');

    return {
        issue: issue,
        actions: actions.slice(0, 6),
        basis: basis,
        ruleIds: matched.map(r => r.id),
        priority: evaluatePriority(tpl, result, matched, item)
    };
}

/** 生成结果本身已是"不符合"或命中的是 P1 关键项 → P1 */
function evaluatePriority(tpl, result, matched, item) {
    if (result !== RESULT.FAIL) return 'P3'; // 部分符合 → 持续改进
    const p1Rule = matched.some(r => r.priority === 'P1');
    const highRiskRule = matched.some(r => HIGH_RISK_IDS.includes(r.id));
    const text = (tpl.guidance || '') + (tpl.applicable || '');
    const highRiskText = HIGH_RISK_KW.some(k => text.includes(k));
    const importantData = (tpl.applicable || '').includes('重要数据') || (tpl.applicable || '').includes('核心数据');
    return (p1Rule || highRiskRule || highRiskText || importantData) ? 'P1' : 'P2';
}

// ---------- 3. 测评结论判定 ----------
const CONCLUSION_LEVELS = {
    PASS: { label: '符合', color: '#2e7d32', badge: 'badge-success' },
    BASIC: { label: '基本符合', color: '#558b2f', badge: 'badge-success' },
    PARTIAL: { label: '部分符合', color: '#ed6c02', badge: 'badge-warn' },
    FAIL: { label: '不符合', color: '#c62828', badge: 'badge-danger' }
};

const RISK_ORDER = ['低风险', '中低风险', '中风险', '较高风险', '高风险'];
const RISK_COLORS = {
    '低风险': '#2e7d32', '中低风险': '#558b2f', '中风险': '#ed6c02', '较高风险': '#e65100', '高风险': '#c62828'
};

/**
 * 生成测评结论
 * 判定口径：综合得分（S=100×(X+0.5Y)/(X+Y+Z)）+ 不符合项数量 + 是否涉及重要数据/核心数据
 */
function evaluateConclusion(project, stats, l1Stats) {
    const s = stats;
    let level, risk;

    if (s.score >= 90 && s.fail === 0) { level = 'PASS'; risk = 0; }
    else if (s.score >= 80 && s.fail === 0) { level = 'BASIC'; risk = 0; }
    else if (s.score >= 80) { level = 'BASIC'; risk = 1; }
    else if (s.score >= 70) { level = 'PARTIAL'; risk = 2; }
    else if (s.score >= 60) { level = 'PARTIAL'; risk = 3; }
    else { level = 'FAIL'; risk = 4; }

    // 涉及重要数据/核心数据的不符合项 → 风险等级上浮一档
    let importantFail = 0;
    const failItems = [];
    getProjectCriteria(project).forEach((tpl, idx) => {
        const item = project.items[idx];
        if (item && item.result === RESULT.FAIL) {
            failItems.push(tpl);
            const ap = tpl.applicable || '';
            if (ap.includes('重要数据') || ap.includes('核心数据')) importantFail++;
        }
    });
    if (importantFail > 0 && risk < RISK_ORDER.length - 1) {
        risk = Math.min(RISK_ORDER.length - 1, risk + 1);
    }

    const levelMeta = CONCLUSION_LEVELS[level];
    const reasons = [];
    reasons.push(`综合得分 ${s.score} 分（公式 S = 100×(X+0.5Y)/(X+Y+Z)，X=${s.pass}、Y=${s.partial}、Z=${s.fail}，不适用项 ${s.na} 项不计入评分）`);
    reasons.push(`共评估 ${s.total} 项指标：符合 ${s.pass} 项、部分符合 ${s.partial} 项、不符合 ${s.fail} 项、不适用 ${s.na} 项、未评估 ${s.unassessed} 项`);
    if (s.fail > 0) reasons.push(`存在 ${s.fail} 项不符合项，需限期整改并复核`);
    if (importantFail > 0) reasons.push(`其中 ${importantFail} 项不符合项涉及重要数据/核心数据，按从高适用原则上调风险等级`);
    if (s.unassessed > 0) reasons.push(`存在 ${s.unassessed} 项未评估指标，评估结论的完整性受影响，建议补充评估后复评`);

    // 维度短板
    const weak = Object.entries(l1Stats)
        .filter(([, d]) => d.scored > 0 && d.score < 80)
        .map(([l1, d]) => `${dimensionName(l1)}（${d.score} 分）`);
    if (weak.length > 0) reasons.push(`短板维度：${weak.join('、')}，建议列为整改重点`);

    return {
        level: level,
        label: levelMeta.label,
        color: levelMeta.color,
        badge: levelMeta.badge,
        risk: RISK_ORDER[risk],
        riskColor: RISK_COLORS[RISK_ORDER[risk]],
        importantFail: importantFail,
        reasons: reasons,
        summary: buildConclusionSummary(project, s, levelMeta.label, RISK_ORDER[risk])
    };
}

function buildConclusionSummary(project, s, label, risk) {
    const target = project.target || '被评估对象';
    const head = `经对${target}数据安全管理、数据处理活动、数据安全技术、个人信息保护四个方面共 ${s.total} 项指标的评估，`;
    if (label === '符合') {
        return `${head}各项控制要求落实到位，综合得分 ${s.score} 分，数据安全状况总体符合法律法规与标准要求，评定为「符合」，总体风险等级为${risk}。`;
    }
    if (label === '基本符合') {
        return `${head}数据安全基础工作基本建立，综合得分 ${s.score} 分，但仍有 ${s.partial} 项指标需完善、${s.fail} 项指标不符合要求，评定为「基本符合」，总体风险等级为${risk}。建议按本报告整改建议限期完成整改并开展复评。`;
    }
    if (label === '部分符合') {
        return `${head}数据安全管理与技术措施存在明显薄弱环节，综合得分 ${s.score} 分，其中 ${s.fail} 项不符合、${s.partial} 项部分符合，评定为「部分符合」，总体风险等级为${risk}。建议成立专项整改工作组，按优先级完成整改并重新评估。`;
    }
    return `${head}数据安全管理制度与技术措施缺失较多，综合得分 ${s.score} 分，其中 ${s.fail} 项不符合要求，评定为「不符合」，总体风险等级为${risk}。建议立即开展专项整改，重大风险项应优先处置并及时向主管部门报告。`;
}

/** 各维度结论 */
function buildDimensionConclusions(l1Stats) {
    return Object.entries(l1Stats)
        .filter(([, d]) => d.scored > 0)
        .map(([l1, d]) => {
            let label = '符合', color = '#2e7d32';
            if (d.score < 60) { label = '不符合'; color = '#c62828'; }
            else if (d.score < 70) { label = '部分符合（偏低）'; color = '#e65100'; }
            else if (d.score < 80) { label = '部分符合'; color = '#ed6c02'; }
            else if (d.score < 90) { label = '基本符合'; color = '#558b2f'; }
            return {
                name: dimensionName(l1),
                score: d.score,
                label: label,
                color: color,
                pass: d.pass, partial: d.partial, fail: d.fail, na: d.na, scored: d.scored
            };
        });
}

// ---------- 4. 整改清单 ----------
function buildRectificationPlan(project) {
    const all = [];
    getProjectCriteria(project).forEach((tpl, idx) => {
        const item = project.items[idx] || {};
        if (item.result !== RESULT.FAIL && item.result !== RESULT.PARTIAL) return;
        const rec = matchRectification(tpl, item.result, item);
        all.push({
            idx: idx,
            seq: idx + 1,
            l1: dimensionName(tpl.l1),
            l2: tpl.l2,
            l3: tpl.l3,
            guidance: tpl.guidance,
            applicable: tpl.applicable || '',
            position: tpl.position || '',
            implement: tpl.implement || '',
            record: item.record || '',
            result: item.result,
            issue: rec.issue,
            actions: rec.actions,
            basis: rec.basis,
            ruleIds: rec.ruleIds,
            priority: rec.priority
        });
    });

    const byPriority = { P1: [], P2: [], P3: [] };
    all.forEach(e => { (byPriority[e.priority] || byPriority.P3).push(e); });

    // 按维度聚合统计
    const byDimension = {};
    all.forEach(e => {
        if (!byDimension[e.l1]) byDimension[e.l1] = { total: 0, fail: 0, partial: 0 };
        byDimension[e.l1].total++;
        if (e.result === RESULT.FAIL) byDimension[e.l1].fail++;
        else byDimension[e.l1].partial++;
    });

    return { all: all, p1: byPriority.P1, p2: byPriority.P2, p3: byPriority.P3, byDimension: byDimension };
}

const PRIORITY_META = {
    P1: { label: 'P1 立即整改', desc: '涉及法律责任或重要数据安全，建议 1 个月内完成', color: '#c62828' },
    P2: { label: 'P2 限期整改', desc: '建议 3 个月内完成', color: '#ed6c02' },
    P3: { label: 'P3 持续改进', desc: '部分符合项，建议 6 个月内完善提升', color: '#1565c0' }
};

// ---------- 5. 报告数据模型 ----------
function buildReportModel(project) {
    const stats = computeItemStats(project);
    const l1Stats = computeL1Stats(project);
    const conclusion = evaluateConclusion(project, stats, l1Stats);
    const dimensions = buildDimensionConclusions(l1Stats);
    const plan = buildRectificationPlan(project);

    // 报告涉及的规范依据清单
    const usedBasis = new Set();
    plan.all.forEach(e => e.basis.forEach(b => usedBasis.add(b)));
    const standards = Array.from(usedBasis).map(k => {
        if (REPORT_STANDARDS[k]) {
            return { key: k, cite: REPORT_STANDARDS[k].cite, desc: REPORT_STANDARDS[k].name };
        }
        const full = CITE[k] || k;
        const m = full.match(/^(.*?)（([\s\S]*)）$/);
        return m ? { key: k, cite: m[1], desc: m[2] } : { key: k, cite: full, desc: '' };
    });

    return {
        project: project,
        generatedAt: new Date().toLocaleString('zh-CN'),
        criteriaSource: project.criteriaSource || '系统内置评估准则',
        stats: stats,
        l1Stats: l1Stats,
        conclusion: conclusion,
        dimensions: dimensions,
        plan: plan,
        standards: standards
    };
}

// ---------- 6. Markdown 渲染 ----------
function renderReportMarkdown(model) {
    const p = model.project, s = model.stats, c = model.conclusion;
    const L = [];
    const line = (t) => L.push(t === undefined ? '' : t);

    line(`# 数据安全评估报告`);
    line();
    line(`> 报告生成时间：${model.generatedAt}`);
    line();
    line(`## 一、项目基本信息`);
    line();
    line(`| 项目 | 内容 |`);
    line(`| --- | --- |`);
    line(`| 项目名称 | ${p.name || '-'} |`);
    line(`| 评估对象 | ${p.target || '-'} |`);
    line(`| 评估人员 | ${p.evaluator || '-'} |`);
    line(`| 评估日期 | ${p.date || '-'} |`);
    line(`| 适用对象范围 | ${p.applicable || '全部适用对象'} |`);
    line(`| 评估准则来源 | ${model.criteriaSource} |`);
    line();

    line(`## 二、测评结论`);
    line();
    line(`**综合结论：${c.label}**　|　**综合得分：${s.score} 分**　|　**总体风险等级：${c.risk}**`);
    line();
    line(c.summary);
    line();
    line(`### 2.1 判定依据`);
    line();
    c.reasons.forEach((r, i) => line(`${i + 1}. ${r}`));
    line();

    line(`### 2.2 各维度结论`);
    line();
    line(`| 评估维度 | 得分 | 结论 | 符合 | 部分符合 | 不符合 | 不适用 | 参评项 |`);
    line(`| --- | ---: | --- | ---: | ---: | ---: | ---: | ---: |`);
    model.dimensions.forEach(d => {
        line(`| ${d.name} | ${d.score} | ${d.label} | ${d.pass} | ${d.partial} | ${d.fail} | ${d.na} | ${d.scored} |`);
    });
    line();

    line(`## 三、评估概况`);
    line();
    line(`| 统计项 | 数量 |`);
    line(`| --- | ---: |`);
    line(`| 评估指标总数 | ${s.total} |`);
    line(`| 符合 | ${s.pass} |`);
    line(`| 部分符合 | ${s.partial} |`);
    line(`| 不符合 | ${s.fail} |`);
    line(`| 不适用 | ${s.na} |`);
    line(`| 未评估 | ${s.unassessed} |`);
    line(`| 已评估 | ${s.assessed} |`);
    line(`| 参与评分 | ${s.scored} |`);
    line();
    line(`评分公式：S = 100 × (X + 0.5Y) / (X + Y + Z)，其中 X=符合、Y=部分符合、Z=不符合；不适用项不计入评分。`);
    if (s.unassessed > 0) {
        line();
        line(`> ⚠️ 本次评估存在 ${s.unassessed} 项未评估指标，结论仅基于已评估的 ${s.assessed} 项得出，建议补充评估后复评。`);
    }
    line();

    line(`## 四、整改建议汇总`);
    line();
    line(`共需整改 ${model.plan.all.length} 项，其中不符合 ${s.fail} 项、部分符合 ${s.partial} 项。`);
    line();
    line(`| 优先级 | 数量 | 建议时限 |`);
    line(`| --- | ---: | --- |`);
    line(`| P1 立即整改 | ${model.plan.p1.length} | 1 个月内 |`);
    line(`| P2 限期整改 | ${model.plan.p2.length} | 3 个月内 |`);
    line(`| P3 持续改进 | ${model.plan.p3.length} | 6 个月内 |`);
    line();
    line(`| 评估维度 | 需整改项 | 其中不符合 | 其中部分符合 |`);
    line(`| --- | ---: | ---: | ---: |`);
    Object.entries(model.plan.byDimension).forEach(([name, d]) => {
        line(`| ${name} | ${d.total} | ${d.fail} | ${d.partial} |`);
    });
    line();

    // 分优先级逐项列出
    const sections = [
        { key: 'p1', meta: PRIORITY_META.P1, title: '五、P1 立即整改项' },
        { key: 'p2', meta: PRIORITY_META.P2, title: '六、P2 限期整改项' },
        { key: 'p3', meta: PRIORITY_META.P3, title: '七、P3 持续改进项（部分符合）' }
    ];
    sections.forEach(sec => {
        const list = model.plan[sec.key];
        if (!list || list.length === 0) return;
        line(`## ${sec.title}`);
        line();
        line(`${sec.meta.label}：共 ${list.length} 项，${sec.meta.desc}。`);
        line();
        list.forEach((e, i) => {
            line(`### ${i + 1}. [${e.l1}] ${e.l2} / ${e.l3}`);
            line();
            line(`- **判定结果**：${e.result}`);
            line(`- **评估指引**：${e.guidance}`);
            if (e.applicable) line(`- **适用对象**：${e.applicable}`);
            if (e.position) line(`- **取证位置**：${e.position.replace(/\n/g, '；')}`);
            if (e.record) line(`- **评估记录**：${e.record.replace(/\n/g, ' ')}`);
            line(`- **问题描述**：${e.issue}`);
            line(`- **整改措施**：`);
            e.actions.forEach((a, ai) => line(`  ${ai + 1}) ${a}`));
            line(`- **规范依据**：${e.basis.map(b => (CITE[b] || (REPORT_STANDARDS[b] ? REPORT_STANDARDS[b].cite : b))).join('；')}`);
            line(`- **建议完成时限**：${sec.meta.desc.replace(/^.*建议/, '建议')}`);
            line();
        });
    });

    line(`## 八、系统性整改建议`);
    line();
    line(`1. **建立整改闭环**：对上述 ${model.plan.all.length} 项问题建立整改台账，明确责任部门、责任人与完成时限，整改完成后留存证明材料并开展有效性复核。`);
    line(`2. **制度与技术并重**：管理制度类问题应同步落实执行记录与技术控制措施，避免"有制度无执行"。`);
    line(`3. **重点关注重要数据**：涉及重要数据、核心数据及个人信息出境的处理活动，应按规定开展风险评估并向主管部门报送（${CITE.DSL_30}；${CITE.NDSR_33}）。`);
    line(`4. **补齐未评估项**：${s.unassessed > 0 ? `尚有 ${s.unassessed} 项未评估，建议补充评估，确保结论完整。` : '本次评估已覆盖全部指标。'}`);
    line(`5. **建立年度长效机制**：建议将数据安全风险评估纳入年度工作计划，形成"评估—整改—复评"的常态化机制（${REPORT_STANDARDS.GB43697.cite}）。`);
    line();

    line(`## 附：主要规范依据`);
    line();
    model.standards.forEach((std, i) => line(`${i + 1}. ${std.cite}${std.desc ? '　' + std.desc : ''}`));
    line();
    line(`> 说明：本报告由数据安全管理评估系统依据评估记录自动生成，规范条款引用供整改参考，`);
    line(`> 具体适用条款请以现行有效文本及主管部门要求为准。`);
    line();

    return L.join('\n');
}

// ---------- 7. HTML 渲染（可直接打印/转 PDF）----------
function escapeReportHtml(str) {
    return String(str === undefined || str === null ? '' : str)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function renderReportHtml(model) {
    const p = model.project, s = model.stats, c = model.conclusion;
    const esc = escapeReportHtml;
    const H = [];
    const line = (t) => H.push(t === undefined ? '' : t);

    line(`<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8">`);
    line(`<title>数据安全评估报告 - ${esc(p.name || '')}</title>`);
    line(`<style>
      :root { --c-pass:#2e7d32; --c-partial:#ed6c02; --c-fail:#c62828; --c-na:#607d8b; }
      * { box-sizing: border-box; }
      body { font-family: "Microsoft YaHei","PingFang SC",-apple-system,sans-serif; color:#333; line-height:1.7; margin:0; padding:32px 40px; background:#f5f6f8; }
      .page { max-width: 1000px; margin:0 auto; background:#fff; padding:40px 48px; box-shadow:0 2px 16px rgba(0,0,0,.08); }
      h1 { font-size:26px; text-align:center; margin:0 0 6px; color:#1a237e; }
      .sub { text-align:center; color:#888; font-size:13px; margin-bottom:28px; }
      h2 { font-size:18px; color:#1a237e; border-left:4px solid #1a237e; padding-left:10px; margin:32px 0 14px; }
      h3 { font-size:14px; color:#333; margin:20px 0 8px; }
      table { width:100%; border-collapse:collapse; font-size:13px; margin:10px 0 16px; }
      th,td { border:1px solid #e0e0e0; padding:8px 10px; text-align:left; vertical-align:top; }
      th { background:#eef1f8; font-weight:600; }
      td.num,th.num { text-align:right; }
      .concl { border:1px solid #e0e0e0; border-left:6px solid ${c.color}; border-radius:8px; padding:18px 22px; margin:16px 0; background:#fafbfd; }
      .concl .big { font-size:22px; font-weight:700; color:${c.color}; }
      .concl .risk { display:inline-block; padding:3px 12px; border-radius:12px; color:#fff; background:${c.riskColor}; font-size:13px; margin-left:10px; }
      .kv { display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:8px 20px; font-size:13px; margin:12px 0; }
      .kv b { color:#555; }
      .item { border:1px solid #e6e6e6; border-radius:8px; padding:14px 18px; margin:12px 0; background:#fff; page-break-inside:avoid; }
      .item .path { font-size:12px; color:#888; margin-bottom:6px; }
      .item .guidance { font-size:13px; color:#333; background:#f7f8fb; border-radius:6px; padding:10px 12px; margin:8px 0; }
      .item ul { margin:6px 0 6px 18px; padding:0; font-size:13px; }
      .badge { display:inline-block; padding:2px 10px; border-radius:10px; font-size:12px; color:#fff; }
      .p1 { background:#c62828; } .p2 { background:#ed6c02; } .p3 { background:#1565c0; }
      .basis { font-size:12px; color:#555; }
      .note { background:#fff8e1; border-left:4px solid #fbc02d; padding:10px 14px; font-size:13px; color:#795548; border-radius:4px; }
      ol.reasons { font-size:13px; }
      @media print { body { background:#fff; padding:0; } .page { box-shadow:none; padding:0 12px; } h2 { page-break-after:avoid; } }
    </style></head><body><div class="page">`);

    line(`<h1>数据安全评估报告</h1>`);
    line(`<div class="sub">报告生成时间：${esc(model.generatedAt)}</div>`);

    // 基本信息
    line(`<h2>一、项目基本信息</h2>`);
    line(`<div class="kv">`);
    line(`<div><b>项目名称：</b>${esc(p.name || '-')}</div>`);
    line(`<div><b>评估对象：</b>${esc(p.target || '-')}</div>`);
    line(`<div><b>评估人员：</b>${esc(p.evaluator || '-')}</div>`);
    line(`<div><b>评估日期：</b>${esc(p.date || '-')}</div>`);
    line(`<div><b>适用对象范围：</b>${esc(p.applicable || '全部适用对象')}</div>`);
    line(`<div><b>评估准则来源：</b>${esc(model.criteriaSource)}</div>`);
    line(`</div>`);

    // 结论
    line(`<h2>二、测评结论</h2>`);
    line(`<div class="concl">`);
    line(`<div><span class="big">${esc(c.label)}</span><span class="risk">总体风险：${esc(c.risk)}</span>`);
    line(`<span style="margin-left:12px;font-size:13px;color:#666;">综合得分 <b style="font-size:18px;color:${c.color};">${s.score}</b> / 100</span></div>`);
    line(`<p style="margin:12px 0 0;font-size:14px;">${esc(c.summary)}</p>`);
    line(`</div>`);
    line(`<h3>2.1 判定依据</h3><ol class="reasons">`);
    c.reasons.forEach(r => line(`<li>${esc(r)}</li>`));
    line(`</ol>`);
    line(`<h3>2.2 各维度结论</h3>`);
    line(`<table><tr><th>评估维度</th><th class="num">得分</th><th>结论</th><th class="num">符合</th><th class="num">部分符合</th><th class="num">不符合</th><th class="num">不适用</th><th class="num">参评项</th></tr>`);
    model.dimensions.forEach(d => {
        line(`<tr><td>${esc(d.name)}</td><td class="num" style="color:${d.color};font-weight:600;">${d.score}</td><td style="color:${d.color};">${esc(d.label)}</td><td class="num">${d.pass}</td><td class="num">${d.partial}</td><td class="num">${d.fail}</td><td class="num">${d.na}</td><td class="num">${d.scored}</td></tr>`);
    });
    line(`</table>`);

    // 概况
    line(`<h2>三、评估概况</h2>`);
    line(`<table><tr><th>统计项</th><th class="num">数量</th><th>统计项</th><th class="num">数量</th></tr>`);
    line(`<tr><td>评估指标总数</td><td class="num">${s.total}</td><td>符合</td><td class="num">${s.pass}</td></tr>`);
    line(`<tr><td>部分符合</td><td class="num">${s.partial}</td><td>不符合</td><td class="num">${s.fail}</td></tr>`);
    line(`<tr><td>不适用</td><td class="num">${s.na}</td><td>未评估</td><td class="num">${s.unassessed}</td></tr>`);
    line(`<tr><td>已评估</td><td class="num">${s.assessed}</td><td>参与评分</td><td class="num">${s.scored}</td></tr>`);
    line(`</table>`);
    line(`<div class="note">评分公式：S = 100 × (X + 0.5Y) / (X + Y + Z)，X=符合、Y=部分符合、Z=不符合；不适用项不计入评分。${s.unassessed > 0 ? `本次存在 ${s.unassessed} 项未评估指标，结论仅基于已评估项得出。` : ''}</div>`);

    // 整改汇总
    line(`<h2>四、整改建议汇总</h2>`);
    line(`<p style="font-size:13px;">共需整改 <b>${model.plan.all.length}</b> 项（不符合 ${s.fail} 项、部分符合 ${s.partial} 项）。</p>`);
    line(`<table><tr><th>优先级</th><th class="num">数量</th><th>建议时限</th></tr>`);
    line(`<tr><td><span class="badge p1">P1 立即整改</span></td><td class="num">${model.plan.p1.length}</td><td>1 个月内</td></tr>`);
    line(`<tr><td><span class="badge p2">P2 限期整改</span></td><td class="num">${model.plan.p2.length}</td><td>3 个月内</td></tr>`);
    line(`<tr><td><span class="badge p3">P3 持续改进</span></td><td class="num">${model.plan.p3.length}</td><td>6 个月内</td></tr>`);
    line(`</table>`);
    line(`<table><tr><th>评估维度</th><th class="num">需整改项</th><th class="num">其中不符合</th><th class="num">其中部分符合</th></tr>`);
    Object.entries(model.plan.byDimension).forEach(([name, d]) => {
        line(`<tr><td>${esc(name)}</td><td class="num">${d.total}</td><td class="num">${d.fail}</td><td class="num">${d.partial}</td></tr>`);
    });
    line(`</table>`);

    // 逐项整改
    const sections = [
        { key: 'p1', cls: 'p1', title: '五、P1 立即整改项', meta: PRIORITY_META.P1 },
        { key: 'p2', cls: 'p2', title: '六、P2 限期整改项', meta: PRIORITY_META.P2 },
        { key: 'p3', cls: 'p3', title: '七、P3 持续改进项（部分符合）', meta: PRIORITY_META.P3 }
    ];
    sections.forEach(sec => {
        const list = model.plan[sec.key];
        if (!list || list.length === 0) return;
        line(`<h2>${sec.title}</h2>`);
        line(`<p style="font-size:13px;color:#666;">${sec.meta.label}：共 ${list.length} 项，${esc(sec.meta.desc)}</p>`);
        list.forEach((e, i) => {
            line(`<div class="item">`);
            line(`<div class="path">${i + 1}. [${esc(e.l1)}] ${esc(e.l2)} / ${esc(e.l3)}　<span class="badge ${sec.cls}">${esc(e.result)}</span></div>`);
            line(`<div class="guidance"><b>评估指引：</b>${esc(e.guidance)}</div>`);
            if (e.applicable) line(`<div class="path"><b>适用对象：</b>${esc(e.applicable)}</div>`);
            if (e.position) line(`<div class="path"><b>取证位置：</b>${esc(e.position.replace(/\n/g, '；'))}</div>`);
            if (e.record) line(`<div class="path"><b>评估记录：</b>${esc(e.record.replace(/\n/g, ' '))}</div>`);
            line(`<div style="font-size:13px;margin-top:6px;"><b>问题描述：</b>${esc(e.issue)}</div>`);
            line(`<div style="font-size:13px;"><b>整改措施：</b><ul>`);
            e.actions.forEach(a => line(`<li>${esc(a)}</li>`));
            line(`</ul></div>`);
            line(`<div class="basis"><b>规范依据：</b>${esc(e.basis.map(b => CITE[b] || (REPORT_STANDARDS[b] ? REPORT_STANDARDS[b].cite : b)).join('；'))}</div>`);
            line(`</div>`);
        });
    });

    // 系统性建议
    line(`<h2>八、系统性整改建议</h2><ol class="reasons">`);
    line(`<li>对上述 ${model.plan.all.length} 项问题建立整改台账，明确责任部门、责任人与完成时限，整改完成后留存证明材料并开展有效性复核。</li>`);
    line(`<li>管理制度类问题应同步落实执行记录与技术控制措施，避免"有制度无执行"。</li>`);
    line(`<li>涉及重要数据、核心数据及个人信息出境的处理活动，应按规定开展风险评估并报送主管部门（${esc(CITE.DSL_30)}；${esc(CITE.NDSR_33)}）。</li>`);
    line(`<li>${s.unassessed > 0 ? `尚有 ${s.unassessed} 项未评估，建议补充评估以确保结论完整。` : '本次评估已覆盖全部指标，建议保持年度评估机制。'}</li>`);
    line(`<li>建议形成"评估—整改—复评"常态化机制，每年至少开展一次数据安全风险评估（${esc(REPORT_STANDARDS.GB43697.cite)}）。</li>`);
    line(`</ol>`);

    // 依据清单
    line(`<h2>附：主要规范依据</h2><ol class="reasons">`);
    model.standards.forEach(std => line(`<li>${esc(std.cite)}${std.desc ? '　' + esc(std.desc) : ''}</li>`));
    line(`</ol>`);
    line(`<div class="note">说明：本报告由数据安全管理评估系统依据评估记录自动生成，规范条款引用供整改参考，具体适用条款请以现行有效文本及主管部门要求为准。</div>`);

    line(`</div></body></html>`);
    return H.join('\n');
}

// ---------- 8. 导出 ----------
function _downloadText(content, filename, mime) {
    const blob = new Blob([content], { type: mime || 'text/plain;charset=utf-8' });
    downloadBlob(blob, filename);
}

function _reportFileBase(project, ext) {
    const target = (project.target || '评估对象').replace(/[\\/:*?"<>|]/g, '_');
    const date = project.date || new Date().toISOString().slice(0, 10);
    return `数据安全评估报告_${target}_${date}.${ext}`;
}

function exportReportMarkdown(project) {
    const proj = project || getProject(currentProjectId);
    if (!proj) return;
    const model = buildReportModel(proj);
    _downloadText(renderReportMarkdown(model), _reportFileBase(proj, 'md'), 'text/markdown;charset=utf-8');
}

function exportReportHtml(project) {
    const proj = project || getProject(currentProjectId);
    if (!proj) return;
    const model = buildReportModel(proj);
    _downloadText(renderReportHtml(model), _reportFileBase(proj, 'html'), 'text/html;charset=utf-8');
}

// ---------- 9. 报告对话框（预览 + 导出） ----------
let _reportModelCache = null;

function showReportModal() {
    const project = getProject(currentProjectId);
    if (!project) return;

    const model = buildReportModel(project);
    _reportModelCache = model;
    const s = model.stats, c = model.conclusion, p = model.plan;

    // 概要
    document.getElementById('reportSummary').innerHTML = `
        <div style="display:flex;gap:20px;flex-wrap:wrap;align-items:center;padding:16px 18px;background:linear-gradient(135deg,#f5f7fa,#e8eaf6);border-radius:10px;margin-bottom:14px;">
            <div>
                <div style="font-size:12px;color:#666;margin-bottom:2px;">测评结论</div>
                <div style="font-size:24px;font-weight:800;color:${c.color};">${c.label}</div>
            </div>
            <div>
                <div style="font-size:12px;color:#666;margin-bottom:2px;">综合得分</div>
                <div style="font-size:24px;font-weight:800;color:${c.color};">${s.score}<span style="font-size:13px;color:#999;font-weight:400;"> / 100</span></div>
            </div>
            <div>
                <div style="font-size:12px;color:#666;margin-bottom:2px;">总体风险等级</div>
                <div style="display:inline-block;padding:4px 14px;border-radius:14px;background:${c.riskColor};color:#fff;font-size:14px;font-weight:600;">${c.risk}</div>
            </div>
            <div style="margin-left:auto;text-align:right;font-size:12px;color:#666;line-height:1.9;">
                <div>不符合 <b style="color:${RESULT_META['不符合'].color};">${s.fail}</b> 项 ｜ 部分符合 <b style="color:${RESULT_META['部分符合'].color};">${s.partial}</b> 项</div>
                <div>整改清单 <b>${p.all.length}</b> 项（P1 ${p.p1.length} / P2 ${p.p2.length} / P3 ${p.p3.length}）</div>
            </div>
        </div>
        <div style="font-size:13px;color:#555;line-height:1.8;padding:0 4px 10px;">${escapeHtml(c.summary)}</div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px;">
            <button class="btn btn-primary btn-sm" onclick="exportReportHtml()">📄 导出完整报告（HTML·可打印/转PDF）</button>
            <button class="btn btn-default btn-sm" onclick="exportReportMarkdown()">📝 导出完整报告（Markdown）</button>
            <button class="btn btn-default btn-sm" onclick="exportScoreReport()">📋 导出简版报告（原有文本格式）</button>
        </div>
        <div style="font-size:12px;color:#888;margin-bottom:10px;">
            完整报告包含：测评结论与判定依据、各维度结论、评估概况、P1/P2/P3 整改清单（不符合项与部分符合项的逐项问题描述、整改措施、规范依据）、系统性整改建议、规范依据清单。
        </div>
    `;

    // 预览（直接渲染完整 HTML 报告）
    const frame = document.getElementById('reportPreviewFrame');
    if (frame) {
        frame.srcdoc = renderReportHtml(model);
    }
    document.getElementById('reportModal').style.display = 'flex';
}

function hideReportModal() {
    document.getElementById('reportModal').style.display = 'none';
    const frame = document.getElementById('reportPreviewFrame');
    if (frame) frame.srcdoc = '';
    _reportModelCache = null;
}

/** 供外部取用当前报告模型（如后续扩展） */
function getReportModel() {
    return _reportModelCache;
}
