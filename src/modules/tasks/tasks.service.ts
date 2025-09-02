import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { Prisma, TaskStatus, Priority, DependencyType } from '@prisma/client';

export interface CreateTaskInput {
  title: string;
  description?: string;
  status?: TaskStatus;
  priority?: Priority;
  projectId: string;
  assigneeId?: string;
  parentId?: string;
  startDate?: Date;
  dueDate?: Date;
  estimatedHours?: number;
  workflowStateId?: string;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  status?: TaskStatus;
  priority?: Priority;
  assigneeId?: string;
  startDate?: Date;
  dueDate?: Date;
  estimatedHours?: number;
  actualHours?: number;
  workflowStateId?: string;
}

export interface TaskFilters {
  projectId?: string;
  issueId?: string;
  status?: TaskStatus;
  priority?: Priority;
  assigneeId?: string;
  creatorId?: string;
  parentId?: string;
  search?: string;
  dueDateFrom?: Date;
  dueDateTo?: Date;
  hasAssignee?: boolean;
}

export interface CreateTaskDependencyInput {
  dependentTaskId: string;
  precedingTaskId: string;
  dependencyType?: DependencyType;
}

export interface TaskComment {
  content: string;
  taskId: string;
  parentId?: string;
}

@Injectable()
export class TasksService {
  constructor(private prisma: PrismaService) {}

  async findAll(filters?: TaskFilters, skip?: number, take?: number) {
    const where: Prisma.TaskWhereInput = {};

    if (filters) {
      if (filters.projectId) {
        where.projectId = filters.projectId;
      }

      if (filters.issueId) {
        where.issueId = filters.issueId;
      }
      
      if (filters.status) {
        where.status = filters.status;
      }

      if (filters.priority) {
        where.priority = filters.priority;
      }

      if (filters.assigneeId) {
        where.assigneeId = filters.assigneeId;
      }

      if (filters.creatorId) {
        where.creatorId = filters.creatorId;
      }

      if (filters.parentId !== undefined) {
        where.parentId = filters.parentId;
      }

      if (filters.hasAssignee !== undefined) {
        where.assigneeId = filters.hasAssignee ? { not: null } : null;
      }

      if (filters.dueDateFrom || filters.dueDateTo) {
        where.dueDate = {};
        if (filters.dueDateFrom) {
          where.dueDate.gte = filters.dueDateFrom;
        }
        if (filters.dueDateTo) {
          where.dueDate.lte = filters.dueDateTo;
        }
      }

      if (filters.search) {
        where.OR = [
          { title: { contains: filters.search, mode: 'insensitive' } },
          { description: { contains: filters.search, mode: 'insensitive' } },
        ];
      }
    }

    const [tasks, total] = await Promise.all([
      this.prisma.task.findMany({
        where,
        include: {
          project: {
            select: {
              id: true,
              name: true,
              key: true,
            },
          },
          assignee: {
            select: {
              id: true,
              name: true,
              username: true,
              avatar: true,
            },
          },
          creator: {
            select: {
              id: true,
              name: true,
              username: true,
              avatar: true,
            },
          },
          parent: {
            select: {
              id: true,
              title: true,
            },
          },
          workflowState: true,
          _count: {
            select: {
              children: true,
              comments: true,
              attachments: true,
              dependencies: true,
              dependents: true,
            },
          },
        },
        skip,
        take,
        orderBy: [
          { priority: 'desc' },
          { createdAt: 'desc' },
        ],
      }),
      this.prisma.task.count({ where }),
    ]);

    return {
      tasks,
      total,
    };
  }

  async findOne(id: string, currentUserId?: string) {
    const task = await this.prisma.task.findUnique({
      where: { id },
      include: {
        project: {
          include: {
            owner: {
              select: {
                id: true,
                name: true,
                username: true,
              },
            },
            members: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    username: true,
                  },
                },
              },
            },
          },
        },
        assignee: {
          select: {
            id: true,
            name: true,
            username: true,
            avatar: true,
            email: true,
          },
        },
        creator: {
          select: {
            id: true,
            name: true,
            username: true,
            avatar: true,
          },
        },
        parent: {
          select: {
            id: true,
            title: true,
            status: true,
          },
        },
        children: {
          include: {
            assignee: {
              select: {
                id: true,
                name: true,
                username: true,
                avatar: true,
              },
            },
            _count: {
              select: {
                children: true,
              },
            },
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
        dependencies: {
          include: {
            precedingTask: {
              select: {
                id: true,
                title: true,
                status: true,
              },
            },
          },
        },
        dependents: {
          include: {
            dependentTask: {
              select: {
                id: true,
                title: true,
                status: true,
              },
            },
          },
        },
        comments: {
          include: {
            author: {
              select: {
                id: true,
                name: true,
                username: true,
                avatar: true,
              },
            },
            replies: {
              include: {
                author: {
                  select: {
                    id: true,
                    name: true,
                    username: true,
                    avatar: true,
                  },
                },
              },
              orderBy: {
                createdAt: 'asc',
              },
            },
          },
          where: {
            parentId: null, // 只获取顶级评论
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
        attachments: {
          include: {
            uploader: {
              select: {
                id: true,
                name: true,
                username: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
        timeLogs: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                username: true,
              },
            },
          },
          orderBy: {
            date: 'desc',
          },
        },
        workflowState: true,
        _count: {
          select: {
            children: true,
            comments: true,
            attachments: true,
          },
        },
      },
    });

    if (!task) {
      throw new NotFoundException('任务不存在');
    }

    // 检查用户是否有权限访问此任务
    if (currentUserId) {
      const hasAccess = await this.checkTaskAccess(task, currentUserId);
      if (!hasAccess) {
        throw new ForbiddenException('无权限访问此任务');
      }
    }

    return task;
  }

