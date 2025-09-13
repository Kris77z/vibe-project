## 组织可见性规则（代码实现版）

### 目标
- 将 Who/Where/Whom/What 四要素转化为代码可执行策略：
  - Who：访问者（viewer）的身份、角色、权限、临时授权
  - Where：组织边界（公司、部门层级、跨界）
  - Whom：目标用户（target user）是否在可见范围
  - What：字段分级 + 临时授权汇总后的可见字段集合

### 组织范围判定（Whom 可见）
1. 超级管理员（super_admin）直通：任何用户均可见
2. 用户隐藏（user_visibility.hidden=true）：不可见（除 super_admin）
3. 视野范围（user_visibility.view_scope）：
   - SELF：仅本人
   - DEPARTMENT：同部门 + 部门上下级（按业务设定）
   - COMPANY：同公司（默认）
4. 部门负责人（leader）扩展：
   - viewer 是目标用户部门链路负责人时，目标用户可见

伪代码：
```ts
function canSeeUser(viewer, target) {
  if (viewer.roles.includes('super_admin')) return true;
  const v = getUserVisibility(target.id);
  if (v.hidden) return false;
  switch (v.viewScope) {
    case 'SELF': return viewer.id === target.id;
    case 'DEPARTMENT': return inSameOrAncestorDepartment(viewer, target);
    case 'COMPANY': return inSameCompany(viewer, target);
  }
}
```

### 字段可见性（What 可见）
1. 基础分级（FieldDefinition.classification）：
   - PUBLIC：人人可见
   - INTERNAL：需 `contact:read` 或主管白名单满足
   - SENSITIVE：需 `user_sensitive:read`
   - HIGHLY_SENSITIVE：需 `user_highly_sensitive:read`
2. 主管白名单：当 viewer 为 target 部门链路负责人时自动放行字段：
   - name, department, position, employee_no, employment_status, contact_work_email
3. 临时授权：`TemporaryAccessGrant` 命中（时间窗口内）时，放行具体 `fieldKey`。
4. 目标用户不可见（canSeeUser=false）时：返回空字段集

伪代码：
```ts
function visibleFieldKeys(viewer, target?) {
  if (target && !canSeeUser(viewer, target)) return [];
  const base = collectKeysByRolePermissions(viewer.permissions);
  const leaders = isLeaderOf(viewer, target) ? LEADER_WHITELIST : [];
  const temp = collectActiveGrants(viewer.id, 'user');
  return unique([...base, ...leaders, ...temp]);
}
```

### 导出策略
- 需具备导出权限包（export:sensitive / export:highly_sensitive）
- 实际导出列 = `visibleFieldKeys ∩ 导出允许列`
- 未授权列被裁剪或脱敏

### 错误与边界
- 无权限访问目标用户/字段：返回空或 403
- 超级管理员 `super_admin` 直通（权限与可见性）


