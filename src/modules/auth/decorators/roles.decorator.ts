import { SetMetadata } from '@nestjs/common';

export const RequireRoles = (...roles: string[]) =>
  SetMetadata('roles', roles);





