import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MembersModule } from '../members/members.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { QrAccessController } from './qr-access.controller';
import { QrAccessService } from './qr-access.service';
import {
  MemberAccessToken,
  MemberAccessTokenSchema,
} from './schemas/member-access-token.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: MemberAccessToken.name, schema: MemberAccessTokenSchema },
    ]),
    MembersModule,
    SubscriptionsModule,
  ],
  controllers: [QrAccessController],
  providers: [QrAccessService],
  exports: [QrAccessService],
})
export class QrAccessModule {}
