import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AccessControlService } from '../access-control/access-control.service';

@Injectable()
export class FieldVisibilityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly acl: AccessControlService,
  ) {}

  /**
   * 返回当前用户在给定资源/目标下可见的字段 key 列表（MVP）
   */
  async getVisibleFieldKeys(userId: string, resource: string, targetUserId?: string): Promise<string[]> {
    const fields = await this.prisma.fieldDefinition.findMany();

    // 公司硬边界：若指定目标用户，需同公司或具备跨界临时授权/超管
    if (targetUserId) {
      const [viewer, target] = await Promise.all([
        this.prisma.user.findUnique({ where: { id: userId }, select: { companyId: true, userRoles: { include: { role: true } } } }),
        this.prisma.user.findUnique({ where: { id: targetUserId }, select: { companyId: true } }),
      ]);
      const isSuper = (viewer?.userRoles || []).some((ur) => ur.role.name === 'super_admin');
      const sameCompany = viewer?.companyId && target?.companyId && viewer.companyId === target.companyId;
      if (!isSuper && !sameCompany) {
        // 检查是否存在任意字段的跨界临时授权（只要某字段有grant，即放行具体字段时再细化）
        const now = new Date();
        const anyGrant = await this.prisma.temporaryAccessGrant.findFirst({
          where: {
            granteeId: userId,
            resource,
            allowCrossBoundary: true,
            startAt: { lte: now },
            endAt: { gte: now },
          },
        });
        if (!anyGrant) {
          return []; // 跨公司且无跨界授权/非超管：直接不可见
        }
      }
    }

    // 组织可见性：若目标用户不可见，直接返回空集
    if (targetUserId) {
      const canSee = await this.acl.canSeeUser(userId, targetUserId);
      if (!canSee) return [];
    }

    // 超/管标记
    const isSuper = await this.acl.isSuperAdmin(userId);
    const roleNames = await this.acl.getUserRoleNames(userId);
    const isAdmin = roleNames.includes('admin') || roleNames.includes('super_admin') || isSuper;

    // 超级管理员：全部可见
    if (isSuper) return fields.map((f) => f.key);

    // 预先缓存常用判定，避免在循环内重复 DB 查询
    const isSelf = targetUserId && targetUserId === userId;
    // 两档后不再需要敏感与主管链

    // 预取当前用户在该资源上的所有有效临时授权（read），减少逐字段的 DB 查询
    const now = new Date();
    const activeGrants = await this.prisma.temporaryAccessGrant.findMany({
      where: {
        granteeId: userId,
        resource,
        action: 'read',
        startAt: { lte: now },
        endAt: { gte: now },
      },
      select: { fieldKey: true, scopeDepartmentId: true },
    });
    const grantedFieldKeys = new Set(activeGrants.map(g => g.fieldKey));

    const result: string[] = [];
    for (const f of fields) {
      // PUBLIC 直接可见
      if (f.classification === 'PUBLIC') {
        result.push(f.key);
        continue;
      }

      // CONFIDENTIAL：管理员可见；或 HR 且同公司
      if (f.classification === 'CONFIDENTIAL') {
        if (isAdmin) { result.push(f.key); continue; }
        // HR 判断：拥有 hr_manager 角色 且 与目标用户同公司
        if (targetUserId) {
          const [viewer, target] = await Promise.all([
            this.prisma.user.findUnique({ where: { id: userId }, select: { companyId: true, userRoles: { include: { role: true } } } }),
            this.prisma.user.findUnique({ where: { id: targetUserId }, select: { companyId: true } }),
          ]);
          const isHR = (viewer?.userRoles || []).some((ur) => ur.role.name === 'hr_manager');
          const sameCompany = !!viewer?.companyId && !!target?.companyId && viewer.companyId === target.companyId;
          if (isHR && sameCompany) { result.push(f.key); }
        }
        continue;
      }
    }

    return result;
  }
}


