import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { Prisma, TeamMemberRole } from '@prisma/client';

export interface CreateTeamInput {
  name: string;
  description?: string;
  departmentId?: string;
}

export interface UpdateTeamInput {
  name?: string;
  description?: string;
  departmentId?: string;
  isActive?: boolean;
}

export interface TeamFilters {
  departmentId?: string;
  isActive?: boolean;
  search?: string;
}

export interface AddTeamMemberInput {
  teamId: string;
  userId: string;
  role?: TeamMemberRole;
}

@Injectable()
export class TeamsService {
  constructor(private prisma: PrismaService) {}

  async findAll(filters?: TeamFilters, skip?: number, take?: number) {
    const where: Prisma.TeamWhereInput = {};

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
          { description: { contains: filters.search, mode: 'insensitive' } },
        ];
      }
    }

    const [teams, total] = await Promise.all([
      this.prisma.team.findMany({
        where,
        include: {
          department: true,
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
          projects: {
            select: {
              id: true,
              name: true,
              status: true,
            },
          },
          _count: {
            select: {
              members: true,
              projects: true,
            },
          },
        },
        skip,
        take,
        orderBy: {
          createdAt: 'desc',
        },
      }),
      this.prisma.team.count({ where }),
    ]);

    return {
      teams,
      total,
    };
  }

  async findOne(id: string) {
    const team = await this.prisma.team.findUnique({
      where: { id },
      include: {
        department: true,
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
          orderBy: [
            { role: 'desc' }, // LEADER first
            { joinedAt: 'asc' },
          ],
        },
        projects: {
          include: {
            owner: {
              select: {
                id: true,
                name: true,
                username: true,
              },
            },
            _count: {
              select: {
                tasks: true,
                members: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
        _count: {
          select: {
            members: true,
            projects: true,
          },
        },
      },
    });

    if (!team) {
      throw new NotFoundException('团队不存在');
    }

    return team;
  }

  async create(createTeamInput: CreateTeamInput, currentUserId: string) {
    // 验证部门是否存在
    if (createTeamInput.departmentId) {
      const department = await this.prisma.department.findUnique({
        where: { id: createTeamInput.departmentId },
      });
      if (!department) {
        throw new NotFoundException('部门不存在');
      }
    }

    const team = await this.prisma.team.create({
      data: createTeamInput,
    });

    return this.findOne(team.id);
  }

  async update(id: string, updateTeamInput: UpdateTeamInput, currentUserId: string) {
    const team = await this.prisma.team.findUnique({
      where: { id },
    });

    if (!team) {
      throw new NotFoundException('团队不存在');
    }

    // 验证部门是否存在
    if (updateTeamInput.departmentId) {
      const department = await this.prisma.department.findUnique({
        where: { id: updateTeamInput.departmentId },
      });
      if (!department) {
        throw new NotFoundException('部门不存在');
      }
    }

    const updatedTeam = await this.prisma.team.update({
      where: { id },
      data: updateTeamInput,
    });

    return this.findOne(updatedTeam.id);
  }

  async delete(id: string, currentUserId: string) {
    const team = await this.prisma.team.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            members: true,
            projects: true,
          },
        },
      },
    });

    if (!team) {
      throw new NotFoundException('团队不存在');
    }

    // 检查是否有关联数据
    if (team._count.members > 0) {
      throw new ForbiddenException('团队还有成员，不能删除');
    }

    if (team._count.projects > 0) {
      throw new ForbiddenException('团队还有项目，不能删除');
    }

    await this.prisma.team.delete({
      where: { id },
    });

    return { success: true, message: '团队已删除' };
  }

  async addMember(input: AddTeamMemberInput, currentUserId: string) {
    const { teamId, userId, role = 'MEMBER' } = input;

    // 检查团队是否存在
    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
    });

    if (!team) {
      throw new NotFoundException('团队不存在');
    }

    // 检查用户是否存在
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    // 检查是否已经是成员
    const existingMember = await this.prisma.teamMember.findUnique({
      where: {
        userId_teamId: {
          userId,
          teamId,
        },
      },
    });

    if (existingMember) {
      throw new ForbiddenException('用户已经是团队成员');
    }

    await this.prisma.teamMember.create({
      data: {
        teamId,
        userId,
        role,
      },
    });

    return this.findOne(teamId);
  }

  async removeMember(teamId: string, userId: string, currentUserId: string) {
    const member = await this.prisma.teamMember.findUnique({
      where: {
        userId_teamId: {
          userId,
          teamId,
        },
      },
    });

    if (!member) {
      throw new NotFoundException('用户不是团队成员');
    }

    await this.prisma.teamMember.delete({
      where: {
        userId_teamId: {
          userId,
          teamId,
        },
      },
    });

    return this.findOne(teamId);
  }

  async updateMemberRole(teamId: string, userId: string, role: TeamMemberRole, currentUserId: string) {
    const member = await this.prisma.teamMember.findUnique({
      where: {
        userId_teamId: {
          userId,
          teamId,
        },
      },
    });

    if (!member) {
      throw new NotFoundException('用户不是团队成员');
    }

    await this.prisma.teamMember.update({
      where: {
        userId_teamId: {
          userId,
          teamId,
        },
      },
      data: {
        role,
      },
    });

    return this.findOne(teamId);
  }

  async getTeamStats(id: string) {
    const [
      totalMembers,
      totalProjects,
      activeProjects,
      completedProjects,
    ] = await Promise.all([
      this.prisma.teamMember.count({
        where: { teamId: id },
      }),
      this.prisma.project.count({
        where: { teamId: id },
      }),
      this.prisma.project.count({
        where: { teamId: id, status: 'ACTIVE' },
      }),
      this.prisma.project.count({
        where: { teamId: id, status: 'COMPLETED' },
      }),
    ]);

    return {
      totalMembers,
      totalProjects,
      activeProjects,
      completedProjects,
    };
  }
}

