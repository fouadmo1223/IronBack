import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import {
  AllowAccountTypes,
  CurrentUser,
  ParseObjectIdPipe,
  Permissions,
  ResponseMessage,
} from '../../common';
import { PERMISSIONS } from '../../common/constants/permissions';
import { AccountType } from '../../common/enums';
import { AuthenticatedUser } from '../../common/types';
import { MembersService } from '../members/members.service';
import {
  AdminNoteDto,
  MarkFakePaymentDto,
  PaymentQueryDto,
  RecordManualPaymentDto,
  RefundPaymentDto,
  RejectPaymentDto,
  SubmitPaymentDto,
} from './dto/payment.dto';
import { PaymentsService } from './payments.service';
import { UploadFile } from '../media/media.service';

function actorFrom(user: AuthenticatedUser, req: Request) {
  return {
    id: user.id,
    label: `${user.firstName} ${user.lastName}`.trim(),
    ip: (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || '',
    userAgent: req.headers['user-agent'] ?? '',
  };
}

@ApiTags('Payments')
@ApiBearerAuth()
@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly membersService: MembersService,
  ) {}

  // ─────────── Member ───────────

  @Post('me/submit')
  @AllowAccountTypes(AccountType.MEMBER)
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['subscriptionId', 'paymentMethodId', 'amount', 'senderName', 'senderPhone', 'transferDate', 'proof'],
      properties: {
        proof: { type: 'string', format: 'binary' },
        subscriptionId: { type: 'string' },
        paymentMethodId: { type: 'string' },
        amount: { type: 'number' },
        senderName: { type: 'string' },
        senderPhone: { type: 'string' },
        transferDate: { type: 'string', format: 'date' },
        transactionReference: { type: 'string' },
        memberNotes: { type: 'string' },
      },
    },
  })
  @UseInterceptors(FileInterceptor('proof'))
  @ResponseMessage('Payment submitted — under review')
  submit(
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
    @UploadedFile() proof: UploadFile,
    @Body() dto: SubmitPaymentDto,
  ) {
    return this.paymentsService.submitProof(user.id, dto, proof, actorFrom(user, req));
  }

  @Get('me')
  @AllowAccountTypes(AccountType.MEMBER)
  @ResponseMessage('Your payments')
  async mine(@CurrentUser() user: AuthenticatedUser) {
    const member = await this.membersService.getByUserIdOrFail(user.id);
    return this.paymentsService.memberHistory(member._id);
  }

  // ─────────── Staff review ───────────

  @Get()
  @Permissions(PERMISSIONS.PAYMENT_READ)
  list(@Query() query: PaymentQueryDto) {
    return this.paymentsService.list(query);
  }

  @Get(':id')
  @Permissions(PERMISSIONS.PAYMENT_READ)
  detail(@Param('id', ParseObjectIdPipe) id: string) {
    return this.paymentsService.getDetail(id);
  }

  @Post('record-manual')
  @Permissions(PERMISSIONS.PAYMENT_CREATE)
  @ResponseMessage('Manual payment recorded')
  recordManual(
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
    @Body() dto: RecordManualPaymentDto,
  ) {
    return this.paymentsService.recordManual(dto, actorFrom(user, req));
  }

  @Post(':id/approve')
  @Permissions(PERMISSIONS.PAYMENT_APPROVE)
  @ResponseMessage('Payment approved')
  approve(
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
    @Param('id', ParseObjectIdPipe) id: string,
  ) {
    return this.paymentsService.approve(id, actorFrom(user, req));
  }

  @Post(':id/reject')
  @Permissions(PERMISSIONS.PAYMENT_REJECT)
  @ResponseMessage('Payment rejected')
  reject(
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: RejectPaymentDto,
  ) {
    return this.paymentsService.reject(id, dto, actorFrom(user, req));
  }

  @Post(':id/mark-fake')
  @Permissions(PERMISSIONS.PAYMENT_MARK_FAKE)
  @ResponseMessage('Payment marked as fake')
  markFake(
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: MarkFakePaymentDto,
  ) {
    return this.paymentsService.markFake(id, dto.internalReason, actorFrom(user, req));
  }

  @Post(':id/cancel')
  @Permissions(PERMISSIONS.PAYMENT_REVIEW)
  @ResponseMessage('Payment cancelled')
  cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
    @Param('id', ParseObjectIdPipe) id: string,
  ) {
    return this.paymentsService.cancel(id, actorFrom(user, req));
  }

  @Post(':id/request-refund')
  @Permissions(PERMISSIONS.PAYMENT_REFUND)
  @ResponseMessage('Refund requested')
  requestRefund(
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
    @Param('id', ParseObjectIdPipe) id: string,
  ) {
    return this.paymentsService.requestRefund(id, actorFrom(user, req));
  }

  @Post(':id/refund')
  @Permissions(PERMISSIONS.PAYMENT_REFUND)
  @ApiConsumes('multipart/form-data', 'application/json')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['amount', 'date', 'method'],
      properties: {
        proof: { type: 'string', format: 'binary', description: 'Optional refund receipt image' },
        amount: { type: 'number' },
        date: { type: 'string', format: 'date' },
        method: { type: 'string' },
        reference: { type: 'string' },
        note: { type: 'string' },
      },
    },
  })
  @UseInterceptors(FileInterceptor('proof'))
  @ResponseMessage('Refund recorded')
  refund(
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
    @Param('id', ParseObjectIdPipe) id: string,
    @UploadedFile() proof: UploadFile | undefined,
    @Body() dto: RefundPaymentDto,
  ) {
    return this.paymentsService.refund(id, dto, actorFrom(user, req), proof);
  }

  @Post(':id/notes')
  @Permissions(PERMISSIONS.PAYMENT_REVIEW)
  @ResponseMessage('Note added')
  addNote(
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: AdminNoteDto,
  ) {
    return this.paymentsService.addAdminNote(id, dto, actorFrom(user, req));
  }
}
