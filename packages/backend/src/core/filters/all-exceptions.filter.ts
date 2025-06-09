import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { JsonWebTokenError } from 'jsonwebtoken'; // Import specific JWT errors if needed

@Catch() // Catch all exceptions initially, can be refined
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const { httpAdapter } = this.httpAdapterHost;
    const ctx = host.switchToHttp();
    const request = ctx.getRequest();
    const response = ctx.getResponse();

    // Narrow type to known HttpStatus values while allowing custom numeric codes
    let httpStatus: HttpStatus | number;
    let message: string | object;

    if (exception instanceof HttpException) {
      // Handle known NestJS HTTP exceptions
      httpStatus = exception.getStatus();
      const responseBody = exception.getResponse();
      message = typeof responseBody === 'string' ? { message: responseBody } : responseBody;
      this.logger.warn(`[${request.method} ${request.url}] HttpException: ${httpStatus} - ${JSON.stringify(message)}`);
    } else if (exception instanceof JsonWebTokenError) {
      // Handle specific JWT errors (e.g., invalid signature, malformed token)
      httpStatus = HttpStatus.UNAUTHORIZED;
      message = { message: 'Unauthorized: Invalid token', error: 'Unauthorized' };
      this.logger.error(`[${request.method} ${request.url}] JsonWebTokenError: ${exception.message}`, exception.stack);
    } else if (exception instanceof Error && exception.name === 'UnauthorizedError') {
        // Catch errors potentially thrown by passport or guards that aren't HttpException
        httpStatus = HttpStatus.UNAUTHORIZED;
        message = { message: exception.message || 'Unauthorized', error: 'Unauthorized' };
        this.logger.error(`[${request.method} ${request.url}] UnauthorizedError: ${exception.message}`, exception.stack);
    } else {
      // Handle unknown errors as Internal Server Error
      httpStatus = HttpStatus.INTERNAL_SERVER_ERROR;
      message = { message: 'Internal server error', error: 'Internal Server Error' };
      // Log the full error for debugging
      this.logger.error(`[${request.method} ${request.url}] Unhandled Exception: ${exception instanceof Error ? exception.message : JSON.stringify(exception)}`, exception instanceof Error ? exception.stack : '');
      console.error(exception); // Also log to console for visibility during development
    }

    const responseBody = {
      statusCode: httpStatus,
      timestamp: new Date().toISOString(),
      path: httpAdapter.getRequestUrl(request),
      ...(typeof message === 'object' ? message : { message }),
    };

    httpAdapter.reply(response, responseBody, httpStatus);
  }
}

