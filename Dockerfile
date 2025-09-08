# 生产环境 Dockerfile
FROM node:18-alpine AS base

# 安装依赖阶段
FROM base AS deps
WORKDIR /app

# 复制依赖文件
COPY package*.json ./
COPY prisma ./prisma/

# 安装依赖
RUN npm ci --only=production && npm cache clean --force

# 构建阶段
FROM base AS builder
WORKDIR /app

# 复制依赖文件
COPY package*.json ./
COPY prisma ./prisma/

# 安装所有依赖 (包括开发依赖)
RUN npm ci

# 复制源代码
COPY . .

# 生成 Prisma 客户端
RUN npm run db:generate

# 构建应用
RUN npm run build

# 运行阶段
FROM base AS runner
WORKDIR /app

# 创建非 root 用户
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nestjs

# 复制生产依赖
COPY --from=deps --chown=nestjs:nodejs /app/node_modules ./node_modules

# 复制构建结果
COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/prisma ./prisma

# 复制必要文件
COPY --chown=nestjs:nodejs package*.json ./

# 创建上传目录
RUN mkdir -p uploads && chown nestjs:nodejs uploads

# 切换到非 root 用户
USER nestjs

# 暴露端口
EXPOSE 3000

# 设置环境变量
ENV NODE_ENV=production
ENV PORT=3000

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

# 启动应用
CMD ["node", "dist/main"]


