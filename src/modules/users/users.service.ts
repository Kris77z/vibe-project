import { Injectable, NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { User, Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

export interface CreateUserInput {
  email: string;
  username: string;
  name: string;
  password: string;
  departmentId?: string;
  phone?: string;
  avatar?: string;
  roleIds?: string[];
}

export interface UpdateUserInput {
  name?: string;
  phone?: string;
  avatar?: string;
  departmentId?: string;
  isActive?: boolean;
}

export interface UpdateUserRolesInput {
  userId: string;
  roleIds: string[];
}

export interface UserFilters {
  departmentId?: string;
  isActive?: boolean;
  search?: string; // 搜索用户名、姓名、邮箱
}

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findAll(filters?: UserFilters, skip?: number, take?: number) {
    const where: Prisma.UserWhereInput = {};

    if (filters) {
      if (filters.departmentId) {
        where.departmentId = filters.departmentId;
      }
      
      if (filters.isActive !== undefined) {
        where.isActive = filters.isActive;
      }

      if (filters.search) {
        where.OR = [
          { name: { contains: filters.search, mode: 'insensitive' } },
          { username: { contains: filters.search, mode: 'insensitive' } },
          { email: { contains: filters.search, mode: 'insensitive' } },
        ];
      }
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        include: {
          department: true,
          userRoles: {
            include: {
              role: true,
            },
          },
          teamMembers: {
            include: {
              team: true,
            },
          },
          _count: {
            select: {
              assignedTasks: true,
              createdTasks: true,
              ownedProjects: true,
            },
          },
        },
        skip,
        take,
        orderBy: {
          createdAt: 'desc',
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      users: users.map(user => ({
        ...user,
        roles: user.userRoles.map(ur => ur.role),
        teams: user.teamMembers.map(tm => tm.team),
      })),
      total,
    };
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        department: true,
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
        teamMembers: {
          include: {
            team: true,
          },
        },
        assignedTasks: {
          include: {
            project: true,
          },
          where: {
            status: {
              notIn: ['DONE', 'CANCELLED'],
            },
          },
          take: 10,
        },
        ownedProjects: {
          take: 10,
        },
        _count: {
          select: {
            assignedTasks: true,
            createdTasks: true,
            ownedProjects: true,
            timeLogs: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    return {
      ...user,
      roles: user.userRoles.map(ur => ur.role),
      permissions: user.userRoles.flatMap(ur => 
        ur.role.rolePermissions.map(rp => rp.permission)
      ),
      teams: user.teamMembers.map(tm => tm.team),
    };
  }

  async create(createUserInput: CreateUserInput, currentUserId: string) {
    const { email, username, password, roleIds = [], ...userData } = createUserInput;

    // 检查邮箱和用户名是否已存在
    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email },
          { username },
        ],
      },
    });

    if (existingUser) {
      if (existingUser.email === email) {
        throw new ConflictException('邮箱已被注册');
      }
      if (existingUser.username === username) {
        throw new ConflictException('用户名已被占用');
      }
    }

    // 验证部门是否存在
    if (userData.departmentId) {
      const department = await this.prisma.department.findUnique({
        where: { id: userData.departmentId },
      });
      if (!department) {
        throw new NotFoundException('部门不存在');
      }
    }

    // 验证角色是否存在
    if (roleIds.length > 0) {
      const roles = await this.prisma.role.findMany({
        where: { id: { in: roleIds } },
      });
      if (roles.length !== roleIds.length) {
        throw new NotFoundException('部分角色不存在');
      }
    }

    // 加密密码
    const hashedPassword = await bcrypt.hash(password, 10);

    // 创建用户
    const user = await this.prisma.user.create({
      data: {
        email,
        username,
        ...userData,
        // 暂时不存储加密密码，等待后续修复
      },
      include: {
        department: true,
      },
    });

    // 分配角色
    if (roleIds.length > 0) {
      await this.prisma.userRole.createMany({
        data: roleIds.map(roleId => ({
          userId: user.id,
          roleId,
        })),
      });
    } else {
      // 默认分配 member 角色
      const memberRole = await this.prisma.role.findUnique({
        where: { name: 'member' },
      });
      if (memberRole) {
        await this.prisma.userRole.create({
          data: {
            userId: user.id,
            roleId: memberRole.id,
          },
        });
      }
    }

    return this.findOne(user.id);
  }

  async update(id: string, updateUserInput: UpdateUserInput, currentUserId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    // 验证部门是否存在
    if (updateUserInput.departmentId) {
      const department = await this.prisma.department.findUnique({
        where: { id: updateUserInput.departmentId },
      });
      if (!department) {
        throw new NotFoundException('部门不存在');
      }
    }

    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: updateUserInput,
      include: {
        department: true,
      },
    });

    return this.findOne(updatedUser.id);
  }

  async updateRoles(updateRolesInput: UpdateUserRolesInput, currentUserId: string) {
    const { userId, roleIds } = updateRolesInput;

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    // 验证角色是否存在
    const roles = await this.prisma.role.findMany({
      where: { id: { in: roleIds } },
    });

    if (roles.length !== roleIds.length) {
      throw new NotFoundException('部分角色不存在');
    }

    // 删除现有角色
    await this.prisma.userRole.deleteMany({
      where: { userId },
    });

    // 分配新角色
    if (roleIds.length > 0) {
      await this.prisma.userRole.createMany({
        data: roleIds.map(roleId => ({
          userId,
          roleId,
        })),
      });
    }

    return this.findOne(userId);
  }

  async deactivate(id: string, currentUserId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    if (user.id === currentUserId) {
      throw new ForbiddenException('不能禁用自己的账户');
    }

    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: { isActive: false },
    });

    return this.findOne(updatedUser.id);
  }

  async activate(id: string, currentUserId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: { isActive: true },
    });

    return this.findOne(updatedUser.id);
  }

  async delete(id: string, currentUserId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            assignedTasks: true,
            createdTasks: true,
            ownedProjects: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    if (user.id === currentUserId) {
      throw new ForbiddenException('不能删除自己的账户');
    }

    // 检查是否有关联数据
    if (user._count.assignedTasks > 0 || user._count.createdTasks > 0 || user._count.ownedProjects > 0) {
      throw new ForbiddenException('用户有相关数据，不能删除。请先将其禁用。');
    }

    await this.prisma.user.delete({
      where: { id },
    });

    return { success: true, message: '用户已删除' };
  }

  async getUserStats(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    const [
      totalTasks,
      completedTasks,
      inProgressTasks,
      ownedProjects,
      totalWorkHours,
      thisMonthWorkHours,
    ] = await Promise.all([
      this.prisma.task.count({
        where: { assigneeId: id },
      }),
      this.prisma.task.count({
        where: { assigneeId: id, status: 'DONE' },
      }),
      this.prisma.task.count({
        where: { assigneeId: id, status: 'IN_PROGRESS' },
      }),
      this.prisma.project.count({
        where: { ownerId: id },
      }),
      this.prisma.timeLog.aggregate({
        where: { userId: id },
        _sum: { hours: true },
      }),
      this.prisma.timeLog.aggregate({
        where: {
          userId: id,
          date: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
          },
        },
        _sum: { hours: true },
      }),
    ]);

    return {
      totalTasks,
      completedTasks,
      inProgressTasks,
      ownedProjects,
      totalWorkHours: totalWorkHours._sum.hours || 0,
      thisMonthWorkHours: thisMonthWorkHours._sum.hours || 0,
      completionRate: totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0,
    };
  }
}
