import { Module } from '@nestjs/common';
import { IssuesResolver } from './issues.resolver';
import { IssuesService } from './issues.service';
import { PrismaModule } from '../../common/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [IssuesResolver, IssuesService],
  exports: [IssuesService],
})
export class IssuesModule {}

