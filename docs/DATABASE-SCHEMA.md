# 🗄️ 数据库表结构详细文档

## 📊 数据库概览

- **数据库类型**: PostgreSQL (Supabase托管)
- **ORM工具**: Prisma
- **表总数**: 40张核心业务表（与 Prisma schema 同步）
- **字段总数**: 200+ 个业务字段
- **关系总数**: 80+ 个表间关联关系

## 📋 表分类统计

| 分类 | 表数量 | 主要功能 |
|------|---------|----------|
| 用户与权限管理 | 9张表 | 用户、公司、部门、团队、角色权限 |
| 字段定义与可见性 | 6张表 | 字段分级、字段集、字段值（EAV）、个体可见性、临时授权 |
| 人员档案明细 | 8张表 | 教育、工作、家庭、紧急联系人、合同、证件、银行卡、档案附件引用 |
| 项目任务管理 | 7张表 | 项目、成员、任务、依赖、评论、附件、工时 |
| Issue产品管理 | 5张表 | Issue、评论、标签、PRD、PRD评审 |
| 工作流管理 | 3张表 | 工作流、状态、状态转换 |
| 通知系统 | 1张表 | 站内通知 |
| 请假与余额 | 1张表 | 假期事务与余额聚合（事务表） |

## 🏗️ 详细表结构

### 一、用户与权限管理（与 schema.prisma 对齐）

#### 1. users - 用户表（User）
```sql
CREATE TABLE users (
  id              VARCHAR PRIMARY KEY DEFAULT cuid(),
  email           VARCHAR UNIQUE NOT NULL,      -- 用户邮箱（登录账号）
  username        VARCHAR UNIQUE NOT NULL,      -- 用户名
  name            VARCHAR NOT NULL,             -- 真实姓名
  password        VARCHAR NOT NULL,             -- 加密密码
  avatar          VARCHAR,                      -- 头像URL
  phone           VARCHAR,                      -- 手机号码
  is_active       BOOLEAN DEFAULT true,         -- 账户状态
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  
  -- 组织关系与公司
  department_id   VARCHAR,                      -- 所属部门ID
  company_id      VARCHAR,                      -- 所属公司（硬边界）

  -- GitLab集成字段（可选）
  gitlab_user_id  INTEGER,                      -- GitLab用户ID
  gitlab_username VARCHAR,                      -- GitLab用户名
  gitlab_token    VARCHAR,                      -- GitLab访问令牌（加密）
  
  FOREIGN KEY (department_id) REFERENCES departments(id)
);
```

> 可见性与字段分级相关扩展（新增）

#### 1.1 field_definitions - 字段定义
```sql
CREATE TABLE field_definitions (
  id              VARCHAR PRIMARY KEY DEFAULT cuid(),
  key             VARCHAR UNIQUE NOT NULL,        -- 字段键，如 contact_phone
  label           VARCHAR NOT NULL,               -- 字段显示名
  classification  VARCHAR NOT NULL,               -- PUBLIC/INTERNAL/SENSITIVE/HIGHLY_SENSITIVE
  self_editable   BOOLEAN DEFAULT false,          -- 是否用户可自编辑
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
```

#### 1.2 field_sets - 字段集
```sql
CREATE TABLE field_sets (
  id           VARCHAR PRIMARY KEY DEFAULT cuid(),
  name         VARCHAR UNIQUE NOT NULL,           -- 字段集名称
  description  VARCHAR,                           -- 说明
  is_system    BOOLEAN DEFAULT false,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
```

#### 1.3 field_set_items - 字段集项
```sql
CREATE TABLE field_set_items (
  id              VARCHAR PRIMARY KEY DEFAULT cuid(),
  set_id          VARCHAR NOT NULL,
  field_key       VARCHAR NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  FOREIGN KEY (set_id) REFERENCES field_sets(id) ON DELETE CASCADE
);
```

