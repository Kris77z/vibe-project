import { ObjectType, Field, Int, ID } from '@nestjs/graphql';

// 基础响应类型
@ObjectType()
export class BaseResponse {
  @Field()
  success: boolean;

  @Field()
  message: string;
}

// 分页响应基类
@ObjectType()
export abstract class PaginatedResponse {
  @Field(() => Int)
  total: number;

  @Field(() => Int, { nullable: true })
  skip?: number;

  @Field(() => Int, { nullable: true })
  take?: number;
}

// 文件上传响应
@ObjectType()
export class FileUploadResponse {
  @Field()
  url: string;

  @Field()
  filename: string;

  @Field(() => Int)
  size: number;

  @Field()
  mimeType: string;
}

// 批量操作响应
@ObjectType()
export class BatchOperationResponse {
  @Field(() => Int)
  affected: number;

  @Field(() => [String], { nullable: true })
  errors?: string[];

  @Field()
  success: boolean;
}

// GitLab集成相关类型
@ObjectType()
export class GitLabUser {
  @Field(() => Int)
  id: number;

  @Field()
  username: string;

  @Field()
  name: string;

  @Field({ nullable: true })
  avatar_url?: string;
}

@ObjectType()
export class GitLabProject {
  @Field(() => Int)
  id: number;

  @Field()
  name: string;

  @Field()
  path: string;

  @Field()
  web_url: string;

  @Field({ nullable: true })
  description?: string;
}

@ObjectType()
export class GitLabIssue {
  @Field(() => Int)
  id: number;

  @Field(() => Int)
  iid: number;

  @Field()
  title: string;

  @Field({ nullable: true })
  description?: string;

  @Field()
  state: string;

  @Field()
  web_url: string;

  @Field(() => GitLabUser, { nullable: true })
  author?: GitLabUser;

  @Field(() => GitLabUser, { nullable: true })
  assignee?: GitLabUser;
}





