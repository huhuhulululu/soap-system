# 在仓库根目录构建: docker build -f frontend/Dockerfile .
# 前端构建依赖 ../src（whitelist、medical-history-engine 等）
FROM node:20-alpine AS builder
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json* ./frontend/
COPY . .
WORKDIR /app/frontend
RUN npm ci
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/frontend/dist /usr/share/nginx/html
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
