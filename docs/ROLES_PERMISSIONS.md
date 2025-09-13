## 角色与权限包（代码与配置）

### 角色（示例）
- super_admin（超级管理员）：拥有全部权限
- admin（管理员）：除删除用户外绝大多数权限
- hr_manager（人事经理）：含敏感导出等人事权限
- project_manager / member：项目管理相关权限

### 权限清单（按资源:动作）
- user:create, user:read, user:update, user:delete
- project:create, project:read, project:update, project:delete
- task:create, task:read, task:update, task:delete, task:assign
- team:read
- contact:read                      -- 内部联系方式
- user_sensitive:read               -- 敏感字段
- user_highly_sensitive:read       -- 极敏感字段
- export:sensitive                  -- 导出敏感
- export:highly_sensitive           -- 导出极敏感
- org_visibility:configure          -- 配置字段/集合/可见性/临时授权

### 权限包（导出）
- 基础导出：export:sensitive
- 含极敏：export:highly_sensitive

### 主管白名单（视图放行）
- 当 viewer 为目标用户部门链路负责人时自动可见：
  - name, department, position, employee_no, employment_status, contact_work_email

### 临时授权
```
createTemporaryAccessGrant(
  granteeId, resource, fieldKey, action, startAt, endAt, allowCrossBoundary?, scopeDepartmentId?
)
```

### GraphQL 守卫（要点）
- PermissionsGuard：super_admin 直通
- AccessControlService：RBAC 检查 + 组织范围过滤/判断
- FieldVisibilityService：字段分级 + 临时授权融合


