import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { randomUUID } from 'crypto';
import { Model, Types } from 'mongoose';
import { AppConfig } from '../../config/configuration';
import { AccountType } from '../../common/enums';
import { JwtPayload, JwtRefreshPayload } from '../../common/types';
import { sha256 } from '../../common/utils/token.util';
import { RefreshToken, RefreshTokenDocument } from './schemas/refresh-token.schema';

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresIn: string;
  refreshTokenExpiresIn: string;
}

interface RequestMeta {
  userAgent?: string;
  ipAddress?: string;
}

@Injectable()
export class TokensService {
  constructor(
    @InjectModel(RefreshToken.name) private readonly refreshModel: Model<RefreshTokenDocument>,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  private accessTtl() {
    return this.config.get('jwt.expiresIn', { infer: true });
  }
  private refreshTtl() {
    return this.config.get('jwt.refreshExpiresIn', { infer: true });
  }

  async issuePair(
    userId: Types.ObjectId,
    accountType: AccountType,
    meta: RequestMeta = {},
  ): Promise<IssuedTokens> {
    const accessToken = await this.jwt.signAsync(
      { sub: String(userId), accountType, tokenType: 'access' } satisfies Omit<
        JwtPayload,
        'iat' | 'exp'
      >,
      {
        secret: this.config.get('jwt.secret', { infer: true }),
        expiresIn: this.accessTtl(),
      },
    );

    const jti = randomUUID();
    const refreshToken = await this.jwt.signAsync(
      { sub: String(userId), jti, accountType, tokenType: 'refresh' } satisfies Omit<
        JwtRefreshPayload,
        'iat' | 'exp'
      >,
      {
        secret: this.config.get('jwt.refreshSecret', { infer: true }),
        expiresIn: this.refreshTtl(),
      },
    );

    const decoded = this.jwt.decode(refreshToken) as { exp: number };
    await this.refreshModel.create({
      user: userId,
      jti,
      tokenHash: sha256(refreshToken),
      expiresAt: new Date(decoded.exp * 1000),
      userAgent: meta.userAgent ?? '',
      ipAddress: meta.ipAddress ?? '',
    });

    return {
      accessToken,
      refreshToken,
      accessTokenExpiresIn: this.accessTtl(),
      refreshTokenExpiresIn: this.refreshTtl(),
    };
  }

  /** Verifies a refresh token, rotates it, and returns a fresh pair. Detects reuse. */
  async rotate(rawRefreshToken: string, meta: RequestMeta = {}): Promise<IssuedTokens> {
    let payload: JwtRefreshPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtRefreshPayload>(rawRefreshToken, {
        secret: this.config.get('jwt.refreshSecret', { infer: true }),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
    if (payload.tokenType !== 'refresh') {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const record = await this.refreshModel.findOne({ jti: payload.jti }).exec();
    if (!record || record.tokenHash !== sha256(rawRefreshToken)) {
      throw new UnauthorizedException('Refresh token not recognized');
    }
    if (record.revokedAt) {
      // Re-use of an already-rotated token: burn the whole family.
      await this.revokeAllForUser(record.user);
      throw new UnauthorizedException('Refresh token reuse detected — please sign in again');
    }
    if (record.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('Refresh token expired');
    }

    const next = await this.issuePair(record.user, payload.accountType ?? AccountType.MEMBER, meta);
    record.revokedAt = new Date();
    record.replacedByJti = (this.jwt.decode(next.refreshToken) as { jti: string }).jti;
    await record.save();
    return next;
  }

  async revokeByRawToken(rawRefreshToken: string): Promise<void> {
    const decoded = this.jwt.decode(rawRefreshToken) as { jti?: string } | null;
    if (!decoded?.jti) return;
    await this.refreshModel
      .updateOne(
        { jti: decoded.jti, revokedAt: null },
        { $set: { revokedAt: new Date() } },
      )
      .exec();
  }

  async revokeAllForUser(userId: Types.ObjectId | string): Promise<void> {
    await this.refreshModel
      .updateMany({ user: userId, revokedAt: null }, { $set: { revokedAt: new Date() } })
      .exec();
  }
}
