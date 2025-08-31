import { Resolver, Query, Mutation, Args, Int } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { UsersService, CreateUserInput, UpdateUserInput, UpdateUserRolesInput, UserFilters } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ObjectType, Field, InputType, ID } from '@nestjs/graphql';

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
  constructor(private usersService: UsersService) {}

  @Query(() => UsersResponse)
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('user:read')
  async users(
    @Args('filters', { nullable: true }) filters?: UserFiltersInput,
    @Args('skip', { type: () => Int, nullable: true }) skip?: number,
    @Args('take', { type: () => Int, nullable: true }) take?: number,
  ) {
    return this.usersService.findAll(filters, skip, take);
  }

  @Query(() => User)
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('user:read')
  async user(@Args('id') id: string) {
    return this.usersService.findOne(id);
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
}
