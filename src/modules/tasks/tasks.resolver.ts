import { Resolver, Query, Mutation, Args, Int } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { TasksService, CreateTaskInput, UpdateTaskInput, TaskFilters, CreateTaskDependencyInput, TaskComment } from './tasks.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ObjectType, Field, InputType, ID, registerEnumType } from '@nestjs/graphql';
import { User } from '../users/users.resolver';
import { Project } from '../projects/projects.resolver';
import { WorkflowState } from '../workflows/workflows.resolver';

// 注册枚举类型
export enum TaskStatus {
  TODO = 'TODO',
  IN_PROGRESS = 'IN_PROGRESS',
  IN_REVIEW = 'IN_REVIEW',
  DONE = 'DONE',
  CANCELLED = 'CANCELLED',
}

export enum Priority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

enum DependencyType {
  FINISH_TO_START = 'FINISH_TO_START',
  START_TO_START = 'START_TO_START',
  FINISH_TO_FINISH = 'FINISH_TO_FINISH',
  START_TO_FINISH = 'START_TO_FINISH',
}

registerEnumType(TaskStatus, { name: 'TaskStatus' });
registerEnumType(Priority, { name: 'Priority' });
registerEnumType(DependencyType, { name: 'DependencyType' });

// User 类型已从 ../users/users.resolver 导入

// Project 类型已从 ../projects/projects.resolver 导入

// WorkflowState 类型已从 ../workflows/workflows.resolver 导入

@ObjectType()
export class Task {
  @Field(() => ID)
  id: string;

  @Field()
  title: string;

  @Field({ nullable: true })
  description?: string;

  @Field(() => TaskStatus)
  status: TaskStatus;

  @Field(() => Priority)
  priority: Priority;

  @Field({ nullable: true })
  startDate?: Date;

  @Field({ nullable: true })
  dueDate?: Date;

  @Field({ nullable: true })
  estimatedHours?: number;

  @Field({ nullable: true })
  actualHours?: number;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;

  @Field(() => Project)
  project: Project;

  @Field(() => User, { nullable: true })
  assignee?: User;

  @Field(() => User)
  creator: User;

  @Field(() => Task, { nullable: true })
  parent?: Task;

  @Field(() => [Task], { nullable: true })
  children?: Task[];

  @Field(() => [TaskDependency], { nullable: true })
  dependencies?: TaskDependency[];

  @Field(() => [Comment], { nullable: true })
  comments?: Comment[];

  @Field(() => [Attachment], { nullable: true })
  attachments?: Attachment[];

  @Field(() => [TimeLog], { nullable: true })
  timeLogs?: TimeLog[];

  @Field(() => WorkflowState, { nullable: true })
  workflowState?: WorkflowState;

  @Field({ nullable: true })
  gitlabIssueId?: number;

  @Field({ nullable: true })
  gitlabIssueUrl?: string;
}

@ObjectType()
class TaskDependency {
  @Field(() => ID)
  id: string;

  @Field(() => DependencyType)
  dependencyType: DependencyType;

  @Field(() => Task)
  precedingTask: Task;
}

@ObjectType()
class Comment {
  @Field(() => ID)
  id: string;

  @Field()
  content: string;

  @Field()
  createdAt: Date;

  @Field(() => User)
  author: User;

  @Field(() => [Comment], { nullable: true })
  replies?: Comment[];
}

@ObjectType()
class Attachment {
  @Field(() => ID)
  id: string;

  @Field()
  filename: string;

  @Field()
  fileUrl: string;

  @Field()
  fileSize: number;

  @Field()
  mimeType: string;

  @Field()
  createdAt: Date;

  @Field(() => User)
  uploader: User;
}

@ObjectType()
class TimeLog {
  @Field(() => ID)
  id: string;

  @Field({ nullable: true })
  description?: string;

  @Field()
  hours: number;

  @Field()
  date: Date;

  @Field(() => User)
  user: User;
}

@ObjectType()
class TasksResponse {
  @Field(() => [Task])
  tasks: Task[];

  @Field(() => Int)
  total: number;
}

@ObjectType()
class TaskStats {
  @Field(() => Int)
  totalTasks: number;

  @Field(() => Int)
  todoTasks: number;

  @Field(() => Int)
  inProgressTasks: number;

  @Field(() => Int)
  inReviewTasks: number;

  @Field(() => Int)
  doneTasks: number;

  @Field(() => Int)
  cancelledTasks: number;

  @Field(() => Int)
  overdueTasks: number;

  @Field()
  completionRate: number;
}

@ObjectType()
class DeleteTaskResponse {
  @Field()
  success: boolean;

  @Field()
  message: string;
}

@InputType()
class CreateTaskInputType {
  @Field()
  title: string;

  @Field({ nullable: true })
  description?: string;

  @Field(() => TaskStatus, { nullable: true })
  status?: TaskStatus;

  @Field(() => Priority, { nullable: true })
  priority?: Priority;

  @Field()
  projectId: string;

