import { PartialType } from '@nestjs/swagger';

import { CreateAgentCustomerDto } from './create-agent-customer.dto';

export class UpdateAgentCustomerDto extends PartialType(CreateAgentCustomerDto) {}
