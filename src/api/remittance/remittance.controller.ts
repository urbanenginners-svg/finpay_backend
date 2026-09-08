import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  Version,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { memoryStorage } from 'multer';
import type { Response } from 'express';

import { RemittanceService } from './remittance.service';
import {
  CompleteForexRequestDto,
  GetAgentChargesQueryDto,
  GetForexOrdersDashboardQueryDto,
  GetPurposesQueryDto,
  GetRemittanceRatesQueryDto,
  InitiateForexRequestDto,
  SubmitForexOfflinePaymentDto,
  UploadForexOrderDocumentDto,
} from './dto';
import { GetCommissionsQueryDto } from '../admin/dto/agent-card-rate.dto';
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
  GetAgentChargesSwagger,
  GetForexOrdersDashboardSwagger,
  GetForexOrderDetailSwagger,
  GetPurposeConfigSwagger,
  GetPurposesSwagger,
  GetRemittanceProvidersSwagger,
  GetRemittanceRatesSwagger,
  InitiateForexRequestSwagger,
  SubmitForexOfflinePaymentSwagger,
  UploadForexOrderDocumentSwagger,
} from './remittance.swagger';

function csvEscape(value: unknown): string {
  const raw = value == null ? '' : String(value);
  if (/[",\n\r]/.test(raw)) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}

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
  @Get('charges')
  @UseGuards(ThrottlerBehindProxyGuard)
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @GetAgentChargesSwagger()
  async getCharges(@Query() query: GetAgentChargesQueryDto) {
    const charges = await this.remittanceService.getCharges(query);
    return new DataResponse(charges, 'Charges fetched successfully');
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
  @Post('forex/orders/:orderId/offline-payment')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerBehindProxyGuard)
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @SubmitForexOfflinePaymentSwagger()
  @UseInterceptors(
    FileInterceptor('document', {
      storage: memoryStorage(),
      fileFilter: imageFileFilter,
      limits: { fileSize: MAX_FILE_SIZE_BYTES },
    }),
  )
  async submitOfflinePayment(
    @GetUser('_id') userId: string,
    @Param('orderId') orderId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: SubmitForexOfflinePaymentDto,
  ) {
    const data = await this.remittanceService.submitOfflinePayment(
      orderId,
      dto.paymentMode,
      dto.utrNumber,
      file,
      userId,
    );
    return new DataResponse(
      data,
      'Offline payment details submitted successfully.',
    );
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

  @ApiBearerAuth()
  @Version('1')
  @Get('forex/orders/:orderId')
  @GetForexOrderDetailSwagger()
  async getForexOrderDetail(
    @GetUser('_id') userId: string,
    @Param('orderId') orderId: string,
  ) {
    const data = await this.remittanceService.getForexOrderDetail(
      orderId,
      userId,
    );
    return new DataResponse(data, 'Forex order retrieved successfully.');
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

  /** Agent: card-rate suggestions (X / Y / card) for booking UI. */
  @ApiBearerAuth()
  @Version('1')
  @Get('agent/card-rates')
  async listMyCardRates(@GetUser('_id') userId: string) {
    const data = await this.remittanceService.listMyCardRates(String(userId));
    return new DataResponse(data);
  }

  @ApiBearerAuth()
  @Version('1')
  @Get('agent/card-rates/:currency')
  async getMyCardRate(
    @GetUser('_id') userId: string,
    @Param('currency') currency: string,
  ) {
    const data = await this.remittanceService.getMyCardRate(
      String(userId),
      currency,
    );
    return new DataResponse(data);
  }

  @ApiBearerAuth()
  @Version('1')
  @Get('agent/commissions')
  async listMyCommissions(
    @GetUser('_id') userId: string,
    @Query() query: GetCommissionsQueryDto,
  ) {
    const result = await this.remittanceService.listMyCommissions(
      String(userId),
      {
        pageNumber: query.pageNumber,
        pageSize: query.pageSize,
        fromDate: query.fromDate,
        toDate: query.toDate,
        currency: query.currency,
      },
    );
    return new DataResponse(result);
  }

  @ApiBearerAuth()
  @Version('1')
  @Get('agent/commissions/export')
  async exportMyCommissionsCsv(
    @GetUser('_id') userId: string,
    @Query() query: GetCommissionsQueryDto,
    @Res() res: Response,
  ) {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="agent-commissions.csv"',
    );

    const header = [
      'orderId',
      'orderCode',
      'currency',
      'product',
      'status',
      'currencyAmount',
      'finpaySellRate_X',
      'cardRate',
      'customerSellRate_Z',
      'agentCommissionPerUnit',
      'agentCommissionTotal',
      'providerCreatedAt',
    ].join(',');
    res.write(`${header}\n`);

    for await (const row of this.remittanceService.iterateMyCommissionsForExport(
      String(userId),
      {
        fromDate: query.fromDate,
        toDate: query.toDate,
        currency: query.currency,
      },
    )) {
      res.write(
        [
          row.id,
          row.orderCode,
          row.currency,
          row.product,
          row.status,
          row.currencyAmount,
          row.finpaySellRate,
          row.cardRate,
          row.customerSellRate,
          row.agentCommissionPerUnit,
          row.agentCommissionTotal,
          row.providerCreatedAt,
        ]
          .map(csvEscape)
          .join(',') + '\n',
      );
    }

    res.end();
  }
}
