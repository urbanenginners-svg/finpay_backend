import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
  Version,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { AdminService } from './admin.service';
import { RegistrationService } from '../auth/registration.service';
import { CreateUserDto, GetUsersQueryDto, UpdateUserDto } from './dto';
import { CreateAgentDto } from './dto/create-agent.dto';
import { RequestAgentDocumentUpdateDto } from './dto/request-agent-document-update.dto';
import { VerifyAgentDto } from '../auth/dto/register.dto';
import {
  CreateUserSwagger,
  DeleteUserSwagger,
  GetAllUsersSwagger,
  GetUserByIdSwagger,
  UpdateUserSwagger,
} from './admin.swagger';
import { PoliciesGuard } from 'src/services/casl/casl-policies.guard';
import { CheckActionPolicy } from 'src/services/casl/casl-policies.decorator';
import { PermissionEnum } from 'src/utils/enums/permission.enum';
import { resource } from 'src/utils/constants/resource';
import { GetUser } from 'src/utils/decorators/get-user.decorator';
import { DataResponse, PaginatedDataResponse } from 'src/utils/response';

@ApiTags('Admin - User Management')
@Controller('admin/users')
@UseGuards(PoliciesGuard)
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly registrationService: RegistrationService,
  ) {}

  /**
   * POST /admin/users
   * Create a new user with role assignment
   */
  @Version('1')
  @Post()
  @CreateUserSwagger()
  @CheckActionPolicy(PermissionEnum.WRITE, resource.User)
  async create(
    @Body() createUserDto: CreateUserDto,
    @GetUser('_id') requestUserId: string,
  ) {
    const result = await this.adminService.create(createUserDto, requestUserId);
    return new DataResponse(result);
  }

  /**
   * POST /admin/users/register-agent
   * Register an agent on their behalf and email temporary login credentials
   */
  @Version('1')
  @Post('register-agent')
  @CheckActionPolicy(PermissionEnum.WRITE, resource.User)
  async registerAgent(
    @Body() dto: CreateAgentDto,
    @GetUser('_id') requestUserId: string,
  ) {
    const result = await this.registrationService.createAgentByAdmin(
      dto,
      requestUserId,
    );
    return new DataResponse(result);
  }

  /**
   * GET /admin/users
   * Get all users with optional role filter and pagination
   */
  @Version('1')
  @Get()
  @GetAllUsersSwagger()
  @CheckActionPolicy(PermissionEnum.READ, resource.User)
  async findAll(@Query() query: GetUsersQueryDto) {
    const result = await this.adminService.findAll(query);
    return new PaginatedDataResponse(result.data, result.meta);
  }

  /**
   * GET /admin/users/:id
   * Get a single user by ID
   */
  @Version('1')
  @Get(':id')
  @GetUserByIdSwagger()
  @CheckActionPolicy(PermissionEnum.READ, resource.User)
  async findOne(@Param('id') id: string) {
    const result = await this.adminService.findOne(id);
    return new DataResponse(result);
  }

  /**
   * PUT /admin/users/:id/verify-agent
   * Approve or reject pending agent registration
   */
  @Version('1')
  @Put(':id/verify-agent')
  @CheckActionPolicy(PermissionEnum.UPDATE, resource.User)
  async verifyAgent(
    @Param('id') id: string,
    @Body() dto: VerifyAgentDto,
    @GetUser('_id') requestUserId: string,
  ) {
    const result = await this.registrationService.verifyAgent(id, dto, requestUserId);
    return new DataResponse(result);
  }

  /**
   * PUT /admin/users/:id/request-agent-documents
   * Ask a pending agent to re-upload or submit additional documents
   */
  @Version('1')
  @Put(':id/request-agent-documents')
  @CheckActionPolicy(PermissionEnum.UPDATE, resource.User)
  async requestAgentDocuments(
    @Param('id') id: string,
    @Body() dto: RequestAgentDocumentUpdateDto,
    @GetUser('_id') requestUserId: string,
  ) {
    const result = await this.registrationService.requestAgentDocumentUpdate(
      id,
      dto,
      requestUserId,
    );
    return new DataResponse(result);
  }

  /**
   * PUT /admin/users/:id
   * Update an existing user
   */
  @Version('1')
  @Put(':id')
  @UpdateUserSwagger()
  @CheckActionPolicy(PermissionEnum.UPDATE, resource.User)
  async update(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
    @GetUser('_id') requestUserId: string,
  ) {
    const result = await this.adminService.update(id, updateUserDto, requestUserId);
    return new DataResponse(result);
  }

  /**
   * DELETE /admin/users/:id
   * Soft-delete a user
   */
  @Version('1')
  @Delete(':id')
  @DeleteUserSwagger()
  @CheckActionPolicy(PermissionEnum.DELETE, resource.User)
  async remove(
    @Param('id') id: string,
    @GetUser('_id') requestUserId: string,
  ) {
    const result = await this.adminService.remove(id, requestUserId);
    return new DataResponse(result, 'User deleted successfully');
  }
}
