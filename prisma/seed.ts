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

  // 4. 创建默认部门
  console.log('创建默认部门...');
  const defaultDepartment = await prisma.department.upsert({
    where: { id: 'default-dept' },
    update: {},
    create: {
      id: 'default-dept',
      name: '技术部',
      description: '默认技术部门',
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
      departmentId: defaultDepartment.id,
      // 注意：在实际生产环境中应该存储加密密码
      // 这里为了演示方便，先使用明文密码
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

  console.log('数据库初始化完成！');
  console.log('默认管理员账号: admin@company.com');
  console.log('默认密码: admin123456');
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
