import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersResolver } from './users.resolver';
import { AccessControlModule } from '../access-control/access-control.module';
import { FieldVisibilityModule } from '../field-visibility/field-visibility.module';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [AccessControlModule, FieldVisibilityModule, StorageModule],
  providers: [UsersService, UsersResolver],
  exports: [UsersService],
})
export class UsersModule {}

