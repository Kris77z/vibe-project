import { Injectable, NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { User, Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { AccessControlService } from '../access-control/access-control.service';
import { StorageService } from '../storage/storage.service';

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

export interface UpdateUserFieldValueEntry {
  fieldKey: string;
  valueString?: string;
  valueNumber?: number;
  valueDate?: string; // ISO date string
  valueJson?: any;
}

export interface UpdateUserRolesInput {
  userId: string;
  roleIds: string[];
}

export interface CreateUserAttachmentInputService {
  userId: string;
  attachmentType: string; // Prisma AttachmentType key
  filename: string;
  fileUrl: string;
  mimeType?: string;
  fileSize?: number;
  notes?: string;
}

export interface UserFilters {
  departmentId?: string;
  isActive?: boolean;
  search?: string; // 搜索用户名、姓名、邮箱
}

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService, private acl: AccessControlService, private storage?: StorageService) {}

  async findAll(filters?: UserFilters, skip?: number, take?: number, currentUserId?: string) {
    // 基于组织可见性生成基础 where
    const baseWhere: Prisma.UserWhereInput = currentUserId
      ? await this.acl.getAccessibleUserWhere(currentUserId)
      : {};

    const where: Prisma.UserWhereInput = { ...baseWhere };

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

  // ===== 附件：登记与删除 =====
  async createUserAttachment(currentUserId: string, input: CreateUserAttachmentInputService) {
    const canUpdate = await this.acl.hasPermission(currentUserId, 'user', 'update');
    if (!canUpdate) throw new ForbiddenException('无权上传附件');

    // 极敏感：后续可加入更细粒度校验（仅HR/超管），这里先沿用 user:update 权限
    const { userId, attachmentType, filename, fileUrl, mimeType, fileSize, notes } = input;

    const attachment = await this.prisma.attachment.create({
      data: {
        filename,
        fileUrl,
        mimeType: mimeType || 'application/octet-stream',
        fileSize: fileSize || 0,
        uploaderId: currentUserId,
      },
    });

    await this.prisma.userAttachmentRef.create({
      data: {
        userId,
        attachmentId: attachment.id,
        attachmentType: attachmentType as any,
        notes,
      },
    });

    return this.findOne(userId);
  }

  async deleteUserAttachment(currentUserId: string, userAttachmentRefId: string) {
    const canUpdate = await this.acl.hasPermission(currentUserId, 'user', 'update');
    if (!canUpdate) throw new ForbiddenException('无权删除附件');

    const ref = await this.prisma.userAttachmentRef.findUnique({ where: { id: userAttachmentRefId } });
    if (!ref) throw new NotFoundException('附件记录不存在');

    // 先删引用，再删底层附件对象（注意：若一个附件被多处引用，需改为引用计数；当前仅人员档案使用）
    await this.prisma.userAttachmentRef.delete({ where: { id: userAttachmentRefId } });
    await this.prisma.attachment.delete({ where: { id: ref.attachmentId } }).catch(() => null);

    return this.findOne(ref.userId);
  }

  // ===== 假期余额：基于交易聚合 =====
  async getUserLeaveBalances(targetUserId: string, currentUserId: string) {
    const canRead = await this.acl.hasPermission(currentUserId, 'user', 'read');
    if (!canRead) throw new ForbiddenException('无权查看');

    // 进一步：仅 HR/超管可见（按你确认的策略）
    const current = await this.prisma.user.findUnique({
      where: { id: currentUserId },
      include: { userRoles: { include: { role: true } } },
    });
    const roleNames = current?.userRoles?.map((ur) => ur.role.name) || [];
    const isHRorSuper = roleNames.includes('hr_manager') || roleNames.includes('super_admin');
    if (!isHRorSuper) {
      throw new ForbiddenException('无权查看假期余额');
    }

    const rows = await this.prisma.leaveTransaction.groupBy({
      by: ['type'],
      where: { userId: targetUserId },
      _sum: { amount: true },
    });

    // 默认所有类型为0
    const allTypes = [
      'ANNUAL','PERSONAL','PAID_SICK','MARRIAGE','MATERNITY','PATERNITY','FUNERAL','PRENATAL_CHECK','SICK','OTHER',
    ];
    const map = new Map<string, number>();
    rows.forEach((r: any) => map.set(r.type, r._sum.amount || 0));

    return allTypes.map((t) => ({
      type: t,
      total: Math.max(0, map.get(t) || 0),
      used: Math.min(0, map.get(t) || 0),
      available: map.get(t) || 0,
    }));
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        department: true,
        userFieldValues: {
          include: { field: true },
        },
        educations: true,
        workExperiences: true,
        familyMembers: true,
        emergencyContacts: true,
        contracts: true,
        documents: true,
        bankAccounts: true,
        attachmentRefs: {
          include: { attachment: true },
        },
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

    // 规范化字段：将 Prisma 的 userFieldValues/attachmentRefs 映射到 GraphQL 需要的名字
    const fieldValues = (user.userFieldValues || []).map((fv: any) => ({
      id: fv.id,
      fieldKey: fv.field?.key || '',
      valueString: fv.valueString ?? undefined,
      valueNumber: fv.valueNumber ?? undefined,
      valueDate: fv.valueDate ?? undefined,
      valueJson: fv.valueJson ?? undefined,
    }));

    const attachments = (user.attachmentRefs || []).map((ref: any) => ({
      id: ref.id,
      attachmentType: ref.attachmentType,
      notes: ref.notes,
      attachment: ref.attachment,
    }));

    return {
      ...user,
      roles: user.userRoles.map(ur => ur.role),
      permissions: user.userRoles.flatMap(ur => 
        ur.role.rolePermissions.map(rp => rp.permission)
      ),
      teams: user.teamMembers.map(tm => tm.team),
      fieldValues,
      attachments,
    };
  }

  async updateFieldValues(targetUserId: string, entries: UpdateUserFieldValueEntry[], currentUserId: string) {
    // 权限：需要 user:update
    const canUpdate = await this.acl.hasPermission(currentUserId, 'user', 'update');
    if (!canUpdate) {
      throw new ForbiddenException('无权更新人员字段');
    }

    const fieldKeys = entries.map(e => e.fieldKey);
    const defs = await this.prisma.fieldDefinition.findMany({ where: { key: { in: fieldKeys } } });
    const defMap = new Map(defs.map(d => [d.key, d]));

    for (const entry of entries) {
      const def = defMap.get(entry.fieldKey);
      if (!def) continue; // 忽略未定义字段

      const data: any = { valueString: null, valueNumber: null, valueDate: null, valueJson: null };
      if (entry.valueString !== undefined) data.valueString = entry.valueString;
      if (entry.valueNumber !== undefined) data.valueNumber = entry.valueNumber;
      if (entry.valueDate !== undefined) data.valueDate = new Date(entry.valueDate);
      if (entry.valueJson !== undefined) data.valueJson = entry.valueJson as any;

      const existing = await this.prisma.userFieldValue.findUnique({
        where: { userId_fieldId: { userId: targetUserId, fieldId: def.id } as any },
      }).catch(() => null);

      if (existing) {
        await this.prisma.userFieldValue.update({
          where: { id: (existing as any).id },
          data,
        });
      } else {
        await this.prisma.userFieldValue.create({
          data: {
            userId: targetUserId,
            fieldId: def.id,
            ...data,
          },
        });
      }
    }

    return this.findOne(targetUserId);
  }

  // ============ 多明细的简化 Upsert/Delete ============
  async upsertEducation(currentUserId: string, input: any) {
    const canUpdate = await this.acl.hasPermission(currentUserId, 'user', 'update');
    if (!canUpdate) throw new ForbiddenException('无权更新教育经历');
    const { id, userId, ...rest } = input;
    if (id) {
      await this.prisma.userEducation.update({ where: { id }, data: rest });
    } else {
      await this.prisma.userEducation.create({ data: { userId, ...rest } });
    }
    return this.findOne(userId);
  }

  async deleteEducation(currentUserId: string, id: string) {
    const rec = await this.prisma.userEducation.findUnique({ where: { id } });
    if (!rec) throw new NotFoundException('记录不存在');
    const canUpdate = await this.acl.hasPermission(currentUserId, 'user', 'update');
    if (!canUpdate) throw new ForbiddenException('无权删除教育经历');
    await this.prisma.userEducation.delete({ where: { id } });
    return this.findOne(rec.userId);
  }

  async upsertWorkExperience(currentUserId: string, input: any) {
    const canUpdate = await this.acl.hasPermission(currentUserId, 'user', 'update');
    if (!canUpdate) throw new ForbiddenException('无权更新工作经历');
    const { id, userId, ...rest } = input;
    if (id) {
      await this.prisma.userWorkExperience.update({ where: { id }, data: rest });
    } else {
      await this.prisma.userWorkExperience.create({ data: { userId, ...rest } });
    }
    return this.findOne(userId);
  }

  async deleteWorkExperience(currentUserId: string, id: string) {
    const rec = await this.prisma.userWorkExperience.findUnique({ where: { id } });
    if (!rec) throw new NotFoundException('记录不存在');
    const canUpdate = await this.acl.hasPermission(currentUserId, 'user', 'update');
    if (!canUpdate) throw new ForbiddenException('无权删除工作经历');
    await this.prisma.userWorkExperience.delete({ where: { id } });
    return this.findOne(rec.userId);
  }

  async upsertEmergencyContact(currentUserId: string, input: any) {
    const canUpdate = await this.acl.hasPermission(currentUserId, 'user', 'update');
    if (!canUpdate) throw new ForbiddenException('无权更新紧急联系人');
    const { id, userId, ...rest } = input;
    if (id) {
      await this.prisma.userEmergencyContact.update({ where: { id }, data: rest });
    } else {
      await this.prisma.userEmergencyContact.create({ data: { userId, ...rest } });
    }
    return this.findOne(userId);
  }

  async deleteEmergencyContact(currentUserId: string, id: string) {
    const rec = await this.prisma.userEmergencyContact.findUnique({ where: { id } });
    if (!rec) throw new NotFoundException('记录不存在');
    const canUpdate = await this.acl.hasPermission(currentUserId, 'user', 'update');
    if (!canUpdate) throw new ForbiddenException('无权删除紧急联系人');
    await this.prisma.userEmergencyContact.delete({ where: { id } });
    return this.findOne(rec.userId);
  }

  async upsertFamilyMember(currentUserId: string, input: any) {
    const canUpdate = await this.acl.hasPermission(currentUserId, 'user', 'update');
    if (!canUpdate) throw new ForbiddenException('无权更新家庭成员');
    const { id, userId, ...rest } = input;
    if (id) {
      await this.prisma.userFamilyMember.update({ where: { id }, data: rest });
    } else {
      await this.prisma.userFamilyMember.create({ data: { userId, ...rest } });
    }
    return this.findOne(userId);
  }

  async deleteFamilyMember(currentUserId: string, id: string) {
    const rec = await this.prisma.userFamilyMember.findUnique({ where: { id } });
    if (!rec) throw new NotFoundException('记录不存在');
    const canUpdate = await this.acl.hasPermission(currentUserId, 'user', 'update');
    if (!canUpdate) throw new ForbiddenException('无权删除家庭成员');
    await this.prisma.userFamilyMember.delete({ where: { id } });
    return this.findOne(rec.userId);
  }

  async upsertContract(currentUserId: string, input: any) {
    const canUpdate = await this.acl.hasPermission(currentUserId, 'user', 'update');
    if (!canUpdate) throw new ForbiddenException('无权更新合同信息');
    const { id, userId, ...rest } = input;
    if (id) {
      await this.prisma.userContract.update({ where: { id }, data: rest });
    } else {
      await this.prisma.userContract.create({ data: { userId, ...rest } });
    }
    return this.findOne(userId);
  }

  async deleteContract(currentUserId: string, id: string) {
    const rec = await this.prisma.userContract.findUnique({ where: { id } });
    if (!rec) throw new NotFoundException('记录不存在');
    const canUpdate = await this.acl.hasPermission(currentUserId, 'user', 'update');
    if (!canUpdate) throw new ForbiddenException('无权删除合同信息');
    await this.prisma.userContract.delete({ where: { id } });
    return this.findOne(rec.userId);
  }

  async upsertDocument(currentUserId: string, input: any) {
    const canUpdate = await this.acl.hasPermission(currentUserId, 'user', 'update');
    if (!canUpdate) throw new ForbiddenException('无权更新证件');
    const { id, userId, ...rest } = input;
    if (id) {
      await this.prisma.userDocument.update({ where: { id }, data: rest });
    } else {
      await this.prisma.userDocument.create({ data: { userId, ...rest } });
    }
    return this.findOne(userId);
  }

  async deleteDocument(currentUserId: string, id: string) {
    const rec = await this.prisma.userDocument.findUnique({ where: { id } });
    if (!rec) throw new NotFoundException('记录不存在');
    const canUpdate = await this.acl.hasPermission(currentUserId, 'user', 'update');
    if (!canUpdate) throw new ForbiddenException('无权删除证件');
    await this.prisma.userDocument.delete({ where: { id } });
    return this.findOne(rec.userId);
  }

  async upsertBankAccount(currentUserId: string, input: any) {
    const canUpdate = await this.acl.hasPermission(currentUserId, 'user', 'update');
    if (!canUpdate) throw new ForbiddenException('无权更新银行卡');
    const { id, userId, ...rest } = input;
    if (id) {
      await this.prisma.userBankAccount.update({ where: { id }, data: rest });
    } else {
      await this.prisma.userBankAccount.create({ data: { userId, ...rest } });
    }
    return this.findOne(userId);
  }

  async deleteBankAccount(currentUserId: string, id: string) {
    const rec = await this.prisma.userBankAccount.findUnique({ where: { id } });
    if (!rec) throw new NotFoundException('记录不存在');
    const canUpdate = await this.acl.hasPermission(currentUserId, 'user', 'update');
    if (!canUpdate) throw new ForbiddenException('无权删除银行卡');
    await this.prisma.userBankAccount.delete({ where: { id } });
    return this.findOne(rec.userId);
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
        password: hashedPassword,
        ...userData,
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

    // 只有 super_admin 可以分配/回收管理员及高权限角色
    const current = await this.prisma.user.findUnique({
      where: { id: currentUserId },
      include: { userRoles: { include: { role: true } } },
    });
    const isSuperAdmin = current?.userRoles?.some(ur => ur.role.name === 'super_admin');
    if (!isSuperAdmin) {
      // 检查目标角色是否包含高权限（admin/hr_manager/super_admin）
      const targetRoles = await this.prisma.role.findMany({ where: { id: { in: roleIds } } });
      const containsHigh = targetRoles.some(r => ['admin', 'hr_manager', 'super_admin'].includes(r.name));
      if (containsHigh) {
        throw new ForbiddenException('仅超级管理员可授予/回收管理员或高权限角色');
      }
    }

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

