import { Resolver, Query, Mutation, Args, Int } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { TeamsService, CreateTeamInput, UpdateTeamInput, TeamFilters, AddTeamMemberInput } from './teams.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ObjectType, Field, InputType, ID, registerEnumType } from '@nestjs/graphql';
import { User, Department, Team } from '../users/users.resolver';
import { Project } from '../projects/projects.resolver';

enum TeamMemberRole {
  LEADER = 'LEADER',
  MEMBER = 'MEMBER',
}

registerEnumType(TeamMemberRole, { name: 'TeamMemberRole' });

// User 类型已从 ../users/users.resolver 导入

// Department 类型已从 ../users/users.resolver 导入

@ObjectType()
class TeamMember {
  @Field(() => ID)
  id: string;

  @Field(() => TeamMemberRole)
  role: TeamMemberRole;

  @Field()
  joinedAt: Date;

  @Field(() => User)
  user: User;
}

// Project 类型已从 ../projects/projects.resolver 导入

// Team 类型已从 ../users/users.resolver 导入

@ObjectType()
class TeamsResponse {
  @Field(() => [Team])
  teams: Team[];

  @Field(() => Int)
  total: number;
}

@ObjectType()
class TeamStats {
  @Field(() => Int)
  totalMembers: number;

  @Field(() => Int)
  totalProjects: number;

  @Field(() => Int)
  activeProjects: number;

  @Field(() => Int)
  completedProjects: number;
}

@ObjectType()
class DeleteTeamResponse {
  @Field()
  success: boolean;

  @Field()
  message: string;
}

@InputType()
class CreateTeamInputType {
  @Field()
  name: string;

  @Field({ nullable: true })
  description?: string;

  @Field({ nullable: true })
  departmentId?: string;
}

@InputType()
class UpdateTeamInputType {
  @Field({ nullable: true })
  name?: string;

  @Field({ nullable: true })
  description?: string;

  @Field({ nullable: true })
  departmentId?: string;

  @Field({ nullable: true })
  isActive?: boolean;
}

@InputType()
class TeamFiltersInput {
  @Field({ nullable: true })
  departmentId?: string;

  @Field({ nullable: true })
  isActive?: boolean;

  @Field({ nullable: true })
  search?: string;
}

@InputType()
class AddTeamMemberInputType {
  @Field()
  teamId: string;

  @Field()
  userId: string;

  @Field(() => TeamMemberRole, { nullable: true })
  role?: TeamMemberRole;
}

@Resolver(() => Team)
export class TeamsResolver {
  constructor(private teamsService: TeamsService) {}

  @Query(() => TeamsResponse)
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('team:read')
  async teams(
    @Args('filters', { nullable: true }) filters?: TeamFiltersInput,
    @Args('skip', { type: () => Int, nullable: true }) skip?: number,
    @Args('take', { type: () => Int, nullable: true }) take?: number,
  ) {
    return this.teamsService.findAll(filters, skip, take);
  }

  @Query(() => Team)
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('team:read')
  async team(@Args('id') id: string) {
    return this.teamsService.findOne(id);
  }

  @Query(() => TeamStats)
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('team:read')
  async teamStats(@Args('id') id: string) {
    return this.teamsService.getTeamStats(id);
  }

  @Mutation(() => Team)
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('team:create')
  async createTeam(
    @Args('input') input: CreateTeamInputType,
    @CurrentUser() currentUser: any,
  ) {
    return this.teamsService.create(input, currentUser.sub);
  }

  @Mutation(() => Team)
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('team:update')
  async updateTeam(
    @Args('id') id: string,
    @Args('input') input: UpdateTeamInputType,
    @CurrentUser() currentUser: any,
  ) {
    return this.teamsService.update(id, input, currentUser.sub);
  }

  @Mutation(() => DeleteTeamResponse)
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('team:delete')
  async deleteTeam(
    @Args('id') id: string,
    @CurrentUser() currentUser: any,
  ) {
    return this.teamsService.delete(id, currentUser.sub);
  }

  @Mutation(() => Team)
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('team:update')
  async addTeamMember(
    @Args('input') input: AddTeamMemberInputType,
    @CurrentUser() currentUser: any,
  ) {
    return this.teamsService.addMember(input, currentUser.sub);
  }

  @Mutation(() => Team)
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('team:update')
  async removeTeamMember(
    @Args('teamId') teamId: string,
    @Args('userId') userId: string,
    @CurrentUser() currentUser: any,
  ) {
    return this.teamsService.removeMember(teamId, userId, currentUser.sub);
  }

  @Mutation(() => Team)
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('team:update')
  async updateTeamMemberRole(
    @Args('teamId') teamId: string,
    @Args('userId') userId: string,
    @Args('role', { type: () => TeamMemberRole }) role: TeamMemberRole,
    @CurrentUser() currentUser: any,
  ) {
    return this.teamsService.updateMemberRole(teamId, userId, role, currentUser.sub);
  }
}
