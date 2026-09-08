import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ParseObjectIdPipe, Permissions, ResponseMessage } from '../../common';
import { PERMISSIONS } from '../../common/constants/permissions';
import {
  CreatePaymentMethodDto,
  UpdatePaymentMethodDto,
} from './dto/payment-method.dto';
import { PaymentMethodsService } from './payment-methods.service';

@ApiTags('Payment Methods')
@ApiBearerAuth()
@Controller('payment-methods')
export class PaymentMethodsController {
  constructor(private readonly paymentMethodsService: PaymentMethodsService) {}

  /** Any authenticated user (members included) needs these to make a transfer. */
  @Get('active')
  @ResponseMessage('Active payment methods')
  active() {
    return this.paymentMethodsService.findAll(false);
  }

  @Get()
  @Permissions(PERMISSIONS.SETTINGS_MANAGE)
  list() {
    return this.paymentMethodsService.findAll(true);
  }

  @Post()
  @Permissions(PERMISSIONS.SETTINGS_MANAGE)
  @ResponseMessage('Payment method created')
  create(@Body() dto: CreatePaymentMethodDto) {
    return this.paymentMethodsService.create(dto);
  }

  @Patch(':id')
  @Permissions(PERMISSIONS.SETTINGS_MANAGE)
  @ResponseMessage('Payment method updated')
  update(@Param('id', ParseObjectIdPipe) id: string, @Body() dto: UpdatePaymentMethodDto) {
    return this.paymentMethodsService.update(id, dto);
  }

  @Delete(':id')
  @Permissions(PERMISSIONS.SETTINGS_MANAGE)
  @ResponseMessage('Payment method deactivated')
  remove(@Param('id', ParseObjectIdPipe) id: string) {
    return this.paymentMethodsService.remove(id);
  }
}
