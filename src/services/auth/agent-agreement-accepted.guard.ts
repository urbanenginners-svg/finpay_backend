import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';

import { AgentAgreementService } from 'src/api/agent-agreement/agent-agreement.service';
import { UserTypeEnum } from 'src/utils/enums/user-type.enum';

export const AGENT_AGREEMENT_REQUIRED_CODE = 'AGENT_AGREEMENT_NOT_ACCEPTED';

/**
 * Blocks agents who have not accepted their referral agreement.
 * Customers, admins and API-key callers pass through. Must run after JwtAuthGuard.
 */
@Injectable()
export class AgentAgreementAcceptedGuard implements CanActivate {
  constructor(private readonly agentAgreementService: AgentAgreementService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const user = context.switchToHttp().getRequest().user as
      | { _id: string; userType?: string }
      | undefined;
    if (user?.userType !== UserTypeEnum.AGENT) return true;

    if (await this.agentAgreementService.hasAccepted(String(user._id))) return true;

    throw new ForbiddenException({
      statusCode: 403,
      code: AGENT_AGREEMENT_REQUIRED_CODE,
      message: 'Please review and accept your referral agreement (My Agreement) to use this feature.',
    });
  }
}
