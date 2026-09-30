# ============================================================
#  数据安全管理评估系统 —— 静态站点镜像
#  前端无需构建（原生 HTML/CSS/JS），直接复制文件即可
#  构建（在项目根目录执行）：
#     docker build -f deploy/Dockerfile -t data-security-eval:latest .
# ============================================================
FROM nginx:1.27-alpine

LABEL org.opencontainers.image.title="数据安全管理评估系统" \
      org.opencontainers.image.description="浏览器端数据安全评估工具（纯静态站点，数据存于浏览器 localStorage）"

# 站点文件 → 与裸机部署一致的目录
COPY index.html user-management.html /var/www/data_security/
COPY css                             /var/www/data_security/css/
COPY js                              /var/www/data_security/js/
COPY vendor                          /var/www/data_security/vendor/
COPY assets                          /var/www/data_security/assets/

# 站点配置
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

# 容器内自检（busybox wget 随 alpine 提供）
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
    CMD wget -qO- http://127.0.0.1/index.html >/dev/null 2>&1 || exit 1
