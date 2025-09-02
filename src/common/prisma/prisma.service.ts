import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super({
      log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
    });
  }

  async onModuleInit() {
    await this.$connect();
    console.log('🗄️  数据库连接成功');
  }

  async onModuleDestroy() {
    await this.$disconnect();
    console.log('🗄️  数据库连接已断开');
  }

  // 清理和重置数据库的辅助方法（仅用于测试环境）
  async cleanDatabase() {
    if (process.env.NODE_ENV !== 'test') {
      throw new Error('清理数据库操作仅允许在测试环境中执行');
    }

    // 按照外键依赖关系的逆序删除数据
    const models = [
      'timeLog',
      'notification',
      'attachment',
      'comment',
      'taskDependency',
      'task',
      'workflowTransition',
      'workflowState', 
      'workflow',
      'projectMember',
      'project',
      'teamMember',
      'team',
      'userRole',
      'rolePermission',
      'permission',
      'role',
      'user',
      'department',
    ];

    for (const model of models) {
      await (this as any)[model].deleteMany({});
    }
  }
}

