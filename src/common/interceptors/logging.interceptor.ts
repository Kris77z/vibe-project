import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const gqlContext = GqlExecutionContext.create(context);
    const info = gqlContext.getInfo();
    const request = gqlContext.getContext().req;
    
    const operationType = info?.operation?.operation || 'unknown';
    const operationName = info?.operation?.name?.value || info?.fieldName || 'unknown';
    const userId = request?.user?.sub || 'anonymous';
    
    const now = Date.now();
    
    this.logger.log(
      `GraphQL ${operationType}: ${operationName} - User: ${userId} - Started`
    );

    return next
      .handle()
      .pipe(
        tap({
          next: () => {
            const duration = Date.now() - now;
            this.logger.log(
              `GraphQL ${operationType}: ${operationName} - User: ${userId} - Completed in ${duration}ms`
            );
          },
          error: (error) => {
            const duration = Date.now() - now;
            this.logger.error(
              `GraphQL ${operationType}: ${operationName} - User: ${userId} - Failed in ${duration}ms`,
              error.stack
            );
          },
        }),
      );
  }
}
