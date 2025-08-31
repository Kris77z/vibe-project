import { Module } from '@nestjs/common';
import { WorkflowsService } from './workflows.service';
import { WorkflowsResolver } from './workflows.resolver';

@Module({
  providers: [WorkflowsService, WorkflowsResolver],
  exports: [WorkflowsService],
})
export class WorkflowsModule {}
