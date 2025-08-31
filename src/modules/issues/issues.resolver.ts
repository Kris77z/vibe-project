import { Resolver, Query, Mutation, Args, ID } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { IssuesService } from './issues.service';
import { 
  Issue, 
  IssueConnection, 
  IssueComment, 
  IssueStats 
} from './dto/issue.response';
import { 
  CreateIssueInput, 
  UpdateIssueInput, 
  IssueFiltersInput,
  AddIssueCommentInput 
} from './dto/issue.input';
import { PaginationInput } from '../../common/dto/pagination.dto';
import { IssueStatus } from '@prisma/client';

@Resolver(() => Issue)
@UseGuards(JwtAuthGuard)
export class IssuesResolver {
  constructor(private readonly issuesService: IssuesService) {}

  // 查询Issue列表
  @Query(() => IssueConnection, { name: 'issues' })
  async findIssues(
    @Args('filters', { type: () => IssueFiltersInput, nullable: true })
    filters?: IssueFiltersInput,
    @Args('pagination', { type: () => PaginationInput, nullable: true })
    pagination?: PaginationInput,
  ): Promise<any> {
    return this.issuesService.findIssues(filters, pagination);
  }

  // 查询单个Issue
  @Query(() => Issue, { name: 'issue' })
  async findIssue(@Args('id', { type: () => ID }) id: string): Promise<any> {
    return this.issuesService.findIssueById(id);
  }

  // Issue统计
  @Query(() => IssueStats, { name: 'issueStats' })
  async getIssueStats(
    @Args('projectId', { type: () => ID, nullable: true }) projectId?: string,
    @Args('filters', { type: () => IssueFiltersInput, nullable: true })
    filters?: IssueFiltersInput,
  ): Promise<any> {
    return this.issuesService.getIssueStats(projectId, filters);
  }

  // 创建Issue
  @Mutation(() => Issue, { name: 'createIssue' })
  async createIssue(
    @Args('input') input: CreateIssueInput,
    @CurrentUser() user: any,
  ): Promise<any> {
    return this.issuesService.createIssue(input, user.id);
  }

  // 更新Issue
  @Mutation(() => Issue, { name: 'updateIssue' })
  async updateIssue(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateIssueInput,
    @CurrentUser() user: any,
  ): Promise<any> {
    return this.issuesService.updateIssue(id, input, user.id);
  }

  // 删除Issue
  @Mutation(() => Boolean, { name: 'deleteIssue' })
  async deleteIssue(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: any,
  ): Promise<boolean> {
    return this.issuesService.deleteIssue(id, user.id);
  }

  // Issue状态流转
  @Mutation(() => Issue, { name: 'transitionIssueStatus' })
  async transitionIssueStatus(
    @Args('id', { type: () => ID }) id: string,
    @Args('targetStatus', { type: () => IssueStatus }) targetStatus: IssueStatus,
    @Args('comment', { nullable: true }) comment?: string,
    @CurrentUser() user?: any,
  ): Promise<any> {
    return this.issuesService.transitionIssueStatus(id, targetStatus, user.id, comment);
  }

  // 添加Issue评论
  @Mutation(() => IssueComment, { name: 'addIssueComment' })
  async addIssueComment(
    @Args('input') input: AddIssueCommentInput,
    @CurrentUser() user: any,
  ): Promise<any> {
    return this.issuesService.addIssueComment(
      input.issueId,
      input.content,
      user.id,
      input.parentId,
    );
  }
}
