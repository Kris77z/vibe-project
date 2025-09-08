import { Resolver, Query, Mutation, Args, Int } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { UsersService, CreateUserInput, UpdateUserInput, UpdateUserRolesInput, UserFilters } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ObjectType, Field, InputType, ID } from '@nestjs/graphql';
import { FieldVisibilityService } from '../field-visibility/field-visibility.service';
import { AccessControlService } from '../access-control/access-control.service';

@ObjectType()
export class Department {
  @Field(() => ID)
  id: string;

  @Field()
  name: string;

  @Field({ nullable: true })
  description?: string;

  @Field({ nullable: true })
  parentId?: string;
}

@ObjectType()
class Role {
  @Field(() => ID)
  id: string;

  @Field()
  name: string;

  @Field({ nullable: true })
  description?: string;

  @Field()
  isSystem: boolean;
}

@ObjectType()
class Permission {
  @Field(() => ID)
  id: string;

  @Field()
  name: string;

  @Field()
  resource: string;

  @Field()
  action: string;

  @Field({ nullable: true })
  description?: string;
}

@ObjectType()
export class Team {
  @Field(() => ID)
  id: string;

  @Field()
  name: string;

  @Field({ nullable: true })
  description?: string;
}

import { Task } from '../tasks/tasks.resolver';
import { Project } from '../projects/projects.resolver';

// Task 类型已从 ../tasks/tasks.resolver 导入

// Project 类型已从 ../projects/projects.resolver 导入

@ObjectType()
class UserStats {
  @Field(() => Int)
  totalTasks: number;

  @Field(() => Int)
  completedTasks: number;

  @Field(() => Int)
  inProgressTasks: number;

  @Field(() => Int)
  ownedProjects: number;

  @Field()
  totalWorkHours: number;

  @Field()
  thisMonthWorkHours: number;

  @Field()
  completionRate: number;
}

@ObjectType()
export class User {
  @Field(() => ID)
  id: string;

  @Field()
  email: string;

  @Field()
  username: string;

  @Field()
  name: string;

  @Field({ nullable: true })
  avatar?: string;

  @Field({ nullable: true })
  phone?: string;

  @Field()
  isActive: boolean;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;

  @Field(() => Department, { nullable: true })
  department?: Department;

  @Field(() => [Role])
  roles: Role[];

  @Field(() => [Permission], { nullable: true })
  permissions?: Permission[];

  @Field(() => [Team])
  teams: Team[];

  @Field(() => [Task], { nullable: true })
  assignedTasks?: Task[];

  @Field(() => [Project], { nullable: true })
  ownedProjects?: Project[];
}

@ObjectType()
class UsersResponse {
  @Field(() => [User])
  users: User[];

  @Field(() => Int)
  total: number;
}

@ObjectType()
class DeleteUserResponse {
  @Field()
  success: boolean;

  @Field()
  message: string;
}

@InputType()
class CreateUserInputType {
  @Field()
  email: string;

  @Field()
  username: string;

  @Field()
  name: string;

  @Field()
  password: string;

  @Field({ nullable: true })
  departmentId?: string;

  @Field({ nullable: true })
  phone?: string;

  @Field({ nullable: true })
  avatar?: string;

  @Field(() => [String], { nullable: true })
  roleIds?: string[];
}

@InputType()
class UpdateUserInputType {
  @Field({ nullable: true })
  name?: string;

  @Field({ nullable: true })
  phone?: string;

  @Field({ nullable: true })
  avatar?: string;

  @Field({ nullable: true })
  departmentId?: string;

  @Field({ nullable: true })
  isActive?: boolean;
}

@InputType()
class UpdateUserRolesInputType {
  @Field()
  userId: string;

  @Field(() => [String])
  roleIds: string[];
}

@InputType()
class UserFiltersInput {
  @Field({ nullable: true })
  departmentId?: string;

  @Field({ nullable: true })
  isActive?: boolean;

  @Field({ nullable: true })
  search?: string;
}

@Resolver(() => User)
export class UsersResolver {
  constructor(
    private usersService: UsersService,
    private fieldVisibility: FieldVisibilityService,
    private acl: AccessControlService,
  ) {}

  @Query(() => UsersResponse)
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('user:read')
  async users(
    @Args('filters', { nullable: true }) filters?: UserFiltersInput,
    @Args('skip', { type: () => Int, nullable: true }) skip?: number,
    @Args('take', { type: () => Int, nullable: true }) take?: number,
    @CurrentUser() current?: any,
  ) {
    const res = await this.usersService.findAll(filters, skip, take, current?.sub ?? current?.id);
    const currentUserId = current?.sub ?? current?.id;
    const visible = await this.fieldVisibility.getVisibleFieldKeys(currentUserId, 'user');
    if (!visible.includes('contact_phone')) {
      res.users = res.users.map((u) => ({ ...u, phone: null }));
    }
    return res;
  }

