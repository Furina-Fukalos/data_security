#!/usr/bin/env bash
# ============================================================
#  数据安全管理评估系统 —— ECS 裸机一键部署脚本（Nginx 静态站点）
#
#  用法（在站点目录内执行）：
#      sudo bash deploy.sh            # 使用 80 端口
#      sudo bash deploy.sh 8080       # 使用 8080 端口
#
#  适用系统：Alibaba Cloud Linux / CentOS / RHEL / Ubuntu / Debian
#  脚本可重复执行（幂等）：更新站点文件后再次运行即可完成升级
# ============================================================
set -euo pipefail

PORT="${1:-80}"
PORT="${PORT//[^0-9]/}"            # 仅保留数字
if [[ -z "${PORT}" ]]; then
    echo "[错误] 端口参数非法，请传入数字，例如：sudo bash deploy.sh 8080" >&2
    exit 1
fi

SITE_DST="/var/www/data_security"
CONF_DST="/etc/nginx/conf.d/data_security.conf"

# ---------- 定位站点源目录（脚本所在目录，或其父目录） ----------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ -f "${SCRIPT_DIR}/index.html" ]]; then
    SITE_SRC="${SCRIPT_DIR}"
elif [[ -f "${SCRIPT_DIR}/../index.html" ]]; then
    SITE_SRC="$(cd "${SCRIPT_DIR}/.." && pwd)"
else
    echo "[错误] 未找到 index.html。请把本脚本放在站点目录内（或 site/deploy.sh 位置）后执行。" >&2
    exit 1
fi

# ---------- 必须 root ----------
if [[ "${EUID}" -ne 0 ]]; then
    echo "[错误] 需要 root 权限，请执行：sudo bash $0 ${PORT}" >&2
    exit 1
fi

echo "============================================================"
echo " 数据安全管理评估系统 —— 部署"
echo "============================================================"
echo " 站点源目录 : ${SITE_SRC}"
echo " 站点目标   : ${SITE_DST}"
echo " 监听端口   : ${PORT}"
echo

# ---------- 1. 安装 nginx ----------
install_nginx() {
    if command -v nginx >/dev/null 2>&1; then
        echo "==> 已安装 nginx：$(nginx -v 2>&1)"
        return 0
    fi
    echo "==> 安装 nginx ..."
    if command -v apt-get >/dev/null 2>&1; then
        export DEBIAN_FRONTEND=noninteractive
        apt-get update -y
        apt-get install -y nginx
    elif command -v dnf >/dev/null 2>&1; then
        dnf install -y nginx
    elif command -v yum >/dev/null 2>&1; then
        yum install -y nginx
    else
        echo "[错误] 未识别的包管理器，请手动安装 nginx 后重试。" >&2
        exit 1
    fi
}
install_nginx

# ---------- 2. 复制站点文件 ----------
echo "==> 复制站点文件到 ${SITE_DST} ..."
mkdir -p "${SITE_DST}"
for item in index.html user-management.html css js vendor assets; do
    if [[ -e "${SITE_SRC}/${item}" ]]; then
        rm -rf "${SITE_DST:?}/${item}"
        cp -r "${SITE_SRC}/${item}" "${SITE_DST}/"
    fi
done
echo "    站点文件数量：$(find "${SITE_DST}" -type f | wc -l)"

# ---------- 3. 写入 nginx 配置（按端口替换 listen） ----------
CONF_SRC=""
for candidate in "${SITE_SRC}/nginx.conf" "${SITE_SRC}/deploy/nginx.conf"; do
    if [[ -f "${candidate}" ]]; then CONF_SRC="${candidate}"; break; fi
done
if [[ -z "${CONF_SRC}" ]]; then
    echo "[错误] 未找到 nginx.conf（应在站点目录或其 deploy/ 子目录）。" >&2
    exit 1
fi
echo "==> 写入站点配置 ${CONF_DST}（源：${CONF_SRC}）"
sed -e "s/listen  *80 default_server;/listen ${PORT} default_server;/" "${CONF_SRC}" > "${CONF_DST}"

# 停用发行版默认站点，避免与本站点抢占 80 端口
if [[ -e /etc/nginx/sites-enabled/default ]]; then
    echo "==> 停用发行版默认站点（/etc/nginx/sites-enabled/default）"
    rm -f /etc/nginx/sites-enabled/default
fi

# ---------- 4. SELinux 上下文（Alibaba Cloud Linux / CentOS 常见坑） ----------
if command -v getenforce >/dev/null 2>&1 && [[ "$(getenforce 2>/dev/null || echo Disabled)" == "Enforcing" ]]; then
    echo "==> SELinux 处于 Enforcing，设置站点目录上下文 ..."
    if ! chcon -R -t httpd_sys_content_t "${SITE_DST}" 2>/dev/null; then
        echo "    [提示] chcon 失败；若访问出现 403，请手动执行："
        echo "           chcon -R -t httpd_sys_content_t ${SITE_DST}"
    fi
fi

# ---------- 5. 校验并启动 nginx ----------
echo "==> 校验 nginx 配置 ..."
if ! nginx -t; then
    echo
    echo "[错误] nginx 配置校验失败。常见原因：" >&2
    echo "  1) 端口 ${PORT} 已被占用或存在另一个 default_server" >&2
    echo "     → 检查 /etc/nginx/conf.d/ 与 /etc/nginx/sites-enabled/ 下是否有同类配置" >&2
    echo "  2) 换一个端口重试： sudo bash $0 8080" >&2
    exit 1
fi

echo "==> 启动 / 重载 nginx ..."
if command -v systemctl >/dev/null 2>&1; then
    systemctl enable nginx >/dev/null 2>&1 || true
    systemctl restart nginx
else
    nginx -s reload 2>/dev/null || nginx
fi

# ---------- 6. 本机防火墙放行（阿里云安全组需另外在控制台配置） ----------
if command -v firewall-cmd >/dev/null 2>&1 && firewall-cmd --state >/dev/null 2>&1; then
    echo "==> firewalld 放行 ${PORT}/tcp"
    firewall-cmd --permanent --add-port="${PORT}/tcp" >/dev/null
    firewall-cmd --reload >/dev/null
elif command -v ufw >/dev/null 2>&1 && ufw status 2>/dev/null | grep -q "Status: active"; then
    echo "==> ufw 放行 ${PORT}/tcp"
    ufw allow "${PORT}/tcp" >/dev/null
fi

# ---------- 7. 输出访问地址 ----------
PUBLIC_IP="$(curl -s --max-time 3 http://100.100.100.200/latest/meta-data/eipv4 2>/dev/null || true)"
if [[ -z "${PUBLIC_IP}" ]]; then
    PUBLIC_IP="$(curl -s --max-time 3 http://100.100.100.200/latest/meta-data/public-ipv4 2>/dev/null || true)"
fi
[[ -z "${PUBLIC_IP}" ]] && PUBLIC_IP="<ECS公网IP>"

cat <<EOF

============================================================
 ✅ 部署完成
============================================================
 本机访问： http://127.0.0.1:${PORT}/index.html
 外网访问： http://${PUBLIC_IP}:${PORT}/index.html
 站点目录： ${SITE_DST}
 配置文件： ${CONF_DST}

 ⚠️ 还需到阿里云控制台放行端口：
    ECS 实例 → 安全组 → 配置规则 → 入方向 → 添加 TCP ${PORT}（源 0.0.0.0/0）

 ℹ️ 数据保存在「浏览器 localStorage」中：换电脑、换浏览器数据不互通。
    迁移/备份请用页面右上角「📦 备份数据」导出 JSON 后再「📂 导入数据」。
============================================================
EOF
