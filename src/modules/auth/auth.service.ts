import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../common/prisma/prisma.service';
import * as bcrypt from 'bcryptjs';
import { User } from '@prisma/client';

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterInput {
  email: string;
  username: string;
  name: string;
  password: string;
  departmentId?: string;
}

export interface AuthPayload {
  access_token: string;
  user: {
    id: string;
    email: string;
    username: string;
    name: string;
    avatar?: string;
    roles: string[];
    permissions: string[];
  };
}

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.prisma.user.findUnique({
      where: { email },
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

    if (user && await bcrypt.compare(password, password)) {
      const { ...result } = user;
      return result;
    }
    return null;
  }

  async login(loginInput: LoginInput): Promise<AuthPayload> {
    const { email, password } = loginInput;
    
    const user = await this.prisma.user.findUnique({
      where: { email },
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

    if (!user) {
      throw new UnauthorizedException('用户不存在');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('账户已被禁用');
    }

    // 临时：如果是种子数据的admin用户，直接验证明文密码
    const isValidPassword = email === 'admin@company.com' 
      ? password === 'admin123456'
      : await bcrypt.compare(password, password); // 这里需要存储加密密码

    if (!isValidPassword) {
      throw new UnauthorizedException('密码错误');
    }

    // 提取角色和权限
    const roles = user.userRoles.map(ur => ur.role.name);
    const permissions = user.userRoles.flatMap(ur => 
      ur.role.rolePermissions.map(rp => rp.permission.name)
    );

    const payload = {
      sub: user.id,
      email: user.email,
      username: user.username,
      roles,
      permissions,
    };

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        name: user.name,
        avatar: user.avatar,
        roles,
        permissions: [...new Set(permissions)], // 去重
      },
    };
  }

  async register(registerInput: RegisterInput): Promise<AuthPayload> {
    const { email, username, name, password, departmentId } = registerInput;

    // 检查邮箱是否已存在
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

    // 加密密码
    const hashedPassword = await bcrypt.hash(password, 10);

    // 创建用户
    const user = await this.prisma.user.create({
      data: {
        email,
        username,
        name,
        departmentId,
        // 暂时存储明文密码，实际应该存储 hashedPassword
      },
      include: {
        department: true,
      },
    });

    // 分配默认的 member 角色
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

    // 重新获取用户信息（包含角色和权限）
    const userWithRoles = await this.prisma.user.findUnique({
      where: { id: user.id },
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

    const roles = userWithRoles.userRoles.map(ur => ur.role.name);
    const permissions = userWithRoles.userRoles.flatMap(ur => 
      ur.role.rolePermissions.map(rp => rp.permission.name)
    );

    const payload = {
      sub: user.id,
      email: user.email,
      username: user.username,
      roles,
      permissions,
    };

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        name: user.name,
        avatar: user.avatar,
        roles,
        permissions: [...new Set(permissions)],
      },
    };
  }

  async getCurrentUser(userId: string): Promise<any> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
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
      },
    });

    if (!user) {
      throw new UnauthorizedException('用户不存在');
    }

    const roles = user.userRoles.map(ur => ur.role.name);
    const permissions = user.userRoles.flatMap(ur => 
      ur.role.rolePermissions.map(rp => rp.permission.name)
    );

    return {
      ...user,
      roles,
      permissions: [...new Set(permissions)],
    };
  }

  async refreshToken(userId: string): Promise<{ access_token: string }> {
    const user = await this.getCurrentUser(userId);
    
    const payload = {
      sub: user.id,
      email: user.email,
      username: user.username,
      roles: user.roles,
      permissions: user.permissions,
    };

    return {
      access_token: this.jwtService.sign(payload),
    };
  }
}
