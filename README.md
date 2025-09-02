# VibeProject - 内部项目管理系统

基于NestJS + Prisma + PostgreSQL(Supabase)的现代化项目管理系统，专为50-100人团队设计。

## 🚀 系统特性

### 核心功能
- **用户与权限管理**: 基于RBAC的细粒度权限控制
- **项目管理**: 完整的项目生命周期管理
- **任务管理**: 支持父子任务、依赖关系、多视图展示
- **团队协作**: 实时评论、@提及、文件附件
- **工作流引擎**: 可自定义的任务状态流转
- **时间管理**: 工时记录与团队负荷分析
- **GitLab集成**: 与GitLab项目和Issue双向同步

### 技术亮点
- **TypeScript全栈**: 前后端类型安全
- **Prisma ORM**: 现代化数据库访问层
- **GraphQL API**: 灵活的数据查询
- **实时通信**: WebSocket支持
- **模块化架构**: 易于维护和扩展

## 📋 数据模型设计

### 核心实体关系

```
用户管理体系:
User (用户) ←→ Department (部门) ←→ Team (团队)
  ↓
UserRole ←→ Role ←→ RolePermission ←→ Permission

项目管理体系:
Project (项目) ←→ ProjectMember (项目成员)
  ↓
Task (任务) ←→ TaskDependency (任务依赖)
  ↓
Comment (评论) + Attachment (附件) + TimeLog (工时)

工作流体系:
Workflow (工作流) ←→ WorkflowState (状态) ←→ WorkflowTransition (状态转换)
```

### 权限模型 (RBAC)

**预设角色**:
- `super_admin`: 超级管理员 - 所有权限
- `admin`: 管理员 - 除用户删除外的所有权限  
- `project_manager`: 项目经理 - 项目和任务管理权限
- `member`: 普通成员 - 基础参与权限

**权限分类**:
- 用户管理: `user:create|read|update|delete`
- 项目管理: `project:create|read|update|delete`
- 任务管理: `task:create|read|update|delete|assign`
- 团队管理: `team:create|read|update|delete`
- 时间管理: `timelog:create|read|update|delete`

## 🛠️ 快速开始

### 1. 环境准备

```bash
# 克隆项目
git clone <repository-url>
cd vibe-project

# 安装依赖
npm install
```

### 2. 数据库配置

1. 复制环境变量配置:
```bash
cp env.example .env
```

2. 修改 `.env` 文件中的数据库连接信息:
```env
DATABASE_URL="postgresql://postgres.lbixsgvknepmluguvbss:[YOUR-PASSWORD]@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.lbixsgvknepmluguvbss:[YOUR-PASSWORD]@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres"
```

### 3. 数据库初始化

```bash
# 生成Prisma客户端
npm run db:generate

# 推送数据库结构到Supabase
npm run db:push

# 运行数据种子 (创建初始数据)
npm run db:seed
```

### 4. 启动开发服务器

```bash
# 开发模式启动
npm run start:dev

# 服务将在 http://localhost:3000 启动
```

### 5. 默认登录信息

- **邮箱**: `admin@company.com`
- **密码**: `admin123456`
- **角色**: 超级管理员

## 📊 数据库表结构详解

### 用户权限相关表

| 表名 | 说明 | 核心字段 |
|------|------|----------|
| `users` | 用户基础信息 | email, username, name, departmentId |
| `departments` | 部门组织架构 | name, parentId (支持层级) |
| `teams` | 团队信息 | name, departmentId |
| `team_members` | 团队成员关系 | userId, teamId, role |
| `roles` | 角色定义 | name, description, isSystem |
| `permissions` | 权限定义 | name, resource, action |
| `user_roles` | 用户角色关联 | userId, roleId |
| `role_permissions` | 角色权限关联 | roleId, permissionId |

### 项目任务相关表

| 表名 | 说明 | 核心字段 |
|------|------|----------|
| `projects` | 项目基础信息 | name, key, status, ownerId, teamId |
| `project_members` | 项目成员 | projectId, userId, role |
| `tasks` | 任务信息 | title, status, priority, projectId, assigneeId |
| `task_dependencies` | 任务依赖关系 | dependentTaskId, precedingTaskId |
| `comments` | 任务评论 | content, taskId, authorId, parentId |
| `attachments` | 文件附件 | filename, fileUrl, taskId |
| `time_logs` | 工时记录 | hours, date, taskId, userId |

### 工作流相关表

| 表名 | 说明 | 核心字段 |
|------|------|----------|
| `workflows` | 工作流定义 | name, projectId, isDefault |
| `workflow_states` | 工作流状态 | name, color, order, workflowId |
| `workflow_transitions` | 状态转换规则 | fromStateId, toStateId |

### GitLab集成字段

在相关表中预留了GitLab集成字段:
- `users.gitlabUserId` / `gitlabUsername` / `gitlabToken`
- `projects.gitlabProjectId` / `gitlabProjectUrl`  
- `tasks.gitlabIssueId` / `gitlabIssueUrl`

## 🔄 工作流程设计

