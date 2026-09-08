import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MembersModule } from '../members/members.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { SubscriptionFreezesController } from './subscription-freezes.controller';
import { SubscriptionFreezesService } from './subscription-freezes.service';
import {
  SubscriptionFreeze,
  SubscriptionFreezeSchema,
} from './schemas/subscription-freeze.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SubscriptionFreeze.name, schema: SubscriptionFreezeSchema },
    ]),
    SubscriptionsModule,
    MembersModule,
  ],
  controllers: [SubscriptionFreezesController],
  providers: [SubscriptionFreezesService],
  exports: [SubscriptionFreezesService],
})
export class SubscriptionFreezesModule {}
