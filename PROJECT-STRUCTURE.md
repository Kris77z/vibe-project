# 📁 项目架构与文件结构

## 🏗️ 整体架构

```
vibe-project/                           # 项目根目录
├── 📄 配置文件
│   ├── package.json                    # 项目依赖和脚本
│   ├── tsconfig.json                   # TypeScript配置
│   ├── nest-cli.json                   # NestJS CLI配置
│   ├── .env                           # 环境变量 (需要创建)
│   └── env.example                     # 环境变量模板
│
├── 📊 数据库
│   ├── prisma/
│   │   ├── schema.prisma              # 数据库Schema定义
│   │   └── seed.ts                    # 初始数据种子
│
├── 📚 文档
│   ├── README.md                      # 项目总览
│   ├── QUICKSTART.md                  # 快速启动指南
│   ├── BACKEND-COMPLETE.md            # 后端功能完成报告
│   ├── PROJECT-STRUCTURE.md           # 项目结构说明 (本文件)
│   ├── test-api.http                  # API测试文件
│   └── docs/                          # 业务文档
│       ├── flow.md                    # 业务流程图
│       └── startup.md                 # 项目规划文档
│
└── 💻 源代码
    └── src/
        ├── main.ts                    # 应用入口点
        ├── app.module.ts              # 根模块
        │
        ├── 🔧 公共模块 (common/)
        │   ├── prisma/                # 数据库服务
        │   │   ├── prisma.module.ts
        │   │   └── prisma.service.ts
        │   ├── dto/                   # 数据传输对象
        │   │   └── pagination.dto.ts
        │   ├── filters/               # 异常过滤器
        │   │   └── http-exception.filter.ts
        │   ├── interceptors/          # 拦截器
        │   │   └── logging.interceptor.ts
        │   ├── types/                 # 类型定义
        │   │   └── graphql.types.ts
        │   └── utils/                 # 工具函数
        │       ├── date.utils.ts
        │       └── string.utils.ts
        │
        ├── ⚙️ 配置模块 (config/)
        │   ├── app.config.ts          # 应用配置
        │   ├── database.config.ts     # 数据库配置
        │   ├── jwt.config.ts          # JWT配置
        │   └── gitlab.config.ts       # GitLab集成配置
        │
        └── 🏢 业务模块 (modules/)
            ├── auth/                  # 认证模块
            │   ├── auth.module.ts
            │   ├── auth.service.ts
            │   ├── auth.resolver.ts
            │   ├── strategies/        # 认证策略
            │   │   ├── jwt.strategy.ts
            │   │   └── local.strategy.ts
            │   ├── guards/            # 守卫
            │   │   ├── jwt-auth.guard.ts
            │   │   ├── permissions.guard.ts
            │   │   └── roles.guard.ts
            │   └── decorators/        # 装饰器
            │       ├── current-user.decorator.ts
            │       ├── permissions.decorator.ts
            │       └── roles.decorator.ts
            │
            ├── users/                 # 用户管理
            │   ├── users.module.ts
            │   ├── users.service.ts
            │   └── users.resolver.ts
            │
            ├── projects/              # 项目管理
            │   ├── projects.module.ts
            │   ├── projects.service.ts
            │   └── projects.resolver.ts
            │
            ├── tasks/                 # 任务管理
            │   ├── tasks.module.ts
            │   ├── tasks.service.ts
            │   └── tasks.resolver.ts
            │
            ├── teams/                 # 团队管理
            │   ├── teams.module.ts
            │   ├── teams.service.ts
            │   └── teams.resolver.ts
            │
            └── gitlab/                # GitLab集成
                ├── gitlab.module.ts
                ├── gitlab.service.ts
                └── gitlab.controller.ts
```

## 🎯 模块说明

### 核心模块

#### 1. 认证模块 (`auth/`)
- **功能**: JWT认证、用户登录注册、权限验证
- **关键文件**:
  - `auth.service.ts`: 认证业务逻辑
  - `jwt.strategy.ts`: JWT策略
  - `permissions.guard.ts`: 权限守卫
- **API**: 登录、注册、获取当前用户、刷新Token

#### 2. 用户管理 (`users/`)
- **功能**: 用户CRUD、角色分配、权限管理
- **特性**: RBAC权限控制、用户统计、批量操作
- **API**: 用户列表、创建用户、更新角色、用户统计

#### 3. 项目管理 (`projects/`)
- **功能**: 项目生命周期管理、成员管理、权限控制
- **特性**: 项目成员角色、GitLab集成、项目统计
- **API**: 项目CRUD、成员管理、项目统计

#### 4. 任务管理 (`tasks/`)
- **功能**: 任务CRUD、层级关系、依赖管理、评论系统
- **特性**: 父子任务、任务依赖、工时记录、状态流转
- **API**: 任务CRUD、依赖管理、评论系统

