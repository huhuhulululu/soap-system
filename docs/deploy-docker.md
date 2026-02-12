# 服务器 Docker 部署与更新

前端通过 Docker 运行在服务器上时，每次代码 push 后需要在服务器上拉代码并重建镜像。

## 首次部署（服务器上）

```bash
# 克隆（若尚未克隆）
git clone https://github.com/huhuhulululu/soap-system.git
cd soap-system
git checkout clean-release

# 用 docker-compose 构建并启动
docker compose up -d --build
```

前端将监听 80 端口。

## 日常更新（代码 push 后）

SSH 登录服务器后执行：

```bash
cd /path/to/soap-system   # 换成你服务器上的项目路径
git pull origin clean-release
docker compose up -d --build
```

`--build` 会重新构建镜像（包含最新前端），`-d` 后台运行，容器会使用新镜像重启，前端即更新。

## 仅用 Docker 命令（不用 docker-compose）

```bash
cd /path/to/soap-system
git pull origin clean-release
docker build -f frontend/Dockerfile -t soap-frontend .
docker stop soap-frontend 2>/dev/null; docker rm soap-frontend 2>/dev/null
docker run -d -p 80:80 --name soap-frontend --restart unless-stopped soap-frontend
```

## 一键更新脚本（可选）

在服务器上保存为 `update.sh`，放在项目根目录：

```bash
#!/bin/bash
set -e
cd "$(dirname "$0")"
git pull origin clean-release
docker compose up -d --build
echo "Frontend updated."
```

之后更新只需：`./update.sh`
