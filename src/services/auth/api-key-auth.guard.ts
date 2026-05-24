import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Request } from 'express';
import * as bcrypt from 'bcrypt';

import { API_KEY_AUTH_KEY } from 'src/utils/decorators/require-api-key.decorator';
import {
  SystemApiKey,
  SystemApiKeyDocument,
} from 'src/services/mongoose/schemas/system-api-key.schema';
import { User } from 'src/services/mongoose/schemas/user.schema';

/**
 * Global guard that enforces organisation API-key authentication on routes
 * decorated with @RequireApiKey().
 *
 * Header names (lowercase after Express normalisation):
 *   x-api-public-key  – "ctrlpub_" + 32 hex chars
 *   x-api-secret-key  – "ctrlsec_" + 64 hex chars (plaintext, hashed in DB)
 *
 * Dual-auth semantics:
 *   - Route has @RequireApiKey() but BOTH headers are absent → pass through
 *     so that JwtAuthGuard can still authenticate the request.
 *   - Route has @RequireApiKey() and BOTH headers are present but
 *     invalid/expired/inactive → 401.
 *   - Route lacks @RequireApiKey() → guard is a no-op.
 *
 * On success the following properties are set on the Express request object:
 *   request.isApiKeyAuthenticated  boolean  true
 *   request.apiKey                 SystemApiKey document (no secretHash)
 *   request.user                   hydrated User document (linkedUserId, role populated)
 *                                  — same shape JwtAuthGuard sets so PoliciesGuard works
 *
 * Data access:
 *   This service shares the same MongoDB instance as ctrl-rest and therefore
 *   reads the `systemApiKey` collection directly via the injected Mongoose
 *   model. If the databases diverge in future, replace the model injection
 *   with an HTTP call to ctrl-rest's internal validation endpoint.
 */
@Injectable()
export class ApiKeyAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @InjectModel(SystemApiKey.name)
    private readonly systemApiKeyModel: Model<SystemApiKeyDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<User>,
  ) { }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiresApiKey = this.reflector.getAllAndOverride<boolean>(
      API_KEY_AUTH_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiresApiKey) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const publicKey = request.headers['x-api-public-key'] as string | undefined;
    const plainSecret = request.headers['x-api-secret-key'] as string | undefined;

    // Both headers absent → let JwtAuthGuard handle auth (dual-auth path).
    if (!publicKey && !plainSecret) {
      return true;
    }

    // Only one header supplied → treat as a malformed API-key attempt.
    if (!publicKey || !plainSecret) {
      throw new UnauthorizedException('Invalid or expired API key credentials. 1');
    }

    // Look up an active, non-expired record by public key.
    // secretHash is normally excluded by `select: false` so we opt it back in.
    const record = await this.systemApiKeyModel
      .findOne({
        publicKey,
        isActive: true,
        $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
      })
      .select('+secretHash')
      .lean()
      .exec();

    if (!record) {
      throw new UnauthorizedException('Invalid or expired API key credentials.2');
    }
   
    const secretMatches = await bcrypt.compare(plainSecret, record.secretHash);
    if (!secretMatches) {
      throw new UnauthorizedException('Invalid or expired API key credentials.3');
    }

    // Attach context to request (omit secretHash for safety).
    const { secretHash: _secretHash, ...safeRecord } = record as any;
    (request as any).isApiKeyAuthenticated = true;
    (request as any).apiKey = safeRecord;

    // Load the linked user so req.user is populated identically to JWT auth.
    // This lets PoliciesGuard / CASL / @GetUser() work without any changes.
    if (record.linkedUserId) {
      const user = await this.userModel
        .findOne({ _id: record.linkedUserId, deletedAt: null })
        .populate('role')
        .exec();

      if (!user) {
        throw new UnauthorizedException('API key linked user not found or inactive.');
      }

      (request as any).user = user;
    }

    return true;
  }
}
