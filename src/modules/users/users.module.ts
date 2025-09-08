import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersResolver } from './users.resolver';
import { AccessControlModule } from '../access-control/access-control.module';
import { FieldVisibilityModule } from '../field-visibility/field-visibility.module';

@Module({
  imports: [AccessControlModule, FieldVisibilityModule],
  providers: [UsersService, UsersResolver],
  exports: [UsersService],
})
export class UsersModule {}

