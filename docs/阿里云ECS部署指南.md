# 阿里云 ECS 部署指南

> 系统是**纯静态站点**（原生 HTML/CSS/JS，无需 Node 构建、无需数据库、无后端进程），
> 部署本质就是"把文件放到服务器的 Web 目录里"。以下三种方式任选，**方案一最推荐**。

---

## 0. 部署前必读（三点，能省很多坑）

### 1）数据存在「浏览器」里，不在服务器上

系统的项目数据保存在浏览器 **localStorage**，服务器只提供页面文件。这意味着：

- ✅ 部署后**任何能访问该网址的电脑都能用**，界面、477 项准则、导入功能全部可用；
- ⚠️ 但**各人/各浏览器的数据互不相通**，A 电脑录的数据 B 电脑看不到；
- ⚠️ **localStorage 按「访问地址」隔离**：换了 IP/域名/端口（如从 `IP:8080` 换成 `域名`），
  旧数据**不会自动带过去**，看起来像"数据丢了"。
  → 换地址前，务必先用页面右上角 **📦 备份数据** 导出 JSON，换完后 **📂 导入数据** 恢复。

> 如果需要"多人共用一份数据 / 集中存储"，那需要给系统加一个后端（账号+数据库）。
> 这属于架构改造，可以后续单独做。

### 2）安全组必须放行端口

ECS 默认只放行 22 等少数端口。无论用哪种方式，都要在
**控制台 → ECS → 实例 → 安全组 → 配置规则 → 入方向** 添加规则：

| 协议 | 端口范围 | 授权对象 |
|---|---|---|
| TCP | `8080/8080`（或你选的端口） | `0.0.0.0/0` |

### 3）关于域名与备案

- **用「公网 IP + 端口」访问**：无需备案，最快可用（推荐先用这个验证）；
- **用「域名 + 80/443」访问**：中国大陆地域的 ECS 需要先完成 **ICP 备案**，
  否则 80/443 会被拦截。没备案就先跑非 80 端口（如 8080）。

---

## 1. 三种方式怎么选

| 方案 | 适用场景 | 命令数 | 特点 |
|---|---|---|---|
| **① Nginx 裸机部署** | 生产使用（推荐） | 3 步 | 轻量、稳定、开机自启、可原地更新 |
| ② Docker 部署 | ECS 已装 Docker | 2 步 | 环境隔离、一条命令起停；拉镜像可能需配国内加速 |
| ③ Python 临时验证 | 只想先看一眼效果 | 2 步 | 最快，但不适合长期对外服务 |

---

## 2. 方案一：Nginx 裸机部署（推荐）

### 步骤 1：本地生成部署包

在项目根目录（Windows 本机）执行：

```powershell
python deploy/make_package.py
```

产物：`dist/data_security_site.tar.gz`（约 1.1 MB，自包含：站点文件 + Nginx 配置 + 部署脚本 +
Dockerfile + docker-compose.yml + 部署说明）

### 步骤 2：上传到 ECS

```powershell
scp dist/data_security_site.tar.gz root@<ECS公网IP>:/root/
```

> 没有 scp？也可用阿里云控制台的 **Workbench → 文件上传**，把 tar.gz 传到 `/root/` 即可。

### 步骤 3：登录 ECS 一键部署

```bash
ssh root@<ECS公网IP>

cd /root
tar -xzf data_security_site.tar.gz
cd data_security_site
sudo bash deploy.sh 8080        # 想用 80 端口就写 80
```

脚本会自动完成：安装 Nginx（未装时）→ 复制站点到 `/var/www/data_security` →
写入配置 `/etc/nginx/conf.d/data_security.conf` → 处理 SELinux 上下文 →
校验并重启 Nginx → 放行本机防火墙 → 打印访问地址。

看到 `✅ 部署完成` 后，浏览器访问：

```
http://<ECS公网IP>:8080/index.html
```

> 也可以在浏览器直接访问 `http://<ECS公网IP>:8080/`（会自动打开 index.html）。

