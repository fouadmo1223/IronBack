import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MembersModule } from '../members/members.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { WhatsAppController } from './whatsapp.controller';
import { WhatsAppService } from './whatsapp.service';
import { MessageLog, MessageLogSchema } from './schemas/message-log.schema';
import {
  WhatsAppTemplate,
  WhatsAppTemplateSchema,
} from './schemas/whatsapp-template.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: WhatsAppTemplate.name, schema: WhatsAppTemplateSchema },
      { name: MessageLog.name, schema: MessageLogSchema },
    ]),
    MembersModule,
    SubscriptionsModule,
  ],
  controllers: [WhatsAppController],
  providers: [WhatsAppService],
  exports: [WhatsAppService],
})
export class WhatsAppModule {}
