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

    // 超级管理员：全部可见（按字段分级策略）
    if (await this.acl.isSuperAdmin(userId)) {
      return fields.map((f) => f.key);
    }

    // 预先缓存常用判定，避免在循环内重复 DB 查询
    const isSelf = targetUserId && targetUserId === userId;
    const hasContactRead = await this.acl.hasPermission(userId, 'contact', 'read');
    const hasSensitiveRead = await this.acl.hasPermission(userId, 'user_sensitive', 'read');
    const hasHighlySensitiveRead = await this.acl.hasPermission(userId, 'user_highly_sensitive', 'read');
    const isLeader = targetUserId ? await this.acl.isLeaderForUser(userId, targetUserId) : false;

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

      // INTERNAL -> 需要 contact:read 或本人视图，或临时授权；若 viewer 为部门链路负责人，则放开主管白名单
      if (f.classification === 'INTERNAL') {
        if (isSelf) {
          result.push(f.key);
          continue;
        }
        if (!hasContactRead) {
          const managerWhitelist = new Set([
            'name', 'department', 'position', 'employee_no', 'employment_status', 'join_date', 'contact_work_email',
          ]);
          if (isLeader && managerWhitelist.has(f.key)) {
            result.push(f.key);
            continue;
          }
          // 仅在存在该字段的授权时，才进一步校验授权范围，避免每个字段都查库
          if (grantedFieldKeys.has(f.key)) {
            const granted = await this.acl.hasTemporaryGrant({ granteeId: userId, resource, fieldKey: f.key, action: 'read', targetUserId });
            if (granted) {
              result.push(f.key);
              continue;
            }
          }
        }
        if (hasContactRead) result.push(f.key);
        continue;
      }

      // SENSITIVE -> 需要 user_sensitive:read 或临时授权（可带部门范围）
      if (f.classification === 'SENSITIVE') {
        if (!hasSensitiveRead) {
          if (grantedFieldKeys.has(f.key)) {
            const granted = await this.acl.hasTemporaryGrant({ granteeId: userId, resource, fieldKey: f.key, action: 'read', targetUserId });
            if (granted) {
              result.push(f.key);
              continue;
            }
          }
        }
        if (hasSensitiveRead) result.push(f.key);
        continue;
      }

      // HIGHLY_SENSITIVE -> 需要 user_highly_sensitive:read 或临时授权（可带部门范围）
      if (f.classification === 'HIGHLY_SENSITIVE') {
        if (!hasHighlySensitiveRead) {
          if (grantedFieldKeys.has(f.key)) {
            const granted = await this.acl.hasTemporaryGrant({ granteeId: userId, resource, fieldKey: f.key, action: 'read', targetUserId });
            if (granted) {
              result.push(f.key);
              continue;
            }
          }
        }
        if (hasHighlySensitiveRead) result.push(f.key);
        continue;
      }
    }

    return result;
  }
}


