import { Resolver, Mutation, Args } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';

@Resolver()
export class AdminResolver {
  constructor(private prisma: PrismaService) {}

  @Mutation(() => Boolean)
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('user:update')
  async upsertFieldDefinition(
    @Args('key') key: string,
    @Args('label') label: string,
    @Args('classification') classification: string,
    @Args('selfEditable', { nullable: true }) selfEditable?: boolean,
  ) {
    await this.prisma.fieldDefinition.upsert({
      where: { key },
      update: { label, classification: classification as any, selfEditable: !!selfEditable },
      create: { key, label, classification: classification as any, selfEditable: !!selfEditable },
    });
    return true;
  }

  @Mutation(() => Boolean)
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('user:update')
  async deleteFieldDefinition(@Args('key') key: string) {
    const def = await this.prisma.fieldDefinition.findUnique({ where: { key } });
    if (!def) return true;
    // 删除相关的用户字段值
    await this.prisma.userFieldValue.deleteMany({ where: { fieldId: def.id } });
    await this.prisma.fieldDefinition.delete({ where: { key } });
    return true;
  }
}