  @Field({ nullable: true })
  assigneeId?: string;

  @Field({ nullable: true })
  parentId?: string;

  @Field({ nullable: true })
  startDate?: Date;

  @Field({ nullable: true })
  dueDate?: Date;

  @Field({ nullable: true })
  estimatedHours?: number;

  @Field({ nullable: true })
  workflowStateId?: string;
}

@InputType()
class UpdateTaskInputType {
  @Field({ nullable: true })
  title?: string;

  @Field({ nullable: true })
  description?: string;

  @Field(() => TaskStatus, { nullable: true })
  status?: TaskStatus;

  @Field(() => Priority, { nullable: true })
  priority?: Priority;

  @Field({ nullable: true })
  assigneeId?: string;

  @Field({ nullable: true })
  startDate?: Date;

  @Field({ nullable: true })
  dueDate?: Date;

  @Field({ nullable: true })
  estimatedHours?: number;

  @Field({ nullable: true })
  actualHours?: number;

  @Field({ nullable: true })
  workflowStateId?: string;
}

@InputType()
class TaskFiltersInput {
  @Field({ nullable: true })
  projectId?: string;

  @Field({ nullable: true })
  issueId?: string;

  @Field(() => TaskStatus, { nullable: true })
  status?: TaskStatus;

  @Field(() => Priority, { nullable: true })
  priority?: Priority;

  @Field({ nullable: true })
  assigneeId?: string;

  @Field({ nullable: true })
  creatorId?: string;

  @Field({ nullable: true })
  parentId?: string;

  @Field({ nullable: true })
  search?: string;

  @Field({ nullable: true })
  dueDateFrom?: Date;

  @Field({ nullable: true })
  dueDateTo?: Date;

  @Field({ nullable: true })
  hasAssignee?: boolean;
}

@InputType()
class CreateTaskDependencyInputType {
  @Field()
  dependentTaskId: string;

  @Field()
  precedingTaskId: string;

  @Field(() => DependencyType, { nullable: true })
  dependencyType?: DependencyType;
}

@InputType()
class TaskCommentInputType {
  @Field()
  content: string;

  @Field()
  taskId: string;

  @Field({ nullable: true })
  parentId?: string;
}

@Resolver(() => Task)
export class TasksResolver {
  constructor(private tasksService: TasksService) {}

  @Query(() => TasksResponse)
  @UseGuards(JwtAuthGuard)
  async tasks(
    @Args('filters', { nullable: true }) filters?: TaskFiltersInput,
    @Args('skip', { type: () => Int, nullable: true }) skip?: number,
    @Args('take', { type: () => Int, nullable: true }) take?: number,
  ) {
    return this.tasksService.findAll(filters, skip, take);
  }

  @Query(() => Task)
  @UseGuards(JwtAuthGuard)
  async task(
    @Args('id') id: string,
    @CurrentUser() currentUser: any,
  ) {
    return this.tasksService.findOne(id, currentUser.sub);
  }

  @Query(() => TaskStats)
  @UseGuards(JwtAuthGuard)
  async taskStats(
    @Args('filters', { nullable: true }) filters?: TaskFiltersInput,
  ) {
    return this.tasksService.getTaskStats(filters);
  }

  @Mutation(() => Task)
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('task:create')
  async createTask(
    @Args('input') input: CreateTaskInputType,
    @CurrentUser() currentUser: any,
  ) {
    return this.tasksService.create(input, currentUser.sub);
  }

  @Mutation(() => Task)
  @UseGuards(JwtAuthGuard)
  async updateTask(
    @Args('id') id: string,
    @Args('input') input: UpdateTaskInputType,
    @CurrentUser() currentUser: any,
  ) {
    return this.tasksService.update(id, input, currentUser.sub);
  }

  @Mutation(() => DeleteTaskResponse)
  @UseGuards(JwtAuthGuard)
  async deleteTask(
    @Args('id') id: string,
    @CurrentUser() currentUser: any,
  ) {
    return this.tasksService.delete(id, currentUser.sub);
  }

  @Mutation(() => Task)
  @UseGuards(JwtAuthGuard)
  async addTaskDependency(
    @Args('input') input: CreateTaskDependencyInputType,
    @CurrentUser() currentUser: any,
  ) {
    return this.tasksService.addDependency(input, currentUser.sub);
  }

  @Mutation(() => Task)
  @UseGuards(JwtAuthGuard)
  async removeTaskDependency(
    @Args('dependentTaskId') dependentTaskId: string,
    @Args('precedingTaskId') precedingTaskId: string,
    @CurrentUser() currentUser: any,
  ) {
    return this.tasksService.removeDependency(dependentTaskId, precedingTaskId, currentUser.sub);
  }

  @Mutation(() => Comment)
  @UseGuards(JwtAuthGuard)
  async addTaskComment(
    @Args('input') input: TaskCommentInputType,
    @CurrentUser() currentUser: any,
  ) {
    return this.tasksService.addComment(input, currentUser.sub);
  }
}