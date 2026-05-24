import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * Extends the default ThrottlerGuard to correctly extract the real client IP
 * when the server sits behind a reverse proxy / load balancer (Nginx, AWS ALB, etc.)
 * that sets the X-Forwarded-For header.
 *
 * Without this, every request would appear to come from the proxy's IP address,
 * making rate limiting useless.
 */
@Injectable()
export class ThrottlerBehindProxyGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    // X-Forwarded-For can be a comma-separated list; take the first (original client) IP
    const forwarded = req.headers?.['x-forwarded-for'];
    if (forwarded) {
      return (forwarded as string).split(',')[0].trim();
    }
    return req.ip ?? req.connection?.remoteAddress ?? 'unknown';
  }
}
