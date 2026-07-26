import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  Version,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { memoryStorage } from 'multer';

import { RemittanceService } from './remittance.service';
import {
  CompleteForexRequestDto,
  GetForexOrdersDashboardQueryDto,
  GetPurposesQueryDto,
  GetRemittanceRatesQueryDto,
  InitiateForexRequestDto,
  UploadForexOrderDocumentDto,
} from './dto';
import { DataResponse } from 'src/utils/response';
import { Public } from 'src/utils/decorators/public-key.decorator';
import { GetUser } from 'src/utils/decorators/get-user.decorator';
import { ThrottlerBehindProxyGuard } from 'src/services/throttler/throttler-proxy.guard';
import {
  imageFileFilter,
  MAX_FILE_SIZE_BYTES,
} from 'src/utils/validators/file.validator';
import {
  CompleteForexRequestSwagger,
  CreatePaymentLinkSwagger,
  GetForexOrdersDashboardSwagger,
  GetPurposeConfigSwagger,
  GetPurposesSwagger,
  GetRemittanceProvidersSwagger,
  GetRemittanceRatesSwagger,
  InitiateForexRequestSwagger,
  UploadForexOrderDocumentSwagger,
} from './remittance.swagger';

@ApiTags('Remittance')
@Controller('remittance')
export class RemittanceController {
  constructor(private readonly remittanceService: RemittanceService) {}

  @Public()
  @Version('1')
  @Get('providers')
  @GetRemittanceProvidersSwagger()
  async getProviders() {
    const providers = this.remittanceService.getProviders();
    return new DataResponse(providers);
  }

  @Public()
  @Version('1')
  @Get('rates')
  @UseGuards(ThrottlerBehindProxyGuard)
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @GetRemittanceRatesSwagger()
  async getRates(@Query() query: GetRemittanceRatesQueryDto) {
    const rate = await this.remittanceService.getRates(query);
    return new DataResponse(rate);
  }

  @ApiBearerAuth()
  @Version('1')
  @Post('forex/initiate')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(ThrottlerBehindProxyGuard)
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @InitiateForexRequestSwagger()
  async initiateForex(
    @GetUser('_id') userId: string,
    @Body() dto: InitiateForexRequestDto,
  ) {
    const data = await this.remittanceService.initiateForex(dto, userId);
    return new DataResponse(data, 'Forex request created successfully.');
  }

  @ApiBearerAuth()
  @Version('1')
  @Post('forex/:id/complete')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerBehindProxyGuard)
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @CompleteForexRequestSwagger()
  async completeForex(
    @GetUser('_id') userId: string,
    @Param('id') id: string,
    @Body() dto: CompleteForexRequestDto,
  ) {
    const data = await this.remittanceService.completeForex(id, dto, userId);
    return new DataResponse(
      data,
      'Forex request completed and submitted for approval',
    );
  }

  @ApiBearerAuth()
  @Version('1')
  @Post('forex/orders/:orderId/payment-link')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerBehindProxyGuard)
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @CreatePaymentLinkSwagger()
  async createPaymentLink(
    @GetUser('_id') userId: string,
    @Param('orderId') orderId: string,
  ) {
    const data = await this.remittanceService.createPaymentLink(
      orderId,
      userId,
    );
    return new DataResponse(data, 'Payment link generated successfully.');
  }

  @ApiBearerAuth()
  @Version('1')
  @Post('forex/orders/:orderId/upload-document')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerBehindProxyGuard)
  @Throttle({ default: { ttl: 60_000, limit: 40 } })
  @UploadForexOrderDocumentSwagger()
  @UseInterceptors(
    FileInterceptor('document', {
      storage: memoryStorage(),
      fileFilter: imageFileFilter,
      limits: { fileSize: MAX_FILE_SIZE_BYTES },
    }),
  )
  async uploadForexOrderDocument(
    @GetUser('_id') userId: string,
    @Param('orderId') orderId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadForexOrderDocumentDto,
  ) {
    const data = await this.remittanceService.uploadForexOrderDocument(
      orderId,
      dto.documentType,
      file,
      userId,
    );
    return new DataResponse(data, 'Document uploaded successfully.');
  }

  @ApiBearerAuth()
  @Version('1')
  @Get('forex/orders/dashboard')
  @GetForexOrdersDashboardSwagger()
  async getForexOrdersDashboard(
    @GetUser('_id') userId: string,
    @Query() query: GetForexOrdersDashboardQueryDto,
  ) {
    const result = await this.remittanceService.getForexOrdersDashboard(
      query,
      userId,
    );
    return {
      data: result.data,
      meta: result.meta,
      message: 'Forex orders retrieved successfully.',
    };
  }

  @Public()
  @Version('1')
  @Get('purposes')
  @GetPurposesSwagger()
  async listPurposes(@Query() query: GetPurposesQueryDto) {
    const purposes = await this.remittanceService.listPurposes(query);
    return new DataResponse(purposes);
  }

  @Public()
  @Version('1')
  @Get('purposes/:code/config')
  @GetPurposeConfigSwagger()
  async getPurposeConfig(@Param('code') code: string) {
    const config = await this.remittanceService.getPurposeConfig(code);
    return new DataResponse(config);
  }
}
