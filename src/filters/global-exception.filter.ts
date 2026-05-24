import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import * as Sentry from '@sentry/node';
import { LoggedException } from 'src/utils/exceptions/logged-exception';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    // Default values
    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let shouldLogToSentry = false;
    let code ;

    // Handle LoggedException
    if (exception instanceof LoggedException) {
      status = exception.statusCode;
      message = exception.message;
      shouldLogToSentry = exception.shouldLogToSentry;
      code = exception.code || 'NA';
      delete exception.code; // Remove code from LoggedException to avoid circular reference
    }
    // Handle HttpException
    else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      message =
        typeof exceptionResponse === 'string'
          ? exceptionResponse
          : (exceptionResponse as any).message || message;
    }
    // Handle generic errors
    else if (exception instanceof Error) {
      message = exception.message;
      // code = exception.code || 'ERR_UNKNOWN';
    }

    // Log to Sentry if required
    if (shouldLogToSentry) {
      Sentry.captureException(exception);
    }

    // Log error details locally
    console.error(`Error occurred: ${message}`, exception);

    // Return standardized error response
    response.status(status).json({
      statusCode: status,
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
      error: exception,
      code,
    });
  }
}
