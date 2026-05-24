import { HttpException, HttpStatus } from '@nestjs/common';

export class LoggedException extends HttpException {
  constructor(
    public readonly message: string,
    public readonly statusCode: number = HttpStatus.INTERNAL_SERVER_ERROR,
    public readonly shouldLogToSentry: boolean = true,
    public code?: string,
  ) {
    super(message, statusCode);
  }
}
