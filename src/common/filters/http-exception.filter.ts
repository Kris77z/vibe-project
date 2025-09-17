import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { GqlArgumentsHost } from '@nestjs/graphql';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const gqlHost = GqlArgumentsHost.create(host);
    
    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let code = 'INTERNAL_ERROR';

    // 添加详细的错误日志
    console.error('Exception caught:', {
      name: exception?.constructor?.name,
      message: (exception as any)?.message,
      stack: (exception as any)?.stack,
      status: (exception as any)?.status,
    });

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
        case 413: // Payload Too Large
          code = 'PAYLOAD_TOO_LARGE';
          message = '请求数据过大，请选择较小的图片文件';
          break;
        default:
          code = 'INTERNAL_ERROR';
      }
    } else if ((exception as any)?.name === 'PayloadTooLargeError') {
      // 处理body-parser的PayloadTooLargeError
      status = 413;
      code = 'PAYLOAD_TOO_LARGE';
      message = '请求数据过大，请选择较小的图片文件';
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


