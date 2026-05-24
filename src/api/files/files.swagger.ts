import { applyDecorators } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
} from '@nestjs/swagger';
import { FileResponseDto, PresignedUrlResponseDto, PublicUrlResponseDto, UploadResponseDto } from './dto';
import { FileResourceEnum } from 'src/utils/enums/file-resource.enum';

export function UploadSingleFileSwagger() {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Upload a single file to S3',
      description:
        'Upload a single image/file to S3. The file is stored and a document is created in the files collection. Requires WRITE permission on the file resource. Maximum file size: 20 MB per file.',
    }),
    ApiConsumes('multipart/form-data'),
    ApiBody({
      schema: {
        type: 'object',
        required: ['file', 'type'],
        properties: {
          file: {
            type: 'string',
            format: 'binary',
            description: 'The file to upload',
          },
          type: {
            type: 'string',
            enum: Object.values(FileResourceEnum), 
            description: 'The resource type this file belongs to',
            example: 'document',
          },
          referenceId: {
            type: 'string',
            description: 'Optional entity ID to associate this file with',
            example: 'franchise::123e4567-e89b-12d3-a456-426614174000',
          },
          documentType: {
            type: 'string',
            enum: ['idProof', 'societyAgreement', 'addressProof', 'franchiseProposalTc'],
            description: 'Document classification — idProof, societyAgreement, addressProof, or franchiseProposalTc',
            example: 'idProof',
          },
          idType: {
            type: 'string',
            enum: ['aadhaar', 'voter-card'],
            description: 'ID proof sub-type — supply when documentType is idProof',
            example: 'aadhaar',
          },
          proofType: {
            type: 'string',
            enum: ['aadhaar', 'electricity-bill'],
            description: 'Address proof sub-type — supply when documentType is addressProof',
            example: 'aadhaar',
          },
        },
      },
    }),
    ApiResponse({
      status: 201,
      description: 'File uploaded successfully',
      type: UploadResponseDto,
    }),
    ApiResponse({ status: 400, description: 'Bad Request - No file provided or invalid data' }),
    ApiResponse({ status: 401, description: 'Unauthorized' }),
    ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' }),
    ApiResponse({ status: 413, description: 'Payload Too Large - file exceeds 20 MB' }),
  );
}

export function UploadMultipleFilesSwagger() {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Upload multiple files to S3',
      description:
        'Upload up to 10 files at once to S3. Each file gets its own document in the files collection. Requires WRITE permission on the file resource. Maximum 20 MB per file.',
    }),
    ApiConsumes('multipart/form-data'),
    ApiBody({
      schema: {
        type: 'object',
        required: ['files', 'type'],
        properties: {
          files: {
            type: 'array',
            items: { type: 'string', format: 'binary' },
            description: 'Array of files to upload (max 10)',
          },
          type: {
            type: 'string',
            enum: ['vendor', 'mandi', 'user', 'institution', 'product', 'document', 'category', 'vendor-invoice', 'other', 'audit', 'society', 'delivery-partner', 'franchise'],
            description: 'The resource type these files belong to',
            example: 'document',
          },
          referenceId: {
            type: 'string',
            description: 'Optional entity ID to associate these files with',
            example: 'franchise::123e4567-e89b-12d3-a456-426614174000',
          },
          documentType: {
            type: 'string',
            enum: ['idProof', 'societyAgreement', 'addressProof', 'franchiseProposalTc'],
            description: 'Document classification — idProof, societyAgreement, addressProof, or franchiseProposalTc',
            example: 'addressProof',
          },
          idType: {
            type: 'string',
            enum: ['aadhaar', 'voter-card'],
            description: 'ID proof sub-type — supply when documentType is idProof',
            example: 'aadhaar',
          },
          proofType: {
            type: 'string',
            enum: ['aadhaar', 'electricity-bill'],
            description: 'Address proof sub-type — supply when documentType is addressProof',
            example: 'electricity-bill',
          },
        },
      },
    }),
    ApiResponse({
      status: 201,
      description: 'Files uploaded successfully',
      type: [UploadResponseDto],
    }),
    ApiResponse({ status: 400, description: 'Bad Request - No files provided or invalid data' }),
    ApiResponse({ status: 401, description: 'Unauthorized' }),
    ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' }),
    ApiResponse({ status: 413, description: 'Payload Too Large - a file exceeds 20 MB' }),
  );
}

export function GetPresignedUrlSwagger() {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Get a presigned URL for a file',
      description:
        'Generate a temporary presigned URL to access a private S3 file. The URL expires after 1 hour. Requires READ permission on the file resource.',
    }),
    ApiParam({
      name: 'id',
      description: 'File document ID',
      example: 'file::123e4567-e89b-12d3-a456-426614174000',
    }),
    ApiResponse({
      status: 200,
      description: 'Presigned URL generated successfully',
      type: PresignedUrlResponseDto,
    }),
    ApiResponse({ status: 401, description: 'Unauthorized' }),
    ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' }),
    ApiResponse({ status: 404, description: 'File not found' }),
  );
}

export function GetAllFilesSwagger() {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Get all files',
      description: 'Retrieve a paginated list of all file documents. Supports search and pagination.',
    }),
    ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page' }),
    ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number' }),
    ApiQuery({ name: 'q', required: false, type: String, description: 'Search query' }),
    ApiResponse({
      status: 200,
      description: 'List of files retrieved successfully',
      type: [FileResponseDto],
    }),
    ApiResponse({ status: 401, description: 'Unauthorized' }),
    ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' }),
  );
}

export function GetFileByIdSwagger() {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Get file by ID',
      description: 'Retrieve a single file document by its ID.',
    }),
    ApiParam({
      name: 'id',
      description: 'File ID',
      example: 'file::123e4567-e89b-12d3-a456-426614174000',
    }),
    ApiResponse({
      status: 200,
      description: 'File retrieved successfully',
      type: FileResponseDto,
    }),
    ApiResponse({ status: 401, description: 'Unauthorized' }),
    ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' }),
    ApiResponse({ status: 404, description: 'File not found' }),
  );
}

export function DeleteFileSwagger() {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Soft delete a file',
      description:
        'Soft delete a file document (sets isDeleted=true and deletedAt). The actual S3 object is NOT removed. Requires DELETE permission on the file resource.',
    }),
    ApiParam({
      name: 'id',
      description: 'File ID',
      example: 'file::123e4567-e89b-12d3-a456-426614174000',
    }),
    ApiResponse({ status: 200, description: 'File deleted successfully', type: FileResponseDto }),
    ApiResponse({ status: 401, description: 'Unauthorized' }),
    ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' }),
    ApiResponse({ status: 404, description: 'File not found' }),
  );
}

export function GetPublicUrlSwagger() {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Get presigned URL from an S3 URL',
      description:
        'Accepts an existing S3 URL (the imageUrl stored on a file document) and returns a temporary presigned URL valid for 1 hour. Validates that the file exists in the database and has not been deleted.',
    }),
    ApiQuery({
      name: 'url',
      required: true,
      type: String,
      description: 'The S3 URL of the file (imageUrl value from the file document)',
      example: 'https://sbzee.dev.bucket.s3.ap-south-1.amazonaws.com/vendor/abc.jpg',
    }),
    ApiResponse({
      status: 200,
      description: 'Presigned URL generated successfully',
      type: PublicUrlResponseDto,
    }),
    ApiResponse({ status: 400, description: 'Bad Request - Invalid or non-S3 URL' }),
    ApiResponse({ status: 401, description: 'Unauthorized' }),
    ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' }),
    ApiResponse({ status: 404, description: 'File not found or has been deleted' }),
  );
}
