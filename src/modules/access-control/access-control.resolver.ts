import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AccessControlService } from './access-control.service';
import { FieldVisibilityService } from '../field-visibility/field-visibility.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';

@Resolver()
export class AccessControlResolver {
  constructor(
    private readonly acl: AccessControlService,
    private readonly visibility: FieldVisibilityService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Query(() => String, { name: 'accessPreview' })
  async accessPreview(
    @Args('resource', { type: () => String, nullable: true }) resource = 'user',
    @Args('targetUserId', { type: () => String, nullable: true }) targetUserId?: string,
    @CurrentUser() user?: any,
  ): Promise<string> {
    const userId = user?.sub ?? user?.id;
    const roles = await this.acl.getUserRoleNames(userId);
    const permissions = await this.acl.getUserPermissionNames(userId);
    const keys = await this.visibility.getVisibleFieldKeys(userId, resource, targetUserId);
    return JSON.stringify({ roles, permissions, visibleFieldKeys: keys });
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('org_visibility:configure')
  @Mutation(() => String, { name: 'createTemporaryAccessGrant' })
  async createTemporaryAccessGrant(
    @Args('granteeId') granteeId: string,
    @Args('resource') resource: string,
    @Args('fieldKey') fieldKey: string,
    @Args('action') action: string,
    @Args('startAt') startAt: Date,
    @Args('endAt') endAt: Date,
    @Args('allowCrossBoundary', { type: () => Boolean, nullable: true }) allowCrossBoundary = false,
    @Args('scopeDepartmentId', { type: () => String, nullable: true }) scopeDepartmentId?: string,
    @CurrentUser() user?: any,
  ): Promise<string> {
    const created = await this.acl.createTemporaryGrant({
      granteeId,
      resource,
      fieldKey,
      action,
      startAt,
      endAt,
      allowCrossBoundary,
      scopeDepartmentId,
      createdById: user?.sub ?? user?.id,
    });
    return created.id;
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('org_visibility:configure')
  @Mutation(() => Boolean, { name: 'setUserVisibility' })
  async setUserVisibility(
    @Args('userId') userId: string,
    @Args('hidden', { type: () => Boolean, nullable: true }) hidden?: boolean,
    @Args('viewScope', { type: () => String, nullable: true }) viewScope?: 'ALL' | 'SELF_ONLY' | 'DEPT_ONLY',
  ): Promise<boolean> {
    await this.acl.setUserVisibility({ userId, hidden, viewScope });
    return true;
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('org_visibility:configure')
  @Mutation(() => Boolean, { name: 'updateDepartmentLeaders' })
  async updateDepartmentLeaders(
    @Args('departmentId') departmentId: string,
    @Args({ name: 'leaderUserIds', type: () => [String] }) leaderUserIds: string[],
  ): Promise<boolean> {
    await this.acl.updateDepartmentLeaders({ departmentId, leaderUserIds });
    return true;
  }
}


