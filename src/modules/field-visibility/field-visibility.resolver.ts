import { Resolver, Query, Args, Mutation, ObjectType, Field } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { FieldVisibilityService } from './field-visibility.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';

// === 字段定义 GraphQL 类型（返回 key/label/classification/selfEditable） ===
@ObjectType()
export class FieldDefinitionItem {
  @Field(() => String)
  key!: string;

  @Field(() => String)
  label!: string;

  @Field(() => String)
  classification!: 'PUBLIC' | 'CONFIDENTIAL';

  @Field(() => Boolean, { nullable: true })
  selfEditable?: boolean;

  // 两档后移除 allowManagerVisible
}

// === 模块可见性：类型 ===
@ObjectType()
export class ModuleVisibilityItem {
  @Field(() => String)
  moduleKey!: string;

  @Field(() => String)
  classification!: 'PUBLIC' | 'CONFIDENTIAL';

  @Field(() => Date)
  updatedAt!: Date;
}

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

  @Query(() => [FieldDefinitionItem], { name: 'fieldDefinitions' })
  async fieldDefinitions(): Promise<Array<{ key: string; label: string; classification: string; selfEditable: boolean }>> {
    const defs = await (this.service as any).prisma.fieldDefinition.findMany({
      select: { key: true, label: true, classification: true, selfEditable: true },
      orderBy: { key: 'asc' },
    });
    return defs;
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
    @Args('classification') classification: 'PUBLIC' | 'CONFIDENTIAL',
    @Args('selfEditable', { type: () => Boolean, nullable: true }) selfEditable = false,
  ): Promise<string> {
    const fd = await (this.service as any).prisma.fieldDefinition.upsert({
      where: { key },
      update: { label, classification: classification as any, selfEditable },
      create: { key, label, classification: classification as any, selfEditable },
    });
    return fd.id;
  }

  @Query(() => [ModuleVisibilityItem], { name: 'moduleVisibilities' })
  async moduleVisibilities(): Promise<Array<{ moduleKey: string; classification: string; updatedAt: Date }>> {
    const list = await (this.service as any).prisma.moduleVisibility.findMany({
      orderBy: { moduleKey: 'asc' },
    });
    return list as any;
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('org_visibility:configure')
  @Mutation(() => String)
  async upsertModuleVisibility(
    @Args('moduleKey') moduleKey: string,
    @Args('classification') classification: 'PUBLIC' | 'CONFIDENTIAL',
  ): Promise<string> {
    const mv = await (this.service as any).prisma.moduleVisibility.upsert({
      where: { moduleKey },
      update: { classification: classification as any },
      create: { moduleKey, classification: classification as any },
    });
    return mv.moduleKey as string;
  }

  // === 分组批量设置：按 FieldSet 名称统一更新字段分级与主管可见 ===
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('org_visibility:configure')
  @Mutation(() => Boolean)
  async applyGroupVisibility(
    @Args('setName') setName: string,
    @Args('classification') classification: 'PUBLIC' | 'CONFIDENTIAL',
  ): Promise<boolean> {
    const fs = await (this.service as any).prisma.fieldSet.findUnique({ where: { name: setName }, include: { items: { include: { field: true } } } });
    if (!fs) throw new Error('FieldSet not found');
    const keys = (fs.items || []).map((it: any) => it.field?.key).filter(Boolean);
    if (keys.length === 0) return true;
    await (this.service as any).prisma.fieldDefinition.updateMany({
      where: { key: { in: keys } },
      data: { classification: classification as any },
    });
    return true;
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


