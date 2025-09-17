import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { Prisma } from '@prisma/client';

/**
 * 访问控制基础服务（MVP）
 * - 以现有 RBAC（roles/permissions）为核心
 * - 超级管理员（super_admin）短路放行
 * - 预留字段级/组织范围判定接口（后续按文档扩展）
 */
@Injectable()
export class AccessControlService {
  constructor(private readonly prisma: PrismaService) {}

  async isSuperAdmin(userId: string): Promise<boolean> {
    const count = await this.prisma.userRole.count({
      where: { userId, role: { name: 'super_admin' } },
    });
    return count > 0;
  }

  async getUserRoleNames(userId: string): Promise<string[]> {
    const roles = await this.prisma.userRole.findMany({
      where: { userId },
      select: { role: { select: { name: true } } },
    });
    return roles.map((r) => r.role.name);
  }

  async getUserPermissionNames(userId: string): Promise<string[]> {
    const userWithRoles = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        userRoles: {
          include: {
            role: {
              include: {
                rolePermissions: { include: { permission: true } },
              },
            },
          },
        },
      },
    });

    if (!userWithRoles) return [];

    const permissions = userWithRoles.userRoles.flatMap((ur) =>
      ur.role.rolePermissions.map((rp) => rp.permission.name),
    );
    return Array.from(new Set(permissions));
  }

  async hasPermission(
    userId: string,
    resource: string,
    action: string,
  ): Promise<boolean> {
    const isSuper = await this.isSuperAdmin(userId);
    if (isSuper) return true;

    const exists = await this.prisma.rolePermission.findFirst({
      where: {
        role: {
          userRoles: { some: { userId } },
        },
        permission: {
          resource,
          action,
        },
      },
    });
    return !!exists;
  }

  async hasTemporaryGrant(params: {
    granteeId: string;
    resource: string;
    fieldKey: string;
    action: string;
    targetUserId?: string;
  }): Promise<boolean> {
    const { granteeId, resource, fieldKey, action, targetUserId } = params;
    const now = new Date();
    const grant = await this.prisma.temporaryAccessGrant.findFirst({
      where: {
        granteeId,
        resource,
        fieldKey,
        action,
        startAt: { lte: now },
        endAt: { gte: now },
      },
    });
    if (!grant) return false;
    if (!grant.scopeDepartmentId || !targetUserId) return true;
    // 若设置了 scopeDepartmentId，要求目标用户属于该部门或其子部门
    const target = await this.prisma.user.findUnique({ where: { id: targetUserId }, select: { departmentId: true } });
    if (!target?.departmentId) return false;
    const allowed = await this.isDepartmentOrDescendant(target.departmentId, grant.scopeDepartmentId);
    return allowed;
  }

  async createTemporaryGrant(params: {
    granteeId: string;
    resource: string;
    fieldKey: string;
    action: string; // 'read' | 'download' | 'export'
    startAt: Date;
    endAt: Date;
    allowCrossBoundary?: boolean;
    scopeDepartmentId?: string;
    createdById: string;
  }) {
    return this.prisma.temporaryAccessGrant.create({ data: params });
  }

  /**
   * 设置用户个体可见性（hidden / viewScope）
   */
  async setUserVisibility(params: {
    userId: string;
    hidden?: boolean;
    viewScope?: 'ALL' | 'SELF_ONLY' | 'DEPT_ONLY';
  }): Promise<void> {
    const { userId, hidden, viewScope } = params;
    const exists = await this.prisma.userVisibility.findUnique({ where: { userId } });
    if (!exists) {
      await this.prisma.userVisibility.create({
        data: {
          userId,
          hidden: hidden ?? false,
          viewScope: (viewScope as any) ?? 'ALL',
        },
      });
    } else {
      await this.prisma.userVisibility.update({
        where: { userId },
        data: {
          hidden: hidden ?? exists.hidden,
          viewScope: (viewScope as any) ?? exists.viewScope,
        },
      });
    }
  }

  /**
   * 批量替换部门负责人（覆盖原 leaderUserIds）
   */
  async updateDepartmentLeaders(params: {
    departmentId: string;
    leaderUserIds: string[];
  }): Promise<void> {
    await this.prisma.department.update({
      where: { id: params.departmentId },
      data: { leaderUserIds: params.leaderUserIds },
    });
  }

  /**
   * 设置用户角色（覆盖式）：由超级管理员或具备配置权限的管理员调用
   */
  async setUserRoles(params: { userId: string; roleNames: string[] }): Promise<void> {
    const { userId, roleNames } = params;
    const roles = await this.prisma.role.findMany({ where: { name: { in: roleNames } } });
    // 先清空原有关联
    await this.prisma.userRole.deleteMany({ where: { userId } });
    if (roles.length === 0) return;
    await this.prisma.userRole.createMany({
      data: roles.map((r) => ({ userId, roleId: r.id })),
      skipDuplicates: true,
    });
  }

  /**
   * canAccess（MVP）：仅基于 RBAC 判断 resource/action
   * 预留 targetId/fieldKey 以便后续扩展组织边界与字段级策略
   */
  async canAccess(params: {
    userId: string;
    resource: string;
    action: string;
    targetUserId?: string;
    fieldKey?: string;
  }): Promise<boolean> {
    const { userId, resource, action } = params;
    return this.hasPermission(userId, resource, action);
  }

  /** 判断 depId 是否为 rootId 部门或其子部门 */
  private async isDepartmentOrDescendant(depId: string, rootId: string): Promise<boolean> {
    if (depId === rootId) return true;
    const all = await this.prisma.department.findMany({ select: { id: true, parentId: true } });
    // 从 depId 向上回溯到根
    const parentMap = new Map<string, string | null>();
    for (const d of all) parentMap.set(d.id, d.parentId);
    let cur: string | undefined = depId;
    while (cur) {
      if (cur === rootId) return true;
      cur = parentMap.get(cur) || undefined;
    }
    return false;
  }

  /** viewer 是否为 targetUser 的部门链路负责人（leaderUserIds） */
  async isLeaderForUser(viewerId: string, targetUserId: string): Promise<boolean> {
    const target = await this.prisma.user.findUnique({ where: { id: targetUserId }, select: { departmentId: true } });
    if (!target?.departmentId) return false;
    const all = await this.prisma.department.findMany({ select: { id: true, parentId: true, leaderUserIds: true } });
    const parentMap = new Map<string, { parentId: string | null; leaderUserIds: string[] | null }>();
    for (const d of all) parentMap.set(d.id, { parentId: d.parentId, leaderUserIds: (d.leaderUserIds || []) as string[] });
    let cur: string | undefined = target.departmentId;
    while (cur) {
      const info = parentMap.get(cur);
      if (!info) break;
      if ((info.leaderUserIds || []).includes(viewerId)) return true;
      cur = info.parentId || undefined;
    }
    return false;
  }

  /**
   * 组织数据可见性：返回 viewer 能看到的用户 where 过滤（公司边界 + 个体视图范围 + 负责人范围 + 隐藏用户剔除）
   */
  async getAccessibleUserWhere(viewerId: string): Promise<Prisma.UserWhereInput> {
    if (await this.isSuperAdmin(viewerId)) {
      return {};
    }

    const viewer = await this.prisma.user.findUnique({
      where: { id: viewerId },
      include: { visibility: true },
    });

    const notHidden: Prisma.UserWhereInput = {
      OR: [
        { visibility: { is: null } },
        { visibility: { is: { hidden: false } } },
      ],
    };

    if (!viewer) {
      return notHidden;
    }

    const companyScope: Prisma.UserWhereInput = viewer.companyId
      ? { companyId: viewer.companyId }
      : {};

    const viewScope = (viewer as any).visibility?.viewScope || 'ALL';

    const deptIdsByLeadership = await this.collectLeaderDepartmentScope(viewerId);

    let scopeWhere: Prisma.UserWhereInput = {};
    if (viewScope === 'SELF_ONLY') {
      scopeWhere = { id: viewerId };
    } else if (viewScope === 'DEPT_ONLY') {
      const deptScope = await this.collectDepartmentAndDescendants((viewer as any).departmentId);
      const union = Array.from(new Set([...(deptScope || []), ...deptIdsByLeadership]));
      if (union.length > 0) {
        scopeWhere = { departmentId: { in: union } } as Prisma.UserWhereInput;
      } else if ((viewer as any).departmentId) {
        scopeWhere = { departmentId: (viewer as any).departmentId };
      } else {
        scopeWhere = { id: viewerId };
      }
    }

    return { AND: [notHidden, companyScope, scopeWhere] } as Prisma.UserWhereInput;
  }

  /**
   * 判断 viewer 是否可以看到 target 用户
   */
  async canSeeUser(viewerId: string, targetUserId: string): Promise<boolean> {
    if (await this.isSuperAdmin(viewerId)) return true;
    const where = await this.getAccessibleUserWhere(viewerId);
    const count = await this.prisma.user.count({ where: { AND: [where, { id: targetUserId }] as any } });
    return count > 0;
  }

  /**
   * 收集 viewer 负责的所有部门（leaderUserIds 包含 viewerId）及其下属部门 ID 列表
   */
  private async collectLeaderDepartmentScope(viewerId: string): Promise<string[]> {
    const all = await this.prisma.department.findMany({ select: { id: true, parentId: true, leaderUserIds: true } });
    const leaderRoots = all.filter((d) => ((d.leaderUserIds || []) as string[]).includes(viewerId)).map((d) => d.id);
    const descendants = await this.collectDescendantsFromRoots(leaderRoots, all);
    return Array.from(new Set([...(leaderRoots || []), ...descendants]));
  }

  /**
   * 收集某部门及其全部下属部门（若 departmentId 为空，返回空数组）
   */
  private async collectDepartmentAndDescendants(departmentId?: string | null): Promise<string[]> {
    if (!departmentId) return [];
    const all = await this.prisma.department.findMany({ select: { id: true, parentId: true } });
    const descendants = await this.collectDescendantsFromRoots([departmentId], all);
    return Array.from(new Set([departmentId, ...descendants]));
  }

  private async collectDescendantsFromRoots(rootIds: string[], all: { id: string; parentId: string | null }[]): Promise<string[]> {
    const parentToChildren = new Map<string, string[]>();
    for (const d of all) {
      const key = d.parentId || '';
      const arr = parentToChildren.get(key) || [];
      arr.push(d.id);
      parentToChildren.set(key, arr);
    }
    const result: string[] = [];
    const stack = [...rootIds];
    while (stack.length) {
      const cur = stack.pop() as string;
      const children = parentToChildren.get(cur) || [];
      for (const c of children) {
        if (!result.includes(c)) {
          result.push(c);
          stack.push(c);
        }
      }
    }
    return result;
  }
}


