import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  CreatePaymentMethodDto,
  UpdatePaymentMethodDto,
} from './dto/payment-method.dto';
import {
  PaymentMethodSetting,
  PaymentMethodSettingDocument,
} from './schemas/payment-method-setting.schema';

@Injectable()
export class PaymentMethodsService {
  constructor(
    @InjectModel(PaymentMethodSetting.name)
    private readonly methodModel: Model<PaymentMethodSettingDocument>,
  ) {}

  findAll(includeInactive: boolean): Promise<PaymentMethodSettingDocument[]> {
    const filter = includeInactive ? {} : { isActive: true };
    return this.methodModel.find(filter).sort({ displayOrder: 1, nameEn: 1 }).exec();
  }

  async getByIdOrFail(id: string | Types.ObjectId): Promise<PaymentMethodSettingDocument> {
    const method = await this.methodModel.findById(id).exec();
    if (!method) throw new NotFoundException('Payment method not found');
    return method;
  }

  async getActiveByIdOrFail(id: string | Types.ObjectId): Promise<PaymentMethodSettingDocument> {
    const method = await this.getByIdOrFail(id);
    if (!method.isActive) throw new NotFoundException('This payment method is not available');
    return method;
  }

  create(dto: CreatePaymentMethodDto): Promise<PaymentMethodSettingDocument> {
    return this.methodModel.create({ ...dto });
  }

  async update(
    id: string,
    dto: UpdatePaymentMethodDto,
  ): Promise<PaymentMethodSettingDocument> {
    const method = await this.getByIdOrFail(id);
    Object.assign(method, dto);
    await method.save();
    return method;
  }

  async remove(id: string): Promise<void> {
    const method = await this.getByIdOrFail(id);
    method.isActive = false;
    await method.save();
  }
}
