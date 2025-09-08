import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('开始数据库初始化...');

  // 1. 创建基础权限
  console.log('创建基础权限...');
  const permissions = [
    // 用户管理权限
    { name: 'user:create', resource: 'user', action: 'create', description: '创建用户' },
    { name: 'user:read', resource: 'user', action: 'read', description: '查看用户' },
    { name: 'user:update', resource: 'user', action: 'update', description: '更新用户' },
    { name: 'user:delete', resource: 'user', action: 'delete', description: '删除用户' },
    
    // 项目管理权限
    { name: 'project:create', resource: 'project', action: 'create', description: '创建项目' },
    { name: 'project:read', resource: 'project', action: 'read', description: '查看项目' },
    { name: 'project:update', resource: 'project', action: 'update', description: '更新项目' },
    { name: 'project:delete', resource: 'project', action: 'delete', description: '删除项目' },
    
    // 任务管理权限
    { name: 'task:create', resource: 'task', action: 'create', description: '创建任务' },
    { name: 'task:read', resource: 'task', action: 'read', description: '查看任务' },
    { name: 'task:update', resource: 'task', action: 'update', description: '更新任务' },
    { name: 'task:delete', resource: 'task', action: 'delete', description: '删除任务' },
    { name: 'task:assign', resource: 'task', action: 'assign', description: '分配任务' },
    
    // 团队管理权限
    { name: 'team:create', resource: 'team', action: 'create', description: '创建团队' },
    { name: 'team:read', resource: 'team', action: 'read', description: '查看团队' },
    { name: 'team:update', resource: 'team', action: 'update', description: '更新团队' },
    { name: 'team:delete', resource: 'team', action: 'delete', description: '删除团队' },
    
    // 时间记录权限
    { name: 'timelog:create', resource: 'timelog', action: 'create', description: '记录工时' },
    { name: 'timelog:read', resource: 'timelog', action: 'read', description: '查看工时' },
    { name: 'timelog:update', resource: 'timelog', action: 'update', description: '更新工时' },
    { name: 'timelog:delete', resource: 'timelog', action: 'delete', description: '删除工时' },

    // 字段与数据可见性（新增）
    { name: 'contact:read', resource: 'contact', action: 'read', description: '查看联系方式（内部）' },
    { name: 'user_sensitive:read', resource: 'user_sensitive', action: 'read', description: '查看敏感字段' },
    { name: 'user_highly_sensitive:read', resource: 'user_highly_sensitive', action: 'read', description: '查看极敏感字段' },
    { name: 'export:sensitive', resource: 'export', action: 'sensitive', description: '导出敏感字段' },
    { name: 'export:highly_sensitive', resource: 'export', action: 'highly_sensitive', description: '导出极敏感字段' },

    // 组织可见性配置
    { name: 'org_visibility:configure', resource: 'org_visibility', action: 'configure', description: '配置组织可见性与字段集' },
  ];

  for (const permission of permissions) {
    await prisma.permission.upsert({
      where: { name: permission.name },
      update: {},
      create: permission,
    });
  }

  // 2. 创建基础角色
  console.log('创建基础角色...');
  const superAdminRole = await prisma.role.upsert({
    where: { name: 'super_admin' },
    update: {},
    create: {
      name: 'super_admin',
      description: '超级管理员，拥有所有权限',
      isSystem: true,
    },
  });

  const adminRole = await prisma.role.upsert({
    where: { name: 'admin' },
    update: {},
    create: {
      name: 'admin',
      description: '管理员，拥有大部分管理权限',
      isSystem: true,
    },
  });

  const managerRole = await prisma.role.upsert({
    where: { name: 'project_manager' },
    update: {},
    create: {
      name: 'project_manager',
      description: '项目经理，负责项目和任务管理',
      isSystem: true,
    },
  });

  const memberRole = await prisma.role.upsert({
    where: { name: 'member' },
    update: {},
    create: {
      name: 'member',
      description: '普通成员，基础的项目参与权限',
      isSystem: true,
    },
  });

  const hrRole = await prisma.role.upsert({
    where: { name: 'hr_manager' },
    update: {},
    create: {
      name: 'hr_manager',
      description: 'HR敏感资料管理',
      isSystem: true,
    },
  });

  // 3. 为角色分配权限
  console.log('分配角色权限...');
  
  // 超级管理员 - 所有权限
  const allPermissions = await prisma.permission.findMany();
  for (const permission of allPermissions) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: superAdminRole.id,
          permissionId: permission.id,
        },
      },
      update: {},
      create: {
        roleId: superAdminRole.id,
        permissionId: permission.id,
      },
    });
  }

  // 管理员 - 除用户删除外的所有权限
  const adminPermissions = allPermissions.filter(p => p.name !== 'user:delete');
  for (const permission of adminPermissions) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: adminRole.id,
          permissionId: permission.id,
        },
      },
      update: {},
      create: {
        roleId: adminRole.id,
        permissionId: permission.id,
      },
    });
  }

  // 项目经理 - 项目和任务相关权限
  const managerPermissionNames = [
    'project:create', 'project:read', 'project:update',
    'task:create', 'task:read', 'task:update', 'task:assign',
    'team:read', 'timelog:read', 'user:read'
  ];
  const managerPermissions = allPermissions.filter(p => 
    managerPermissionNames.includes(p.name)
  );
  for (const permission of managerPermissions) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: managerRole.id,
          permissionId: permission.id,
        },
      },
      update: {},
      create: {
        roleId: managerRole.id,
        permissionId: permission.id,
      },
    });
  }

  // 普通成员 - 基础权限
  const memberPermissionNames = [
    'project:read', 'task:read', 'task:update', 'team:read',
    'timelog:create', 'timelog:read', 'timelog:update'
  ];
  const memberPermissions = allPermissions.filter(p => 
    memberPermissionNames.includes(p.name)
  );
  for (const permission of memberPermissions) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: memberRole.id,
          permissionId: permission.id,
        },
      },
      update: {},
      create: {
        roleId: memberRole.id,
        permissionId: permission.id,
      },
    });
  }

  // HR 管理员 - 敏感与极敏感查看（默认不授予导出极敏感）
  const hrPermissionNames = [
    'user_sensitive:read',
    'user_highly_sensitive:read',
    'contact:read',
    'export:sensitive',
  ];
  const hrPermissions = allPermissions.filter(p => hrPermissionNames.includes(p.name));
  for (const permission of hrPermissions) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: hrRole.id,
          permissionId: permission.id,
        },
      },
      update: {},
      create: {
        roleId: hrRole.id,
        permissionId: permission.id,
      },
    });
  }

  // 4. 创建默认部门
  console.log('创建默认部门...');
  // 先创建默认公司
  console.log('创建默认公司...');
  const defaultCompany = await prisma.company.upsert({
    where: { name: '默认公司' },
    update: {},
    create: { name: '默认公司', code: 'DEFAULT' },
  });

  const defaultDepartment = await prisma.department.upsert({
    where: { id: 'default-dept' },
    update: {},
    create: {
      id: 'default-dept',
      name: '技术部',
      description: '默认技术部门',
      companyId: defaultCompany.id,
    },
  });

  // 5. 创建默认团队
  console.log('创建默认团队...');
  const defaultTeam = await prisma.team.upsert({
    where: { id: 'default-team' },
    update: {},
    create: {
      id: 'default-team',
      name: '开发团队',
      description: '默认开发团队',
      departmentId: defaultDepartment.id,
    },
  });

  // 5b. 初始化字段分级与字段集（最小集）
  console.log('初始化字段分级与字段集...');
  const fieldDefs = [
    { key: 'name', label: '姓名', classification: 'PUBLIC', selfEditable: false },
    { key: 'department', label: '部门', classification: 'PUBLIC', selfEditable: false },
    { key: 'position', label: '职务/岗位', classification: 'PUBLIC', selfEditable: false },
    { key: 'landline', label: '座机', classification: 'PUBLIC', selfEditable: true },
    { key: 'employee_no', label: '工号', classification: 'INTERNAL', selfEditable: false },
    { key: 'employment_status', label: '在职状态', classification: 'INTERNAL', selfEditable: false },
    { key: 'join_date', label: '入职日期', classification: 'INTERNAL', selfEditable: false },

    { key: 'contact_work_email', label: '工作邮箱', classification: 'PUBLIC', selfEditable: false },
    { key: 'contact_phone', label: '手机号码', classification: 'INTERNAL', selfEditable: true },
    { key: 'contact_wechat', label: '微信', classification: 'INTERNAL', selfEditable: true },
    { key: 'contact_qq', label: 'QQ', classification: 'INTERNAL', selfEditable: true },
    { key: 'contact_personal_email', label: '个人邮箱', classification: 'INTERNAL', selfEditable: true },

    { key: 'vacation_balance', label: '假期余额', classification: 'SENSITIVE', selfEditable: false },

    { key: 'id_number', label: '证件号码', classification: 'HIGHLY_SENSITIVE', selfEditable: false },
    { key: 'bank_card_number', label: '银行卡号', classification: 'HIGHLY_SENSITIVE', selfEditable: false },
    { key: 'document_id_card', label: '身份证附件', classification: 'HIGHLY_SENSITIVE', selfEditable: false },
  ];

  for (const fd of fieldDefs) {
    await prisma.fieldDefinition.upsert({
      where: { key: fd.key },
      update: {
        label: fd.label,
        classification: fd.classification as any,
        selfEditable: fd.selfEditable,
      },
      create: {
        key: fd.key,
        label: fd.label,
        classification: fd.classification as any,
        selfEditable: fd.selfEditable,
      },
    });
  }

  // 创建字段集
  const fieldSetEnterprise = await prisma.fieldSet.upsert({
    where: { name: '企业内展示集' },
    update: {},
    create: { name: '企业内展示集', description: '姓名/部门/职务/工作邮箱/座机', isSystem: true },
  });
  const fieldSetOrg = await prisma.fieldSet.upsert({
    where: { name: '组织信息集' },
    update: {},
    create: { name: '组织信息集', description: '部门/岗位/组织信息', isSystem: true },
  });
  const fieldSetContact = await prisma.fieldSet.upsert({
    where: { name: '联系方式集（内部）' },
    update: {},
    create: { name: '联系方式集（内部）', description: '手机/微信/QQ/个人邮箱', isSystem: true },
  });
  const fieldSetLeave = await prisma.fieldSet.upsert({
    where: { name: '假勤信息集（内部）' },
    update: {},
    create: { name: '假勤信息集（内部）', description: '假期余额', isSystem: true },
  });

  // 组装字段集项（先清空再写入，使用upsert覆盖）
  const connectByKey = async (setId: string, keys: string[]) => {
    for (let i = 0; i < keys.length; i++) {
      const f = await prisma.fieldDefinition.findUnique({ where: { key: keys[i] } });
      if (!f) continue;
      await prisma.fieldSetItem.upsert({
        where: { fieldSetId_fieldId: { fieldSetId: setId, fieldId: f.id } as any },
        update: { order: i + 1 },
        create: { fieldSetId: setId, fieldId: f.id, order: i + 1 },
      });
    }
  };

  await connectByKey(fieldSetEnterprise.id, ['name', 'department', 'position', 'contact_work_email', 'landline']);
  await connectByKey(fieldSetOrg.id, ['department', 'position']);
  await connectByKey(fieldSetContact.id, ['contact_phone', 'contact_wechat', 'contact_qq', 'contact_personal_email']);
  await connectByKey(fieldSetLeave.id, ['vacation_balance']);

  // 6. 创建超级管理员用户
  console.log('创建超级管理员用户...');
  const hashedPassword = await bcrypt.hash('admin123456', 10);
  
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@company.com' },
    update: {},
    create: {
      email: 'admin@company.com',
      username: 'admin',
      name: '系统管理员',
      password: hashedPassword,
      departmentId: defaultDepartment.id,
      companyId: defaultCompany.id,
    },
  });

  // 为管理员分配超级管理员角色
  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: adminUser.id,
        roleId: superAdminRole.id,
      },
    },
    update: {},
    create: {
      userId: adminUser.id,
      roleId: superAdminRole.id,
    },
  });

  // 创建你指定的超级管理员账号
  console.log('创建指定的超级管理员账户 jiangziyi@applychart.com ...');
  const userSpecifiedHashedPassword = await bcrypt.hash('12345678', 10);
  const specifiedSuperAdmin = await prisma.user.upsert({
    where: { email: 'jiangziyi@applychart.com' },
    update: {},
    create: {
      email: 'jiangziyi@applychart.com',
      username: 'jiangziyi',
      name: '姜子逸',
      password: userSpecifiedHashedPassword,
      departmentId: defaultDepartment.id,
      companyId: defaultCompany.id,
    },
  });

  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: specifiedSuperAdmin.id,
        roleId: superAdminRole.id,
      },
    },
    update: {},
    create: {
      userId: specifiedSuperAdmin.id,
      roleId: superAdminRole.id,
    },
  });

  // 6b. 创建部门负责人账户（种子）
  console.log('创建部门负责人账户 yejieli@applychart.com ...');
  const deptLeaderPasswordHash = await bcrypt.hash('12345678', 10);
  const deptLeader = await prisma.user.upsert({
    where: { email: 'yejieli@applychart.com' },
    update: { name: 'Jelly' },
    create: {
      email: 'yejieli@applychart.com',
      username: 'yejieli',
      name: 'Jelly',
      password: deptLeaderPasswordHash,
      departmentId: defaultDepartment.id,
      companyId: defaultCompany.id,
    },
  });

  // 设为默认部门负责人
  await prisma.department.update({
    where: { id: defaultDepartment.id },
    data: { leaderUserIds: { push: deptLeader.id } },
  });

  // 设置 Jelly 的默认个体可见性为本部门（DEPT_ONLY）
  await prisma.userVisibility.upsert({
    where: { userId: deptLeader.id },
    update: { hidden: false, viewScope: 'DEPT_ONLY' as any },
    create: { userId: deptLeader.id, hidden: false, viewScope: 'DEPT_ONLY' as any },
  });

  // 授予项目经理角色以具备用户读取等基础权限
  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: deptLeader.id,
        roleId: managerRole.id,
      },
    },
    update: {},
    create: {
      userId: deptLeader.id,
      roleId: managerRole.id,
    },
  });

  // 7. 创建示例项目
  console.log('创建示例项目...');
  const sampleProject = await prisma.project.upsert({
    where: { key: 'SAMPLE001' },
    update: {},
    create: {
      name: '项目管理系统开发',
      key: 'SAMPLE001',
      description: '开发内部项目管理系统',
      status: 'ACTIVE',
      priority: 'HIGH',
      ownerId: adminUser.id,
      teamId: defaultTeam.id,
      startDate: new Date(),
      endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90天后
    },
  });

  // 8. 创建默认工作流
  console.log('创建默认工作流...');
  const defaultWorkflow = await prisma.workflow.upsert({
    where: { id: 'default-workflow' },
    update: {},
    create: {
      id: 'default-workflow',
      name: '标准开发流程',
      description: '标准的任务开发流程',
      isDefault: true,
      projectId: sampleProject.id,
    },
  });

  // 创建工作流状态
  const workflowStates = [
    { name: '待办', color: '#gray', order: 1, isInitial: true },
    { name: '进行中', color: '#blue', order: 2 },
    { name: '待审查', color: '#yellow', order: 3 },
    { name: '已完成', color: '#green', order: 4, isFinal: true },
  ];

  for (const state of workflowStates) {
    await prisma.workflowState.upsert({
      where: {
        workflowId_name: {
          workflowId: defaultWorkflow.id,
          name: state.name,
        },
      },
      update: {},
      create: {
        ...state,
        workflowId: defaultWorkflow.id,
      },
    });
  }

  // 9. 创建示例任务
  console.log('创建示例任务...');
  await prisma.task.upsert({
    where: { id: 'sample-task-1' },
    update: {},
    create: {
      id: 'sample-task-1',
      title: '设计数据库表结构',
      description: '设计完整的项目管理系统数据库表结构',
      status: 'IN_PROGRESS',
      priority: 'HIGH',
      projectId: sampleProject.id,
      assigneeId: adminUser.id,
      creatorId: adminUser.id,
      estimatedHours: 16.0,
      startDate: new Date(),
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7天后
    },
  });

  await prisma.task.upsert({
    where: { id: 'sample-task-2' },
    update: {},
    create: {
      id: 'sample-task-2',
      title: '开发用户认证模块',
      description: '实现用户登录、注册、权限验证功能',
      status: 'TODO',
      priority: 'MEDIUM',
      projectId: sampleProject.id,
      creatorId: adminUser.id,
      estimatedHours: 24.0,
      dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14天后
    },
  });

  // 10. 创建更多用户角色用于演示
  console.log('创建演示用户...');
  
  // 产品经理
  const pmUser = await prisma.user.upsert({
    where: { email: 'pm@company.com' },
    update: {},
    create: {
      email: 'pm@company.com',
      username: 'product_manager',
      name: '产品经理',
      password: hashedPassword,
      departmentId: defaultDepartment.id,
    },
  });

  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: pmUser.id,
        roleId: managerRole.id,
      },
    },
    update: {},
    create: {
      userId: pmUser.id,
      roleId: managerRole.id,
    },
  });

  // 开发工程师
  const devUser = await prisma.user.upsert({
    where: { email: 'dev@company.com' },
    update: {},
    create: {
      email: 'dev@company.com',
      username: 'developer',
      name: '开发工程师',
      password: hashedPassword,
      departmentId: defaultDepartment.id,
    },
  });

  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: devUser.id,
        roleId: memberRole.id,
      },
    },
    update: {},
    create: {
      userId: devUser.id,
      roleId: memberRole.id,
    },
  });

  // 测试工程师
  const testUser = await prisma.user.upsert({
    where: { email: 'test@company.com' },
    update: {},
    create: {
      email: 'test@company.com',
      username: 'tester',
      name: '测试工程师',
      password: hashedPassword,
      departmentId: defaultDepartment.id,
    },
  });

  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: testUser.id,
        roleId: memberRole.id,
      },
    },
    update: {},
    create: {
      userId: testUser.id,
      roleId: memberRole.id,
    },
  });

  // 11. 创建Issue标签
  console.log('创建Issue标签...');
  const featureTag = await prisma.issueTag.upsert({
    where: {
      projectId_name: {
        projectId: sampleProject.id,
        name: '新功能',
      },
    },
    update: {},
    create: {
      name: '新功能',
      color: '#10B981',
      projectId: sampleProject.id,
    },
  });

  const urgentTag = await prisma.issueTag.upsert({
    where: {
      projectId_name: {
        projectId: sampleProject.id,
        name: '紧急',
      },
    },
    update: {},
    create: {
      name: '紧急',
      color: '#EF4444',
      projectId: sampleProject.id,
    },
  });

  const optimizationTag = await prisma.issueTag.upsert({
    where: {
      projectId_name: {
        projectId: sampleProject.id,
        name: '优化',
      },
    },
    update: {},
    create: {
      name: '优化',
      color: '#F59E0B',
      projectId: sampleProject.id,
    },
  });

  // 12. 创建完整的Issue管理示例数据
  console.log('创建Issue管理示例数据...');
  
  // Issue 1: 用户反馈 - 新功能需求
  const issue1 = await prisma.issue.upsert({
    where: { id: 'issue-user-feedback-1' },
    update: {},
    create: {
      id: 'issue-user-feedback-1',
      title: '用户希望增加暗黑模式功能',
      description: '多位用户反馈希望应用支持暗黑模式，提升夜间使用体验。根据用户调研，约70%的用户表示会经常使用暗黑模式。',
      priority: 'HIGH',
      status: 'OPEN',
      inputSource: 'USER_FEEDBACK',
      issueType: 'FEATURE',
      businessValue: '提升用户体验，增加用户粘性，预计可提升用户满意度15%',
      userImpact: '影响所有用户，特别是夜间使用频繁的用户群体',
      technicalRisk: '需要重构现有主题系统，工作量中等，技术风险较低',
      creatorId: adminUser.id,
      assigneeId: pmUser.id,
      projectId: sampleProject.id,
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30天后
    },
  });

  // 为Issue1添加标签
  await prisma.issue.update({
    where: { id: issue1.id },
    data: {
      tags: {
        connect: [{ id: featureTag.id }, { id: urgentTag.id }],
      },
    },
  });

  // Issue 2: 内部反馈 - 性能优化
  const issue2 = await prisma.issue.upsert({
    where: { id: 'issue-internal-2' },
    update: {},
    create: {
      id: 'issue-internal-2',
      title: '首页加载速度优化',
      description: '内部测试发现首页加载时间过长，平均需要3-4秒，影响用户体验。需要进行性能优化。',
      priority: 'MEDIUM',
      status: 'IN_DISCUSSION',
      inputSource: 'INTERNAL',
      issueType: 'ENHANCEMENT',
      businessValue: '提升用户体验，减少用户流失，预计可降低跳出率10%',
      userImpact: '影响所有访问首页的用户',
      technicalRisk: '需要优化数据库查询和前端资源加载，技术风险中等',
      creatorId: devUser.id,
      assigneeId: pmUser.id,
      projectId: sampleProject.id,
      dueDate: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000), // 21天后
    },
  });

  await prisma.issue.update({
    where: { id: issue2.id },
    data: {
      tags: {
        connect: [{ id: optimizationTag.id }],
      },
    },
  });

  // Issue 3: 数据分析 - 新功能
  const issue3 = await prisma.issue.upsert({
    where: { id: 'issue-data-analysis-3' },
    update: {},
    create: {
      id: 'issue-data-analysis-3',
      title: '用户行为分析仪表盘',
      description: '根据数据分析，需要为运营团队提供用户行为分析仪表盘，帮助更好地理解用户使用习惯。',
      priority: 'MEDIUM',
      status: 'APPROVED',
      inputSource: 'DATA_ANALYSIS',
      issueType: 'FEATURE',
      businessValue: '提升运营效率，数据驱动决策，预计可提升运营效率25%',
      userImpact: '主要影响内部运营团队，间接提升所有用户体验',
      technicalRisk: '需要集成多个数据源，技术复杂度较高',
      creatorId: adminUser.id,
      assigneeId: pmUser.id,
      projectId: sampleProject.id,
      dueDate: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000), // 45天后
    },
  });

  await prisma.issue.update({
    where: { id: issue3.id },
    data: {
      tags: {
        connect: [{ id: featureTag.id }],
      },
    },
  });

  // Issue 4: 战略需求 - 已进入开发阶段
  const issue4 = await prisma.issue.upsert({
    where: { id: 'issue-strategy-4' },
    update: {},
    create: {
      id: 'issue-strategy-4',
      title: '移动端适配优化',
      description: '公司战略重点转向移动端，需要全面优化移动端用户体验，包括响应式设计和移动端专属功能。',
      priority: 'HIGH',
      status: 'IN_DEVELOPMENT',
      inputSource: 'STRATEGY',
      issueType: 'ENHANCEMENT',
      businessValue: '抢占移动端市场，预计可增加移动端用户30%',
      userImpact: '影响所有移动端用户，约占总用户的60%',
      technicalRisk: '需要重构部分前端组件，工作量较大但技术风险可控',
      creatorId: adminUser.id,
      assigneeId: pmUser.id,
      projectId: sampleProject.id,
      dueDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60天后
    },
  });

  // 13. 为Issue创建评论讨论
  console.log('创建Issue评论...');
  
  // Issue1的讨论
  await prisma.issueComment.create({
    data: {
      content: '这个需求确实很重要，我们收到了很多用户的反馈。建议优先级设为HIGH。',
      issueId: issue1.id,
      authorId: pmUser.id,
    },
  });

  await prisma.issueComment.create({
    data: {
      content: '从技术角度来看，实现暗黑模式需要重构现有的主题系统。预计需要2-3周时间。',
      issueId: issue1.id,
      authorId: devUser.id,
    },
  });

  // Issue2的讨论
  await prisma.issueComment.create({
    data: {
      content: '性能问题确实需要解决，建议先做性能分析，找出具体的瓶颈点。',
      issueId: issue2.id,
      authorId: pmUser.id,
    },
  });

  // 14. 创建PRD文档
  console.log('创建PRD文档...');
  
  const prd1 = await prisma.pRD.create({
    data: {
      title: '暗黑模式功能需求文档',
      content: `
# 暗黑模式功能需求文档

## 1. 需求背景
用户反馈希望应用支持暗黑模式，提升夜间使用体验。

## 2. 功能描述
- 支持系统级暗黑模式切换
- 提供手动切换选项
- 所有页面和组件适配暗黑主题

## 3. 技术方案
- 重构主题系统
- 使用CSS变量实现主题切换
- 适配所有现有组件

## 4. 验收标准
- 所有页面支持暗黑模式
- 切换流畅无闪烁
- 保持用户选择偏好
      `,
      version: '1.0',
      status: 'DRAFT',
      issueId: issue1.id,
      authorId: pmUser.id,
    },
  });

  // 15. 创建从Issue拆分的Task
  console.log('创建从Issue拆分的Task...');
  
  // 从Issue4拆分的开发任务
  const task1 = await prisma.task.create({
    data: {
      title: '移动端响应式布局重构',
      description: '重构主要页面的响应式布局，确保在各种移动设备上的显示效果',
      status: 'IN_PROGRESS',
      priority: 'HIGH',
      projectId: sampleProject.id,
      assigneeId: devUser.id,
      creatorId: pmUser.id,
      issueId: issue4.id,
      estimatedHours: 40.0,
      startDate: new Date(),
      dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    },
  });

  const task2 = await prisma.task.create({
    data: {
      title: '移动端专属功能开发',
      description: '开发移动端专属的手势操作和触摸优化功能',
      status: 'TODO',
      priority: 'MEDIUM',
      projectId: sampleProject.id,
      assigneeId: devUser.id,
      creatorId: pmUser.id,
      issueId: issue4.id,
      estimatedHours: 32.0,
      dueDate: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000),
    },
  });

  const task3 = await prisma.task.create({
    data: {
      title: '移动端功能测试',
      description: '对移动端适配功能进行全面测试，包括各种设备和浏览器',
      status: 'TODO',
      priority: 'HIGH',
      projectId: sampleProject.id,
      assigneeId: testUser.id,
      creatorId: pmUser.id,
      issueId: issue4.id,
      estimatedHours: 24.0,
      dueDate: new Date(Date.now() + 28 * 24 * 60 * 60 * 1000),
    },
  });

  // 16. 创建通知示例
  console.log('创建通知示例...');
  
  await prisma.notification.create({
    data: {
      title: 'Issue已分配给您',
      content: `Issue "${issue1.title}" 已分配给您处理，请及时查看。`,
      type: 'ISSUE_ASSIGNED',
      userId: pmUser.id,
      resourceType: 'issue',
      resourceId: issue1.id,
    },
  });

  await prisma.notification.create({
    data: {
      title: '任务已分配给您',
      content: `任务 "${task1.title}" 已分配给您，请按时完成。`,
      type: 'TASK_ASSIGNED',
      userId: devUser.id,
      resourceType: 'task',
      resourceId: task1.id,
    },
  });

  console.log('数据库初始化完成！');
  console.log('='.repeat(50));
  console.log('默认账号信息：');
  console.log('超级管理员: admin@company.com / admin123456');
  console.log('产品经理: pm@company.com / admin123456');
  console.log('开发工程师: dev@company.com / admin123456');
  console.log('测试工程师: test@company.com / admin123456');
  console.log('部门负责人: yejieli@applychart.com / 12345678');
  console.log('指定超级管理员: jiangziyi@applychart.com / 12345678');
  console.log('='.repeat(50));
  console.log('示例数据：');
  console.log(`- 项目: ${sampleProject.name} (${sampleProject.key})`);
  console.log(`- Issues: 4个不同阶段的产品建议`);
  console.log(`- Tasks: 3个从Issue拆分的开发任务`);
  console.log(`- PRD: 1个需求文档`);
  console.log(`- 用户角色: 完整的权限体系`);
  console.log('='.repeat(50));
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
