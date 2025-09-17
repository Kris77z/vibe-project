import { Resolver, Query, Mutation, Args, Int } from '@nestjs/graphql';
import { UseGuards, ForbiddenException } from '@nestjs/common';
import { UsersService, CreateUserInput, UpdateUserInput, UpdateUserRolesInput, UserFilters, UpdateUserFieldValueEntry } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ObjectType, Field, InputType, ID } from '@nestjs/graphql';
import { FieldVisibilityService } from '../field-visibility/field-visibility.service';
import { AccessControlService } from '../access-control/access-control.service';
import { StorageService } from '../storage/storage.service';
import { IsArray, IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

@ObjectType()
export class Department {
  @Field(() => ID)
  id: string;

  @Field()
  name: string;

  @Field({ nullable: true })
  description?: string;

  @Field({ nullable: true })
  parentId?: string;
}

@ObjectType()
export class Role {
  @Field(() => ID)
  id: string;

  @Field()
  name: string;

  @Field({ nullable: true })
  description?: string;

  @Field()
  isSystem: boolean;
}

@ObjectType()
class Permission {
  @Field(() => ID)
  id: string;

  @Field()
  name: string;

  @Field()
  resource: string;

  @Field()
  action: string;

  @Field({ nullable: true })
  description?: string;
}

@ObjectType()
export class Team {
  @Field(() => ID)
  id: string;

  @Field()
  name: string;

  @Field({ nullable: true })
  description?: string;
}

import { Task } from '../tasks/tasks.resolver';
import { Project } from '../projects/projects.resolver';

// Task 类型已从 ../tasks/tasks.resolver 导入

// Project 类型已从 ../projects/projects.resolver 导入

@ObjectType()
class UserStats {
  @Field(() => Int)
  totalTasks: number;

  @Field(() => Int)
  completedTasks: number;

  @Field(() => Int)
  inProgressTasks: number;

  @Field(() => Int)
  ownedProjects: number;

  @Field()
  totalWorkHours: number;

  @Field()
  thisMonthWorkHours: number;

  @Field()
  completionRate: number;
}

@ObjectType()
class UserFieldValueType {
  @Field(() => ID)
  id: string;

  @Field()
  fieldKey: string;

  @Field({ nullable: true })
  valueString?: string;
  @Field({ nullable: true })
  valueNumber?: number;
  @Field({ nullable: true })
  valueDate?: Date;
  @Field({ nullable: true })
  valueJson?: string;
}

@ObjectType()
class UserEducationType {
  @Field(() => ID)
  id: string;
  @Field()
  degree: string;
  @Field()
  school: string;
  @Field({ nullable: true })
  major?: string;
  @Field({ nullable: true })
  startDate?: string;
  @Field({ nullable: true })
  endDate?: string;
}

@ObjectType()
class UserWorkExperienceType {
  @Field(() => ID)
  id: string;
  @Field()
  company: string;
  @Field()
  position: string;
  @Field({ nullable: true })
  startDate?: string;
  @Field({ nullable: true })
  endDate?: string;
}

@ObjectType()
class UserEmergencyContactType {
  @Field(() => ID)
  id: string;
  @Field()
  name: string;
  @Field({ nullable: true })
  relation?: string;
  @Field({ nullable: true })
  phone?: string;
}

@ObjectType()
class UserFamilyMemberType {
  @Field(() => ID)
  id: string;
  @Field()
  name: string;
  @Field()
  relation: string;
}

@ObjectType()
class UserContractType {
  @Field(() => ID)
  id: string;
  @Field()
  contractNo: string;
  @Field()
  contractType: string;
  @Field()
  company: string;
  @Field({ nullable: true })
  startDate?: string;
  @Field({ nullable: true })
  endDate?: string;
}

@ObjectType()
class UserDocumentType {
  @Field(() => ID)
  id: string;
  @Field()
  docType: string;
  @Field()
  docNumber: string;
  @Field({ nullable: true })
  validUntil?: string;
}

@ObjectType()
class UserBankAccountType {
  @Field(() => ID)
  id: string;
  @Field()
  accountName: string;
  @Field()
  bankName: string;
  @Field()
  accountNumber: string;
}

@ObjectType()
export class User {
  @Field(() => ID)
  id: string;

  @Field()
  email: string;

  @Field()
  username: string;

  @Field()
  name: string;

  @Field({ nullable: true })
  avatar?: string;

  @Field({ nullable: true })
  phone?: string;

  @Field()
  isActive: boolean;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;

  @Field(() => Department, { nullable: true })
  department?: Department;

  @Field(() => [Role])
  roles: Role[];

  @Field(() => [Permission], { nullable: true })
  permissions?: Permission[];

  @Field(() => [Team])
  teams: Team[];

  @Field(() => [Task], { nullable: true })
  assignedTasks?: Task[];

  @Field(() => [Project], { nullable: true })
  ownedProjects?: Project[];

  // EAV 字段
  @Field(() => [UserFieldValueType], { nullable: true })
  fieldValues?: UserFieldValueType[];
  
  // 多明细（完整对象类型）
  @Field(() => [UserEducationType], { nullable: true }) educations?: UserEducationType[];
  @Field(() => [UserWorkExperienceType], { nullable: true }) workExperiences?: UserWorkExperienceType[];
  @Field(() => [UserFamilyMemberType], { nullable: true }) familyMembers?: UserFamilyMemberType[];
  @Field(() => [UserEmergencyContactType], { nullable: true }) emergencyContacts?: UserEmergencyContactType[];
  @Field(() => [UserContractType], { nullable: true }) contracts?: UserContractType[];
  @Field(() => [UserDocumentType], { nullable: true }) documents?: UserDocumentType[];
  @Field(() => [UserBankAccountType], { nullable: true }) bankAccounts?: UserBankAccountType[];
  @Field(() => [String], { nullable: true }) attachments?: any[];
}

@ObjectType()
class LeaveBalanceItem {
  @Field()
  type: string;

  @Field()
  total: number; // 发放/补贴总额（>=0）

  @Field()
  used: number; // 消耗总额（<=0）

  @Field()
  available: number; // 可用 = total + used
}

@InputType()
class CreateUserAttachmentInput {
  @Field()
  userId: string;

  @Field()
  attachmentType: string; // 对应 Prisma 的 AttachmentType 枚举 key

  @Field()
  filename: string;

  @Field()
  fileUrl: string; // 先用外部URL或已上传地址；后续改签名URL上传

  @Field({ nullable: true })
  mimeType?: string;

  @Field(() => Int, { nullable: true })
  fileSize?: number;

  @Field({ nullable: true })
  notes?: string;
}

@ObjectType()
class UsersResponse {
  @Field(() => [User])
  users: User[];

  @Field(() => Int)
  total: number;
}

@ObjectType()
class DeleteUserResponse {
  @Field()
  success: boolean;

  @Field()
  message: string;
}

@InputType()
class CreateUserInputType {
  @Field()
  @IsEmail()
  email: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  username?: string;

  @Field()
  @IsString()
  name: string;

  @Field()
  @IsString()
  @MinLength(6)
  password: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  departmentId?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  phone?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  avatar?: string;

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  roleIds?: string[];
}

@InputType()
class UpdateUserInputType {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  name?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  phone?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  avatar?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  departmentId?: string;

  @Field({ nullable: true })
  isActive?: boolean;
}

@InputType()
class UpdatePasswordInputType {
  @Field()
  @IsString()
  currentPassword: string;

  @Field()
  @IsString()
  @MinLength(6)
  newPassword: string;
}

@InputType()
class UpdateUserFieldValueEntryInput {
  @Field()
  fieldKey: string;

  @Field({ nullable: true })
  valueString?: string;
  @Field({ nullable: true })
  valueNumber?: number;
  @Field({ nullable: true })
  valueDate?: string;
  @Field({ nullable: true })
  valueJson?: String;
}

@InputType()
class UpsertEducationInput {
  @Field({ nullable: true }) id?: string;
  @Field() userId: string;
  @Field({ nullable: true }) degree?: string;
  @Field({ nullable: true }) school?: string;
  @Field({ nullable: true }) enrollDate?: string;
  @Field({ nullable: true }) graduateDate?: string;
  @Field({ nullable: true }) major?: string;
  @Field({ nullable: true }) studyForm?: string;
  @Field({ nullable: true }) schoolingYears?: number;
  @Field({ nullable: true }) degreeName?: string;
  @Field({ nullable: true }) awardingCountry?: string;
  @Field({ nullable: true }) awardingInstitution?: string;
  @Field({ nullable: true }) awardingDate?: string;
  @Field({ nullable: true }) languageLevel?: string;
}

@InputType()
class UpsertWorkExperienceInput {
  @Field({ nullable: true }) id?: string;
  @Field() userId: string;
  @Field({ nullable: true }) company?: string;
  @Field({ nullable: true }) department?: string;
  @Field({ nullable: true }) position?: string;
  @Field({ nullable: true }) startDate?: string;
  @Field({ nullable: true }) endDate?: string;
}

@InputType()
class UpsertEmergencyContactInput {
  @Field({ nullable: true }) id?: string;
  @Field() userId: string;
  @Field() name: string;
  @Field({ nullable: true }) relation?: string;
  @Field() phone: string;
  @Field({ nullable: true }) address?: string;
}

@InputType()
class UpsertFamilyMemberInput {
  @Field({ nullable: true }) id?: string;
  @Field() userId: string;
  @Field() name: string;
  @Field() relation: string;
  @Field({ nullable: true }) organization?: string;
  @Field({ nullable: true }) contact?: string;
}

@InputType()
class UpsertContractInput {
  @Field({ nullable: true }) id?: string;
  @Field() userId: string;
  @Field({ nullable: true }) contractNo?: string;
  @Field({ nullable: true }) company?: string;
  @Field({ nullable: true }) contractType?: string;
  @Field({ nullable: true }) startDate?: string;
  @Field({ nullable: true }) endDate?: string;
  @Field({ nullable: true }) actualEndDate?: string;
  @Field({ nullable: true }) signedTimes?: number;
}

@InputType()
class UpsertDocumentInput {
  @Field({ nullable: true }) id?: string;
  @Field() userId: string;
  @Field() docType: string;
  @Field() docNumber: string;
  @Field({ nullable: true }) validUntil?: string;
}

@InputType()
class UpsertBankAccountInput {
  @Field({ nullable: true }) id?: string;
  @Field() userId: string;
  @Field({ nullable: true }) accountName?: string;
  @Field({ nullable: true }) bankName?: string;
  @Field({ nullable: true }) bankBranch?: string;
  @Field({ nullable: true }) accountNumber?: string;
}
@InputType()
class UpdateUserRolesInputType {
  @Field()
  userId: string;

  @Field(() => [String])
  roleIds: string[];
}

@InputType()
class UserFiltersInput {
  @Field({ nullable: true })
  departmentId?: string;

  @Field({ nullable: true })
  isActive?: boolean;

  @Field({ nullable: true })
  search?: string;
}

@Resolver(() => User)
export class UsersResolver {
  constructor(
    private usersService: UsersService,
    private fieldVisibility: FieldVisibilityService,
    private acl: AccessControlService,
    private storage: StorageService,
  ) {}

  @Query(() => UsersResponse)
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('user:read')
  async users(
    @Args('filters', { nullable: true }) filters?: UserFiltersInput,
    @Args('skip', { type: () => Int, nullable: true }) skip?: number,
    @Args('take', { type: () => Int, nullable: true }) take?: number,
    @CurrentUser() current?: any,
  ) {
    const res = await this.usersService.findAll(filters, skip, take, current?.sub ?? current?.id);
    const currentUserId = current?.sub ?? current?.id;
    const visible = await this.fieldVisibility.getVisibleFieldKeys(currentUserId, 'user');
    if (!visible.includes('contact_phone')) {
      res.users = res.users.map((u) => ({ ...u, phone: null }));
    }
    return res;
  }

  // ===== Supabase Storage: 直传上传会话 =====
  @Mutation(() => String)
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('user:update')
  async createAttachmentUploadUrl(
    @Args('userId') userId: string,
    @Args('attachmentType') attachmentType: string,
    @Args('filename') filename: string,
    @CurrentUser() currentUser: any,
  ): Promise<string> {
    // 校验当前用户是否有权限操作该用户（此处MVP按 user:update 简化）
    const objectPath = this.storage.buildObjectPath({ userId, attachmentType, filename });
    const { signedUrl } = await this.storage.createSignedUploadUrl(objectPath);
    // 返回 "objectPath|signedUrl" （MVP：前端用'|'拆分）
    return `${objectPath}|${signedUrl}`;
  }

  // ===== Supabase Storage: 下载签名URL =====
  @Query(() => String)
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('user:read')
  async createAttachmentDownloadUrl(
    @Args('objectPath') objectPath: string,
    @CurrentUser() currentUser: any,
  ): Promise<string> {
    // 解析路径，提取 userId 与 attachmentType
    // 期望形如："<userId>/<attachmentType>/<yyyy>/<mm>/<uuid>-<filename>"
    const parts = (objectPath || '').split('/');
    const targetUserId = parts[0];
    const attachmentType = parts[1];
    if (!targetUserId || !attachmentType) {
      throw new ForbiddenException('无效的附件路径');
    }

    // 超管直通
    const viewerId = currentUser?.sub ?? currentUser?.id;
    if (await this.acl.isSuperAdmin(viewerId)) {
      const { signedUrl } = await this.storage.createSignedDownloadUrl(objectPath, 600);
      return signedUrl;
    }

    // AttachmentType -> 字段key映射（与 seed.ts 保持一致）
    const typeToFieldKey: Record<string, string> = {
      ID_CARD: 'document_id_card',
      CMB_BANK_CARD: 'document_bank_card',
      HOUSEHOLD_MAIN: 'document_household_book_index',
      HOUSEHOLD_SELF: 'document_household_book_self',
      EDU_DIPLOMA: 'document_education_certificate',
      EDU_DEGREE: 'document_degree_certificate',
      RESIGNATION_CERT: 'document_resignation_proof',
      MEDICAL_REPORT: 'document_medical_report',
      ORIGINAL_RESUME: 'document_resume',
      ONBOARD_FORM: 'document_onboarding_form',
      STUDENT_ID: 'document_student_card',
      PERSONALITY_TEST: 'document_personality_test',
    };
    const fieldKey = typeToFieldKey[attachmentType] || '';

    // 1) 若存在下载临时授权（download），放行
    const hasDownloadGrant = fieldKey
      ? await this.acl.hasTemporaryGrant({
          granteeId: viewerId,
          resource: 'user',
          fieldKey,
          action: 'download',
          targetUserId,
        })
      : false;

    // 2) 否则按“可读可见字段”判定（包含 HR 敏感/极敏感读权限与可见性范围）
    let canReadThis = false;
    if (fieldKey) {
      const visible = await this.fieldVisibility.getVisibleFieldKeys(viewerId, 'user', targetUserId);
      canReadThis = visible.includes(fieldKey);
    }

    if (!hasDownloadGrant && !canReadThis) {
      throw new ForbiddenException('无权下载该附件');
    }

    const { signedUrl } = await this.storage.createSignedDownloadUrl(objectPath, 600);
    return signedUrl;
  }

  @Query(() => User)
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('user:read')
  async user(@Args('id') id: string, @CurrentUser() current?: any) {
    const data = await this.usersService.findOne(id);
    // 基于可见性：字段级过滤/脱敏
    const visible = await this.fieldVisibility.getVisibleFieldKeys(current?.sub ?? current?.id, 'user', id);
    // 1) 联系方式：未授权则置空
    if (!visible.includes('contact_phone')) {
      data.phone = null;
    }
    // 2) EAV 字段：仅返回可见字段集合
    if (Array.isArray((data as any).fieldValues)) {
      (data as any).fieldValues = (data as any).fieldValues.filter((fv: any) => visible.includes(fv.fieldKey));
    }
    return data;
  }

  @Query(() => UserStats)
  @UseGuards(JwtAuthGuard)
  async userStats(
    @Args('id', { nullable: true }) id?: string,
    @CurrentUser() currentUser?: any,
  ) {
    const userId = id || currentUser.sub;
    return this.usersService.getUserStats(userId);
  }

  @Mutation(() => User)
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('user:create')
  async createUser(
    @Args('input') input: CreateUserInputType,
    @CurrentUser() currentUser: any,
  ) {
    return this.usersService.create(input, currentUser.sub);
  }

  @Mutation(() => User)
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('user:update')
  async updateUser(
    @Args('id') id: string,
    @Args('input') input: UpdateUserInputType,
    @CurrentUser() currentUser: any,
  ) {
    return this.usersService.update(id, input, currentUser.sub);
  }

  // 自助修改头像/手机号/姓名（不含部门/状态等敏感字段）
  @Mutation(() => User)
  @UseGuards(JwtAuthGuard)
  async updateMyProfile(
    @Args('input') input: UpdateUserInputType,
    @CurrentUser() currentUser: any,
  ) {
    return this.usersService.updateSelf(currentUser.sub, input);
  }

  @Mutation(() => Boolean)
  @UseGuards(JwtAuthGuard)
  async updatePassword(
    @Args('input') input: UpdatePasswordInputType,
    @CurrentUser() currentUser: any,
  ) {
    await this.usersService.updatePassword(currentUser.sub, input.currentPassword, input.newPassword);
    return true;
  }

  // ===== EAV 批量更新 =====
  @Mutation(() => User)
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('user:update')
  async updateUserFieldValues(
    @Args('userId') userId: string,
    @Args({ name: 'entries', type: () => [UpdateUserFieldValueEntryInput] }) entries: UpdateUserFieldValueEntry[],
    @CurrentUser() currentUser: any,
  ) {
    return this.usersService.updateFieldValues(userId, entries, currentUser.sub);
  }

  // ===== 多明细 Upsert/Delete =====
  @Mutation(() => User)
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('user:update')
  async upsertUserEducation(@Args('input') input: UpsertEducationInput, @CurrentUser() currentUser: any) {
    return this.usersService.upsertEducation(currentUser.sub, input);
  }
  @Mutation(() => User)
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('user:update')
  async deleteUserEducation(@Args('id') id: string, @CurrentUser() currentUser: any) {
    return this.usersService.deleteEducation(currentUser.sub, id);
  }

  @Mutation(() => User)
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('user:update')
  async upsertUserWorkExperience(@Args('input') input: UpsertWorkExperienceInput, @CurrentUser() currentUser: any) {
    return this.usersService.upsertWorkExperience(currentUser.sub, input);
  }
  @Mutation(() => User)
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('user:update')
  async deleteUserWorkExperience(@Args('id') id: string, @CurrentUser() currentUser: any) {
    return this.usersService.deleteWorkExperience(currentUser.sub, id);
  }

  @Mutation(() => User)
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('user:update')
  async upsertUserEmergencyContact(@Args('input') input: UpsertEmergencyContactInput, @CurrentUser() currentUser: any) {
    return this.usersService.upsertEmergencyContact(currentUser.sub, input);
  }
  @Mutation(() => User)
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('user:update')
  async deleteUserEmergencyContact(@Args('id') id: string, @CurrentUser() currentUser: any) {
    return this.usersService.deleteEmergencyContact(currentUser.sub, id);
  }

  @Mutation(() => User)
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('user:update')
  async upsertUserFamilyMember(@Args('input') input: UpsertFamilyMemberInput, @CurrentUser() currentUser: any) {
    return this.usersService.upsertFamilyMember(currentUser.sub, input);
  }
  @Mutation(() => User)
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('user:update')
  async deleteUserFamilyMember(@Args('id') id: string, @CurrentUser() currentUser: any) {
    return this.usersService.deleteFamilyMember(currentUser.sub, id);
  }

  @Mutation(() => User)
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('user:update')
  async upsertUserContract(@Args('input') input: UpsertContractInput, @CurrentUser() currentUser: any) {
    return this.usersService.upsertContract(currentUser.sub, input);
  }
  @Mutation(() => User)
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('user:update')
  async deleteUserContract(@Args('id') id: string, @CurrentUser() currentUser: any) {
    return this.usersService.deleteContract(currentUser.sub, id);
  }

  @Mutation(() => User)
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('user:update')
  async upsertUserDocument(@Args('input') input: UpsertDocumentInput, @CurrentUser() currentUser: any) {
    return this.usersService.upsertDocument(currentUser.sub, input);
  }
  @Mutation(() => User)
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('user:update')
  async deleteUserDocument(@Args('id') id: string, @CurrentUser() currentUser: any) {
    return this.usersService.deleteDocument(currentUser.sub, id);
  }

  @Mutation(() => User)
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('user:update')
  async upsertUserBankAccount(@Args('input') input: UpsertBankAccountInput, @CurrentUser() currentUser: any) {
    return this.usersService.upsertBankAccount(currentUser.sub, input);
  }
  @Mutation(() => User)
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('user:update')
  async deleteUserBankAccount(@Args('id') id: string, @CurrentUser() currentUser: any) {
    return this.usersService.deleteBankAccount(currentUser.sub, id);
  }

  @Mutation(() => User)
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('user:update')
  async updateUserRoles(
    @Args('input') input: UpdateUserRolesInputType,
    @CurrentUser() currentUser: any,
  ) {
    return this.usersService.updateRoles(input, currentUser.sub);
  }

  @Mutation(() => User)
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('user:update')
  async deactivateUser(
    @Args('id') id: string,
    @CurrentUser() currentUser: any,
  ) {
    return this.usersService.deactivate(id, currentUser.sub);
  }

  @Mutation(() => User)
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('user:update')
  async activateUser(
    @Args('id') id: string,
    @CurrentUser() currentUser: any,
  ) {
    return this.usersService.activate(id, currentUser.sub);
  }

  @Mutation(() => DeleteUserResponse)
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('user:delete')
  async deleteUser(
    @Args('id') id: string,
    @CurrentUser() currentUser: any,
  ) {
    return this.usersService.delete(id, currentUser.sub);
  }

  @Query(() => String)
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('user:read')
  async exportUsersCsv(
    @Args('filters', { nullable: true }) filters?: UserFiltersInput,
    @CurrentUser() current?: any,
  ): Promise<string> {
    const currentUserId = current?.sub ?? current?.id;
    // 权限：导出敏感/极敏感，仅在需要时检查
    const canExportSensitive = await this.acl.hasPermission(currentUserId, 'export', 'sensitive');
    const canExportHighly = await this.acl.hasPermission(currentUserId, 'export', 'highly_sensitive');

    const res = await this.usersService.findAll(filters as any, 0, 1000);
    // 预取逐行可见字段（按目标用户）
    const perRowVisible: Record<string, Set<string>> = {};
    await Promise.all(
      (res.users || []).map(async (u: any) => {
        const keys = await this.fieldVisibility.getVisibleFieldKeys(currentUserId, 'user', u.id);
        perRowVisible[u.id] = new Set(keys);
      }),
    );

    // 列定义（依据现有User模型可用字段；敏感字段目前未在模型中，保留占位逻辑）
    const baseCols: { key: string; header: string; getter: (u: any) => any }[] = [
      { key: 'name', header: '姓名', getter: (u) => u.name },
      { key: 'username', header: '用户名', getter: (u) => u.username },
      { key: 'email', header: '工作邮箱', getter: (u) => u.email },
      { key: 'department', header: '部门', getter: (u) => u.department?.name || '' },
    ];
    // 是否至少一行可见手机号
    const anyPhoneVisible = (res.users || []).some((u: any) => perRowVisible[u.id]?.has('contact_phone'));
    if (anyPhoneVisible) {
      baseCols.push({
        key: 'contact_phone',
        header: '手机',
        getter: (u) => (perRowVisible[u.id]?.has('contact_phone') ? (u.phone || '') : ''),
      });
    }

    // 敏感与极敏感示例（当前User模型无对应字段，留作后续扩展）
    const sensitiveCols: { key: string; header: string; getter: (u: any) => any }[] = [];
    if (canExportSensitive) {
      // e.g., vacation_balance -> 待有模型字段后增加
      // if (visible.includes('vacation_balance')) sensitiveCols.push({ key: 'vacation_balance', header: '假期余额', getter: (u) => u.vacationBalance || '' });
    }
    const highlyCols: { key: string; header: string; getter: (u: any) => any }[] = [];
    if (canExportHighly) {
      // e.g., id_number/bank_card_number -> 待有模型字段后增加
    }

    const columns = [...baseCols, ...sensitiveCols, ...highlyCols];
    const headers = columns.map((c) => c.header);
    const rows = (res.users || []).map((u) => columns.map((c) => String(c.getter(u) ?? '')));

    const escape = (val: string) => {
      const needsQuote = /[",\n]/.test(val);
      const v = val.replace(/"/g, '""');
      return needsQuote ? `"${v}"` : v;
    };
    const csv = [headers.join(','), ...rows.map((r) => r.map(escape).join(','))].join('\n');
    return csv;
  }

  // ===== 附件（极敏感） =====
  @Mutation(() => User)
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('user:update')
  async createUserAttachment(
    @Args('input') input: CreateUserAttachmentInput,
    @CurrentUser() currentUser: any,
  ) {
    return this.usersService.createUserAttachment(currentUser.sub, input);
  }

  @Mutation(() => User)
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('user:update')
  async deleteUserAttachment(
    @Args('id') id: string,
    @CurrentUser() currentUser: any,
  ) {
    return this.usersService.deleteUserAttachment(currentUser.sub, id);
  }

  // ===== 假期余额（HR/超管可见） =====
  @Query(() => [LeaveBalanceItem])
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('user:read')
  async userLeaveBalances(
    @Args('userId') userId: string,
    @CurrentUser() currentUser: any,
  ): Promise<LeaveBalanceItem[]> {
    return this.usersService.getUserLeaveBalances(userId, currentUser.sub);
  }

  // ===== 角色管理 =====
  @Query(() => [Role])
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('org_visibility:configure')
  async roles() {
    return this.usersService.getAllRoles();
  }
}