### 步骤 4：验证

```bash
systemctl status nginx --no-pager        # 服务状态
curl -I http://127.0.0.1:8080/index.html # 本地自测，应返回 200
```

浏览器能打开登录页即为成功。默认管理员账号：`admin` / `admin123`
（**请立刻用右上角「🔒 修改密码」改掉**）。

---

## 3. 方案二：Docker 部署

适合已经装了 Docker 的 ECS。**`make_package.py` 生成的 tar 包已包含 `Dockerfile` 与 `docker-compose.yml`**，
所以直接复用方案一的上传包即可：

```bash
# 1) 上传（同方案一步骤 2）
scp dist/data_security_site.tar.gz root@<ECS公网IP>:/root/

# 2) 解压并构建启动
ssh root@<ECS公网IP>
tar -xzf data_security_site.tar.gz && cd data_security_site
docker compose up -d --build

# 3) 查看状态
docker compose ps
docker compose logs -f --tail=50
```

> 如果你是从 Git 仓库直接部署整个项目，则在项目根目录执行 `docker compose up -d --build` 即可
> （仓库里的 compose 文件通过 `deploy/Dockerfile` 构建，效果一致）。

默认映射宿主机 **8080** 端口（改端口编辑 `docker-compose.yml` 里的 `ports: "8080:80"`）。

**如果拉取 `nginx:1.27-alpine` 很慢或失败**，配置阿里云镜像加速：

```bash
mkdir -p /etc/docker
cat > /etc/docker/daemon.json <<'EOF'
{
  "registry-mirrors": ["https://<你的专属加速地址>.mirror.aliyuncs.com"]
}
EOF
systemctl restart docker
```

> 专属加速地址在阿里云控制台 **容器镜像服务 ACR → 镜像工具 → 镜像加速器** 里获取。

更新站点：重新上传文件后执行 `docker compose up -d --build` 即可。

---

## 4. 方案三：Python 临时验证（最快）

项目自带启动器，无需安装 Nginx：

```bash
# 上传解压后的站点目录（含 start_server.py）到 ECS，然后：
cd data_security_site
python3 start_server.py --host 0.0.0.0 --port 8080 --no-browser
```

浏览器访问 `http://<ECS公网IP>:8080/index.html`。

> ⚠️ 这是开发用服务器：单进程、无 gzip、无 HTTPS，**仅建议临时验证**，长期对外请用方案一。

如果想让它常驻（不阻塞终端），可用 systemd：

```ini
# /etc/systemd/system/data-security.service
[Unit]
Description=Data Security Evaluation Site
After=network.target

[Service]
Type=simple
WorkingDirectory=/root/data_security_site
ExecStart=/usr/bin/python3 start_server.py --host 0.0.0.0 --port 8080 --no-browser
Restart=always

[Install]
WantedBy=multi-user.target
```

```bash
systemctl daemon-reload && systemctl enable --now data-security
```

---

## 5. 绑定域名 + 开启 HTTPS

### 5.1 准备

1. 域名解析：在阿里云 **云解析 DNS** 添加 A 记录指向 ECS 公网 IP；
2. **中国大陆地域需先完成 ICP 备案**（控制台 → 备案），否则 80/443 不通；
3. 申请证书：**数字证书管理服务 → 免费证书（DV 单域名）** → 下载 **Nginx 版**，
   得到 `xxx.pem` 与 `xxx.key`。

### 5.2 上传证书并追加 HTTPS 配置

```bash
mkdir -p /etc/nginx/ssl
# 上传证书到 /etc/nginx/ssl/ 后，编辑站点配置：
vi /etc/nginx/conf.d/data_security.conf
```

在文件**末尾追加**（替换域名与证书路径）：

