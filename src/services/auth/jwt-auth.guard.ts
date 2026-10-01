import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Request } from 'express';

import { IS_PUBLIC_KEY } from 'src/utils/decorators/public-key.decorator';
import { User } from 'src/services/mongoose/schemas/user.schema';
import { Role } from 'src/services/mongoose/schemas/role.schema';
import { MaintenanceService } from 'src/services/maintenance/maintenance.service';
import { assertUserNotBlocked } from 'src/utils/services/account-block.service';
import { RoleSlugEnum } from 'src/utils/enums/role-slug.enum';
import { UserTypeEnum } from 'src/utils/enums/user-type.enum';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    private reflector: Reflector,
    @InjectModel(User.name) private userModel: Model<User>,
    private maintenanceService: MaintenanceService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Allow public routes
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();

    // Skip JWT validation when the request was already authenticated via
    // organisation API-key credentials (set by ApiKeyAuthGuard).
    if ((request as any).isApiKeyAuthenticated) {
      return true;
    }
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException('No authorization token provided');
    }

    let payload: any;
    try {
      payload = this.jwtService.verify(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }

    // Load the full user with populated roles from DB
    const user = await this.userModel
      .findOne({ _id: payload.sub, deletedAt: null })
      .populate('role')
      .exec();

    if (!user) {
      throw new UnauthorizedException('User not found or inactive');
    }

    // Applies to tokens issued before the block, so a blocked agent is cut off immediately.
    assertUserNotBlocked(user);

    await this.assertPortalNotInMaintenance(user);

    // Attach full user object to request so PoliciesGuard can use it
    (request as any).user = user;
    return true;
  }

  /** Admins are never affected; 503 (not 401) so the frontend keeps the session. */
  private async assertPortalNotInMaintenance(user: User): Promise<void> {
    const roleSlug = (user.role as Role | undefined)?.slug;
    const isAgent =
      roleSlug === RoleSlugEnum.AGENT || user.userType === UserTypeEnum.AGENT;
    const isCustomer =
      !isAgent &&
      (roleSlug === RoleSlugEnum.CUSTOMER || user.userType === UserTypeEnum.USER);

    if (!isAgent && !isCustomer) {
      return;
    }

    const status = await this.maintenanceService.getStatus();
    const underMaintenance = isAgent ? status.agentPortal : status.customerPortal;

    if (underMaintenance) {
      throw new ServiceUnavailableException(
        status.message ||
          `The ${isAgent ? 'agent' : 'customer'} portal is under maintenance. Please try again later.`,
      );
    }
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
