import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { Issue, IssueStatus, InputSource, IssueType, Priority } from '@prisma/client';
import { CreateIssueInput, UpdateIssueInput, IssueFiltersInput } from './dto/issue.input';
import { PaginationInput } from '../../common/dto/pagination.dto';

@Injectable()
export class IssuesService {
  constructor(private prisma: PrismaService) {}

  // 创建Issue
  async createIssue(input: CreateIssueInput, creatorId: string): Promise<any> {
    return this.prisma.issue.create({
      data: {
        ...input,
        creatorId,
      },
      include: {
        creator: true,
        assignee: true,
        project: true,
        tags: true,
        comments: {
          include: {
            author: true,
            replies: {
              include: {
                author: true,
              },
            },
          },
        },
        tasks: {
          include: {
            assignee: true,
          },
        },
        attachments: true,
        prds: {
          include: {
            author: true,
            reviews: {
              include: {
                reviewer: true,
              },
            },
          },
        },
      },
    }) as any;
  }

  // 获取Issue列表
  async findIssues(
    filters?: IssueFiltersInput,
    pagination?: PaginationInput,
  ) {
    const where: any = {};

    if (filters) {
      if (filters.projectId) where.projectId = filters.projectId;
      if (filters.status?.length) where.status = { in: filters.status };
      if (filters.priority?.length) where.priority = { in: filters.priority };
      if (filters.inputSource?.length) where.inputSource = { in: filters.inputSource };
      if (filters.issueType?.length) where.issueType = { in: filters.issueType };
      if (filters.assigneeId) where.assigneeId = filters.assigneeId;
      if (filters.creatorId) where.creatorId = filters.creatorId;
      
      if (filters.tagIds?.length) {
        where.tags = {
          some: {
            id: { in: filters.tagIds },
          },
        };
      }

      if (filters.keyword) {
        where.OR = [
          { title: { contains: filters.keyword, mode: 'insensitive' } },
          { description: { contains: filters.keyword, mode: 'insensitive' } },
        ];
      }

      if (filters.dateRange) {
        where.createdAt = {
          gte: filters.dateRange.startDate,
          lte: filters.dateRange.endDate,
        };
      }
    }

    const [issues, total] = await Promise.all([
      this.prisma.issue.findMany({
        where,
        include: {
          creator: true,
          assignee: true,
          project: true,
          tags: true,
          comments: {
            include: {
              author: true,
              replies: {
                include: {
                  author: true,
                },
              },
            },
            where: { parentId: null },
          },
          tasks: {
            include: {
              assignee: true,
            },
          },
          attachments: true,
          prds: {
            include: {
              author: true,
              reviews: {
                include: {
                  reviewer: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: pagination?.skip || 0,
        take: pagination?.take || 20,
      }),
      this.prisma.issue.count({ where }),
    ]);

    return {
      issues,
      total,
      hasMore: (pagination?.skip || 0) + issues.length < total,
    };
  }

  // 获取单个Issue
  async findIssueById(id: string): Promise<any> {
    const issue = await this.prisma.issue.findUnique({
      where: { id },
      include: {
        creator: true,
        assignee: true,
        project: true,
        tags: true,
        comments: {
          include: {
            author: true,
            replies: {
              include: {
                author: true,
              },
            },
          },
          where: { parentId: null },
          orderBy: { createdAt: 'desc' },
        },
        tasks: {
          include: {
            assignee: true,
          },
        },
        attachments: true,
        prds: {
          include: {
            author: true,
            reviews: {
              include: {
                reviewer: true,
              },
            },
          },
        },
      },
    });

    if (!issue) {
      throw new NotFoundException('Issue not found');
    }

    return issue;
  }

  // 更新Issue
  async updateIssue(
    id: string,
    input: UpdateIssueInput,
    userId: string,
  ): Promise<any> {
    // 检查Issue是否存在
    const existingIssue = await this.prisma.issue.findUnique({
      where: { id },
      include: { creator: true },
    });

    if (!existingIssue) {
      throw new NotFoundException('Issue not found');
    }

    // 权限检查：只有创建者、负责人或管理员可以更新
    // 这里简化处理，实际应该结合RBAC权限系统
    if (existingIssue.creatorId !== userId && existingIssue.assigneeId !== userId) {
      throw new ForbiddenException('No permission to update this issue');
    }

    return this.prisma.issue.update({
      where: { id },
      data: input,
      include: {
        creator: true,
        assignee: true,
        project: true,
        tags: true,
        comments: {
          include: {
            author: true,
            replies: {
              include: {
                author: true,
              },
            },
          },
        },
        tasks: {
          include: {
            assignee: true,
          },
        },
        attachments: true,
        prds: {
          include: {
            author: true,
            reviews: {
              include: {
                reviewer: true,
              },
            },
          },
        },
      },
    }) as any;
  }

  // 删除Issue
  async deleteIssue(id: string, userId: string): Promise<boolean> {
    const existingIssue = await this.prisma.issue.findUnique({
      where: { id },
      include: { creator: true },
    });

    if (!existingIssue) {
      throw new NotFoundException('Issue not found');
    }

    // 权限检查：只有创建者或管理员可以删除
    if (existingIssue.creatorId !== userId) {
      throw new ForbiddenException('No permission to delete this issue');
    }

    await this.prisma.issue.delete({
      where: { id },
    });

    return true;
  }

  // 状态流转
  async transitionIssueStatus(
    id: string,
    targetStatus: IssueStatus,
    userId: string,
    comment?: string,
  ): Promise<any> {
    const issue = await this.findIssueById(id);

    // 验证状态流转是否合法
    if (!this.isValidStatusTransition(issue.status, targetStatus)) {
      throw new ForbiddenException(`Cannot transition from ${issue.status} to ${targetStatus}`);
    }

    // 更新Issue状态
    const updatedIssue = await this.prisma.issue.update({
      where: { id },
      data: { status: targetStatus },
      include: {
        creator: true,
        assignee: true,
        project: true,
        tags: true,
        comments: {
          include: {
            author: true,
            replies: {
              include: {
                author: true,
              },
            },
          },
        },
        tasks: {
          include: {
            assignee: true,
          },
        },
        attachments: true,
        prds: {
          include: {
            author: true,
            reviews: {
              include: {
                reviewer: true,
              },
            },
          },
        },
      },
    }) as any;

    // 如果有评论，添加状态变更评论
    if (comment) {
      await this.addIssueComment(id, `状态变更：${issue.status} → ${targetStatus}\n\n${comment}`, userId);
    }

    return updatedIssue;
  }

  // 添加Issue评论
  async addIssueComment(
    issueId: string,
    content: string,
    authorId: string,
    parentId?: string,
  ) {
    return this.prisma.issueComment.create({
      data: {
        content,
        issueId,
        authorId,
        parentId,
      },
      include: {
        author: true,
        parent: true,
        replies: {
          include: {
            author: true,
          },
        },
      },
    });
  }

  // Issue统计
  async getIssueStats(projectId?: string, filters?: IssueFiltersInput) {
    const where: any = {};
    
    if (projectId) where.projectId = projectId;
    if (filters) {
      // 复用filters逻辑
      Object.assign(where, this.buildFiltersWhere(filters));
    }

    const [total, statusCounts, priorityCounts, inputSourceCounts] = await Promise.all([
      this.prisma.issue.count({ where }),
      this.prisma.issue.groupBy({
        by: ['status'],
        where,
        _count: { _all: true },
      }),
      this.prisma.issue.groupBy({
        by: ['priority'],
        where,
        _count: { _all: true },
      }),
      this.prisma.issue.groupBy({
        by: ['inputSource'],
        where,
        _count: { _all: true },
      }),
    ]);

    // 计算完成率
    const completedCount = statusCounts.find(s => s.status === 'COMPLETED')?._count._all || 0;
    const completionRate = total > 0 ? (completedCount / total) * 100 : 0;

    return {
      total,
      byStatus: statusCounts.map(s => ({ status: s.status, count: s._count._all })),
      byPriority: priorityCounts.map(p => ({ priority: p.priority, count: p._count._all })),
      byInputSource: inputSourceCounts.map(i => ({ inputSource: i.inputSource, count: i._count._all })),
      completionRate,
    };
  }

  // 验证状态流转是否合法
  private isValidStatusTransition(currentStatus: IssueStatus, targetStatus: IssueStatus): boolean {
    const validTransitions: Record<IssueStatus, IssueStatus[]> = {
      OPEN: ['IN_DISCUSSION', 'CANCELLED'],
      IN_DISCUSSION: ['APPROVED', 'REJECTED', 'CANCELLED'],
      APPROVED: ['IN_PRD', 'CANCELLED'],
      IN_PRD: ['IN_DEVELOPMENT', 'CANCELLED'],
      IN_DEVELOPMENT: ['IN_TESTING', 'CANCELLED'],
      IN_TESTING: ['IN_ACCEPTANCE', 'IN_DEVELOPMENT', 'CANCELLED'],
      IN_ACCEPTANCE: ['COMPLETED', 'IN_DEVELOPMENT', 'CANCELLED'],
      COMPLETED: [], // 已完成不能再转换
      REJECTED: [], // 已拒绝不能再转换
      CANCELLED: [], // 已取消不能再转换
    };

    return validTransitions[currentStatus]?.includes(targetStatus) || false;
  }

  // 构建筛选条件
  private buildFiltersWhere(filters: IssueFiltersInput): any {
    const where: any = {};
    
    if (filters.status?.length) where.status = { in: filters.status };
    if (filters.priority?.length) where.priority = { in: filters.priority };
    if (filters.inputSource?.length) where.inputSource = { in: filters.inputSource };
    if (filters.issueType?.length) where.issueType = { in: filters.issueType };
    if (filters.assigneeId) where.assigneeId = filters.assigneeId;
    if (filters.creatorId) where.creatorId = filters.creatorId;
    
    if (filters.keyword) {
      where.OR = [
        { title: { contains: filters.keyword, mode: 'insensitive' } },
        { description: { contains: filters.keyword, mode: 'insensitive' } },
      ];
    }

    if (filters.dateRange) {
      where.createdAt = {
        gte: filters.dateRange.startDate,
        lte: filters.dateRange.endDate,
      };
    }

    return where;
  }
}
