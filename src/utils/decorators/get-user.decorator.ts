import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Extracts the authenticated user (or a specific property of it) from the request.
 *
 * Usage:
 *   @GetUser() user: any          — full user object
 *   @GetUser('_id') userId: string — specific property
 */
export const GetUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;
    return data ? user?.[data] : user;
  },
);
