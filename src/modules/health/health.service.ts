import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class HealthService {
  constructor(private prisma: PrismaService) {}

  async getHealthStatus() {
    try {
      // 简单的数据库连接检查
      await this.prisma.$queryRaw`SELECT 1`;
      
      return {
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development',
      };
    } catch (error) {
      return {
        status: 'error',
        timestamp: new Date().toISOString(),
        error: error.message,
      };
    }
  }

  async getDetailedHealth() {
    const checks = {};

    // 数据库检查
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      checks['database'] = { status: 'ok', timestamp: new Date().toISOString() };
    } catch (error) {
      checks['database'] = { 
        status: 'error', 
        error: error.message,
        timestamp: new Date().toISOString() 
      };
    }

    // 内存使用检查
    const memUsage = process.memoryUsage();
    checks['memory'] = {
      status: 'ok',
      rss: Math.round(memUsage.rss / 1024 / 1024) + 'MB',
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024) + 'MB',
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + 'MB',
      external: Math.round(memUsage.external / 1024 / 1024) + 'MB',
    };

    // 系统信息
    checks['system'] = {
      status: 'ok',
      uptime: process.uptime(),
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      environment: process.env.NODE_ENV || 'development',
    };

    const overallStatus = Object.values(checks).every(
      (check: any) => check.status === 'ok'
    ) ? 'ok' : 'error';

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      checks,
    };
  }
}



