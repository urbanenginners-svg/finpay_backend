import { BadRequestException } from '@nestjs/common';

// ─── Allowed MIME types ────────────────────────────────────────────────────

export const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'application/pdf',
];

// Max file size per upload (multer LIMIT_FILE_SIZE → Nest PayloadTooLargeException / 413)
// Keep in line with `main.ts` JSON/urlencoded body limit.
export const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024;

// ─── Magic byte signatures ─────────────────────────────────────────────────
// These are the actual first bytes every valid image format MUST start with.
// A user cannot fake these by just renaming a file or forging the Content-Type header.

const MAGIC_BYTES: {
  mime: string;
  bytes: number[];
  offset?: number;
}[] = [
  // JPEG: FF D8 FF
  { mime: 'image/jpeg', bytes: [0xff, 0xd8, 0xff] },
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  { mime: 'image/png', bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  // GIF87a / GIF89a
  { mime: 'image/gif', bytes: [0x47, 0x49, 0x46, 0x38] },
  // WebP: RIFF????WEBP  (bytes 0-3 = RIFF, bytes 8-11 = WEBP)
  { mime: 'image/webp', bytes: [0x52, 0x49, 0x46, 0x46] },
  // PDF: %PDF-
  { mime: 'application/pdf', bytes: [0x25, 0x50, 0x44, 0x46, 0x2d] },
];

// ─── Multer file filter ────────────────────────────────────────────────────

/**
 * Used directly in the multer interceptor options.
 * Rejects files whose reported MIME type is not in the allowed list before
 * the handler is even invoked.
 */
export function imageFileFilter(
  _req: unknown,
  file: Express.Multer.File,
  callback: (error: Error | null, acceptFile: boolean) => void,
) {
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    return callback(
      new BadRequestException(
        `File type "${file.mimetype}" is not allowed. Allowed types: ${ALLOWED_MIME_TYPES.join(', ')}`,
      ),
      false,
    );
  }
  callback(null, true);
}

// ─── Magic bytes validator ─────────────────────────────────────────────────

/**
 * Reads the actual binary header of the buffer and ensures it matches a
 * real image signature. This is the second (and stronger) defence layer —
 * it catches cases where someone forges the Content-Type header or renames
 * a non-image file to .jpg / .png.
 *
 * Call this in the service AFTER multer has already loaded the buffer.
 */
export function validateImageMagicBytes(
  buffer: Buffer,
  reportedMimeType: string,
): void {
  if (!buffer || buffer.length < 8) {
    throw new BadRequestException('File is empty or too small to be a valid image');
  }

  // Special case: WebP has WEBP at bytes 8-11
  if (reportedMimeType === 'image/webp') {
    const riff = buffer.slice(0, 4);
    const webp = buffer.slice(8, 12);
    if (
      riff.toString('hex') === '52494646' &&
      webp.toString('ascii') === 'WEBP'
    ) {
      return; // valid WebP
    }
    throw new BadRequestException(
      'File content does not match the reported WebP format. Possible spoofed file.',
    );
  }

  // SVG: text-based — check for opening XML/SVG tags
  if (reportedMimeType === 'image/svg+xml') {
    const text = buffer.slice(0, 100).toString('utf8').trimStart();
    if (text.startsWith('<?xml') || text.startsWith('<svg') || text.startsWith('<!--')) {
      return; // valid SVG
    }
    throw new BadRequestException(
      'File content does not match the reported SVG format. Possible spoofed file.',
    );
  }

  // For all other types, check magic bytes
  const entry = MAGIC_BYTES.find((m) => m.mime === reportedMimeType);

  if (!entry) {
    throw new BadRequestException(`Unsupported file type: ${reportedMimeType}`);
  }

  const fileHeader = Array.from(buffer.slice(0, entry.bytes.length));
  const matches = entry.bytes.every((byte, i) => fileHeader[i] === byte);

  if (!matches) {
    throw new BadRequestException(
      `File content does not match the reported type "${reportedMimeType}". Possible spoofed file.`,
    );
  }
}