```nginx
server {
    listen       443 ssl;
    http2        on;
    server_name  eval.example.com;

    root  /var/www/data_security;
    index index.html;
    charset utf-8;

    ssl_certificate      /etc/nginx/ssl/eval.example.com.pem;
    ssl_certificate_key  /etc/nginx/ssl/eval.example.com.key;
    ssl_protocols        TLSv1.2 TLSv1.3;
    ssl_ciphers          HIGH:!aNULL:!MD5;
    ssl_session_cache    shared:SSL:10m;

    gzip on;
    gzip_comp_level 5;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/javascript application/javascript application/json image/svg+xml;

    location = / { add_header Cache-Control "no-store"; try_files /index.html =404; }
    location = /index.html { add_header Cache-Control "no-store"; }
    location /vendor/ { expires 30d; add_header Cache-Control "public, max-age=2592000"; }
    location / { try_files $uri $uri/ =404; }
}

# HTTP 自动跳转 HTTPS：把原 80 端口的 server 块改成
# server { listen 80; server_name eval.example.com; return 301 https://$host$request_uri; }
```

```bash
nginx -t && systemctl reload nginx
```

**为什么要上 HTTPS**：除了传输安全，浏览器的 `crypto.subtle`（用于口令哈希）
**只在安全上下文（HTTPS 或 localhost）可用**；纯 HTTP 下会自动降级为简单哈希——
功能不受影响，但口令强度弱。生产环境建议务必启用 HTTPS。

> 用 certbot 也可以：`apt install certbot python3-certbot-nginx && certbot --nginx -d eval.example.com`

---

## 6. 日常运维

### 更新站点（改完代码后）

```bash
# 本地重新打包
python deploy/make_package.py
# 上传后重新执行部署脚本（幂等，会覆盖站点文件）
scp dist/data_security_site.tar.gz root@<IP>:/root/
ssh root@<IP> -c 'cd /root && tar -xzf data_security_site.tar.gz && cd data_security_site && bash deploy.sh 8080'
```

Docker 方式：`docker compose up -d --build`

### 数据备份与迁移

- 页面右上角 **📦 备份数据** → 导出全部项目 JSON；**📂 导入数据** → 恢复（可合并或替换）；
- 单个项目也可用 **💾 备份项目** 导出 JSON；
- 评估结果可导出 Excel / 完整报告（HTML 可打印为 PDF）。

### 常用命令

```bash
systemctl status nginx          # 状态
systemctl restart nginx         # 重启
nginx -t                        # 校验配置
tail -f /var/log/nginx/error.log
```

---

## 7. 常见问题

| 现象 | 原因与处理 |
|---|---|
| 浏览器打不开、一直转圈 | 安全组没放行端口；或本机防火墙未放行。先 `curl -I http://127.0.0.1:8080/` 确认服务端正常，再查安全组。 |
| 403 Forbidden | 多为 SELinux 拦截：`chcon -R -t httpd_sys_content_t /var/www/data_security` |
| 404 Not Found | 站点文件没复制全。检查 `/var/www/data_security/index.html` 是否存在。 |
| `nginx -t` 报 `duplicate default server` | 已有别的站点占了 80 的 default_server。换端口（`sudo bash deploy.sh 8080`）或删掉冲突配置。 |
| `sudo bash deploy.sh` 报 `bad interpreter: /bin/bash^M` | 脚本被转成了 Windows 行尾。执行：`sed -i 's/\r$//' deploy.sh`（用本仓库 `make_package.py` 打包的版本已是 LF，不会出现）。 |
| 页面能开但图标/图表不显示 | `vendor/` 或 `assets/` 未上传完整，重新解压覆盖。 |
| 换了访问地址后"数据不见了" | localStorage 按地址隔离。回到旧地址导出 JSON，再到新地址导入即可。 |
| 中文文件名下载乱码 | 现代浏览器正常；若异常，升级浏览器或改用 Chrome/Edge。 |

---

## 8. 卸载

**Nginx 方式：**

```bash
rm -f  /etc/nginx/conf.d/data_security.conf
rm -rf /var/www/data_security
systemctl reload nginx
```

**Docker 方式：**

```bash
docker compose down --rmi local
```
