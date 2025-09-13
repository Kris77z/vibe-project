import { Module, forwardRef } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { AccessControlModule } from '../access-control/access-control.module';
import { FieldVisibilityService } from './field-visibility.service';
import { FieldVisibilityResolver } from './field-visibility.resolver';

@Module({
  imports: [PrismaModule, forwardRef(() => AccessControlModule)],
  providers: [FieldVisibilityService, FieldVisibilityResolver],
  exports: [FieldVisibilityService],
})
export class FieldVisibilityModule {}


