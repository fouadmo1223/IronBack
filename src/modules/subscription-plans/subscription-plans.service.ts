import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  CreateSubscriptionPlanDto,
  UpdateSubscriptionPlanDto,
} from './dto/subscription-plan.dto';
import {
  SubscriptionPlan,
  SubscriptionPlanDocument,
} from './schemas/subscription-plan.schema';

@Injectable()
export class SubscriptionPlansService {
  constructor(
    @InjectModel(SubscriptionPlan.name)
    private readonly planModel: Model<SubscriptionPlanDocument>,
  ) {}

  findAll(includeInactive: boolean): Promise<SubscriptionPlanDocument[]> {
    const filter = includeInactive ? {} : { isActive: true };
    return this.planModel.find(filter).sort({ displayOrder: 1, price: 1 }).exec();
  }

  findById(id: string | Types.ObjectId): Promise<SubscriptionPlanDocument | null> {
    return this.planModel.findById(id).exec();
  }

  async getByIdOrFail(id: string | Types.ObjectId): Promise<SubscriptionPlanDocument> {
    const plan = await this.findById(id);
    if (!plan) throw new NotFoundException('Subscription plan not found');
    return plan;
  }

  async getActiveByIdOrFail(id: string | Types.ObjectId): Promise<SubscriptionPlanDocument> {
    const plan = await this.getByIdOrFail(id);
    if (!plan.isActive) throw new NotFoundException('This plan is no longer available');
    return plan;
  }

  create(dto: CreateSubscriptionPlanDto): Promise<SubscriptionPlanDocument> {
    return this.planModel.create({ ...dto });
  }

  async update(
    id: string | Types.ObjectId,
    dto: UpdateSubscriptionPlanDto,
  ): Promise<SubscriptionPlanDocument> {
    const plan = await this.getByIdOrFail(id);
    Object.assign(plan, dto);
    await plan.save();
    return plan;
  }

  /** Soft archive — historical subscriptions keep referencing the plan. */
  async archive(id: string | Types.ObjectId): Promise<void> {
    const plan = await this.getByIdOrFail(id);
    plan.isActive = false;
    await plan.save();
  }
}