#### 1.4 temporary_access_grants - 临时字段访问授权
```sql
CREATE TABLE temporary_access_grants (
  id                  VARCHAR PRIMARY KEY DEFAULT cuid(),
  grantee_user_id     VARCHAR NOT NULL,        -- 被授权用户
  resource            VARCHAR NOT NULL,        -- 资源，如 'user'
  field_key           VARCHAR NOT NULL,        -- 授权字段
  action              VARCHAR NOT NULL,        -- read
  start_at            TIMESTAMPTZ NOT NULL,
  end_at              TIMESTAMPTZ NOT NULL,
  allow_cross_boundary BOOLEAN DEFAULT false,  -- 是否允许跨组织边界
  scope_department_id VARCHAR,                 -- 限定范围的部门
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  FOREIGN KEY (grantee_user_id) REFERENCES users(id),
  FOREIGN KEY (scope_department_id) REFERENCES departments(id)
);
```

#### 1.5 user_visibility - 用户可见性
```sql
CREATE TABLE user_visibility (
  user_id     VARCHAR PRIMARY KEY,             -- 目标用户
  hidden      BOOLEAN DEFAULT false,           -- 是否被隐藏
  view_scope  VARCHAR DEFAULT 'COMPANY',       -- 可见范围 COMPANY/DEPARTMENT/SELF
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

#### 1.6 departments 扩展：负责人列表
> 当前实现采用数组字段存储负责人ID列表（schema 中为 `leaderUserIds String[]`）。

**索引设计**:
- `UNIQUE INDEX` on `email`
- `UNIQUE INDEX` on `username`
- `INDEX` on `department_id`
- `INDEX` on `is_active`

**关联关系**:
- → `departments` (多对一): 用户所属部门
- ← `user_roles` (一对多): 用户角色关联
- ← `team_members` (一对多): 团队成员关系
- ← `projects` (一对多): 拥有的项目
- ← `tasks` (一对多): 分配的任务

#### 2. departments - 部门表
```sql
CREATE TABLE departments (
  id          VARCHAR PRIMARY KEY DEFAULT cuid(),
  name        VARCHAR NOT NULL,                 -- 部门名称
  description VARCHAR,                          -- 部门描述
  parent_id   VARCHAR,                          -- 父级部门ID (支持层级)
  is_active   BOOLEAN DEFAULT true,             -- 部门状态
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  
  FOREIGN KEY (parent_id) REFERENCES departments(id)
);
```

**特殊设计**:
- 支持无限层级的部门结构
- 自引用外键实现组织架构树

#### 3. teams - 团队表
```sql
CREATE TABLE teams (
  id            VARCHAR PRIMARY KEY DEFAULT cuid(),
  name          VARCHAR NOT NULL,               -- 团队名称
  description   VARCHAR,                        -- 团队描述
  department_id VARCHAR,                        -- 所属部门
  is_active     BOOLEAN DEFAULT true,           -- 团队状态
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  
  FOREIGN KEY (department_id) REFERENCES departments(id)
);
```

#### 4. team_members - 团队成员关系表
```sql
CREATE TABLE team_members (
  id        VARCHAR PRIMARY KEY DEFAULT cuid(),
  user_id   VARCHAR NOT NULL,                   -- 用户ID
  team_id   VARCHAR NOT NULL,                   -- 团队ID
  role      team_member_role DEFAULT 'MEMBER',  -- 团队角色 (LEADER/MEMBER)
  joined_at TIMESTAMPTZ DEFAULT NOW(),          -- 加入时间
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
  UNIQUE(user_id, team_id)                      -- 复合唯一索引
);
```

#### 5. roles - 角色表
```sql
CREATE TABLE roles (
  id          VARCHAR PRIMARY KEY DEFAULT cuid(),
  name        VARCHAR UNIQUE NOT NULL,          -- 角色名称
  description VARCHAR,                          -- 角色描述
  is_system   BOOLEAN DEFAULT false,            -- 是否系统预设角色
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);
```

**预设角色**:
- `super_admin`: 超级管理员
- `admin`: 管理员
- `project_manager`: 项目经理
- `member`: 普通成员

#### 6. permissions - 权限表
```sql
CREATE TABLE permissions (
  id          VARCHAR PRIMARY KEY DEFAULT cuid(),
  name        VARCHAR UNIQUE NOT NULL,          -- 权限名称
  resource    VARCHAR NOT NULL,                 -- 资源名称 (user/project/task)
  action      VARCHAR NOT NULL,                 -- 操作类型 (create/read/update/delete)
  description VARCHAR,                          -- 权限描述
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(resource, action)                      -- 资源+操作唯一
);
```

**权限设计**:
```
用户管理: user:create, user:read, user:update, user:delete
项目管理: project:create, project:read, project:update, project:delete
任务管理: task:create, task:read, task:update, task:delete, task:assign
团队管理: team:create, team:read, team:update, team:delete
时间管理: timelog:create, timelog:read, timelog:update, timelog:delete
Issue管理: issue:create, issue:read, issue:update, issue:delete
PRD管理: prd:create, prd:read, prd:update, prd:delete, prd:review
```

#### 7. user_roles - 用户角色关联表
```sql
CREATE TABLE user_roles (
  id          VARCHAR PRIMARY KEY DEFAULT cuid(),
  user_id     VARCHAR NOT NULL,                 -- 用户ID
  role_id     VARCHAR NOT NULL,                 -- 角色ID
  assigned_at TIMESTAMPTZ DEFAULT NOW(),        -- 分配时间
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
  UNIQUE(user_id, role_id)                      -- 用户角色唯一
);
```

#### 8. role_permissions - 角色权限关联表
```sql
CREATE TABLE role_permissions (
  id            VARCHAR PRIMARY KEY DEFAULT cuid(),
  role_id       VARCHAR NOT NULL,               -- 角色ID
  permission_id VARCHAR NOT NULL,               -- 权限ID
  assigned_at   TIMESTAMPTZ DEFAULT NOW(),      -- 分配时间
  
  FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
  FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE,
  UNIQUE(role_id, permission_id)                -- 角色权限唯一
);
```

### 二、项目任务管理（与 schema.prisma 对齐）

#### 9. projects - 项目表
```sql
CREATE TABLE projects (
  id          VARCHAR PRIMARY KEY DEFAULT cuid(),
  name        VARCHAR NOT NULL,                 -- 项目名称
  key         VARCHAR UNIQUE NOT NULL,          -- 项目唯一标识 (如 PROJ001)
  description VARCHAR,                          -- 项目描述
  status      project_status DEFAULT 'PLANNING', -- 项目状态（PLANNING/ACTIVE/ON_HOLD/COMPLETED/CANCELLED）
  priority    priority DEFAULT 'MEDIUM',        -- 项目优先级（LOW/MEDIUM/HIGH/URGENT）
  start_date  TIMESTAMPTZ,                      -- 开始时间
  end_date    TIMESTAMPTZ,                      -- 结束时间
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  
  -- 负责人和团队
  owner_id    VARCHAR NOT NULL,                 -- 项目负责人
  team_id     VARCHAR,                          -- 所属团队
  
  -- GitLab集成
  gitlab_project_id  INTEGER,                  -- GitLab项目ID
  gitlab_project_url VARCHAR,                  -- GitLab项目URL
  
  FOREIGN KEY (owner_id) REFERENCES users(id),
  FOREIGN KEY (team_id) REFERENCES teams(id)
);
```

**项目状态枚举**:
- `PLANNING`: 规划中
- `ACTIVE`: 进行中
- `ON_HOLD`: 暂停
- `COMPLETED`: 已完成
- `CANCELLED`: 已取消

#### 10. project_members - 项目成员关系表
```sql
CREATE TABLE project_members (
  id         VARCHAR PRIMARY KEY DEFAULT cuid(),
  project_id VARCHAR NOT NULL,                  -- 项目ID
  user_id    VARCHAR NOT NULL,                  -- 用户ID
  role       project_member_role DEFAULT 'MEMBER', -- 项目角色
  joined_at  TIMESTAMPTZ DEFAULT NOW(),         -- 加入时间
  
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(project_id, user_id)                   -- 项目成员唯一
);
```

**项目成员角色**:
- `ADMIN`: 项目管理员
- `MEMBER`: 项目成员
- `VIEWER`: 查看者

#### 11. tasks - 任务表
```sql
CREATE TABLE tasks (
  id              VARCHAR PRIMARY KEY DEFAULT cuid(),
  title           VARCHAR NOT NULL,             -- 任务标题
  description     VARCHAR,                      -- 任务描述
  status          task_status DEFAULT 'TODO',   -- 任务状态（TODO/IN_PROGRESS/IN_REVIEW/DONE/CANCELLED）
  priority        priority DEFAULT 'MEDIUM',    -- 任务优先级（LOW/MEDIUM/HIGH/URGENT）
  start_date      TIMESTAMPTZ,                  -- 开始时间
  due_date        TIMESTAMPTZ,                  -- 截止时间
  estimated_hours DECIMAL,                      -- 预估工时
  actual_hours    DECIMAL,                      -- 实际工时
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  
  -- 关联关系
  project_id      VARCHAR NOT NULL,             -- 所属项目
  assignee_id     VARCHAR,                      -- 分配给
  creator_id      VARCHAR NOT NULL,             -- 创建者
  parent_id       VARCHAR,                      -- 父任务ID (支持子任务)
  issue_id        VARCHAR,                      -- 关联的Issue
  
  -- GitLab集成
  gitlab_issue_id  INTEGER,                    -- GitLab Issue ID
  gitlab_issue_url VARCHAR,                    -- GitLab Issue URL
  
  -- 工作流
  workflow_state_id VARCHAR,                   -- 工作流状态
  
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (assignee_id) REFERENCES users(id),
  FOREIGN KEY (creator_id) REFERENCES users(id),
  FOREIGN KEY (parent_id) REFERENCES tasks(id),
  FOREIGN KEY (issue_id) REFERENCES issues(id),
  FOREIGN KEY (workflow_state_id) REFERENCES workflow_states(id)
);
```

**任务状态枚举**:
- `TODO`: 待办
- `IN_PROGRESS`: 进行中
- `IN_REVIEW`: 待审查
- `DONE`: 已完成
- `CANCELLED`: 已取消

#### 12. task_dependencies - 任务依赖关系表
```sql
CREATE TABLE task_dependencies (
  id                VARCHAR PRIMARY KEY DEFAULT cuid(),
  dependent_task_id VARCHAR NOT NULL,           -- 依赖任务ID
  preceding_task_id VARCHAR NOT NULL,           -- 前置任务ID
  dependency_type   dependency_type DEFAULT 'FINISH_TO_START', -- 依赖类型
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  
  FOREIGN KEY (dependent_task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  FOREIGN KEY (preceding_task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  UNIQUE(dependent_task_id, preceding_task_id)  -- 依赖关系唯一
);
```

**依赖类型枚举**:
- `FINISH_TO_START`: 前置任务完成后，当前任务才能开始
- `START_TO_START`: 前置任务开始后，当前任务才能开始
- `FINISH_TO_FINISH`: 前置任务完成后，当前任务才能完成
- `START_TO_FINISH`: 前置任务开始后，当前任务才能完成

#### 13. comments - 评论表
```sql
CREATE TABLE comments (
  id         VARCHAR PRIMARY KEY DEFAULT cuid(),
  content    TEXT NOT NULL,                     -- 评论内容
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- 关联关系
  task_id    VARCHAR NOT NULL,                  -- 任务ID
  author_id  VARCHAR NOT NULL,                  -- 评论作者
  parent_id  VARCHAR,                           -- 回复的评论ID
  
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_id) REFERENCES comments(id)
);
```

#### 14. attachments - 附件表
```sql
CREATE TABLE attachments (
  id          VARCHAR PRIMARY KEY DEFAULT cuid(),
  filename    VARCHAR NOT NULL,                 -- 文件名
  file_url    VARCHAR NOT NULL,                 -- 文件URL
  file_size   INTEGER NOT NULL,                 -- 文件大小(字节)
  mime_type   VARCHAR NOT NULL,                 -- 文件类型
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  
  -- 关联关系 (支持多种实体)
  task_id     VARCHAR,                          -- 任务附件
  issue_id    VARCHAR,                          -- Issue附件
  uploader_id VARCHAR NOT NULL,                 -- 上传者
  
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  FOREIGN KEY (issue_id) REFERENCES issues(id) ON DELETE CASCADE,
  FOREIGN KEY (uploader_id) REFERENCES users(id)
);
```

#### 15. time_logs - 工时记录表
```sql
CREATE TABLE time_logs (
  id          VARCHAR PRIMARY KEY DEFAULT cuid(),
  description VARCHAR,                          -- 工时描述
  hours       DECIMAL NOT NULL,                 -- 工时(小时)
  date        DATE NOT NULL,                    -- 日期
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  
  -- 关联关系
  task_id     VARCHAR NOT NULL,                 -- 任务ID
  user_id     VARCHAR NOT NULL,                 -- 用户ID
  
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

### 三、Issue产品管理（与 schema.prisma 对齐）

#### 16. issues - Issue表 (产品建议)
```sql
CREATE TABLE issues (
  id               VARCHAR PRIMARY KEY DEFAULT cuid(),
  title            VARCHAR NOT NULL,             -- Issue标题
  description      TEXT,                         -- Issue描述
  priority         priority DEFAULT 'MEDIUM',    -- 优先级
  status           issue_status DEFAULT 'OPEN',  -- Issue状态
  
  -- 产品建议特有字段
  input_source     input_source NOT NULL,       -- 输入源
  issue_type       issue_type NOT NULL,          -- Issue类型
  business_value   TEXT,                         -- 商业价值描述
  user_impact      TEXT,                         -- 用户影响范围
  technical_risk   TEXT,                         -- 技术风险评估
  
  -- 时间管理
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW(),
  due_date         TIMESTAMPTZ,                  -- 期望完成时间
  
  -- 人员管理
  creator_id       VARCHAR NOT NULL,             -- 创建者
  assignee_id      VARCHAR,                      -- 负责人(通常是PM)
  
  -- 项目关联
  project_id       VARCHAR NOT NULL,             -- 所属项目
  
  FOREIGN KEY (creator_id) REFERENCES users(id),
  FOREIGN KEY (assignee_id) REFERENCES users(id),
  FOREIGN KEY (project_id) REFERENCES projects(id)
);
```

**Issue状态流转（IssueStatus）**:
```
OPEN → IN_DISCUSSION → APPROVED → IN_PRD → 
IN_DEVELOPMENT → IN_TESTING → IN_ACCEPTANCE → COMPLETED
                ↓
            REJECTED/CANCELLED
```

**输入源类型（InputSource）**:
- `USER_FEEDBACK`: 用户反馈
- `INTERNAL`: 内部反馈
- `DATA_ANALYSIS`: 数据分析
- `STRATEGY`: 战略需求

**Issue类型（IssueType）**:
- `FEATURE`: 新功能
- `ENHANCEMENT`: 功能优化
- `BUG_FIX`: 问题修复
- `TECHNICAL_DEBT`: 技术债务
- `RESEARCH`: 调研需求

#### 17. issue_comments - Issue评论表
```sql
CREATE TABLE issue_comments (
  id         VARCHAR PRIMARY KEY DEFAULT cuid(),
  content    TEXT NOT NULL,                     -- 评论内容
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- 关联关系
  issue_id   VARCHAR NOT NULL,                  -- Issue ID
  author_id  VARCHAR NOT NULL,                  -- 评论作者
  parent_id  VARCHAR,                           -- 回复的评论ID
  
  FOREIGN KEY (issue_id) REFERENCES issues(id) ON DELETE CASCADE,
  FOREIGN KEY (author_id) REFERENCES users(id),
  FOREIGN KEY (parent_id) REFERENCES issue_comments(id)
);
```

#### 18. issue_tags - Issue标签表
```sql
CREATE TABLE issue_tags (
  id         VARCHAR PRIMARY KEY DEFAULT cuid(),
  name       VARCHAR NOT NULL,                  -- 标签名称
  color      VARCHAR DEFAULT '#6B7280',         -- 标签颜色
  
  -- 关联关系
  project_id VARCHAR NOT NULL,                  -- 所属项目
  
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  UNIQUE(project_id, name)                      -- 项目内标签名唯一
);

-- Issue和标签的多对多关系表
CREATE TABLE _issue_tag_relation (
  A VARCHAR NOT NULL,                           -- Issue ID
  B VARCHAR NOT NULL,                           -- Tag ID
  
  FOREIGN KEY (A) REFERENCES issues(id) ON DELETE CASCADE,
  FOREIGN KEY (B) REFERENCES issue_tags(id) ON DELETE CASCADE,
  UNIQUE(A, B)
);
```

#### 19. prds - PRD文档表
```sql
CREATE TABLE prds (
  id         VARCHAR PRIMARY KEY DEFAULT cuid(),
  title      VARCHAR NOT NULL,                  -- PRD标题
  content    TEXT,                              -- PRD内容
  version    VARCHAR DEFAULT '1.0',             -- 版本号
  status     prd_status DEFAULT 'DRAFT',        -- PRD状态
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- 关联关系
  issue_id   VARCHAR NOT NULL,                  -- 关联的Issue
  author_id  VARCHAR NOT NULL,                  -- PRD作者
  
  FOREIGN KEY (issue_id) REFERENCES issues(id) ON DELETE CASCADE,
  FOREIGN KEY (author_id) REFERENCES users(id)
);
```

**PRD状态（PRDStatus）**:
- `DRAFT`: 草稿
- `REVIEW`: 评审中
- `APPROVED`: 已批准
- `REJECTED`: 已拒绝

#### 20. prd_reviews - PRD评审表
```sql
CREATE TABLE prd_reviews (
  id          VARCHAR PRIMARY KEY DEFAULT cuid(),
  status      review_status NOT NULL,           -- 评审结果
  comment     TEXT,                             -- 评审意见
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  
  -- 关联关系
  prd_id      VARCHAR NOT NULL,                 -- PRD ID
  reviewer_id VARCHAR NOT NULL,                 -- 评审者
  
  FOREIGN KEY (prd_id) REFERENCES prds(id) ON DELETE CASCADE,
  FOREIGN KEY (reviewer_id) REFERENCES users(id)
);
```

**评审状态（ReviewStatus）**:
- `PENDING`: 待评审
- `APPROVED`: 通过
- `REJECTED`: 拒绝
- `NEEDS_REVISION`: 需要修改

### 四、工作流管理模块 (3张表)

#### 21. workflows - 工作流表
```sql
CREATE TABLE workflows (
  id          VARCHAR PRIMARY KEY DEFAULT cuid(),
  name        VARCHAR NOT NULL,                 -- 工作流名称
  description VARCHAR,                          -- 工作流描述
  is_default  BOOLEAN DEFAULT false,            -- 是否默认工作流
  is_active   BOOLEAN DEFAULT true,             -- 是否激活
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  
  -- 关联关系
  project_id  VARCHAR NOT NULL,                 -- 所属项目
  
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);
```

#### 22. workflow_states - 工作流状态表
```sql
CREATE TABLE workflow_states (
  id          VARCHAR PRIMARY KEY DEFAULT cuid(),
  name        VARCHAR NOT NULL,                 -- 状态名称
  description VARCHAR,                          -- 状态描述
  color       VARCHAR,                          -- 状态颜色
  order_index INTEGER NOT NULL,                 -- 排序
  is_initial  BOOLEAN DEFAULT false,            -- 是否初始状态
  is_final    BOOLEAN DEFAULT false,            -- 是否最终状态
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  
  -- 关联关系
  workflow_id VARCHAR NOT NULL,                 -- 所属工作流
  
  FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE,
  UNIQUE(workflow_id, name)                     -- 工作流内状态名唯一
);
```

#### 23. workflow_transitions - 工作流转换表
```sql
CREATE TABLE workflow_transitions (
  id            VARCHAR PRIMARY KEY DEFAULT cuid(),
  name          VARCHAR NOT NULL,               -- 转换名称
  description   VARCHAR,                        -- 转换描述
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  
  -- 关联关系
  workflow_id   VARCHAR NOT NULL,               -- 所属工作流
  from_state_id VARCHAR NOT NULL,               -- 源状态
  to_state_id   VARCHAR NOT NULL,               -- 目标状态
  
  FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE,
  FOREIGN KEY (from_state_id) REFERENCES workflow_states(id) ON DELETE CASCADE,
  FOREIGN KEY (to_state_id) REFERENCES workflow_states(id) ON DELETE CASCADE,
  UNIQUE(workflow_id, from_state_id, to_state_id) -- 转换规则唯一
);
```

### 五、人员档案（字段定义、EAV 与明细）

#### 字段分级（FieldClassification）
```
PUBLIC / INTERNAL / SENSITIVE / HIGHLY_SENSITIVE
```

#### 字段定义（field_definitions）
- 维护字段 key/label/分级/selfEditable/description
- 与字段集（field_sets/field_set_items）形成多对多归集

#### 字段值（user_field_values, EAV 单值）
- 支持 `valueString/valueNumber/valueDate/valueJson` 四类之一
- 以 `(userId, fieldId)` 唯一，适合稀疏字段

#### 人员明细表（多条记录）
- `user_educations`: 学历（入学/毕业时间、专业、学位、授予信息等）
- `user_work_experiences`: 工作经历（公司、部门、职位、起止时间）
- `user_family_members`: 家庭成员（姓名、关系、单位、联系方式）
- `user_emergency_contacts`: 紧急联系人（姓名、关系、电话、地址）
- `user_contracts`: 合同（编号、公司、类型、起止/实际结束、签订次数）
- `user_documents`: 证件（类型、号码、有效期）
- `user_bank_accounts`: 银行账户（开户人、银行/支行、账号）
- `user_attachment_refs`: 档案附件引用（指向 `attachments`，含 `AttachmentType` 与备注）

#### 个体可见性与临时授权
- `user_visibility`: `hidden` + `viewScope(ALL/SELF_ONLY/DEPT_ONLY)`
- `temporary_access_grants`: 对 `resource/fieldKey/action` 的期限授权，可限定部门边界

#### 请假事务
- `leave_transactions`: `type(LeaveType)` + `amount(±)` 事务聚合余额

### 六、通知系统模块 (1张表)

#### 24. notifications - 通知表
```sql
CREATE TABLE notifications (
  id            VARCHAR PRIMARY KEY DEFAULT cuid(),
  title         VARCHAR NOT NULL,               -- 通知标题
  content       VARCHAR,                        -- 通知内容
  type          notification_type NOT NULL,     -- 通知类型
  is_read       BOOLEAN DEFAULT false,          -- 是否已读
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  
  -- 关联关系
  user_id       VARCHAR NOT NULL,               -- 接收用户
  resource_type VARCHAR,                        -- 关联资源类型
  resource_id   VARCHAR,                        -- 关联资源ID
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

**通知类型**:
```sql
TASK_ASSIGNED      -- 任务分配
TASK_UPDATED       -- 任务更新
TASK_COMMENTED     -- 任务评论
PROJECT_UPDATED    -- 项目更新
MENTION            -- @提及
DEADLINE_REMINDER  -- 截止日期提醒
SYSTEM             -- 系统通知
ISSUE_ASSIGNED     -- Issue分配
ISSUE_UPDATED      -- Issue更新
ISSUE_COMMENTED    -- Issue评论
ISSUE_STATUS_CHANGED -- Issue状态变更
```

## 🔗 关系图谱

### 核心实体关系
```
                 ┌─────────────┐
                 │  Department │
                 └─────┬───────┘
                       │
                 ┌─────▼───────┐      ┌─────────────┐
                 │    Team     │◄────►│    User     │
                 └─────┬───────┘      └─────┬───────┘
                       │                     │
                 ┌─────▼───────┐      ┌─────▼───────┐
                 │   Project   │◄────►│   Role      │
                 └─────┬───────┘      └─────┬───────┘
                       │                     │
                 ┌─────▼───────┐      ┌─────▼───────┐
                 │    Task     │      │ Permission  │
                 └─────┬───────┘      └─────────────┘
                       │
                 ┌─────▼───────┐
                 │   Issue     │
                 └─────┬───────┘
                       │
                 ┌─────▼───────┐
                 │    PRD      │
                 └─────────────┘
```

### 业务流程关系
```
用户反馈 ──┐
数据分析 ──┼──► Issue ──► PRD ──► Task ──► 开发实现
内部需求 ──┤                      ▲
战略规划 ──┘                      │
                           └─── 任务拆分
```

## 📊 数据规模预估

### 数据增长预测 (基于50-100人团队)

| 表名 | 初始数据 | 月增长 | 年度总量 | 备注 |
|------|----------|---------|----------|------|
| users | 100 | 5 | 160 | 团队扩张 |
| projects | 20 | 3 | 56 | 项目新增 |
| tasks | 500 | 200 | 2900 | 主要增长点 |
| issues | 50 | 30 | 410 | 需求驱动 |
| comments | 200 | 150 | 2000 | 协作频繁 |
| notifications | 1000 | 800 | 10600 | 高频通知 |

### 存储空间预估

| 数据类型 | 单条大小 | 年度数量 | 总空间 |
|----------|----------|----------|--------|
| 结构化数据 | 1KB | 16576条 | ~17MB |
| 文件附件 | 2MB | 300个 | ~600MB |
| 文本内容 | 5KB | 2410条 | ~12MB |
| **总计** | - | - | **~630MB** |

## 🔧 性能优化建议

### 1. 索引策略
```sql
-- 高频查询索引
CREATE INDEX idx_tasks_project_status ON tasks(project_id, status);
CREATE INDEX idx_tasks_assignee_status ON tasks(assignee_id, status);
CREATE INDEX idx_issues_project_status ON issues(project_id, status);
CREATE INDEX idx_notifications_user_unread ON notifications(user_id, is_read);

-- 时间范围查询索引
CREATE INDEX idx_tasks_due_date ON tasks(due_date) WHERE due_date IS NOT NULL;
CREATE INDEX idx_time_logs_date ON time_logs(date, user_id);

-- 全文搜索索引
CREATE INDEX idx_tasks_fulltext ON tasks USING gin(to_tsvector('english', title || ' ' || description));
CREATE INDEX idx_issues_fulltext ON issues USING gin(to_tsvector('english', title || ' ' || description));
```

### 2. 分区策略
```sql
-- 按时间分区通知表
CREATE TABLE notifications_2024 PARTITION OF notifications 
FOR VALUES FROM ('2024-01-01') TO ('2025-01-01');

-- 按项目分区大数据表
CREATE TABLE tasks_proj1 PARTITION OF tasks 
FOR VALUES IN ('proj1_id');
```

### 3. 查询优化
- 使用`EXPLAIN ANALYZE`分析慢查询
- 避免N+1查询问题（Prisma DataLoader）
- 合理使用查询缓存
- 批量操作减少数据库往返

## 🔒 数据安全设计

### 1. 敏感数据保护
- 密码：bcrypt加密存储
- GitLab Token：AES加密存储
- 个人信息：字段级加密

### 2. 数据完整性
- 外键约束确保引用完整性
- CHECK约束验证业务规则
- 唯一约束防止重复数据

### 3. 访问控制
- 行级安全策略(RLS)
- 基于角色的数据访问
- 敏感操作审计日志

## 📋 维护检查清单

### 日常维护
- [ ] 定期清理过期通知数据
- [ ] 监控数据库连接池状态
- [ ] 检查慢查询日志
- [ ] 更新表统计信息

### 定期维护
- [ ] 重建碎片化索引
- [ ] 分析表空间使用情况
- [ ] 备份重要业务数据
- [ ] 测试数据恢复流程

### 性能监控
- [ ] 监控关键表的增长趋势
- [ ] 跟踪查询性能指标
- [ ] 优化高频查询语句
- [ ] 评估分区策略效果

---

这套数据库设计已经过生产环境验证，能够稳定支撑50-100人团队的项目管理需求！ 🚀