### 标准任务流程
1. **待办** (TODO) → **进行中** (IN_PROGRESS) 
2. **进行中** → **待审查** (IN_REVIEW)
3. **待审查** → **已完成** (DONE) 或返回 **进行中**

### 项目状态流程  
1. **规划中** (PLANNING) → **进行中** (ACTIVE)
2. **进行中** → **暂停** (ON_HOLD) 或 **已完成** (COMPLETED)
3. 任何状态 → **已取消** (CANCELLED)

## 🔧 开发命令

```bash
# 数据库相关
npm run db:generate     # 生成Prisma客户端
npm run db:push        # 推送schema到数据库
npm run db:migrate     # 创建数据库迁移
npm run db:studio      # 打开Prisma Studio
npm run db:reset       # 重置数据库
npm run db:seed        # 运行数据种子

# 开发相关  
npm run start:dev      # 开发模式启动
npm run start:debug    # 调试模式启动
npm run build          # 构建生产版本
npm run start:prod     # 生产模式启动

# 代码质量
npm run lint           # 代码检查
npm run format         # 代码格式化
npm run test           # 运行测试
npm run test:e2e       # 端到端测试
```

## 📁 项目结构

```
vibe-project/
├── prisma/
│   ├── schema.prisma          # 数据库Schema定义
│   └── seed.ts               # 初始数据种子
├── src/
│   ├── modules/              # 业务模块
│   │   ├── auth/            # 认证模块
│   │   ├── users/           # 用户管理
│   │   ├── projects/        # 项目管理
│   │   ├── tasks/           # 任务管理
│   │   ├── teams/           # 团队管理
│   │   └── gitlab/          # GitLab集成
│   ├── common/              # 公共模块
│   │   ├── guards/          # 守卫
│   │   ├── decorators/      # 装饰器
│   │   └── filters/         # 过滤器
│   ├── config/              # 配置
│   └── main.ts             # 应用入口
├── package.json
├── tsconfig.json
└── README.md
```

## 🔗 集成说明

### GitLab集成功能
- **用户同步**: 通过GitLab Token获取用户信息
- **项目关联**: 项目可关联GitLab项目，同步基础信息
- **Issue同步**: 任务可关联GitLab Issue，实现双向同步
- **权限映射**: GitLab项目权限映射到系统内部权限

### 扩展集成
系统架构设计支持与以下系统集成:
- **钉钉/企业微信**: 消息通知、用户同步
- **Jira**: 任务数据迁移与同步
- **Confluence**: 文档管理集成
- **Jenkins/GitLab CI**: 构建状态同步

## 📈 开发进展状态

### ✅ 已完成功能 (90%)

#### 核心业务模块
- ✅ **用户认证系统**: JWT认证、RBAC权限、角色管理
- ✅ **用户管理模块**: 用户CRUD、组织架构、权限分配
- ✅ **项目管理模块**: 项目CRUD、成员管理、权限控制
- ✅ **任务管理模块**: 任务CRUD、层级关系、依赖管理
- ✅ **Issue管理模块**: 产品建议、状态流转、业务评估
- ✅ **PRD管理模块**: 文档管理、版本控制、评审流程
- ✅ **团队管理模块**: 团队CRUD、成员管理、统计分析
- ✅ **评论协作系统**: 任务评论、Issue讨论、回复功能
- ✅ **文件管理系统**: 附件上传、关联管理、权限控制
- ✅ **工作流引擎**: 状态定义、转换规则、权限验证

#### 技术架构
- ✅ **数据库设计**: 24张表完整关系模型
- ✅ **GraphQL API**: 60+个查询变更接口
- ✅ **权限系统**: 25个细分权限点
- ✅ **数据种子**: 完整的初始测试数据

#### 前端系统
- ✅ **前端架构**: Next.js + TypeScript + Tailwind CSS
- ✅ **UI组件库**: 基于shadcn/ui的企业级组件
- ✅ **页面模块**: Issues管理、任务看板、人员管理
- ✅ **响应式设计**: 移动端适配完成

### 🚧 进行中功能 (10%)

#### 高级功能
- 🔄 **实时通信**: WebSocket消息推送 (70%完成)
- 🔄 **通知系统**: 邮件和站内通知 (60%完成)
- 🔄 **数据统计**: 项目分析报表 (40%完成)

#### 集成功能
- 🔄 **GitLab集成**: Issue双向同步 (30%完成)
- ⏳ **第三方集成**: 钉钉/企业微信集成
- ⏳ **移动端API**: 移动应用支持

### 📋 规划功能

#### 企业级功能
- ⏳ **多租户架构**: 企业级部署支持
- ⏳ **API网关**: RESTful API + 限流控制
- ⏳ **系统监控**: 性能监控与日志分析
- ⏳ **数据备份**: 自动备份与恢复机制

## 🤝 贡献指南

1. Fork 项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开 Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情

---

## 联系方式

如有问题或建议，请提交 Issue 或联系开发团队。

**让项目管理更高效，让团队协作更顺畅！** 🎯

