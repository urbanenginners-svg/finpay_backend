import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
  Version,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';

import { AgentAgreementService } from './agent-agreement.service';
import { AcceptAgentAgreementDto } from './dto';
import { DataResponse } from 'src/utils/response';
import { GetUser } from 'src/utils/decorators/get-user.decorator';
import { ThrottlerBehindProxyGuard } from 'src/services/throttler/throttler-proxy.guard';

function clientIp(req: Request): string | undefined {
  const forwarded = req.headers['x-forwarded-for'];
  const first = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  if (first) return first.split(',')[0].trim();
  return req.ip ?? req.socket?.remoteAddress ?? undefined;
}

@ApiTags('Agent Agreement')
@ApiBearerAuth()
@Controller('agent-agreement')
export class AgentAgreementController {
  constructor(private readonly agentAgreementService: AgentAgreementService) {}

  @Version('1')
  @Get('me')
  @UseGuards(ThrottlerBehindProxyGuard)
  @Throttle({ default: { ttl: 60_000, limit: 60 } })
  @ApiOperation({ summary: "Get the logged-in agent's referral agreement (null if not issued yet)" })
  async getMine(@GetUser() user: { _id: string; userType?: string }) {
    const agentId = this.agentAgreementService.assertAgent(user);
    const data = await this.agentAgreementService.findForAgent(agentId);
    return new DataResponse(data, 'Agreement fetched successfully');
  }

  @Version('1')
  @Post('me/accept')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerBehindProxyGuard)
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @ApiOperation({ summary: 'Digitally accept the agreement by typing the signatory name' })
  async accept(
    @GetUser() user: { _id: string; userType?: string },
    @Body() dto: AcceptAgentAgreementDto,
    @Req() req: Request,
  ) {
    const agentId = this.agentAgreementService.assertAgent(user);
    const data = await this.agentAgreementService.accept(agentId, dto, {
      ipAddress: clientIp(req),
      userAgent: req.headers['user-agent'],
    });
    return new DataResponse(data, 'Agreement accepted successfully');
  }
}
