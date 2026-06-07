import {
  Controller,
  Get,
  Param,
  ParseEnumPipe,
  Post,
  Query,
  Version,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { RemittanceService } from './remittance.service';
import { ProviderTokenStatusQueryDto } from './dto';
import { DataResponse } from 'src/utils/response';
import { RemittanceProvider } from 'src/utils/enums/remittance-provider.enum';
import {
  GetProviderTokenStatusSwagger,
  ObtainProviderTokenSwagger,
  RefreshProviderTokenSwagger,
} from './remittance.swagger';

@ApiTags('Remittance Admin')
@ApiBearerAuth()
@Controller('remittance')
export class RemittanceAdminController {
  constructor(private readonly remittanceService: RemittanceService) {}

  @Version('1')
  @Post('providers/:provider/token')
  @ObtainProviderTokenSwagger()
  async obtainToken(
    @Param('provider', new ParseEnumPipe(RemittanceProvider))
    provider: RemittanceProvider,
  ) {
    const result = await this.remittanceService.obtainToken(provider);
    return new DataResponse(
      result,
      'Token obtained from provider and stored in database.',
    );
  }

  @Version('1')
  @Post('providers/:provider/token/refresh')
  @RefreshProviderTokenSwagger()
  async refreshToken(
    @Param('provider', new ParseEnumPipe(RemittanceProvider))
    provider: RemittanceProvider,
  ) {
    const result = await this.remittanceService.refreshToken(provider);
    return new DataResponse(
      result,
      'Token refreshed via provider and stored in database.',
    );
  }

  @Version('1')
  @Get('providers/:provider/token')
  @GetProviderTokenStatusSwagger()
  async getTokenStatus(
    @Param('provider', new ParseEnumPipe(RemittanceProvider))
    provider: RemittanceProvider,
    @Query() query: ProviderTokenStatusQueryDto,
  ) {
    const result = await this.remittanceService.getTokenStatus(provider, query);
    return new DataResponse(result);
  }
}
