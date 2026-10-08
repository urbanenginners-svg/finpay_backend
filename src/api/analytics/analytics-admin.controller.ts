import { Controller, Delete, Get, Param, ParseUUIDPipe, Query, Res, UseGuards, Version } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';

import { PoliciesGuard } from 'src/services/casl/casl-policies.guard';
import { CheckActionPolicy } from 'src/services/casl/casl-policies.decorator';
import { PermissionEnum } from 'src/utils/enums/permission.enum';
import { resource } from 'src/utils/constants/resource';
import { DataResponse, PaginatedDataResponse } from 'src/utils/response';
import { csvEscape, formatCsvDate } from 'src/utils/csv.util';
import { AnalyticsService } from './analytics.service';
import { AnalyticsLeadsQueryDto, AnalyticsRangeQueryDto, AnalyticsVisitsQueryDto } from './dto';

function writeCsv(res: Response, filename: string, header: string[], rows: unknown[][]) {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.write(header.join(',') + '\n');
  for (const row of rows) {
    res.write(row.map(csvEscape).join(',') + '\n');
  }
  res.end();
}

@ApiTags('Admin - Website Analytics')
@ApiBearerAuth()
@Controller('admin/analytics')
@UseGuards(PoliciesGuard)
export class AnalyticsAdminController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Version('1')
  @Get('overview')
  @CheckActionPolicy(PermissionEnum.READ, resource.Enquiry)
  @ApiOperation({ summary: 'Traffic totals, trends, sources, locations, devices and lead conversion for a date range' })
  async overview(@Query() query: AnalyticsRangeQueryDto) {
    return new DataResponse(await this.analyticsService.getOverview(query));
  }

  @Version('1')
  @Get('visits')
  @CheckActionPolicy(PermissionEnum.READ, resource.Enquiry)
  @ApiOperation({ summary: 'Paginated list of individual visits (sessions) with the pages viewed' })
  async visits(@Query() query: AnalyticsVisitsQueryDto) {
    const result = await this.analyticsService.getVisits(query);
    return new PaginatedDataResponse(result.data, result.meta);
  }

  @Version('1')
  @Get('visits/export')
  @CheckActionPolicy(PermissionEnum.READ, resource.Enquiry)
  @ApiOperation({ summary: 'Export visits as CSV' })
  async exportVisits(@Query() query: AnalyticsVisitsQueryDto, @Res() res: Response) {
    const rows = await this.analyticsService.getVisitsForExport(query);
    writeCsv(
      res,
      'finpay-website-visits.csv',
      [
        'sessionId', 'visitorId', 'visitorType', 'startedAt', 'lastActivityAt', 'pageViews', 'landingPage',
        'exitPage', 'pagesVisited', 'channel', 'source', 'medium', 'campaign', 'referrer', 'country', 'region',
        'city', 'deviceType', 'browser', 'os', 'language', 'leadReference',
      ],
      rows.map((row) => [
        row._id,
        row.visitorId,
        row.isNewVisitor ? 'new' : 'returning',
        formatCsvDate(row.startedAt),
        formatCsvDate(row.lastActivityAt),
        row.pageViewCount,
        row.landingPage,
        row.exitPage,
        (row.pages ?? []).map((p: { path: string }) => p.path).join(' > '),
        row.channel,
        row.source,
        row.medium,
        row.campaign,
        row.referrer,
        row.country,
        row.region,
        row.city,
        row.deviceType,
        row.browser,
        row.os,
        row.language,
        row.enquiry?.referenceNumber,
      ]),
    );
  }

  @Version('1')
  @Get('leads')
  @CheckActionPolicy(PermissionEnum.READ, resource.Enquiry)
  @ApiOperation({ summary: 'Paginated leads (website enquiries) with the traffic source that produced them' })
  async leads(@Query() query: AnalyticsLeadsQueryDto) {
    const result = await this.analyticsService.getLeads(query);
    return new PaginatedDataResponse(result.data, result.meta);
  }

  @Version('1')
  @Get('leads/export')
  @CheckActionPolicy(PermissionEnum.READ, resource.Enquiry)
  @ApiOperation({ summary: 'Export leads with contact details and attribution as CSV' })
  async exportLeads(@Query() query: AnalyticsLeadsQueryDto, @Res() res: Response) {
    const rows = await this.analyticsService.getLeadsForExport(query);
    writeCsv(
      res,
      'finpay-website-leads.csv',
      [
        'enquiryId', 'referenceNumber', 'submittedAt', 'serviceType', 'status', 'priority', 'fullName', 'email',
        'mobile', 'callbackRequested', 'estimatedInrValue', 'channel', 'source', 'medium', 'campaign',
        'referrerHost', 'landingPage', 'pagesBeforeLead', 'visitorType', 'country', 'region', 'city',
        'deviceType', 'browser', 'os',
      ],
      rows.map((row) => {
        const a = row.attribution;
        return [
          row._id,
          row.referenceNumber,
          formatCsvDate(row.createdAt),
          row.serviceType,
          row.status,
          row.isPriority ? 'yes' : 'no',
          row.contact?.fullName,
          row.contact?.email,
          row.contact?.mobile,
          row.contact?.callbackRequested ? 'yes' : 'no',
          row.estimatedInrValue,
          a?.channel ?? 'untracked',
          a?.source,
          a?.medium,
          a?.campaign,
          a?.referrerHost,
          a?.landingPage,
          a?.pagesBeforeLead,
          a ? (a.isNewVisitor ? 'new' : 'returning') : '',
          a?.country,
          a?.region,
          a?.city,
          a?.deviceType,
          a?.browser,
          a?.os,
        ];
      }),
    );
  }

  @Version('1')
  @Delete('visitors/:visitorId')
  @CheckActionPolicy(PermissionEnum.DELETE, resource.Enquiry)
  @ApiOperation({ summary: 'Erase all browsing data for a visitor (data-deletion request). Lead records are kept.' })
  async deleteVisitor(@Param('visitorId', new ParseUUIDPipe({ version: '4' })) visitorId: string) {
    const result = await this.analyticsService.deleteVisitor(visitorId);
    return new DataResponse(result, 'Visitor analytics data erased.');
  }
}
