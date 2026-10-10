import { Body, Controller, Get, Param, Put, UseGuards, Version } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { AgentAgreementService } from './agent-agreement.service';
import { UpsertAgentAgreementDto } from './dto';
import { PoliciesGuard } from 'src/services/casl/casl-policies.guard';
import { CheckActionPolicy } from 'src/services/casl/casl-policies.decorator';
import { PermissionEnum } from 'src/utils/enums/permission.enum';
import { resource } from 'src/utils/constants/resource';
import { DataResponse } from 'src/utils/response';
import { GetUser } from 'src/utils/decorators/get-user.decorator';

@ApiTags('Admin - Agent Agreements')
@ApiBearerAuth()
@Controller('admin/agent-agreements')
@UseGuards(PoliciesGuard)
export class AgentAgreementAdminController {
  constructor(private readonly agentAgreementService: AgentAgreementService) {}

  @Version('1')
  @Get(':agentId')
  @CheckActionPolicy(PermissionEnum.READ, resource.User)
  @ApiOperation({ summary: "Get an agent's agreement and acceptance record (null if not issued)" })
  async findOne(@Param('agentId') agentId: string) {
    const data = await this.agentAgreementService.findForAdmin(agentId);
    return new DataResponse(data);
  }

  @Version('1')
  @Put(':agentId')
  @CheckActionPolicy(PermissionEnum.UPDATE, resource.User)
  @ApiOperation({
    summary: 'Issue or update the agreement details. Changing details requires the agent to accept again.',
  })
  async upsert(
    @Param('agentId') agentId: string,
    @Body() dto: UpsertAgentAgreementDto,
    @GetUser('_id') adminId: string,
  ) {
    const data = await this.agentAgreementService.upsertByAdmin(agentId, dto, adminId);
    return new DataResponse(data, 'Agreement saved successfully');
  }
}
