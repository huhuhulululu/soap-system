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
# AChecker Vue SPA
COPY --from=builder /app/frontend/dist /usr/share/nginx/html
# 公司主页 + Portal 静态页面
COPY company-site/ /usr/share/nginx/html/site/
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
RUN chown -R nginx:nginx /usr/share/nginx/html /var/cache/nginx /var/log/nginx \
    && touch /var/run/nginx.pid && chown nginx:nginx /var/run/nginx.pid
USER nginx

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://localhost:8080/ || exit 1

EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
