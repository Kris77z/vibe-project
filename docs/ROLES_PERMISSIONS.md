## 角色与权限包（代码与配置）

> 基于"字段可见性两档方案"（公开/保密）更新，2024年最新版本

### 角色（示例）
- super_admin（超级管理员）：拥有全部权限
- admin（管理员）：除删除用户外绝大多数权限
- hr_manager（HR管理员）：查看和导出保密字段（限同公司）
- project_manager（主管）：项目和任务管理权限
- member（普通成员）：基础项目参与权限

### 权限清单（按资源:动作）

#### 基础权限
- user:create, user:read, user:update, user:delete
- project:create, project:read, project:update, project:delete
- task:create, task:read, task:update, task:delete, task:assign
- team:read, team:create, team:update, team:delete
- timelog:create, timelog:read, timelog:update, timelog:delete

#### 字段可见性权限（两档方案）
- **user_confidential:read** -- 查看保密字段（admin/super_admin 全可见，HR 限同公司）
- **export:confidential** -- 导出保密字段（admin/super_admin 全可导，HR 限同公司）

#### 配置权限
- **org_visibility:configure** -- 配置组织可见性、字段分级与字段集

### 字段可见性判定（两档）
- **PUBLIC（公开）**：所有登录用户可见
- **CONFIDENTIAL（保密）**：
  - super_admin/admin 全部可见
  - hr_manager 仅可见同公司员工的保密字段
  - 其他角色不可见

### 角色权限包
- **super_admin**：全部权限
- **admin**：全部权限 - user:delete
- **hr_manager**：user:read + user_confidential:read + export:confidential
- **project_manager**：project/task 增删改查 + task:assign + team:read + user:read
- **member**：project:read + task:read/update + team:read + timelog:create/read/update

### GraphQL 守卫（要点）
- PermissionsGuard：super_admin 直通，其余检查 RBAC
- AccessControlService：RBAC 检查 + 组织范围过滤（公司边界、视图范围、负责人范围）
- FieldVisibilityService：两档判定（PUBLIC 直通；CONFIDENTIAL 检查 admin 或同公司 HR）


