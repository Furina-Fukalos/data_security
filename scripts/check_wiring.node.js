// 静态接线检查：确认 HTML 中所有 on* 事件调用的函数都在 js/ 中有定义。
// 运行： node scripts/check_wiring.node.js
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const HTML_FILES = ['index.html', 'user-management.html'];

// ---- 收集已定义的函数名 ----
const defined = new Set();
fs.readdirSync(path.join(ROOT, 'js')).filter(f => f.endsWith('.js')).forEach(f => {
    const src = fs.readFileSync(path.join(ROOT, 'js', f), 'utf-8');
    // function foo( ... )
    for (const m of src.matchAll(/\bfunction\s+([A-Za-z_$][\w$]*)\s*\(/g)) defined.add(m[1]);
    // const foo = function / const foo = async function / const foo = ( ... ) => / const foo = async ( ... ) =>
    for (const m of src.matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:function\b|\()/g)) defined.add(m[1]);
});

// 浏览器/内联表达式白名单
const WHITELIST = new Set([
    'event', 'this', 'document', 'window', 'alert', 'confirm', 'prompt', 'console',
    'if', 'return', 'function', 'void', 'new', 'typeof', 'Number', 'String', 'Boolean',
    'parseInt', 'parseFloat', 'setTimeout', 'setInterval'
]);

let problems = 0;
HTML_FILES.forEach(file => {
    const full = path.join(ROOT, file);
    if (!fs.existsSync(full)) return;
    const html = fs.readFileSync(full, 'utf-8');
    console.log(`\n--- ${file} ---`);

    // 页面内联 <script> 中定义的函数也算已定义
    const localDefined = new Set(defined);
    for (const block of html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)) {
        for (const m of block[1].matchAll(/\bfunction\s+([A-Za-z_$][\w$]*)\s*\(/g)) localDefined.add(m[1]);
        for (const m of block[1].matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:function\b|\()/g)) localDefined.add(m[1]);
    }

    for (const attr of html.matchAll(/\bon[a-z]+\s*=\s*"([^"]*)"/g)) {
        const code = attr[1];
        // 只取「非方法调用」形式的标识符( ，排除 x.y(...) 这类成员调用
        for (const call of code.matchAll(/(^|[^.\w$])([A-Za-z_$][\w$]*)\s*\(/g)) {
            const name = call[2];
            if (WHITELIST.has(name)) continue;
            if (localDefined.has(name)) continue;
            console.error(`  ✗ 未定义的事件处理函数: ${name}()  ← ${code.trim().slice(0, 80)}`);
            problems++;
        }
    }
});

if (problems === 0) {
    console.log(`\n✓ 事件接线检查通过（共定义 ${defined.size} 个函数）`);
} else {
    console.log(`\n${problems} 个问题`);
}
process.exit(problems === 0 ? 0 : 1);
