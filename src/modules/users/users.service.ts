import { Injectable, NotFoundException, ConflictException, ForbiddenException, BadRequestException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from '../../common/prisma/prisma.service';
import { User, Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { AccessControlService } from '../access-control/access-control.service';
import { StorageService } from '../storage/storage.service';

export interface CreateUserInput {
  email: string;
  username?: string;
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
    // 权限：本人可改 selfEditable 字段；他人需 user:update
    const isSelf = targetUserId === currentUserId;
    if (!isSelf) {
      const canUpdate = await this.acl.hasPermission(currentUserId, 'user', 'update');
      if (!canUpdate) {
        throw new ForbiddenException('无权更新人员字段');
      }
    }

    const fieldKeys = entries.map(e => e.fieldKey);
    const defs = await this.prisma.fieldDefinition.findMany({ where: { key: { in: fieldKeys } } });
    const defMap = new Map(defs.map(d => [d.key, d]));

    for (const entry of entries) {
      const def = defMap.get(entry.fieldKey);
      if (!def) continue; // 忽略未定义字段
      if (isSelf && !def.selfEditable) {
        // 本人仅可编辑 selfEditable 字段
        continue;
      }

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
          ...(username ? [{ username }] : []),
        ],
      },
    });

    if (existingUser) {
      if (existingUser.email === email) {
        throw new ConflictException('邮箱已被注册');
      }
      if (username && existingUser.username === username) {
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
        username: username || email.split('@')[0],
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

  async updateSelf(userId: string, input: UpdateUserInput) {
    const allowed: UpdateUserInput = {
      name: input.name,
      phone: input.phone,
      avatar: input.avatar,
    };
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: allowed,
      include: { department: true },
    });
    return this.findOne(updated.id);
  }

  async updatePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // 验证当前密码
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isCurrentPasswordValid) {
      throw new BadRequestException('当前密码不正确');
    }

    // 规则：至少6位，包含大小写和特殊字符
    const hasMinLength = newPassword.length >= 6;
    const hasLower = /[a-z]/.test(newPassword);
    const hasUpper = /[A-Z]/.test(newPassword);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(newPassword);
    if (!(hasMinLength && hasLower && hasUpper && hasSpecial)) {
      throw new BadRequestException('新密码需至少6位，且包含大小写字母和特殊字符');
    }

    // 检查新密码不能与当前密码相同
    const isSamePassword = await bcrypt.compare(newPassword, user.password);
    if (isSamePassword) {
      throw new BadRequestException('新密码不能与当前密码相同');
    }

    // 加密新密码
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);

    // 更新密码
    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashedNewPassword },
    });
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

  // ===== 角色管理 =====
  async getAllRoles() {
    return this.prisma.role.findMany({
      orderBy: [
        { isSystem: 'desc' }, // 系统角色优先
        { name: 'asc' }
      ]
    });
  }

  // ===== 批量导入人员：支持CSV或Markdown表格 =====
  async importUsers(text: string, currentUserId: string): Promise<{ created: number; skipped: number; errors: string[] }> {
    const canCreate = await this.acl.hasPermission(currentUserId, 'user', 'create');
    if (!canCreate) throw new ForbiddenException('无权导入人员');

    const lines = (text || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) return { created: 0, skipped: 0, errors: ['内容为空'] };

    // 解析为二维数组 rows
    let rows: string[][] = [];
    if (lines[0].startsWith('|')) {
      // Markdown表格：保留空单元格位置，避免列错位
      const mdRows = lines.filter(l => l.startsWith('|'));
      const splitMdRow = (line: string) => line.replace(/^\|/, '').replace(/\|$/, '').split('|').map(s => s.trim());
      const header = splitMdRow(mdRows[0]);
      const hasDivider = mdRows[1] && /:?-+:?/.test(mdRows[1]);
      const dataRows = mdRows.slice(hasDivider ? 2 : 1);
      rows = [header, ...dataRows.map(splitMdRow)];
    } else {
      // CSV
      rows = lines.map(l => l.split(',').map(s => s.trim()));
    }

    if (rows.length < 2) return { created: 0, skipped: 0, errors: ['未检测到数据行'] };

    const header = rows[0].map(h => h.toLowerCase());
    const idx = (name: string) => header.indexOf(name);
    const iId = (() => { const cands = ['员工编码','员工id','id','用户id','个人id']; for (const k of cands){ const i = idx(k); if (i!==-1) return i; } return -1; })();
    const iName = idx('姓名') !== -1 ? idx('姓名') : idx('name');
    const iEmail = idx('邮箱') !== -1 ? idx('邮箱') : idx('email');
    const iDepartment = idx('部门') !== -1 ? idx('部门') : idx('department');
    const iPhone = idx('手机') !== -1 ? idx('手机') : idx('phone');

    if (iName === -1 || iEmail === -1) {
      return { created: 0, skipped: 0, errors: ['表头需包含：姓名、邮箱（可选：部门、手机）'] };
    }

    // 值清洗：去除引号/占位说明文本，将 NaN/无/要填/人事录入 等视为空
    const normalize = (val?: string) => {
      if (val === undefined || val === null) return '';
      let s = String(val).trim();
      if (!s) return '';
      s = s.replace(/^\s*["']|["']\s*$/g, '');
      const lower = s.toLowerCase();
      if (['nan', 'null', 'n/a', '-', '—', '－'].includes(lower)) return '';
      if (/^(无|没有)$/.test(s)) return '';
      if (/(人事(?:部)?录入|要填|自动计算|格式[:：]|固定为|尽量填|示例|说明)/.test(s)) return '';
      return s;
    };

    let created = 0; let skipped = 0; const errors: string[] = [];
    for (let r = 1; r < rows.length; r++) {
      const cols = rows[r];
      const rawId = iId !== -1 ? cols[iId] : undefined;
      const rawName = cols[iName];
      const rawEmail = cols[iEmail];
      const rawDept = iDepartment !== -1 ? cols[iDepartment] : undefined;
      const rawPhone = iPhone !== -1 ? cols[iPhone] : undefined;

      const idVal = normalize(rawId);
      const name = normalize(rawName);
      const email = normalize(rawEmail);
      const deptName = normalize(rawDept);
      const phone = normalize(rawPhone);

      // 解析部门名称，尽早获得 departmentId，供“更新”和“创建”两种路径复用
      let departmentId: string | undefined = undefined;
      if (deptName) {
        const dept = await this.prisma.department.findFirst({ where: { name: deptName } });
        if (dept) {
          departmentId = dept.id;
        }
      }

      // 空白或全是占位的行：直接跳过
      if (!idVal && !name && !email && !deptName && !phone) { continue; }

      if (!idVal && (!name || !email)) { skipped++; continue; }

      // 若提供员工编码（=用户ID），则走更新逻辑
      if (idVal) {
        const existingById = await this.prisma.user.findUnique({ where: { id: idVal } });
        if (existingById) {

          // 若改邮箱，需检查冲突
        if (email && email !== existingById.email) {
          const conflict = await this.prisma.user.findFirst({ where: { email: { equals: email, mode: 'insensitive' } } });
            if (conflict) { skipped++; errors.push(`第${r+1}行邮箱已存在: ${email}`); continue; }
          }

          try {
            await this.update(idVal, { name, phone, departmentId: departmentId }, currentUserId);
            // 邮箱更新需要单独处理
            if (email && email !== existingById.email) {
              await this.prisma.user.update({ where: { id: idVal }, data: { email } });
            }
          } catch (e:any) {
            skipped++; errors.push(`第${r+1}行更新失败: ${e?.message || e}`); continue;
          }
          continue;
        }
        // 若指定了ID但库中不存在，则走创建分支（不报错），下面继续
      }

      // 创建：若邮箱已存在则跳过
      const existing = email ? await this.prisma.user.findFirst({ where: { email: { equals: email, mode: 'insensitive' } } }) : null;
      if (existing) { skipped++; continue; }


      try {
        await this.create({
          email,
          name,
          username: email.split('@')[0],
          password: Math.random().toString(36).slice(2, 10) + 'Aa!1',
          departmentId,
          phone,
        }, currentUserId);
        created++;
      } catch (e: any) {
        skipped++;
        errors.push(`第${r+1}行导入失败: ${e?.message || e}`);
      }
    }

    return { created, skipped, errors };
  }

  // ===== 获取导入模板表头：从 docs/花名册样例.md 提取第一行表头 =====
  async getUserImportHeaders(): Promise<string[]> {
    try {
      const root = path.resolve(__dirname, '../../..');
      const filePath = path.join(root, 'docs', '花名册样例.md');
      const content = await fs.promises.readFile(filePath, 'utf-8');
      const lines = content.split(/\r?\n/);
      const headerLine = lines.find(l => l.trim().startsWith('|'));
      if (!headerLine) return ['姓名', '邮箱', '部门', '手机', '员工编码'];
      const headers = headerLine
        .replace(/^\|/, '')
        .replace(/\|$/, '')
        .split('|')
        .map(s => s.trim())
        .filter(Boolean)
        // 去除“序号”列（模板中第一列，不参与导入）
        .filter(h => h !== '序号');
      return headers;
    } catch {
      return ['姓名', '邮箱', '部门', '手机', '员工编码'];
    }
  }
}

