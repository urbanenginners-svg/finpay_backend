import {
  Injectable,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';

import { File, FileDocument } from 'src/services/mongoose/schemas/file.schema';
import { CreateFileDto } from './dto';
import { CommonFieldsDto } from 'src/utils/dtos/common-fields.dto';
import { getPaginatedDataWithAggregation } from 'src/utils/services/get-paginated-data-aggregation.service';
import { FileResourceEnum } from 'src/utils/enums/file-resource.enum';
import { validateImageMagicBytes } from 'src/utils/validators/file.validator';

@Injectable()
export class FilesService {
  private s3Client: S3Client;
  private readonly bucket: string;
  private readonly region: string;
  private readonly presignedUrlExpiresIn = 3600; // 1 hour

  constructor(
    @InjectModel(File.name)
    private fileModel: Model<FileDocument>,
    private readonly configService: ConfigService,
  ) {
    this.region = this.configService.get<string>('AWS_REGION') || 'us-east-1';
    this.bucket = this.configService.get<string>('AWS_S3_BUCKET');

    this.s3Client = new S3Client({
      region: this.region,
      credentials: {
        accessKeyId: this.configService.get<string>('AWS_ACCESS_KEY_ID'),
        secretAccessKey: this.configService.get<string>('AWS_SECRET_ACCESS_KEY'),
      },
    });
  }

  // ─── Private S3 Helpers ───────────────────────────────────────────────────

  private buildS3Key(
    type: FileResourceEnum,
    originalName: string,
    referenceId?: string,
  ): string {
    const ext = originalName.split('.').pop() || 'bin';
    const uniqueId = uuidv4();
    const base = referenceId ? `${type}/${referenceId}` : type;
    return `${base}/${uniqueId}.${ext}`;
  }

  private buildPublicUrl(s3Key: string): string {
    return `https://${this.bucket}.s3.${this.region}.amazonaws.com/${s3Key}`;
  }

  private async uploadToS3(
    buffer: Buffer,
    s3Key: string,
    mimeType: string,
  ): Promise<void> {
    try {
      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: s3Key,
        Body: buffer,
        ContentType: mimeType,
      });
      await this.s3Client.send(command);
    } catch (error) {
      throw new InternalServerErrorException(
        `Failed to upload file to S3: ${error.message}`,
      );
    }
  }

  // ─── Upload Single File ──────────────────────────────────────────────────

  async uploadSingle(
    file: Express.Multer.File,
    createFileDto: CreateFileDto,
    userId?: string,
  ): Promise<FileDocument> {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    // Layer 3 — Magic bytes: verify the actual binary content matches the
    // reported MIME type. This catches spoofed files (e.g. malware.exe
    // renamed to photo.jpg with a forged Content-Type header).
    validateImageMagicBytes(file.buffer, file.mimetype);

    const s3Key = this.buildS3Key(
      createFileDto.type,
      file.originalname,
      createFileDto.referenceId,
    );

    await this.uploadToS3(file.buffer, s3Key, file.mimetype);

    const imageUrl = this.buildPublicUrl(s3Key);

    const fileDoc = new this.fileModel({
      imageUrl,
      s3Key,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      type: createFileDto.type,
      referenceId: createFileDto.referenceId,
      ...(createFileDto.documentType && { documentType: createFileDto.documentType }),
      ...(createFileDto.idType && { idType: createFileDto.idType }),
      ...(createFileDto.proofType && { proofType: createFileDto.proofType }),
      isActive: true,
      isDeleted: false,
      ...(userId && { createdBy: userId }),
    });

    return fileDoc.save();
  }

  // ─── Upload Multiple Files ───────────────────────────────────────────────

  async uploadMultiple(
    files: Express.Multer.File[],
    createFileDto: CreateFileDto,
    userId?: string,
  ): Promise<FileDocument[]> {
    if (!files || files.length === 0) {
      throw new BadRequestException('No files provided');
    }

    const results: FileDocument[] = [];

    for (const file of files) {
      const uploaded = await this.uploadSingle(file, createFileDto, userId);
      results.push(uploaded);
    }

    return results;
  }

  // ─── Get Public URL from URL ──────────────────────────────────────────────

  async getPublicUrlFromUrl(
    url: string,
  ): Promise<{ presignedUrl: string; s3Key: string; expiresIn: number }> {
    // Extract the S3 key from the provided URL.
    // Supports both path-style and virtual-hosted-style S3 URLs:
    //   https://<bucket>.s3.<region>.amazonaws.com/<key>
    //   https://s3.<region>.amazonaws.com/<bucket>/<key>
    let s3Key: string;

    try {
      const parsed = new URL(url);
      const hostname = parsed.hostname;

      if (hostname.endsWith('.amazonaws.com')) {
        if (hostname.startsWith(this.bucket)) {
          // Virtual-hosted style: <bucket>.s3.<region>.amazonaws.com/<key>
          s3Key = parsed.pathname.replace(/^\//, '');
        } else {
          // Path style: s3.<region>.amazonaws.com/<bucket>/<key>
          const parts = parsed.pathname.replace(/^\//, '').split('/');
          parts.shift(); // remove bucket name
          s3Key = parts.join('/');
        }
      } else {
        throw new BadRequestException('URL does not appear to be a valid S3 URL');
      }
    } catch (e) {
      if (e instanceof BadRequestException) throw e;
      throw new BadRequestException(`Invalid URL provided: ${url}`);
    }

    if (!s3Key) {
      throw new BadRequestException('Could not extract S3 key from the provided URL');
    }

    // Verify this file exists in the database
    const fileDoc = await this.fileModel
      .findOne({ s3Key, isDeleted: false })
      .exec();

    if (!fileDoc) {
      throw new NotFoundException(
        `No file record found for the provided URL. It may have been deleted.`,
      );
    }

    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: s3Key,
      });

      const presignedUrl = await getSignedUrl(this.s3Client, command, {
        expiresIn: this.presignedUrlExpiresIn,
      });

      return { presignedUrl, s3Key, expiresIn: this.presignedUrlExpiresIn };
    } catch (error) {
      throw new InternalServerErrorException(
        `Failed to generate presigned URL: ${error.message}`,
      );
    }
  }

  // ─── Get Presigned URL ───────────────────────────────────────────────────

  async getPresignedUrl(
    id: string,
  ): Promise<{ presignedUrl: string; expiresIn: number }> {
    const fileDoc = await this.findOne(id);

    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: fileDoc.s3Key,
      });

      const presignedUrl = await getSignedUrl(this.s3Client, command, {
        expiresIn: this.presignedUrlExpiresIn,
      });

      return { presignedUrl, expiresIn: this.presignedUrlExpiresIn };
    } catch (error) {
      throw new InternalServerErrorException(
        `Failed to generate presigned URL: ${error.message}`,
      );
    }
  }

  // ─── Standard CRUD ───────────────────────────────────────────────────────

  async findAll(
    query: CommonFieldsDto,
  ): Promise<{ data: FileDocument[]; meta: any }> {
    const [data, meta] = await getPaginatedDataWithAggregation(
      this.fileModel,
      query,
      [{ $match: { isDeleted: false } }],
    );
    return { data, meta };
  }

  async findOne(id: string): Promise<FileDocument> {
    const file = await this.fileModel
      .findOne({ _id: id, isDeleted: false })
      .exec();

    if (!file) {
      throw new NotFoundException(`File with ID ${id} not found`);
    }

    return file;
  }

  async updateReferenceId(
    id: string,
    referenceId: string,
    userId?: string,
  ): Promise<FileDocument> {
    const file = await this.findOne(id);

    file.referenceId = referenceId;
    if (userId) {
      file.lastUpdatedBy = userId;
    }

    return file.save();
  }

  async remove(id: string, userId?: string): Promise<FileDocument> {
    const file = await this.findOne(id);

    file.isDeleted = true;
    file.deletedAt = new Date();
    if (userId) {
      file.deletedBy = userId;
    }

    return file.save();
  }

  // ─── Hard Delete from S3 (optional utility) ──────────────────────────────

  async deleteFromS3(s3Key: string): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: s3Key,
      });
      await this.s3Client.send(command);
    } catch (error) {
      throw new InternalServerErrorException(
        `Failed to delete file from S3: ${error.message}`,
      );
    }
  }
}