  @Query(() => User)
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('user:read')
  async user(@Args('id') id: string, @CurrentUser() current?: any) {
    const data = await this.usersService.findOne(id);
    // 基于可见性隐藏 phone（示例：联系方式）
    const visible = await this.fieldVisibility.getVisibleFieldKeys(current?.sub ?? current?.id, 'user', id)
    if (!visible.includes('contact_phone')) {
      data.phone = null;
    }
    return data;
  }

  @Query(() => UserStats)
  @UseGuards(JwtAuthGuard)
  async userStats(
    @Args('id', { nullable: true }) id?: string,
    @CurrentUser() currentUser?: any,
  ) {
    const userId = id || currentUser.sub;
    return this.usersService.getUserStats(userId);
  }

  @Mutation(() => User)
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('user:create')
  async createUser(
    @Args('input') input: CreateUserInputType,
    @CurrentUser() currentUser: any,
  ) {
    return this.usersService.create(input, currentUser.sub);
  }

  @Mutation(() => User)
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('user:update')
  async updateUser(
    @Args('id') id: string,
    @Args('input') input: UpdateUserInputType,
    @CurrentUser() currentUser: any,
  ) {
    return this.usersService.update(id, input, currentUser.sub);
  }

  @Mutation(() => User)
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('user:update')
  async updateUserRoles(
    @Args('input') input: UpdateUserRolesInputType,
    @CurrentUser() currentUser: any,
  ) {
    return this.usersService.updateRoles(input, currentUser.sub);
  }

  @Mutation(() => User)
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('user:update')
  async deactivateUser(
    @Args('id') id: string,
    @CurrentUser() currentUser: any,
  ) {
    return this.usersService.deactivate(id, currentUser.sub);
  }

  @Mutation(() => User)
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('user:update')
  async activateUser(
    @Args('id') id: string,
    @CurrentUser() currentUser: any,
  ) {
    return this.usersService.activate(id, currentUser.sub);
  }

  @Mutation(() => DeleteUserResponse)
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('user:delete')
  async deleteUser(
    @Args('id') id: string,
    @CurrentUser() currentUser: any,
  ) {
    return this.usersService.delete(id, currentUser.sub);
  }

  @Query(() => String)
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('user:read')
  async exportUsersCsv(
    @Args('filters', { nullable: true }) filters?: UserFiltersInput,
    @CurrentUser() current?: any,
  ): Promise<string> {
    const currentUserId = current?.sub ?? current?.id;
    // 权限：导出敏感/极敏感，仅在需要时检查
    const canExportSensitive = await this.acl.hasPermission(currentUserId, 'export', 'sensitive');
    const canExportHighly = await this.acl.hasPermission(currentUserId, 'export', 'highly_sensitive');

    const res = await this.usersService.findAll(filters as any, 0, 1000);
    const visible = await this.fieldVisibility.getVisibleFieldKeys(currentUserId, 'user');

    // 列定义（依据现有User模型可用字段；敏感字段目前未在模型中，保留占位逻辑）
    const baseCols: { key: string; header: string; getter: (u: any) => any }[] = [
      { key: 'name', header: '姓名', getter: (u) => u.name },
      { key: 'username', header: '用户名', getter: (u) => u.username },
      { key: 'email', header: '工作邮箱', getter: (u) => u.email },
      { key: 'department', header: '部门', getter: (u) => u.department?.name || '' },
    ];

    if (visible.includes('contact_phone')) {
      baseCols.push({ key: 'contact_phone', header: '手机', getter: (u) => u.phone || '' });
    }

    // 敏感与极敏感示例（当前User模型无对应字段，留作后续扩展）
    const sensitiveCols: { key: string; header: string; getter: (u: any) => any }[] = [];
    if (canExportSensitive) {
      // e.g., vacation_balance -> 待有模型字段后增加
      // if (visible.includes('vacation_balance')) sensitiveCols.push({ key: 'vacation_balance', header: '假期余额', getter: (u) => u.vacationBalance || '' });
    }
    const highlyCols: { key: string; header: string; getter: (u: any) => any }[] = [];
    if (canExportHighly) {
      // e.g., id_number/bank_card_number -> 待有模型字段后增加
    }

    const columns = [...baseCols, ...sensitiveCols, ...highlyCols];
    const headers = columns.map((c) => c.header);
    const rows = (res.users || []).map((u) => columns.map((c) => String(c.getter(u) ?? '')));

    const escape = (val: string) => {
      const needsQuote = /[",\n]/.test(val);
      const v = val.replace(/"/g, '""');
      return needsQuote ? `"${v}"` : v;
    };
    const csv = [headers.join(','), ...rows.map((r) => r.map(escape).join(','))].join('\n');
    return csv;
  }
}
