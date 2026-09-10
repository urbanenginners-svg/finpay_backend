import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  Version,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { AgentCustomerService } from './agent-customer.service';
import { CreateAgentCustomerDto, UpdateAgentCustomerDto } from './dto';
import {
  CreateAgentCustomerSwagger,
  DeleteAgentCustomerSwagger,
  GetAgentCustomerSwagger,
  ListAgentCustomersSwagger,
  UpdateAgentCustomerSwagger,
} from './agent-customer.swagger';
import { DataResponse } from 'src/utils/response';
import { GetUser } from 'src/utils/decorators/get-user.decorator';
import { ThrottlerBehindProxyGuard } from 'src/services/throttler/throttler-proxy.guard';

@ApiTags('Agent Customers')
@ApiBearerAuth()
@Controller('agent-customers')
export class AgentCustomerController {
  constructor(private readonly agentCustomerService: AgentCustomerService) {}

  @Version('1')
  @Get()
  @UseGuards(ThrottlerBehindProxyGuard)
  @Throttle({ default: { ttl: 60_000, limit: 60 } })
  @ListAgentCustomersSwagger()
  async list(
    @GetUser() user: { _id: string; userType?: string },
    @Query('search') search?: string,
  ) {
    const agentId = this.agentCustomerService.assertAgent(user);
    const data = await this.agentCustomerService.list(agentId, search);
    return new DataResponse(data, 'Customers fetched successfully');
  }

  @Version('1')
  @Get(':id')
  @UseGuards(ThrottlerBehindProxyGuard)
  @Throttle({ default: { ttl: 60_000, limit: 60 } })
  @GetAgentCustomerSwagger()
  async getOne(
    @GetUser() user: { _id: string; userType?: string },
    @Param('id') id: string,
  ) {
    const agentId = this.agentCustomerService.assertAgent(user);
    const data = await this.agentCustomerService.findOwned(agentId, id);
    return new DataResponse(data, 'Customer fetched successfully');
  }

  @Version('1')
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(ThrottlerBehindProxyGuard)
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @CreateAgentCustomerSwagger()
  async create(
    @GetUser() user: { _id: string; userType?: string },
    @Body() dto: CreateAgentCustomerDto,
  ) {
    const agentId = this.agentCustomerService.assertAgent(user);
    const data = await this.agentCustomerService.create(agentId, dto);
    return new DataResponse(data, 'Customer saved successfully');
  }

  @Version('1')
  @Patch(':id')
  @UseGuards(ThrottlerBehindProxyGuard)
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @UpdateAgentCustomerSwagger()
  async update(
    @GetUser() user: { _id: string; userType?: string },
    @Param('id') id: string,
    @Body() dto: UpdateAgentCustomerDto,
  ) {
    const agentId = this.agentCustomerService.assertAgent(user);
    const data = await this.agentCustomerService.update(agentId, id, dto);
    return new DataResponse(data, 'Customer updated successfully');
  }

  @Version('1')
  @Delete(':id')
  @UseGuards(ThrottlerBehindProxyGuard)
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @DeleteAgentCustomerSwagger()
  async remove(
    @GetUser() user: { _id: string; userType?: string },
    @Param('id') id: string,
  ) {
    const agentId = this.agentCustomerService.assertAgent(user);
    await this.agentCustomerService.remove(agentId, id);
    return new DataResponse(null, 'Customer deleted successfully');
  }
}
