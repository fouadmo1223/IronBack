import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import { MediaFolder } from '../../common/enums';
import { PaginatedResult } from '../../common/types';
import { buildSort, paginated } from '../../common/utils/pagination.util';
import { CloudinaryService } from './cloudinary.service';
import { MediaQueryDto, UpdateMediaAssetDto } from './dto/media.dto';
import { MediaAsset, MediaAssetDocument } from './schemas/media-asset.schema';

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'];
const MAX_BYTES = 8 * 1024 * 1024;

export interface UploadFile {
  buffer: Buffer;
  mimetype: string;
  size: number;
  originalname: string;
}

@Injectable()
export class MediaService {
  constructor(
    @InjectModel(MediaAsset.name) private readonly assetModel: Model<MediaAssetDocument>,
    private readonly cloudinary: CloudinaryService,
  ) {}

  private validate(file: UploadFile): void {
    if (!file) throw new BadRequestException('No file provided');
    if (!ALLOWED_MIME.includes(file.mimetype)) {
      throw new BadRequestException('Unsupported image type');
    }
    if (file.size > MAX_BYTES) {
      throw new BadRequestException('Image exceeds the 8MB limit');
    }
  }

  async uploadToLibrary(
    file: UploadFile,
    folder: MediaFolder,
    uploadedBy: string,
    meta: { altAr?: string; altEn?: string; title?: string; tags?: string[] } = {},
  ): Promise<MediaAssetDocument> {
    this.validate(file);
    const result = await this.cloudinary.uploadBuffer(file.buffer, folder);
    return this.assetModel.create({
      ...result,
      folder,
      altAr: meta.altAr ?? '',
      altEn: meta.altEn ?? '',
      title: meta.title ?? file.originalname,
      tags: meta.tags ?? [],
      uploadedBy: new Types.ObjectId(uploadedBy),
    });
  }

  /**
   * Private upload for sensitive documents (payment proofs). No library row —
   * the caller stores publicId on its own record and fetches signed URLs.
   */
  async uploadPrivate(
    file: UploadFile,
    folder: MediaFolder,
    sub?: string,
  ): Promise<{ publicId: string; secureUrl: string; width: number; height: number }> {
    this.validate(file);
    const result = await this.cloudinary.uploadBuffer(file.buffer, folder, {
      sub,
      type: 'private',
    });
    return {
      publicId: result.publicId,
      secureUrl: result.secureUrl,
      width: result.width,
      height: result.height,
    };
  }

  signedUrl(publicId: string, expiresIn = 300): string {
    return this.cloudinary.signedUrl(publicId, expiresIn);
  }

  async list(query: MediaQueryDto): Promise<PaginatedResult<MediaAssetDocument>> {
    const filter: FilterQuery<MediaAssetDocument> = { folder: MediaFolder.CMS };
    if (query.tag) filter.tags = query.tag;
    if (query.search) {
      const rx = new RegExp(query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ title: rx }, { altEn: rx }, { altAr: rx }, { publicId: rx }];
    }
    const [items, total] = await Promise.all([
      this.assetModel
        .find(filter)
        .sort(buildSort(query.sortBy, query.sortDir))
        .skip(query.skip)
        .limit(query.limit)
        .exec(),
      this.assetModel.countDocuments(filter).exec(),
    ]);
    return paginated(items, total, query.page, query.limit);
  }

  async getByIdOrFail(id: string | Types.ObjectId): Promise<MediaAssetDocument> {
    const asset = await this.assetModel.findById(id).exec();
    if (!asset) throw new NotFoundException('Media asset not found');
    return asset;
  }

  async update(id: string, dto: UpdateMediaAssetDto): Promise<MediaAssetDocument> {
    const asset = await this.getByIdOrFail(id);
    Object.assign(asset, dto);
    await asset.save();
    return asset;
  }

  async remove(id: string): Promise<void> {
    const asset = await this.getByIdOrFail(id);
    if (asset.usedBy.length > 0) {
      throw new BadRequestException(
        `This image is in use (${asset.usedBy.join(', ')}). Replace it before deleting.`,
      );
    }
    await this.cloudinary.destroy(asset.publicId);
    await asset.deleteOne();
  }

  async markUsage(publicId: string, ref: string, inUse: boolean): Promise<void> {
    await this.assetModel
      .updateOne(
        { publicId },
        inUse ? { $addToSet: { usedBy: ref } } : { $pull: { usedBy: ref } },
      )
      .exec();
  }
}
