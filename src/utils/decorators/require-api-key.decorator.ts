import { SetMetadata } from '@nestjs/common';
import { ApiSecurity } from '@nestjs/swagger';

export const API_KEY_AUTH_KEY = 'api-key-auth';

/**
 * Mark a controller class or individual route handler as accepting
 * organisation API-key credentials (x-api-public-key / x-api-secret-key).
 *
 * Routes WITHOUT this decorator are skipped by ApiKeyAuthGuard so normal
 * JWT/session auth continues to work unmodified.
 *
 * Also attaches Swagger security requirements for both header schemes.
 */
export const RequireApiKey = (): ClassDecorator & MethodDecorator =>
  (target: any, key?: string | symbol, descriptor?: PropertyDescriptor) => {
    SetMetadata(API_KEY_AUTH_KEY, true)(target, key as string, descriptor);
    ApiSecurity('x-api-public-key')(target, key as string, descriptor);
    ApiSecurity('x-api-secret-key')(target, key as string, descriptor);
  };
