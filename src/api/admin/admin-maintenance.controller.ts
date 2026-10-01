import { Body, Controller, Get, Put, UseGuards, Version } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { MaintenanceService } from 'src/services/maintenance/maintenance.service';
import { PoliciesGuard } from 'src/services/casl/casl-policies.guard';
import { CheckActionPolicy } from 'src/services/casl/casl-policies.decorator';
import { PermissionEnum } from 'src/utils/enums/permission.enum';
import { resource } from 'src/utils/constants/resource';
import { DataResponse } from 'src/utils/response';
import { GetUser } from 'src/utils/decorators/get-user.decorator';
import { UpdateMaintenanceDto } from './dto/maintenance.dto';

@ApiTags('Admin - Maintenance')
@ApiBearerAuth()
@Controller('admin')
@UseGuards(PoliciesGuard)
export class AdminMaintenanceController {
  constructor(private readonly maintenance: MaintenanceService) {}

  @Version('1')
  @Get('maintenance')
  @CheckActionPolicy(PermissionEnum.READ, resource.User)
  @ApiOperation({ summary: 'Get landing page / customer portal / agent portal maintenance settings' })
  async getMaintenance() {
    return new DataResponse(await this.maintenance.getStatus());
  }

  @Version('1')
  @Put('maintenance')
  @CheckActionPolicy(PermissionEnum.UPDATE, resource.User)
  @ApiOperation({ summary: 'Update maintenance settings (only provided fields change)' })
  async updateMaintenance(
    @Body() dto: UpdateMaintenanceDto,
    @GetUser('_id') adminId: string,
  ) {
    const data = await this.maintenance.update({
      ...dto,
      updatedByAdminId: String(adminId),
    });
    return new DataResponse(data, 'Maintenance settings saved.');
  }
}
