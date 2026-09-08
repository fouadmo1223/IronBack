import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RolesModule } from '../roles/roles.module';
import { UsersModule } from '../users/users.module';
import { StaffController } from './staff.controller';
import { StaffService } from './staff.service';
import { StaffProfile, StaffProfileSchema } from './schemas/staff-profile.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: StaffProfile.name, schema: StaffProfileSchema }]),
    UsersModule,
    RolesModule,
  ],
  controllers: [StaffController],
  providers: [StaffService],
  exports: [StaffService, MongooseModule],
})
export class StaffModule {}
