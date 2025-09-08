import { Resolver, Query, Args, Mutation } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { FieldVisibilityService } from './field-visibility.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';

@Resolver()
export class FieldVisibilityResolver {
  constructor(private readonly service: FieldVisibilityService) {}

  @UseGuards(JwtAuthGuard)
  @Query(() => [String], { name: 'visibleFieldKeys' })
  async visibleFieldKeys(
    @Args('resource', { type: () => String }) resource: string,
    @Args('targetUserId', { type: () => String, nullable: true }) targetUserId?: string,
    @CurrentUser() user?: any,
  ): Promise<string[]> {
    const userId: string = user?.sub ?? user?.id;
    return this.service.getVisibleFieldKeys(userId, resource, targetUserId);
  }

  @Query(() => [String], { name: 'fieldDefinitions' })
  async fieldDefinitions(): Promise<string[]> {
    // 返回 key 列表（MVP 简化），后续可换成对象类型
    const defs = await (this.service as any).prisma.fieldDefinition.findMany({ select: { key: true } });
    return defs.map((d: any) => d.key);
  }

  @Query(() => [String], { name: 'fieldSets' })
  async fieldSets(): Promise<string[]> {
    const sets = await (this.service as any).prisma.fieldSet.findMany({ select: { name: true } });
    return sets.map((s: any) => s.name);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('org_visibility:configure')
  @Mutation(() => String)
  async upsertFieldDefinition(
    @Args('key') key: string,
    @Args('label') label: string,
    @Args('classification') classification: 'PUBLIC' | 'INTERNAL' | 'SENSITIVE' | 'HIGHLY_SENSITIVE',
    @Args('selfEditable', { type: () => Boolean, nullable: true }) selfEditable = false,
  ): Promise<string> {
    const fd = await (this.service as any).prisma.fieldDefinition.upsert({
      where: { key },
      update: { label, classification: classification as any, selfEditable },
      create: { key, label, classification: classification as any, selfEditable },
    });
    return fd.id;
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('org_visibility:configure')
  @Mutation(() => String)
  async upsertFieldSet(
    @Args('name') name: string,
    @Args('description', { nullable: true }) description?: string,
    @Args('isSystem', { type: () => Boolean, nullable: true }) isSystem = false,
  ): Promise<string> {
    const fs = await (this.service as any).prisma.fieldSet.upsert({
      where: { name },
      update: { description, isSystem },
      create: { name, description, isSystem },
    });
    return fs.id;
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('org_visibility:configure')
  @Mutation(() => Boolean)
  async assignFieldsToSet(
    @Args('setName') setName: string,
    @Args({ name: 'fieldKeys', type: () => [String] }) fieldKeys: string[],
  ): Promise<boolean> {
    const fs = await (this.service as any).prisma.fieldSet.findUnique({ where: { name: setName } });
    if (!fs) throw new Error('FieldSet not found');
    for (let i = 0; i < fieldKeys.length; i++) {
      const f = await (this.service as any).prisma.fieldDefinition.findUnique({ where: { key: fieldKeys[i] } });
      if (!f) continue;
      await (this.service as any).prisma.fieldSetItem.upsert({
        where: { fieldSetId_fieldId: { fieldSetId: fs.id, fieldId: f.id } as any },
        update: { order: i + 1 },
        create: { fieldSetId: fs.id, fieldId: f.id, order: i + 1 },
      });
    }
    return true;
  }
}


