import { Resolver, Query, Mutation, Args, Int } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { ProjectsService, CreateProjectInput, UpdateProjectInput, ProjectFilters, AddProjectMemberInput } from './projects.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ObjectType, Field, InputType, ID, registerEnumType } from '@nestjs/graphql';
import { User, Department, Team } from '../users/users.resolver';
import { Task } from '../tasks/tasks.resolver';
import { WorkflowState, Workflow } from '../workflows/workflows.resolver';
import { Priority } from '../tasks/tasks.resolver';

// 注册枚举类型
enum ProjectStatus {
  PLANNING = 'PLANNING',
  ACTIVE = 'ACTIVE',
  ON_HOLD = 'ON_HOLD',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

// Priority 枚举已从 ../tasks/tasks.resolver 导入

enum ProjectMemberRole {
  ADMIN = 'ADMIN',
  MEMBER = 'MEMBER',
  VIEWER = 'VIEWER',
}

registerEnumType(ProjectStatus, { name: 'ProjectStatus' });
// Priority 枚举注册已在 ../tasks/tasks.resolver 中完成
registerEnumType(ProjectMemberRole, { name: 'ProjectMemberRole' });

// User 类型已从 ../users/users.resolver 导入

// Department 类型已从 ../users/users.resolver 导入

// Team 类型已从 ../users/users.resolver 导入

@ObjectType()
class ProjectMember {
  @Field(() => ID)
  id: string;

  @Field(() => ProjectMemberRole)
  role: ProjectMemberRole;

  @Field()
  joinedAt: Date;

  @Field(() => User)
  user: User;
}

// Task 类型已从 ../tasks/tasks.resolver 导入

// WorkflowState 类型已从 ../workflows/workflows.resolver 导入

// Workflow 类型已从 ../workflows/workflows.resolver 导入

@ObjectType()
export class Project {
  @Field(() => ID)
  id: string;

  @Field()
  name: string;

  @Field()
  key: string;

  @Field({ nullable: true })
  description?: string;

  @Field(() => ProjectStatus)
  status: ProjectStatus;

  @Field(() => Priority)
  priority: Priority;

  @Field({ nullable: true })
  startDate?: Date;

  @Field({ nullable: true })
  endDate?: Date;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;

  @Field(() => User)
  owner: User;

  @Field(() => Team, { nullable: true })
  team?: Team;

  @Field(() => [ProjectMember])
  members: ProjectMember[];

  @Field(() => [Task], { nullable: true })
  tasks?: Task[];

  @Field(() => [Workflow], { nullable: true })
  workflows?: Workflow[];

  @Field(() => Int)
  memberCount: number;

  @Field(() => Int)
  taskCount: number;

  @Field({ nullable: true })
  gitlabProjectId?: number;

  @Field({ nullable: true })
  gitlabProjectUrl?: string;
}

@ObjectType()
class ProjectsResponse {
  @Field(() => [Project])
  projects: Project[];

  @Field(() => Int)
  total: number;
}

@ObjectType()
class ProjectStats {
  @Field(() => Int)
  totalTasks: number;

  @Field(() => Int)
  completedTasks: number;

  @Field(() => Int)
  inProgressTasks: number;

  @Field(() => Int)
  todoTasks: number;

  @Field(() => Int)
  totalMembers: number;

  @Field()
  totalWorkHours: number;

  @Field()
  completionRate: number;
}

@ObjectType()
class DeleteProjectResponse {
  @Field()
  success: boolean;

  @Field()
  message: string;
}

@InputType()
class CreateProjectInputType {
  @Field()
  name: string;

  @Field()
  key: string;

  @Field({ nullable: true })
  description?: string;

  @Field(() => ProjectStatus, { nullable: true })
  status?: ProjectStatus;

  @Field(() => Priority, { nullable: true })
  priority?: Priority;

  @Field({ nullable: true })
  startDate?: Date;

  @Field({ nullable: true })
  endDate?: Date;

  @Field({ nullable: true })
  teamId?: string;

  @Field(() => [String], { nullable: true })
  memberIds?: string[];
}

@InputType()
class UpdateProjectInputType {
  @Field({ nullable: true })
  name?: string;

  @Field({ nullable: true })
  description?: string;

  @Field(() => ProjectStatus, { nullable: true })
  status?: ProjectStatus;

  @Field(() => Priority, { nullable: true })
  priority?: Priority;

  @Field({ nullable: true })
  startDate?: Date;

  @Field({ nullable: true })
  endDate?: Date;

  @Field({ nullable: true })
  teamId?: string;
}

@InputType()
class ProjectFiltersInput {
  @Field(() => ProjectStatus, { nullable: true })
  status?: ProjectStatus;

  @Field(() => Priority, { nullable: true })
  priority?: Priority;

  @Field({ nullable: true })
  ownerId?: string;

  @Field({ nullable: true })
  teamId?: string;

  @Field({ nullable: true })
  search?: string;

  @Field({ nullable: true })
  memberUserId?: string;
}

@InputType()
class AddProjectMemberInputType {
  @Field()
  projectId: string;

  @Field()
  userId: string;

  @Field(() => ProjectMemberRole, { nullable: true })
  role?: ProjectMemberRole;
}

@Resolver(() => Project)
export class ProjectsResolver {
  constructor(private projectsService: ProjectsService) {}

  @Query(() => ProjectsResponse)
  @UseGuards(JwtAuthGuard)
  async projects(
    @Args('filters', { nullable: true }) filters?: ProjectFiltersInput,
    @Args('skip', { type: () => Int, nullable: true }) skip?: number,
    @Args('take', { type: () => Int, nullable: true }) take?: number,
  ) {
    return this.projectsService.findAll(filters, skip, take);
  }

  @Query(() => Project)
  @UseGuards(JwtAuthGuard)
  async project(
    @Args('id') id: string,
    @CurrentUser() currentUser: any,
  ) {
    return this.projectsService.findOne(id, currentUser.sub);
  }

  @Query(() => ProjectStats)
  @UseGuards(JwtAuthGuard)
  async projectStats(@Args('id') id: string) {
    return this.projectsService.getProjectStats(id);
  }

  @Mutation(() => Project)
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('project:create')
  async createProject(
    @Args('input') input: CreateProjectInputType,
    @CurrentUser() currentUser: any,
  ) {
    return this.projectsService.create(input, currentUser.sub);
  }

  @Mutation(() => Project)
  @UseGuards(JwtAuthGuard)
  async updateProject(
    @Args('id') id: string,
    @Args('input') input: UpdateProjectInputType,
    @CurrentUser() currentUser: any,
  ) {
    return this.projectsService.update(id, input, currentUser.sub);
  }

  @Mutation(() => DeleteProjectResponse)
  @UseGuards(JwtAuthGuard)
  async deleteProject(
    @Args('id') id: string,
    @CurrentUser() currentUser: any,
  ) {
    return this.projectsService.delete(id, currentUser.sub);
  }

  @Mutation(() => Project)
  @UseGuards(JwtAuthGuard)
  async addProjectMember(
    @Args('input') input: AddProjectMemberInputType,
    @CurrentUser() currentUser: any,
  ) {
    return this.projectsService.addMember(input, currentUser.sub);
  }

  @Mutation(() => Project)
  @UseGuards(JwtAuthGuard)
  async removeProjectMember(
    @Args('projectId') projectId: string,
    @Args('userId') userId: string,
    @CurrentUser() currentUser: any,
  ) {
    return this.projectsService.removeMember(projectId, userId, currentUser.sub);
  }
}
