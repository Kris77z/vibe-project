import { InputType, Field, ID, registerEnumType } from '@nestjs/graphql';
import { IsString, IsOptional, IsEnum, IsUUID, IsArray, IsDateString } from 'class-validator';
import { IssueStatus, InputSource, IssueType, PRDStatus, ReviewStatus } from '@prisma/client';
import { Priority, TaskStatus } from '../../tasks/tasks.resolver';

// 注册枚举类型给GraphQL (Priority和TaskStatus已在tasks模块注册)
registerEnumType(IssueStatus, { name: 'IssueStatus' });
registerEnumType(InputSource, { name: 'InputSource' });
registerEnumType(IssueType, { name: 'IssueType' });
registerEnumType(PRDStatus, { name: 'PRDStatus' });
registerEnumType(ReviewStatus, { name: 'ReviewStatus' });

@InputType()
export class DateRangeInput {
  @Field()
  @IsDateString()
  startDate: string;

  @Field()
  @IsDateString()
  endDate: string;
}

@InputType()
export class CreateIssueInput {
  @Field()
  @IsString()
  title: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  description?: string;

  @Field(() => Priority)
  @IsEnum(Priority)
  priority: Priority;

  @Field(() => InputSource)
  @IsEnum(InputSource)
  inputSource: InputSource;

  @Field(() => IssueType)
  @IsEnum(IssueType)
  issueType: IssueType;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  businessValue?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  userImpact?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  technicalRisk?: string;

  @Field(() => ID)
  @IsUUID()
  projectId: string;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  assigneeId?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsDateString()
  dueDate?: string;
}

@InputType()
export class UpdateIssueInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  title?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  description?: string;

  @Field(() => Priority, { nullable: true })
  @IsOptional()
  @IsEnum(Priority)
  priority?: Priority;

  @Field(() => InputSource, { nullable: true })
  @IsOptional()
  @IsEnum(InputSource)
  inputSource?: InputSource;

  @Field(() => IssueType, { nullable: true })
  @IsOptional()
  @IsEnum(IssueType)
  issueType?: IssueType;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  businessValue?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  userImpact?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  technicalRisk?: string;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  assigneeId?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsDateString()
  dueDate?: string;
}

@InputType()
export class IssueFiltersInput {
  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  projectId?: string;

  @Field(() => [IssueStatus], { nullable: true })
  @IsOptional()
  @IsArray()
  @IsEnum(IssueStatus, { each: true })
  status?: IssueStatus[];

  @Field(() => [Priority], { nullable: true })
  @IsOptional()
  @IsArray()
  @IsEnum(Priority, { each: true })
  priority?: Priority[];

  @Field(() => [InputSource], { nullable: true })
  @IsOptional()
  @IsArray()
  @IsEnum(InputSource, { each: true })
  inputSource?: InputSource[];

  @Field(() => [IssueType], { nullable: true })
  @IsOptional()
  @IsArray()
  @IsEnum(IssueType, { each: true })
  issueType?: IssueType[];

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  assigneeId?: string;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  creatorId?: string;

  @Field(() => [ID], { nullable: true })
  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  tagIds?: string[];

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  keyword?: string;

  @Field(() => DateRangeInput, { nullable: true })
  @IsOptional()
  dateRange?: DateRangeInput;
}

@InputType()
export class AddIssueCommentInput {
  @Field(() => ID)
  @IsUUID()
  issueId: string;

  @Field()
  @IsString()
  content: string;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  parentId?: string;
}
