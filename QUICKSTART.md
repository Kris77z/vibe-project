# 🚀 快速启动指南

按照以下步骤快速搭建和运行VibeProject项目管理系统。

## 📋 前置要求

- Node.js (>= 18.0.0)
- npm (>= 9.0.0)
- Git
- Supabase 账号 (或PostgreSQL数据库)

## ⚡ 快速开始 (5分钟启动)

### 1. 项目初始化

```bash
# 创建项目目录
mkdir vibe-project
cd vibe-project

# 初始化npm项目
npm init -y

# 安装依赖包
npm install @nestjs/common @nestjs/core @nestjs/platform-express @nestjs/config @nestjs/jwt @nestjs/passport @nestjs/graphql @nestjs/apollo @nestjs/websockets @nestjs/platform-socket.io @prisma/client apollo-server-express graphql graphql-tools passport passport-jwt passport-local bcryptjs class-validator class-transformer socket.io reflect-metadata rxjs

# 安装开发依赖
npm install --save-dev @nestjs/cli @nestjs/schematics @nestjs/testing @types/express @types/jest @types/node @types/supertest @types/bcryptjs @types/passport-jwt @types/passport-local @typescript-eslint/eslint-plugin @typescript-eslint/parser eslint eslint-config-prettier eslint-plugin-prettier jest prettier prisma source-map-support supertest ts-jest ts-loader ts-node tsconfig-paths typescript
```

### 2. 环境配置

创建 `.env` 文件：

```bash
# 复制环境变量模板
cp env.example .env
```

编辑 `.env` 文件，填入您的Supabase数据库连接信息：

```env
# 将 [YOUR-PASSWORD] 替换为您的实际密码
DATABASE_URL="postgresql://postgres.lbixsgvknepmluguvbss:[YOUR-PASSWORD]@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.lbixsgvknepmluguvbss:[YOUR-PASSWORD]@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres"

JWT_SECRET="your-super-secret-jwt-key-please-change-this"
JWT_EXPIRES_IN="7d"
PORT=3000
NODE_ENV="development"
```

### 3. 数据库设置

```bash
# 生成Prisma客户端
npm run db:generate

# 推送数据库结构到Supabase (首次使用推荐)
npm run db:push

# 或者使用迁移方式 (生产环境推荐)
# npm run db:migrate

# 初始化种子数据
npm run db:seed
```

### 4. 启动服务

```bash
# 开发模式启动
npm run start:dev
```

如果看到以下输出，说明启动成功：

```
🗄️  数据库连接成功
🚀 应用启动成功！
📡 服务地址: http://localhost:3000
📊 GraphQL Playground: http://localhost:3000/graphql
🔗 API文档: http://localhost:3000/api
```

### 5. 验证安装

打开浏览器访问：
- **GraphQL Playground**: http://localhost:3000/graphql
- **API接口**: http://localhost:3000/api

默认管理员账号：
- 邮箱: `admin@company.com`
- 密码: `admin123456`

## 🔧 常用开发命令

```bash
# 开发相关
npm run start:dev      # 开发模式 (文件变化自动重启)
npm run start:debug    # 调试模式
npm run build          # 构建生产版本
npm run start:prod     # 生产模式启动

# 数据库相关
npm run db:generate    # 生成Prisma客户端
npm run db:push        # 推送schema变更 (开发环境)
npm run db:migrate     # 创建并应用迁移 (生产环境)
npm run db:studio      # 打开Prisma Studio数据浏览器
npm run db:seed        # 重新运行种子数据
npm run db:reset       # 重置数据库 (危险操作!)

# 代码质量
npm run lint           # ESLint代码检查
npm run format         # Prettier代码格式化
npm run test           # 运行单元测试
npm run test:e2e       # 运行端到端测试
```

## 📊 Prisma Studio

想要可视化查看和编辑数据库内容？

```bash
npm run db:studio
```

这将在浏览器中打开 Prisma Studio (通常在 http://localhost:5555)，您可以：
- 浏览所有数据表
- 查看和编辑数据
- 执行复杂查询

## 🐛 常见问题

### 1. 数据库连接失败

**错误**: `Error: P1001: Can't reach database server`

**解决**:
- 检查 `.env` 文件中的数据库URL是否正确
- 确认Supabase项目是否正常运行
- 验证网络连接

### 2. Prisma客户端错误

**错误**: `@prisma/client did not initialize yet`

**解决**:
```bash
npm run db:generate
```

### 3. 端口冲突

**错误**: `Error: listen EADDRINUSE: address already in use :::3000`

**解决**:
- 修改 `.env` 文件中的 `PORT` 值
- 或者停止占用3000端口的进程

### 4. JWT密钥警告

**警告**: 使用默认JWT密钥

**解决**:
- 在 `.env` 中设置强随机的 `JWT_SECRET`
- 推荐使用32字符以上的随机字符串

## 🔄 数据重置

如果需要重新开始：

```bash
# 重置数据库到初始状态
npm run db:reset

# 重新运行种子数据
npm run db:seed
```

⚠️ **警告**: `db:reset` 会删除所有数据，请谨慎使用！

## 📈 下一步

1. **熟悉GraphQL API**: 访问 http://localhost:3000/graphql
2. **查看数据结构**: 运行 `npm run db:studio`
3. **阅读完整文档**: 查看 [README.md](README.md)
4. **开发前端界面**: 基于GraphQL API开发React前端

## 🆘 获取帮助

如果遇到问题：
1. 查看控制台错误信息
2. 检查 `.env` 配置
3. 确认数据库连接
4. 提交Issue到项目仓库

祝您使用愉快！🎉
