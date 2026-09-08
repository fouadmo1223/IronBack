import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  v2 as cloudinary,
  UploadApiOptions,
  UploadApiResponse,
} from 'cloudinary';
import { AppConfig } from '../../config/configuration';
import { MediaFolder } from '../../common/enums';

export interface UploadResult {
  url: string;
  secureUrl: string;
  publicId: string;
  width: number;
  height: number;
  format: string;
  resourceType: string;
  bytes: number;
}

@Injectable()
export class CloudinaryService {
  private readonly logger = new Logger(CloudinaryService.name);
  private readonly enabled: boolean;
  private readonly folderRoot: string;

  constructor(private readonly config: ConfigService<AppConfig, true>) {
    const c = this.config.get('cloudinary', { infer: true });
    this.enabled = c.enabled;
    this.folderRoot = c.folderRoot;
    if (this.enabled) {
      cloudinary.config({
        cloud_name: c.cloudName,
        api_key: c.apiKey,
        api_secret: c.apiSecret,
        secure: true,
      });
    } else {
      this.logger.warn('Cloudinary credentials missing — media uploads are disabled');
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  private assertEnabled(): void {
    if (!this.enabled) {
      throw new InternalServerErrorException(
        'Media storage is not configured. Set CLOUDINARY_* environment variables.',
      );
    }
  }

  folderPath(folder: MediaFolder, sub?: string): string {
    return [this.folderRoot, folder, sub].filter(Boolean).join('/');
  }

  async uploadBuffer(
    buffer: Buffer,
    folder: MediaFolder,
    options: { sub?: string; publicId?: string; overwrite?: boolean; type?: 'upload' | 'private' } = {},
  ): Promise<UploadResult> {
    this.assertEnabled();
    const uploadOptions: UploadApiOptions = {
      folder: this.folderPath(folder, options.sub),
      resource_type: 'image',
      overwrite: options.overwrite ?? false,
      public_id: options.publicId,
      type: options.type ?? 'upload',
      unique_filename: !options.publicId,
      use_filename: false,
    };

    const res = await new Promise<UploadApiResponse>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(uploadOptions, (err, result) => {
        if (err || !result) return reject(err ?? new Error('Upload failed'));
        resolve(result);
      });
      stream.end(buffer);
    });

    return {
      url: res.url,
      secureUrl: res.secure_url,
      publicId: res.public_id,
      width: res.width,
      height: res.height,
      format: res.format,
      resourceType: res.resource_type,
      bytes: res.bytes,
    };
  }

  /** Time-limited signed URL for a privately-stored asset (e.g. payment proofs). */
  signedUrl(publicId: string, expiresInSeconds = 300): string {
    this.assertEnabled();
    return cloudinary.url(publicId, {
      type: 'private',
      sign_url: true,
      secure: true,
      resource_type: 'image',
      expires_at: Math.floor(Date.now() / 1000) + expiresInSeconds,
    });
  }

  async destroy(publicId: string, type: 'upload' | 'private' = 'upload'): Promise<void> {
    this.assertEnabled();
    try {
      await cloudinary.uploader.destroy(publicId, { type, resource_type: 'image', invalidate: true });
    } catch (err) {
      this.logger.error(`Failed to delete Cloudinary asset ${publicId}`, err as Error);
    }
  }
}
