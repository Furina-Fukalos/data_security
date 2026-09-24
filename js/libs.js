// ============================================
// 重型第三方库按需加载
// echarts / xlsx-js-style / mammoth 合计约 2.1MB，
// 改为「用到才加载」：首屏不再同步阻塞，功能不变。
// ============================================

const LIB_SOURCES = {
    echarts: { file: 'vendor/echarts.min.js', global: 'echarts', desc: '图表库' },
    xlsx: { file: 'vendor/xlsx-js-style.min.js', global: 'XLSX', desc: 'Excel 读写库' },
    mammoth: { file: 'vendor/mammoth.browser.min.js', global: 'mammoth', desc: 'Word 解析库' },
    pdfjs: {
        file: 'vendor/pdf.min.js', global: 'pdfjsLib', desc: 'PDF 解析库',
        worker: 'vendor/pdf.worker.min.js'
    }
};

const _libPromises = {};

/**
 * 按需加载第三方库
 * @param {'echarts'|'xlsx'|'mammoth'} name
 * @returns {Promise<any>} 加载完成后的全局对象
 */
function loadLib(name) {
    const spec = LIB_SOURCES[name];
    if (!spec) return Promise.reject(new Error('未知的库: ' + name));
    if (window[spec.global]) return Promise.resolve(window[spec.global]);
    if (_libPromises[name]) return _libPromises[name];

    _libPromises[name] = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = spec.file;
        script.async = true;
        script.onload = () => {
            if (!window[spec.global]) {
                reject(new Error(spec.desc + '加载后未找到全局对象 ' + spec.global));
                return;
            }
            // 需要独立 worker 的库（如 pdf.js）
            if (spec.worker && window[spec.global].GlobalWorkerOptions) {
                window[spec.global].GlobalWorkerOptions.workerSrc = spec.worker;
            }
            resolve(window[spec.global]);
        };
        script.onerror = () => {
            delete _libPromises[name];
            reject(new Error(spec.desc + '加载失败：' + spec.file + '（请确认 vendor 目录完整）'));
        };
        document.head.appendChild(script);
    });
    return _libPromises[name];
}

/** 预加载（空闲时调用，不阻塞当前操作） */
function preloadLib(name) {
    if (window.requestIdleCallback) {
        window.requestIdleCallback(() => { loadLib(name).catch(() => {}); });
    } else {
        setTimeout(() => { loadLib(name).catch(() => {}); }, 500);
    }
}
