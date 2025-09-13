import { Module, forwardRef } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { AccessControlService } from './access-control.service';
import { FieldVisibilityModule } from '../field-visibility/field-visibility.module';
import { AccessControlResolver } from './access-control.resolver';

@Module({
  imports: [PrismaModule, forwardRef(() => FieldVisibilityModule)],
  providers: [AccessControlService, AccessControlResolver],
  exports: [AccessControlService],
})
export class AccessControlModule {}


