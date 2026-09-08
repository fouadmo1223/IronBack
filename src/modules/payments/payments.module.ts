import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MediaModule } from '../media/media.module';
import { MembersModule } from '../members/members.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { QrAccessModule } from '../qr-access/qr-access.module';
import { PaymentMethodsController } from './payment-methods.controller';
import { PaymentMethodsService } from './payment-methods.service';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import {
  PaymentMethodSetting,
  PaymentMethodSettingSchema,
} from './schemas/payment-method-setting.schema';
import { Payment, PaymentSchema } from './schemas/payment.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Payment.name, schema: PaymentSchema },
      { name: PaymentMethodSetting.name, schema: PaymentMethodSettingSchema },
    ]),
    MembersModule,
    SubscriptionsModule,
    QrAccessModule,
    MediaModule,
  ],
  controllers: [PaymentsController, PaymentMethodsController],
  providers: [PaymentsService, PaymentMethodsService],
  exports: [PaymentsService, PaymentMethodsService],
})
export class PaymentsModule {}
