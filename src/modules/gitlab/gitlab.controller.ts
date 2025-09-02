import { Controller, Get, Post, Put, Body, Param, Query, UseGuards } from '@nestjs/common';
import { GitlabService } from './gitlab.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('gitlab')
@UseGuards(JwtAuthGuard)
export class GitlabController {
  constructor(private gitlabService: GitlabService) {}

  @Get('validate')
  async validateConnection() {
    const isValid = await this.gitlabService.validateConnection();
    return { valid: isValid };
  }

  @Get('projects')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('project:read')
  async getProjects(@Query('userId') userId?: string) {
    const gitlabUserId = userId ? parseInt(userId, 10) : undefined;
    const projects = await this.gitlabService.getUserProjects(gitlabUserId);
    return { projects };
  }

  @Get('projects/:projectId')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('project:read')
  async getProject(@Param('projectId') projectId: string) {
    const project = await this.gitlabService.getProject(parseInt(projectId, 10));
    return { project };
  }

  @Get('projects/:projectId/issues')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('task:read')
  async getProjectIssues(
    @Param('projectId') projectId: string,
    @Query('state') state?: 'opened' | 'closed',
  ) {
    const issues = await this.gitlabService.getProjectIssues(
      parseInt(projectId, 10),
      state,
    );
    return { issues };
  }

  @Get('projects/:projectId/issues/:issueIid')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('task:read')
  async getIssue(
    @Param('projectId') projectId: string,
    @Param('issueIid') issueIid: string,
  ) {
    const issue = await this.gitlabService.getIssue(
      parseInt(projectId, 10),
      parseInt(issueIid, 10),
    );
    return { issue };
  }

  @Post('projects/:projectId/issues')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('task:create')
  async createIssue(
    @Param('projectId') projectId: string,
    @Body() data: {
      title: string;
      description?: string;
      assignee_id?: number;
      labels?: string;
    },
  ) {
    const issue = await this.gitlabService.createIssue(
      parseInt(projectId, 10),
      data,
    );
    return { issue };
  }

  @Put('projects/:projectId/issues/:issueIid')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('task:update')
  async updateIssue(
    @Param('projectId') projectId: string,
    @Param('issueIid') issueIid: string,
    @Body() data: {
      title?: string;
      description?: string;
      assignee_id?: number;
      state_event?: 'close' | 'reopen';
      labels?: string;
    },
  ) {
    const issue = await this.gitlabService.updateIssue(
      parseInt(projectId, 10),
      parseInt(issueIid, 10),
      data,
    );
    return { issue };
  }

  @Get('user')
  async getCurrentUser() {
    const user = await this.gitlabService.getUser();
    return { user };
  }

  @Get('users/:userId')
  async getUser(@Param('userId') userId: string) {
    const user = await this.gitlabService.getUser(parseInt(userId, 10));
    return { user };
  }

  @Post('sync/project')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('project:update')
  async syncProject(
    @Body() data: {
      gitlabProjectId: number;
      systemProjectId: string;
    },
  ) {
    await this.gitlabService.syncProject(data.gitlabProjectId, data.systemProjectId);
    return { success: true, message: 'Project synced successfully' };
  }

  @Post('sync/issue')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('task:update')
  async syncIssue(
    @Body() data: {
      gitlabProjectId: number;
      issueIid: number;
      systemTaskId: string;
    },
  ) {
    await this.gitlabService.syncIssueToTask(
      data.gitlabProjectId,
      data.issueIid,
      data.systemTaskId,
    );
    return { success: true, message: 'Issue synced successfully' };
  }

  @Post('tasks/:taskId/create-issue')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('task:update')
  async createIssueFromTask(@Param('taskId') taskId: string) {
    await this.gitlabService.createIssueFromTask(taskId);
    return { success: true, message: 'GitLab issue created successfully' };
  }
}

