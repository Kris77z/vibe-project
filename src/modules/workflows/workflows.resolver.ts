import { Resolver, Query, Mutation, Args, Int } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { WorkflowsService, CreateWorkflowInput, CreateWorkflowStateInput, CreateWorkflowTransitionInput } from './workflows.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ObjectType, Field, InputType, ID } from '@nestjs/graphql';
import { Task } from '../tasks/tasks.resolver';
import { Project } from '../projects/projects.resolver';

// Project 类型已从 ../projects/projects.resolver 导入

@ObjectType()
export class WorkflowState {
  @Field(() => ID)
  id: string;

  @Field()
  name: string;

  @Field({ nullable: true })
  description?: string;

  @Field({ nullable: true })
  color?: string;

  @Field(() => Int)
  order: number;

  @Field()
  isInitial: boolean;

  @Field()
  isFinal: boolean;

  @Field()
  createdAt: Date;
}

@ObjectType()
class WorkflowTransition {
  @Field(() => ID)
  id: string;

  @Field()
  name: string;

  @Field({ nullable: true })
  description?: string;

  @Field()
  createdAt: Date;

  @Field(() => WorkflowState)
  fromState: WorkflowState;

  @Field(() => WorkflowState)
  toState: WorkflowState;
}

@ObjectType()
export class Workflow {
  @Field(() => ID)
  id: string;

  @Field()
  name: string;

  @Field({ nullable: true })
  description?: string;

  @Field()
  isDefault: boolean;

  @Field()
  isActive: boolean;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;

  @Field(() => Project, { nullable: true })
  project?: Project;

  @Field(() => [WorkflowState])
  states: WorkflowState[];

  @Field(() => [WorkflowTransition])
  transitions: WorkflowTransition[];
}

// Task 类型已从 ../tasks/tasks.resolver 导入

@ObjectType()
class DeleteWorkflowResponse {
  @Field()
  success: boolean;

  @Field()
  message: string;
}

@InputType()
class CreateWorkflowInputType {
  @Field()
  name: string;

  @Field({ nullable: true })
  description?: string;

  @Field()
  projectId: string;

  @Field({ nullable: true })
  isDefault?: boolean;
}

@InputType()
class CreateWorkflowStateInputType {
  @Field()
  workflowId: string;

  @Field()
  name: string;

  @Field({ nullable: true })
  description?: string;

  @Field({ nullable: true })
  color?: string;

  @Field(() => Int)
  order: number;

  @Field({ nullable: true })
  isInitial?: boolean;

  @Field({ nullable: true })
  isFinal?: boolean;
}

@InputType()
class CreateWorkflowTransitionInputType {
  @Field()
  workflowId: string;

  @Field()
  fromStateId: string;

  @Field()
  toStateId: string;

  @Field()
  name: string;

  @Field({ nullable: true })
  description?: string;
}

@Resolver(() => Workflow)
export class WorkflowsResolver {
  constructor(private workflowsService: WorkflowsService) {}

  @Query(() => [Workflow])
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('project:read')
  async projectWorkflows(@Args('projectId') projectId: string) {
    return this.workflowsService.findByProject(projectId);
  }

  @Query(() => Workflow)
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('project:read')
  async workflow(@Args('id') id: string) {
    return this.workflowsService.findOne(id);
  }

  @Query(() => [WorkflowState])
  @UseGuards(JwtAuthGuard)
  async availableTaskTransitions(@Args('taskId') taskId: string) {
    return this.workflowsService.getAvailableTransitions(taskId);
  }

  @Mutation(() => Workflow)
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('project:update')
  async createWorkflow(
    @Args('input') input: CreateWorkflowInputType,
    @CurrentUser() currentUser: any,
  ) {
    return this.workflowsService.create(input, currentUser.sub);
  }

  @Mutation(() => WorkflowState)
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('project:update')
  async createWorkflowState(
    @Args('input') input: CreateWorkflowStateInputType,
    @CurrentUser() currentUser: any,
  ) {
    return this.workflowsService.createState(input, currentUser.sub);
  }

  @Mutation(() => WorkflowTransition)
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('project:update')
  async createWorkflowTransition(
    @Args('input') input: CreateWorkflowTransitionInputType,
    @CurrentUser() currentUser: any,
  ) {
    return this.workflowsService.createTransition(input, currentUser.sub);
  }

  @Mutation(() => Task)
  @UseGuards(JwtAuthGuard)
  async updateTaskState(
    @Args('taskId') taskId: string,
    @Args('newStateId') newStateId: string,
    @CurrentUser() currentUser: any,
  ) {
    return this.workflowsService.updateTaskState(taskId, newStateId, currentUser.sub);
  }

  @Mutation(() => DeleteWorkflowResponse)
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('project:delete')
  async deleteWorkflow(
    @Args('id') id: string,
    @CurrentUser() currentUser: any,
  ) {
    return this.workflowsService.delete(id, currentUser.sub);
  }
}