#### 5. 团队管理 (`teams/`)
- **功能**: 团队组织、成员管理、角色分配
- **特性**: 部门关联、成员角色、团队统计
- **API**: 团队CRUD、成员管理、团队统计

#### 6. GitLab集成 (`gitlab/`)
- **功能**: GitLab API集成、项目同步、Issue同步
- **特性**: 双向同步、Webhook支持、用户映射
- **API**: 项目同步、Issue管理、用户信息

### 配置模块

#### 1. 应用配置 (`app.config.ts`)
- 端口、环境、CORS设置
- 文件上传配置
- 分页和速率限制配置

#### 2. 数据库配置 (`database.config.ts`)
- Supabase连接配置
- 连接池设置
- 查询日志配置

#### 3. JWT配置 (`jwt.config.ts`)
- 密钥和过期时间
- 刷新Token配置
- 签发者和受众配置

#### 4. GitLab配置 (`gitlab.config.ts`)
- GitLab API配置
- Webhook配置
- 同步和映射配置

### 公共模块

#### 1. 数据库服务 (`common/prisma/`)
- Prisma客户端封装
- 连接管理
- 数据库清理工具

#### 2. 工具函数 (`common/utils/`)
- **日期工具**: 工作日计算、日期格式化
- **字符串工具**: 随机字符串、格式转换、验证

#### 3. 异常处理 (`common/filters/`)
- GraphQL异常过滤器
- 统一错误响应格式

#### 4. 日志记录 (`common/interceptors/`)
- GraphQL操作日志
- 性能监控
- 用户操作追踪

## 📊 数据模型架构

### 用户权限体系
```
Department (部门) 
    ↓
Team (团队) ←→ TeamMember (团队成员)
    ↓
User (用户) ←→ UserRole (用户角色) ←→ Role (角色)
                                       ↓
                              RolePermission (角色权限)
                                       ↓
                              Permission (权限)
```

### 项目任务体系
```
Project (项目) ←→ ProjectMember (项目成员)
    ↓
Workflow (工作流) ←→ WorkflowState (工作流状态)
    ↓
Task (任务) ←→ TaskDependency (任务依赖)
    ↓
Comment (评论) + Attachment (附件) + TimeLog (工时记录)
```

## 🔐 权限系统架构

### 角色层级
1. **super_admin** - 超级管理员
2. **admin** - 管理员  
3. **project_manager** - 项目经理
4. **member** - 普通成员

### 权限分类
- **用户管理**: `user:create|read|update|delete`
- **项目管理**: `project:create|read|update|delete`
- **任务管理**: `task:create|read|update|delete|assign`
- **团队管理**: `team:create|read|update|delete`
- **时间管理**: `timelog:create|read|update|delete`

### 权限验证流程
```
请求 → JWT守卫 → 权限守卫 → 业务逻辑
                    ↓
            检查用户角色权限
                    ↓
            验证资源访问权限
```

## 🔄 API架构

### GraphQL Schema
- **类型安全**: TypeScript + GraphQL自动生成
- **灵活查询**: 支持深度关联和按需获取
- **权限控制**: 基于装饰器的细粒度权限验证
- **分页查询**: 统一的分页、筛选、排序接口

### RESTful API (GitLab集成)
- **项目同步**: `/api/gitlab/sync/project`
- **Issue管理**: `/api/gitlab/projects/:id/issues`
- **用户信息**: `/api/gitlab/user`
- **连接验证**: `/api/gitlab/validate`

## 🚀 部署架构

### 开发环境
```
localhost:3000 (NestJS)
    ↓
Supabase (PostgreSQL)
    ↓
GitLab API (可选)
```

### 生产环境建议
```
Load Balancer
    ↓
NestJS Cluster (多实例)
    ↓
Supabase/PostgreSQL (主从)
    ↓
Redis (缓存/会话)
    ↓
GitLab/外部服务
```

## 📈 扩展规划

### 短期扩展
1. **文件上传**: 任务附件、用户头像
2. **实时通知**: WebSocket消息推送
3. **邮件通知**: SMTP集成
4. **数据导出**: Excel/PDF报表

### 中期扩展
1. **工作流引擎**: 自定义状态流转
2. **批量操作**: 任务批量处理
3. **API文档**: Swagger/GraphQL文档
4. **性能监控**: APM集成

### 长期扩展
1. **微服务拆分**: 按业务模块拆分
2. **多租户**: SaaS模式支持
3. **移动端**: React Native/Flutter
4. **AI辅助**: 智能任务分配、进度预测

---

这个架构设计支持50-100人团队规模，具备良好的扩展性和维护性。所有模块都遵循单一职责原则，便于后续的功能扩展和性能优化。
