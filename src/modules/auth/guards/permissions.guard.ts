import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import { PrismaService } from '../../../common/prisma/prisma.service';

// 轻量扩展：若用户为超级管理员(supper_admin角色)，直接放行
// 否则按原有permissions元数据校验

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector, private prisma?: PrismaService) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.get<string[]>(
      'permissions',
      context.getHandler(),
    );

    if (!requiredPermissions) {
      return true;
    }

    const ctx = GqlExecutionContext.create(context);
    const user = ctx.getContext().req.user;

    if (!user || !user.permissions) {
      return false;
    }

    // 超级管理员直通
    if (user.roles && user.roles.includes('super_admin')) {
      return true;
    }

    return requiredPermissions.some((permission) =>
      user.permissions.includes(permission),
    );
  }
}


