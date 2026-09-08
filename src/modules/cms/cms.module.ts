import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CmsController } from './cms.controller';
import { CmsService } from './cms.service';
import { CmsPage, CmsPageSchema } from './schemas/cms-page.schema';
import { SiteContent, SiteContentSchema } from './schemas/site-content.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: CmsPage.name, schema: CmsPageSchema },
      { name: SiteContent.name, schema: SiteContentSchema },
    ]),
  ],
  controllers: [CmsController],
  providers: [CmsService],
  exports: [CmsService],
})
export class CmsModule {}
