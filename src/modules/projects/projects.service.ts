import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { Prisma, ProjectStatus, Priority, ProjectMemberRole } from '@prisma/client';

export interface CreateProjectInput {
  name: string;
  key: string;
  description?: string;
  status?: ProjectStatus;
  priority?: Priority;
  startDate?: Date;
  endDate?: Date;
  teamId?: string;
  memberIds?: string[];
}

export interface UpdateProjectInput {
  name?: string;
  description?: string;
  status?: ProjectStatus;
  priority?: Priority;
  startDate?: Date;
  endDate?: Date;
  teamId?: string;
}

export interface ProjectFilters {
  status?: ProjectStatus;
  priority?: Priority;
  ownerId?: string;
  teamId?: string;
  search?: string;
  memberUserId?: string; // 用户参与的项目
}

export interface AddProjectMemberInput {
  projectId: string;
  userId: string;
  role?: ProjectMemberRole;
}

@Injectable()
export class ProjectsService {
  constructor(private prisma: PrismaService) {}

  async findAll(filters?: ProjectFilters, skip?: number, take?: number) {
    const where: Prisma.ProjectWhereInput = {};

    if (filters) {
      if (filters.status) {
        where.status = filters.status;
      }
      
      if (filters.priority) {
        where.priority = filters.priority;
      }

      if (filters.ownerId) {
        where.ownerId = filters.ownerId;
      }

      if (filters.teamId) {
        where.teamId = filters.teamId;
      }

      if (filters.memberUserId) {
        where.OR = [
          { ownerId: filters.memberUserId },
          { members: { some: { userId: filters.memberUserId } } },
        ];
      }

      if (filters.search) {
        where.OR = [
          { name: { contains: filters.search, mode: 'insensitive' } },
          { key: { contains: filters.search, mode: 'insensitive' } },
          { description: { contains: filters.search, mode: 'insensitive' } },
        ];
      }
    }

    const [projects, total] = await Promise.all([
      this.prisma.project.findMany({
        where,
        include: {
          owner: {
            select: {
              id: true,
              name: true,
              username: true,
              avatar: true,
            },
          },
          team: {
            select: {
              id: true,
              name: true,
            },
          },
          members: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  username: true,
                  avatar: true,
                },
              },
            },
          },
          _count: {
            select: {
              tasks: true,
              members: true,
            },
          },
        },
        skip,
        take,
        orderBy: {
          createdAt: 'desc',
        },
      }),
      this.prisma.project.count({ where }),
    ]);

    return {
      projects: projects.map(project => ({
        ...project,
        memberCount: project._count.members + 1, // +1 for owner
        taskCount: project._count.tasks,
      })),
      total,
    };
  }

  async findOne(id: string, currentUserId?: string) {
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            username: true,
            avatar: true,
            email: true,
          },
        },
        team: {
          include: {
            department: true,
          },
        },
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                username: true,
                avatar: true,
                email: true,
              },
            },
          },
        },
        tasks: {
          include: {
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
              },
            },
            _count: {
              select: {
                comments: true,
                children: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
        workflows: {
          include: {
            states: {
              orderBy: {
                order: 'asc',
              },
            },
          },
        },
        _count: {
          select: {
            tasks: true,
            members: true,
          },
        },
      },
    });

    if (!project) {
      throw new NotFoundException('项目不存在');
    }

    // 检查用户是否有权限访问此项目
    if (currentUserId) {
      const hasAccess = project.ownerId === currentUserId || 
        project.members.some(member => member.userId === currentUserId);
      
      if (!hasAccess) {
        // 检查用户权限，如果有 project:read 权限则可以访问
        const user = await this.prisma.user.findUnique({
          where: { id: currentUserId },
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

        const hasProjectReadPermission = user?.userRoles.some(ur =>
          ur.role.rolePermissions.some(rp => rp.permission.name === 'project:read')
        );

        if (!hasProjectReadPermission) {
          throw new ForbiddenException('无权限访问此项目');
        }
      }
    }

    return {
      ...project,
      memberCount: project._count.members + 1,
      taskCount: project._count.tasks,
    };
  }

  async create(createProjectInput: CreateProjectInput, currentUserId: string) {
    const { memberIds = [], ...projectData } = createProjectInput;

    // 检查项目key是否已存在
    const existingProject = await this.prisma.project.findUnique({
      where: { key: projectData.key },
    });

    if (existingProject) {
      throw new ForbiddenException('项目标识符已存在');
    }

    // 验证团队是否存在
    if (projectData.teamId) {
      const team = await this.prisma.team.findUnique({
        where: { id: projectData.teamId },
      });
      if (!team) {
        throw new NotFoundException('团队不存在');
      }
    }

    // 验证成员是否存在
    if (memberIds.length > 0) {
      const users = await this.prisma.user.findMany({
        where: { id: { in: memberIds } },
      });
      if (users.length !== memberIds.length) {
        throw new NotFoundException('部分用户不存在');
      }
    }

    // 创建项目
    const project = await this.prisma.project.create({
      data: {
        ...projectData,
        ownerId: currentUserId,
      },
    });

    // 添加项目成员
    if (memberIds.length > 0) {
      await this.prisma.projectMember.createMany({
        data: memberIds.map(userId => ({
          projectId: project.id,
          userId,
          role: 'MEMBER',
        })),
      });
    }

    // 创建默认工作流
    await this.createDefaultWorkflow(project.id);

    return this.findOne(project.id);
  }

  async update(id: string, updateProjectInput: UpdateProjectInput, currentUserId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: {
        members: true,
      },
    });

    if (!project) {
      throw new NotFoundException('项目不存在');
    }

    // 检查权限：项目所有者或有 project:update 权限
    const hasAccess = await this.checkProjectAccess(id, currentUserId, 'update');
    if (!hasAccess) {
      throw new ForbiddenException('无权限修改此项目');
    }

    // 验证团队是否存在
    if (updateProjectInput.teamId) {
      const team = await this.prisma.team.findUnique({
        where: { id: updateProjectInput.teamId },
      });
      if (!team) {
        throw new NotFoundException('团队不存在');
      }
    }

    const updatedProject = await this.prisma.project.update({
      where: { id },
      data: updateProjectInput,
    });

    return this.findOne(updatedProject.id);
  }

  async delete(id: string, currentUserId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            tasks: true,
          },
        },
      },
    });

    if (!project) {
      throw new NotFoundException('项目不存在');
    }

    // 检查权限：项目所有者或有 project:delete 权限
    const hasAccess = await this.checkProjectAccess(id, currentUserId, 'delete');
    if (!hasAccess) {
      throw new ForbiddenException('无权限删除此项目');
    }

    // 检查是否有任务
    if (project._count.tasks > 0) {
      throw new ForbiddenException('项目下还有任务，不能删除');
    }

    await this.prisma.project.delete({
      where: { id },
    });

    return { success: true, message: '项目已删除' };
  }

  async addMember(input: AddProjectMemberInput, currentUserId: string) {
    const { projectId, userId, role = 'MEMBER' } = input;

    // 检查项目是否存在
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new NotFoundException('项目不存在');
    }

    // 检查权限
    const hasAccess = await this.checkProjectAccess(projectId, currentUserId, 'update');
    if (!hasAccess) {
      throw new ForbiddenException('无权限添加项目成员');
    }

    // 检查用户是否存在
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    // 检查是否已经是成员
    const existingMember = await this.prisma.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId,
          userId,
        },
      },
    });

    if (existingMember) {
      throw new ForbiddenException('用户已经是项目成员');
    }

    // 检查是否是项目所有者
    if (project.ownerId === userId) {
      throw new ForbiddenException('项目所有者无需添加为成员');
    }

    await this.prisma.projectMember.create({
      data: {
        projectId,
        userId,
        role,
      },
    });

    return this.findOne(projectId);
  }

  async removeMember(projectId: string, userId: string, currentUserId: string) {
    // 检查权限
    const hasAccess = await this.checkProjectAccess(projectId, currentUserId, 'update');
    if (!hasAccess) {
      throw new ForbiddenException('无权限移除项目成员');
    }

    const member = await this.prisma.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId,
          userId,
        },
      },
    });

    if (!member) {
      throw new NotFoundException('用户不是项目成员');
    }

    await this.prisma.projectMember.delete({
      where: {
        projectId_userId: {
          projectId,
          userId,
        },
      },
    });

    return this.findOne(projectId);
  }

  async getProjectStats(id: string) {
    const [
      totalTasks,
      completedTasks,
      inProgressTasks,
      todoTasks,
      totalMembers,
      totalWorkHours,
    ] = await Promise.all([
      this.prisma.task.count({
        where: { projectId: id },
      }),
      this.prisma.task.count({
        where: { projectId: id, status: 'DONE' },
      }),
      this.prisma.task.count({
        where: { projectId: id, status: 'IN_PROGRESS' },
      }),
      this.prisma.task.count({
        where: { projectId: id, status: 'TODO' },
      }),
      this.prisma.projectMember.count({
        where: { projectId: id },
      }),
      this.prisma.timeLog.aggregate({
        where: {
          task: {
            projectId: id,
          },
        },
        _sum: { hours: true },
      }),
    ]);

    return {
      totalTasks,
      completedTasks,
      inProgressTasks,
      todoTasks,
      totalMembers: totalMembers + 1, // +1 for owner
      totalWorkHours: totalWorkHours._sum.hours || 0,
      completionRate: totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0,
    };
  }

  private async checkProjectAccess(projectId: string, userId: string, action: string): Promise<boolean> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        members: true,
      },
    });

    if (!project) {
      return false;
    }

    // 项目所有者总是有权限
    if (project.ownerId === userId) {
      return true;
    }

    // 检查是否是项目成员 (针对读取权限)
    if (action === 'read') {
      const isMember = project.members.some(member => member.userId === userId);
      if (isMember) {
        return true;
      }
    }

    // 检查用户是否有相应的权限
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
      ur.role.rolePermissions.some(rp => rp.permission.name === `project:${action}`)
    );

    return hasPermission || false;
  }

  private async createDefaultWorkflow(projectId: string) {
    const workflow = await this.prisma.workflow.create({
      data: {
        name: '标准开发流程',
        description: '标准的任务开发流程',
        isDefault: true,
        projectId,
      },
    });

    const states = [
      { name: '待办', color: '#gray', order: 1, isInitial: true },
      { name: '进行中', color: '#blue', order: 2 },
      { name: '待审查', color: '#yellow', order: 3 },
      { name: '已完成', color: '#green', order: 4, isFinal: true },
    ];

    await this.prisma.workflowState.createMany({
      data: states.map(state => ({
        ...state,
        workflowId: workflow.id,
      })),
    });

    return workflow;
  }
}
