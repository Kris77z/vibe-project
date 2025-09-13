## 字段敏感矩阵（MVP）

> 说明：后端以 `FieldDefinition.classification` 管控；前端仅按 `visibleFieldKeys` 渲染。

### 分级定义
- PUBLIC：公开（默认）
- INTERNAL：内部（需 contact:read 或主管白名单）
- SENSITIVE：敏感（需 user_sensitive:read）
- HIGHLY_SENSITIVE：极敏（需 user_highly_sensitive:read）

### 用户（User）常见字段分类

| 字段Key | 说明 | 分级 |
|---|---|---|
| name | 姓名 | PUBLIC |
| department | 部门名称 | PUBLIC |
| position | 职务 | INTERNAL |
| employee_no | 工号 | INTERNAL |
| employment_status | 人员状态 | INTERNAL |
| contact_work_email | 工作邮箱 | PUBLIC |
| contact_phone | 手机号 | INTERNAL |
| contact_wechat | 微信 | SENSITIVE |
| contact_qq | QQ | SENSITIVE |
| contact_personal_email | 个人邮箱 | SENSITIVE |
| national_id | 身份证号 | HIGHLY_SENSITIVE |
| bank_account | 银行卡号 | HIGHLY_SENSITIVE |

### 主管白名单（自动放行）
- name, department, position, employee_no, employment_status, contact_work_email

### 临时授权
- 针对单字段（如 contact_phone）在时间窗口内放行；到期自动失效；可限制部门边界。


