import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { PrismaService } from '../../common/prisma/prisma.service';
import { firstValueFrom } from 'rxjs';

export interface GitLabProject {
  id: number;
  name: string;
  path: string;
  web_url: string;
  description?: string;
  default_branch: string;
  visibility: string;
  created_at: string;
  last_activity_at: string;
}

export interface GitLabIssue {
  id: number;
  iid: number;
  title: string;
  description?: string;
  state: 'opened' | 'closed';
  web_url: string;
  created_at: string;
  updated_at: string;
  author: {
    id: number;
    username: string;
    name: string;
    avatar_url?: string;
  };
  assignee?: {
    id: number;
    username: string;
    name: string;
    avatar_url?: string;
  };
  labels: string[];
  milestone?: {
    id: number;
    title: string;
    description?: string;
    due_date?: string;
  };
}

export interface GitLabUser {
  id: number;
  username: string;
  name: string;
  email: string;
  avatar_url?: string;
  state: string;
  created_at: string;
}

@Injectable()
export class GitlabService {
  private readonly logger = new Logger(GitlabService.name);
  private readonly gitlabUrl: string;
  private readonly gitlabToken: string;

  constructor(
    private configService: ConfigService,
    private httpService: HttpService,
    private prisma: PrismaService,
  ) {
    this.gitlabUrl = this.configService.get('gitlab.url');
    this.gitlabToken = this.configService.get('gitlab.token');
  }

  private getHeaders() {
    return {
      'Authorization': `Bearer ${this.gitlabToken}`,
      'Content-Type': 'application/json',
    };
  }

  private getApiUrl(endpoint: string): string {
    return `${this.gitlabUrl}/api/v4${endpoint}`;
  }

  /**
   * 获取用户的GitLab项目列表
   */
  async getUserProjects(gitlabUserId?: number): Promise<GitLabProject[]> {
    try {
      const endpoint = gitlabUserId 
        ? `/users/${gitlabUserId}/projects`
        : '/projects';
      
      const response = await firstValueFrom(
        this.httpService.get(this.getApiUrl(endpoint), {
          headers: this.getHeaders(),
          params: {
            membership: true,
            simple: false,
            per_page: 100,
          },
        })
      );

      return response.data;
    } catch (error) {
      this.logger.error('Failed to fetch GitLab projects', error);
      throw error;
    }
  }