  async create(createTaskInput: CreateTaskInput, currentUserId: string) {
    const { projectId, assigneeId, parentId, ...taskData } = createTaskInput;

    // 验证项目是否存在及权限
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        members: true,
      },
    });

    if (!project) {
      throw new NotFoundException('项目不存在');
    }

    // 检查是否有项目访问权限
    const hasProjectAccess = project.ownerId === currentUserId || 
      project.members.some(member => member.userId === currentUserId);

    if (!hasProjectAccess) {
      // 检查用户是否有 task:create 权限
      const hasPermission = await this.checkUserPermission(currentUserId, 'task:create');
      if (!hasPermission) {
        throw new ForbiddenException('无权限在此项目中创建任务');
      }
    }

    // 验证指派人是否存在
    if (assigneeId) {
      const assignee = await this.prisma.user.findUnique({
        where: { id: assigneeId },
      });
      if (!assignee) {
        throw new NotFoundException('指派用户不存在');
      }
    }

    // 验证父任务是否存在且属于同一项目
    if (parentId) {
      const parentTask = await this.prisma.task.findUnique({
        where: { id: parentId },
      });
      if (!parentTask) {
        throw new NotFoundException('父任务不存在');
      }
      if (parentTask.projectId !== projectId) {
        throw new ForbiddenException('父任务必须属于同一项目');
      }
    }

    const task = await this.prisma.task.create({
      data: {
        ...taskData,
        projectId,
        assigneeId,
        parentId,
        creatorId: currentUserId,
      },
    });

    return this.findOne(task.id);
  }

  async update(id: string, updateTaskInput: UpdateTaskInput, currentUserId: string) {
    const task = await this.prisma.task.findUnique({
      where: { id },
      include: {
        project: {
          include: {
            members: true,
          },
        },
      },
    });

    if (!task) {
      throw new NotFoundException('任务不存在');
    }

    // 检查权限
    const hasAccess = await this.checkTaskAccess(task, currentUserId);
    if (!hasAccess) {
      throw new ForbiddenException('无权限修改此任务');
    }

    // 验证指派人是否存在
    if (updateTaskInput.assigneeId) {
      const assignee = await this.prisma.user.findUnique({
        where: { id: updateTaskInput.assigneeId },
      });
      if (!assignee) {
        throw new NotFoundException('指派用户不存在');
      }
    }

    const updatedTask = await this.prisma.task.update({
      where: { id },
      data: updateTaskInput,
    });

    return this.findOne(updatedTask.id);
  }

  async delete(id: string, currentUserId: string) {
    const task = await this.prisma.task.findUnique({
      where: { id },
      include: {
        project: {
          include: {
            members: true,
          },
        },
        _count: {
          select: {
            children: true,
            comments: true,
            timeLogs: true,
          },
        },
      },
    });

    if (!task) {
      throw new NotFoundException('任务不存在');
    }

    // 检查权限
    const hasAccess = await this.checkTaskAccess(task, currentUserId, 'delete');
    if (!hasAccess) {
      throw new ForbiddenException('无权限删除此任务');
    }

    // 检查是否有子任务
    if (task._count.children > 0) {
      throw new ForbiddenException('任务下还有子任务，不能删除');
    }

    // 检查是否有时间记录
    if (task._count.timeLogs > 0) {
      throw new ForbiddenException('任务有工时记录，不能删除');
    }

    await this.prisma.task.delete({
      where: { id },
    });

    return { success: true, message: '任务已删除' };
  }

  async addDependency(input: CreateTaskDependencyInput, currentUserId: string) {
    const { dependentTaskId, precedingTaskId, dependencyType = 'FINISH_TO_START' } = input;

    // 验证两个任务都存在
    const [dependentTask, precedingTask] = await Promise.all([
      this.prisma.task.findUnique({
        where: { id: dependentTaskId },
        include: { project: { include: { members: true } } },
      }),
      this.prisma.task.findUnique({
        where: { id: precedingTaskId },
        include: { project: { include: { members: true } } },
      }),
    ]);

    if (!dependentTask) {
      throw new NotFoundException('依赖任务不存在');
    }
    if (!precedingTask) {
      throw new NotFoundException('前置任务不存在');
    }

    // 检查权限
    const hasAccess = await this.checkTaskAccess(dependentTask, currentUserId);
    if (!hasAccess) {
      throw new ForbiddenException('无权限修改任务依赖关系');
    }

    // 防止循环依赖
    if (dependentTaskId === precedingTaskId) {
      throw new ForbiddenException('任务不能依赖自己');
    }

    // 检查是否已存在依赖关系
    const existingDependency = await this.prisma.taskDependency.findUnique({
      where: {
        dependentTaskId_precedingTaskId: {
          dependentTaskId,
          precedingTaskId,
        },
      },
    });

    if (existingDependency) {
      throw new ForbiddenException('依赖关系已存在');
    }

    await this.prisma.taskDependency.create({
      data: {
        dependentTaskId,
        precedingTaskId,
        dependencyType,
      },
    });

    return this.findOne(dependentTaskId);
  }

  async removeDependency(dependentTaskId: string, precedingTaskId: string, currentUserId: string) {
    const dependentTask = await this.prisma.task.findUnique({
      where: { id: dependentTaskId },
      include: { project: { include: { members: true } } },
    });

    if (!dependentTask) {
      throw new NotFoundException('任务不存在');
    }

    // 检查权限
    const hasAccess = await this.checkTaskAccess(dependentTask, currentUserId);
    if (!hasAccess) {
      throw new ForbiddenException('无权限修改任务依赖关系');
    }

    const dependency = await this.prisma.taskDependency.findUnique({
      where: {
        dependentTaskId_precedingTaskId: {
          dependentTaskId,
          precedingTaskId,
        },
      },
    });

    if (!dependency) {
      throw new NotFoundException('依赖关系不存在');
    }

    await this.prisma.taskDependency.delete({
      where: {
        dependentTaskId_precedingTaskId: {
          dependentTaskId,
          precedingTaskId,
        },
      },
    });

    return this.findOne(dependentTaskId);
  }

  async addComment(comment: TaskComment, currentUserId: string) {
    const { taskId, ...commentData } = comment;

    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: { project: { include: { members: true } } },
    });

    if (!task) {
      throw new NotFoundException('任务不存在');
    }

    // 检查权限
    const hasAccess = await this.checkTaskAccess(task, currentUserId);
    if (!hasAccess) {
      throw new ForbiddenException('无权限评论此任务');
    }

    const createdComment = await this.prisma.comment.create({
      data: {
        ...commentData,
        taskId,
        authorId: currentUserId,
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            username: true,
            avatar: true,
          },
        },
      },
    });

    return createdComment;
  }

  async getTaskStats(filters?: TaskFilters) {
    const where: Prisma.TaskWhereInput = {};

    if (filters) {
      if (filters.projectId) where.projectId = filters.projectId;
      if (filters.assigneeId) where.assigneeId = filters.assigneeId;
      if (filters.creatorId) where.creatorId = filters.creatorId;
    }

    const [
      totalTasks,
      todoTasks,
      inProgressTasks,
      inReviewTasks,
      doneTasks,
      cancelledTasks,
      overdueTasks,
    ] = await Promise.all([
      this.prisma.task.count({ where }),
      this.prisma.task.count({ where: { ...where, status: 'TODO' } }),
      this.prisma.task.count({ where: { ...where, status: 'IN_PROGRESS' } }),
      this.prisma.task.count({ where: { ...where, status: 'IN_REVIEW' } }),
      this.prisma.task.count({ where: { ...where, status: 'DONE' } }),
      this.prisma.task.count({ where: { ...where, status: 'CANCELLED' } }),
      this.prisma.task.count({
        where: {
          ...where,
          dueDate: { lt: new Date() },
          status: { notIn: ['DONE', 'CANCELLED'] },
        },
      }),
    ]);

    return {
      totalTasks,
      todoTasks,
      inProgressTasks,
      inReviewTasks,
      doneTasks,
      cancelledTasks,
      overdueTasks,
      completionRate: totalTasks > 0 ? (doneTasks / totalTasks) * 100 : 0,
    };
  }

  private async checkTaskAccess(task: any, userId: string, action: string = 'read'): Promise<boolean> {
    // 任务创建者总是有权限
    if (task.creatorId === userId) {
      return true;
    }

    // 任务指派人有读取和更新权限
    if (task.assigneeId === userId && (action === 'read' || action === 'update')) {
      return true;
    }

    // 项目所有者有权限
    if (task.project.ownerId === userId) {
      return true;
    }

    // 项目成员有读取权限
    if (action === 'read') {
      const isMember = task.project.members.some((member: any) => member.userId === userId);
      if (isMember) {
        return true;
      }
    }

    // 检查用户权限
    const hasPermission = await this.checkUserPermission(userId, `task:${action}`);
    return hasPermission;
  }

  private async checkUserPermission(userId: string, permission: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        userRoles: {
          include: {
            role: {
              include: {
                rolePermissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    const hasPermission = user?.userRoles.some(ur =>
      ur.role.rolePermissions.some(rp => rp.permission.name === permission)
    );

    return hasPermission || false;
  }
}

