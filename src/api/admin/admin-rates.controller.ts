import { Controller, Get, Post, Query, UseGuards, Version } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

import { RemittanceService } from '../remittance/remittance.service';
import { GetRemittanceRatesQueryDto } from '../remittance/dto';
import { GetAdminRatesSwagger, SyncAdminRatesSwagger } from './admin-rates.swagger';
import { PoliciesGuard } from 'src/services/casl/casl-policies.guard';
import { CheckActionPolicy } from 'src/services/casl/casl-policies.decorator';
import { PermissionEnum } from 'src/utils/enums/permission.enum';
import { resource } from 'src/utils/constants/resource';
import { DataResponse } from 'src/utils/response';

class SyncAdminRatesQueryDto {
  @IsOptional()
  @IsUUID()
  agentId?: string;
}

@ApiTags('Admin - Live Rates')
@ApiBearerAuth()
@Controller('admin/rates')
@UseGuards(PoliciesGuard)
export class AdminRatesController {
  constructor(private readonly remittanceService: RemittanceService) {}

  /**
   * GET /admin/rates
   * Fetch live FX rates from Prithvi Exchange for the admin dashboard.
   */
  @Version('1')
  @Get()
  @GetAdminRatesSwagger()
  @CheckActionPolicy(PermissionEnum.READ, resource.User)
  async getRates(@Query() query: GetRemittanceRatesQueryDto) {
    const rate = await this.remittanceService.getRates(query);
    return new DataResponse(rate);
  }

  /**
   * GET /admin/rates/providers
   * List remittance providers and their active status.
   */
  @Version('1')
  @Get('providers')
  @CheckActionPolicy(PermissionEnum.READ, resource.User)
  async getProviders() {
    const providers = this.remittanceService.getProviders();
    return new DataResponse(providers);
  }

  /**
   * POST /admin/rates/sync
   * Pull latest agent FX rates from Prithvi and refresh the MongoDB cache.
   */
  @Version('1')
  @Post('sync')
  @SyncAdminRatesSwagger()
  @CheckActionPolicy(PermissionEnum.READ, resource.User)
  async syncRates(@Query() query: SyncAdminRatesQueryDto) {
    const result = await this.remittanceService.syncRatesNow(query.agentId);
    return new DataResponse(
      result,
      `Synced ${result.currencyCount} currencies from Prithvi.`,
    );
  }
}
