import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { GqlArgumentsHost } from '@nestjs/graphql';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const gqlHost = GqlArgumentsHost.create(host);
    
    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let code = 'INTERNAL_ERROR';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const response = exception.getResponse();
      
      if (typeof response === 'object' && response !== null) {
        message = (response as any).message || exception.message;
      } else {
        message = exception.message;
      }

      // 设置GraphQL错误代码
      switch (status) {
        case HttpStatus.BAD_REQUEST:
          code = 'BAD_REQUEST';
          break;
        case HttpStatus.UNAUTHORIZED:
          code = 'UNAUTHORIZED';
          break;
        case HttpStatus.FORBIDDEN:
          code = 'FORBIDDEN';
          break;
        case HttpStatus.NOT_FOUND:
          code = 'NOT_FOUND';
          break;
        case HttpStatus.CONFLICT:
          code = 'CONFLICT';
          break;
        default:
          code = 'INTERNAL_ERROR';
      }
    }

    // 对于GraphQL，抛出带有扩展信息的错误
    const error = new Error(message);
    (error as any).extensions = {
      code,
      status,
      timestamp: new Date().toISOString(),
    };

    throw error;
  }
}


