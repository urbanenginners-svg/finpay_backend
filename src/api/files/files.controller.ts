import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Version,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
  Body,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { ApiTags } from '@nestjs/swagger';
import { memoryStorage } from 'multer';
// import { Throttle, SkipThrottle } from '@nestjs/throttler';

import { FilesService } from './files.service';
import { CreateFileDto } from './dto';
import { DataResponse, PaginatedDataResponse } from 'src/utils/response';
import {
  imageFileFilter,
  MAX_FILE_SIZE_BYTES,
} from 'src/utils/validators/file.validator';
import {
  UploadSingleFileSwagger,
  UploadMultipleFilesSwagger,
  GetPresignedUrlSwagger,
  GetPublicUrlSwagger,
  GetAllFilesSwagger,
  GetFileByIdSwagger,
  DeleteFileSwagger,
} from './files.swagger';
import { CheckActionPolicy } from 'src/services/casl/casl-policies.decorator';
import { PoliciesGuard } from 'src/services/casl/casl-policies.guard';
import { PermissionEnum } from 'src/utils/enums/permission.enum';
import { resource } from 'src/utils/constants/resource';
import { CommonFieldsDto } from 'src/utils/dtos/common-fields.dto';
import { RequireApiKey } from 'src/utils/decorators/require-api-key.decorator';

@ApiTags('Files')
@Controller('files')
@UseGuards(PoliciesGuard)
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  // ─── Upload Single File ────────────────────────────────────────────────────

  @Version('1')
  @Post('upload')
  // @Throttle({ upload: { ttl: 60_000, limit: 10 } })
  @UploadSingleFileSwagger()
  @CheckActionPolicy(PermissionEnum.WRITE, resource.File)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      fileFilter: imageFileFilter,
      limits: { fileSize: MAX_FILE_SIZE_BYTES },
    }),
  )
  
  async uploadSingle(
    @UploadedFile() file: Express.Multer.File,
    @Body() createFileDto: CreateFileDto,
  ) {
    const result = await this.filesService.uploadSingle(file, createFileDto);
    return new DataResponse(result);
  }

  // ─── Upload Multiple Files ─────────────────────────────────────────────────

  @Version('1')
  @Post('upload/multiple')
  // @Throttle({ upload: { ttl: 60_000, limit: 5 } })
  @UploadMultipleFilesSwagger()
  @CheckActionPolicy(PermissionEnum.WRITE, resource.File)
  @UseInterceptors(
    FilesInterceptor('files', 10, {
      storage: memoryStorage(),
      fileFilter: imageFileFilter,
      limits: { fileSize: MAX_FILE_SIZE_BYTES },
    }),
  )
  async uploadMultiple(
    @UploadedFiles() files: Express.Multer.File[],
    @Body() createFileDto: CreateFileDto,
  ) {
    const result = await this.filesService.uploadMultiple(files, createFileDto);
    return new DataResponse(result);
  }

  // ─── Get Presigned URL ─────────────────────────────────────────────────────

  @Version('1')
  @Get(':id/presigned-url')
  @GetPresignedUrlSwagger()
  @RequireApiKey()
  @CheckActionPolicy(PermissionEnum.READ, resource.File)
  async getPresignedUrl(@Param('id') id: string) {
    const result = await this.filesService.getPresignedUrl(id);
    return new DataResponse(result);
  }

  // ─── Get Public URL from URL ───────────────────────────────────────────────

  @Version('1')
  @Get('resolve/public-url')
  @GetPublicUrlSwagger()
  @CheckActionPolicy(PermissionEnum.READ, resource.File)
  @RequireApiKey()
  async getPublicUrlFromUrl(@Query('url') url: string) {
    const result = await this.filesService.getPublicUrlFromUrl(url);
    return new DataResponse(result);
  }

  // ─── Get All Files ─────────────────────────────────────────────────────────

  @Version('1')
  @Get()
  @GetAllFilesSwagger()
  @CheckActionPolicy(PermissionEnum.READ, resource.File)
  async findAll(@Query() query: CommonFieldsDto) {
    const result = await this.filesService.findAll(query);
    return new PaginatedDataResponse(result.data, result.meta);
  }

  // ─── Get File By ID ────────────────────────────────────────────────────────

  @Version('1')
  @Get(':id')
  @GetFileByIdSwagger()
  @RequireApiKey()
  @CheckActionPolicy(PermissionEnum.READ, resource.File)
  async findOne(@Param('id') id: string) {
    const result = await this.filesService.findOne(id);
    return new DataResponse(result);
  }

  // ─── Soft Delete File ──────────────────────────────────────────────────────

  @Version('1')
  @Delete(':id')
  @RequireApiKey()
  @DeleteFileSwagger()
  @CheckActionPolicy(PermissionEnum.DELETE, resource.File)
  async remove(@Param('id') id: string) {
    const result = await this.filesService.remove(id);
    return new DataResponse(result);
  }


}
