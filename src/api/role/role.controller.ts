import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
  Version,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { RoleService } from './role.service';
import {
  CreateRoleSwagger,
  GetAllPermissionsSwagger,
  GetAllRolesSwagger,
  GetRoleByIdSwagger,
  ToggleRoleSwagger,
  UpdateRoleSwagger,
} from './role.swagger';
import { DataResponse, PaginatedDataResponse } from 'src/utils/response';
import { CheckActionPolicy } from 'src/services/casl/casl-policies.decorator';
import { PoliciesGuard } from 'src/services/casl/casl-policies.guard';
import { PermissionEnum } from 'src/utils/enums/permission.enum';
import { resource } from 'src/utils/constants/resource';
import { CommonFieldsDto } from 'src/utils/dtos/common-fields.dto';
import { CreateRoleDto, UpdateRoleDto } from './dto';

@ApiTags('Roles')
@Controller('roles')
@UseGuards(PoliciesGuard)
export class RoleController {
  constructor(private readonly roleService: RoleService) {}

  @Version('1')
  @Get('permissions')
  @GetAllPermissionsSwagger()
  @CheckActionPolicy(PermissionEnum.READ, resource.Permission)
  async findAllPermissions(@Query() query: CommonFieldsDto) {
    const result = await this.roleService.findAllPermissions(query);
    return new PaginatedDataResponse(result.data, result.meta);
  }

  @Version('1')
  @Post()
  @CreateRoleSwagger()
  @CheckActionPolicy(PermissionEnum.WRITE, resource.Role)
  async create(@Body() createRoleDto: CreateRoleDto) {
    const result = await this.roleService.create(createRoleDto);
    return new DataResponse(result);
  }

  @Version('1')
  @Get()
  @GetAllRolesSwagger()
  @CheckActionPolicy(PermissionEnum.READ, resource.Role)
  async findAll(@Query() query: CommonFieldsDto) {
    const result = await this.roleService.findAll(query);
    return new PaginatedDataResponse(result.data, result.meta);
  }

  @Version('1')
  @Patch(':id/toggle')
  @ToggleRoleSwagger()
  @CheckActionPolicy(PermissionEnum.UPDATE, resource.Role)
  async toggle(@Param('id') id: string) {
    const result = await this.roleService.toggle(id);
    return new DataResponse(result);
  }

  @Version('1')
  @Get(':id')
  @GetRoleByIdSwagger()
  @CheckActionPolicy(PermissionEnum.READ, resource.Role)
  async findOne(@Param('id') id: string) {
    const result = await this.roleService.findOne(id);
    return new DataResponse(result);
  }

  @Version('1')
  @Put(':id')
  @UpdateRoleSwagger()
  @CheckActionPolicy(PermissionEnum.UPDATE, resource.Role)
  async update(@Param('id') id: string, @Body() updateRoleDto: UpdateRoleDto) {
    const result = await this.roleService.update(id, updateRoleDto);
    return new DataResponse(result);
  }
}