  /**
   * 获取项目详情
   */
  async getProject(projectId: number): Promise<GitLabProject> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(this.getApiUrl(`/projects/${projectId}`), {
          headers: this.getHeaders(),
        })
      );

      return response.data;
    } catch (error) {
      this.logger.error(`Failed to fetch GitLab project ${projectId}`, error);
      throw error;
    }
  }

  /**
   * 获取项目的Issues列表
   */
  async getProjectIssues(projectId: number, state?: 'opened' | 'closed'): Promise<GitLabIssue[]> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(this.getApiUrl(`/projects/${projectId}/issues`), {
          headers: this.getHeaders(),
          params: {
            state: state || 'all',
            per_page: 100,
          },
        })
      );

      return response.data;
    } catch (error) {
      this.logger.error(`Failed to fetch GitLab issues for project ${projectId}`, error);
      throw error;
    }
  }

  /**
   * 获取Issue详情
   */
  async getIssue(projectId: number, issueIid: number): Promise<GitLabIssue> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(this.getApiUrl(`/projects/${projectId}/issues/${issueIid}`), {
          headers: this.getHeaders(),
        })
      );

      return response.data;
    } catch (error) {
      this.logger.error(`Failed to fetch GitLab issue ${projectId}/${issueIid}`, error);
      throw error;
    }
  }

  /**
   * 创建Issue
   */
  async createIssue(projectId: number, data: {
    title: string;
    description?: string;
    assignee_id?: number;
    labels?: string;
  }): Promise<GitLabIssue> {
    try {
      const response = await firstValueFrom(
        this.httpService.post(this.getApiUrl(`/projects/${projectId}/issues`), data, {
          headers: this.getHeaders(),
        })
      );

      return response.data;
    } catch (error) {
      this.logger.error(`Failed to create GitLab issue for project ${projectId}`, error);
      throw error;
    }
  }

  /**
   * 更新Issue
   */
  async updateIssue(projectId: number, issueIid: number, data: {
    title?: string;
    description?: string;
    assignee_id?: number;
    state_event?: 'close' | 'reopen';
    labels?: string;
  }): Promise<GitLabIssue> {
    try {
      const response = await firstValueFrom(
        this.httpService.put(this.getApiUrl(`/projects/${projectId}/issues/${issueIid}`), data, {
          headers: this.getHeaders(),
        })
      );

      return response.data;
    } catch (error) {
      this.logger.error(`Failed to update GitLab issue ${projectId}/${issueIid}`, error);
      throw error;
    }
  }

  /**
   * 获取用户信息
   */
  async getUser(userId?: number): Promise<GitLabUser> {
    try {
      const endpoint = userId ? `/users/${userId}` : '/user';
      
      const response = await firstValueFrom(
        this.httpService.get(this.getApiUrl(endpoint), {
          headers: this.getHeaders(),
        })
      );

      return response.data;
    } catch (error) {
      this.logger.error('Failed to fetch GitLab user', error);
      throw error;
    }
  }

  /**
   * 同步项目到系统
   */
  async syncProject(gitlabProjectId: number, systemProjectId: string): Promise<void> {
    try {
      const gitlabProject = await this.getProject(gitlabProjectId);
      
      // 更新系统项目的GitLab信息
      await this.prisma.project.update({
        where: { id: systemProjectId },
        data: {
          gitlabProjectId: gitlabProject.id,
          gitlabProjectUrl: gitlabProject.web_url,
        },
      });

      this.logger.log(`Synced project ${systemProjectId} with GitLab project ${gitlabProjectId}`);
    } catch (error) {
      this.logger.error(`Failed to sync project ${systemProjectId}`, error);
      throw error;
    }
  }

  /**
   * 同步Issue到系统任务
   */
  async syncIssueToTask(gitlabProjectId: number, issueIid: number, systemTaskId: string): Promise<void> {
    try {
      const gitlabIssue = await this.getIssue(gitlabProjectId, issueIid);
      
      // 更新系统任务的GitLab信息
      await this.prisma.task.update({
        where: { id: systemTaskId },
        data: {
          gitlabIssueId: gitlabIssue.iid,
          gitlabIssueUrl: gitlabIssue.web_url,
        },
      });

      this.logger.log(`Synced task ${systemTaskId} with GitLab issue ${gitlabProjectId}/${issueIid}`);
    } catch (error) {
      this.logger.error(`Failed to sync task ${systemTaskId}`, error);
      throw error;
    }
  }

  /**
   * 从系统任务创建GitLab Issue
   */
  async createIssueFromTask(taskId: string): Promise<void> {
    try {
      const task = await this.prisma.task.findUnique({
        where: { id: taskId },
        include: {
          project: true,
          assignee: true,
        },
      });

      if (!task) {
        throw new Error('Task not found');
      }

      if (!task.project.gitlabProjectId) {
        throw new Error('Project is not linked to GitLab');
      }

      // 查找GitLab用户ID
      let assigneeId: number | undefined;
      if (task.assignee?.gitlabUserId) {
        assigneeId = task.assignee.gitlabUserId;
      }

      const gitlabIssue = await this.createIssue(task.project.gitlabProjectId, {
        title: task.title,
        description: task.description || '',
        assignee_id: assigneeId,
      });

      // 更新任务的GitLab信息
      await this.prisma.task.update({
        where: { id: taskId },
        data: {
          gitlabIssueId: gitlabIssue.iid,
          gitlabIssueUrl: gitlabIssue.web_url,
        },
      });

      this.logger.log(`Created GitLab issue for task ${taskId}`);
    } catch (error) {
      this.logger.error(`Failed to create GitLab issue for task ${taskId}`, error);
      throw error;
    }
  }

  /**
   * 验证GitLab连接
   */
  async validateConnection(): Promise<boolean> {
    try {
      await this.getUser();
      return true;
    } catch (error) {
      this.logger.error('GitLab connection validation failed', error);
      return false;
    }
  }
}

