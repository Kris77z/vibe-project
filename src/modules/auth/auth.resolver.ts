import { Resolver, Mutation, Args, Query } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { AuthService, LoginInput, RegisterInput, AuthPayload } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { ObjectType, Field, InputType } from '@nestjs/graphql';

@ObjectType()
class AuthUser {
  @Field()
  id: string;

  @Field()
  email: string;

  @Field()
  username: string;

  @Field()
  name: string;

  @Field({ nullable: true })
  avatar?: string;

  @Field(() => [String])
  roles: string[];

  @Field(() => [String])
  permissions: string[];
}

@ObjectType()
class AuthResponse {
  @Field()
  access_token: string;

  @Field(() => AuthUser)
  user: AuthUser;
}

@InputType()
class LoginInputType {
  @Field()
  email: string;

  @Field()
  password: string;
}

@InputType()
class RegisterInputType {
  @Field()
  email: string;

  @Field()
  username: string;

  @Field()
  name: string;

  @Field()
  password: string;

  @Field({ nullable: true })
  departmentId?: string;
}

@ObjectType()
class RefreshTokenResponse {
  @Field()
  access_token: string;
}

@Resolver()
export class AuthResolver {
  constructor(private authService: AuthService) {}

  @Mutation(() => AuthResponse)
  async login(@Args('input') input: LoginInputType): Promise<AuthResponse> {
    return this.authService.login(input);
  }

  @Mutation(() => AuthResponse)
  async register(@Args('input') input: RegisterInputType): Promise<AuthResponse> {
    return this.authService.register(input);
  }

  @Query(() => AuthUser)
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() user: any): Promise<AuthUser> {
    return this.authService.getCurrentUser(user.sub);
  }

  @Mutation(() => RefreshTokenResponse)
  @UseGuards(JwtAuthGuard)
  async refreshToken(@CurrentUser() user: any): Promise<RefreshTokenResponse> {
    return this.authService.refreshToken(user.sub);
  }
}
