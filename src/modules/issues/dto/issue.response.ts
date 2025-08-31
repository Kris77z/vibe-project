import { ObjectType, Field, ID, Int, Float } from '@nestjs/graphql';
import { IssueStatus, InputSource, IssueType, PRDStatus, ReviewStatus } from '@prisma/client';
import { Priority, TaskStatus } from '../../tasks/tasks.resolver';

// 导入现有的GraphQL类型，避免重复定义
import { User } from '../../users/users.resolver';
import { Project } from '../../projects/projects.resolver';
import { Task } from '../../tasks/tasks.resolver';

// 为Attachment创建简化版本，因为其他模块可能没有定义
@ObjectType()
export class IssueAttachment {
  @Field(() => ID)
  id: string;

  @Field()
  filename: string;

  @Field()
  fileUrl: string;

  @Field(() => Int)
  fileSize: number;

  @Field()
  mimeType: string;

  @Field()
  createdAt: Date;
}

@ObjectType()
export class IssueTag {
  @Field(() => ID)
  id: string;

  @Field()
  name: string;

  @Field()
  color: string;

  @Field(() => ID)
  projectId: string;
}

// Issue评论类型 - 使用前向引用
@ObjectType()
export class IssueComment {
  @Field(() => ID)
  id: string;

  @Field()
  content: string;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;

  @Field(() => ID)
  issueId: string;

  @Field(() => ID)
  authorId: string;

  @Field(() => User)
  author: User;

  @Field(() => ID, { nullable: true })
  parentId?: string;

  @Field(() => IssueComment, { nullable: true })
  parent?: IssueComment;

  @Field(() => [IssueComment])
  replies: IssueComment[];
}

// PRD相关类型
@ObjectType()
export class PRDReview {
  @Field(() => ID)
  id: string;

  @Field(() => ReviewStatus)
  status: ReviewStatus;

  @Field({ nullable: true })
  comment?: string;

  @Field()
  createdAt: Date;

  @Field(() => ID)
  prdId: string;

  @Field(() => ID)
  reviewerId: string;

  @Field(() => User)
  reviewer: User;
}

@ObjectType()
export class PRD {
  @Field(() => ID)
  id: string;

  @Field()
  title: string;

  @Field({ nullable: true })
  content?: string;

  @Field()
  version: string;

  @Field(() => PRDStatus)
  status: PRDStatus;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;

  @Field(() => ID)
  issueId: string;

  @Field(() => ID)
  authorId: string;

  @Field(() => User)
  author: User;

  @Field(() => [PRDReview])
  reviews: PRDReview[];
}

// 主要的Issue类型
@ObjectType()
export class Issue {
  @Field(() => ID)
  id: string;

  @Field()
  title: string;

  @Field({ nullable: true })
  description?: string;

  @Field(() => Priority)
  priority: Priority;

  @Field(() => IssueStatus)
  status: IssueStatus;

  @Field(() => InputSource)
  inputSource: InputSource;

  @Field(() => IssueType)
  issueType: IssueType;

  @Field({ nullable: true })
  businessValue?: string;

  @Field({ nullable: true })
  userImpact?: string;

  @Field({ nullable: true })
  technicalRisk?: string;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;

  @Field({ nullable: true })
  dueDate?: Date;

  @Field(() => ID)
  projectId: string;

  @Field(() => Project)
  project: Project;

  @Field(() => ID)
  creatorId: string;

  @Field(() => User)
  creator: User;

  @Field(() => ID, { nullable: true })
  assigneeId?: string;

  @Field(() => User, { nullable: true })
  assignee?: User;

  @Field(() => [IssueTag])
  tags: IssueTag[];

  @Field(() => [IssueComment])
  comments: IssueComment[];

  @Field(() => [Task])
  tasks: Task[];

  @Field(() => [IssueAttachment])
  attachments: IssueAttachment[];

  @Field(() => [PRD])
  prds: PRD[];
}

// 连接和统计类型
@ObjectType()
export class IssueConnection {
  @Field(() => [Issue])
  issues: Issue[];

  @Field(() => Int)
  total: number;

  @Field()
  hasMore: boolean;
}

@ObjectType()
export class IssueStats {
  @Field(() => Int)
  total: number;

  @Field(() => [StatusCount])
  byStatus: StatusCount[];

  @Field(() => [PriorityCount])
  byPriority: PriorityCount[];

  @Field(() => [InputSourceCount])
  byInputSource: InputSourceCount[];

  @Field(() => Float)
  completionRate: number;
}

@ObjectType()
export class StatusCount {
  @Field(() => IssueStatus)
  status: IssueStatus;

  @Field(() => Int)
  count: number;
}

@ObjectType()
export class PriorityCount {
  @Field(() => Priority)
  priority: Priority;

  @Field(() => Int)
  count: number;
}

@ObjectType()
export class InputSourceCount {
  @Field(() => InputSource)
  inputSource: InputSource;

  @Field(() => Int)
  count: number;
}