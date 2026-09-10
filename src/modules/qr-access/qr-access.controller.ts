import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
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
import { AssignCardDto, GenerateCardsDto } from './dto/qr-access.dto';
import { QrAccessService } from './qr-access.service';

function actorFrom(user: AuthenticatedUser, req: Request) {
  return {
    id: user.id,
    label: `${user.firstName} ${user.lastName}`.trim(),
    ip: req.ip ?? '',
    userAgent: req.headers['user-agent'] ?? '',
  };
}

@ApiTags('QR Access')
@ApiBearerAuth()
@Controller()
export class QrAccessController {
  constructor(private readonly qrAccessService: QrAccessService) {}

  @Get('qr-access/me')
  @AllowAccountTypes(AccountType.MEMBER)
  @ResponseMessage('Your access QR')
  myQr(@CurrentUser('id') userId: string) {
    return this.qrAccessService.getForMemberUser(userId);
  }

  @Post('members/:memberId/qr/regenerate')
  @Permissions(PERMISSIONS.MEMBER_UPDATE)
  @ResponseMessage('QR regenerated')
  regenerate(
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
    @Param('memberId', ParseObjectIdPipe) memberId: string,
  ) {
    return this.qrAccessService.regenerate(memberId, actorFrom(user, req));
  }

  @Post('members/:memberId/qr/disable')
  @Permissions(PERMISSIONS.MEMBER_UPDATE)
  @ResponseMessage('QR disabled')
  async disable(
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
    @Param('memberId', ParseObjectIdPipe) memberId: string,
  ) {
    await this.qrAccessService.disable(memberId, actorFrom(user, req));
    return null;
  }

  @Get('members/:memberId/qr')
  @Permissions(PERMISSIONS.MEMBER_READ)
  @ResponseMessage("Member's access QR")
  memberQr(@Param('memberId', ParseObjectIdPipe) memberId: string) {
    return this.qrAccessService.getForMemberProfile(memberId);
  }

  @Post('members/:memberId/qr/unassign')
  @Permissions(PERMISSIONS.MEMBER_UPDATE)
  @ResponseMessage('Card released to the pool')
  async unassign(
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
    @Param('memberId', ParseObjectIdPipe) memberId: string,
  ) {
    await this.qrAccessService.unassign(memberId, actorFrom(user, req));
    return null;
  }

  /* ───────── Card pool (pre-printed batches) ───────── */

  @Post('qr-cards/batch')
  @Permissions(PERMISSIONS.MEMBER_UPDATE)
  @ResponseMessage('Cards generated')
  generateCards(
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
    @Body() dto: GenerateCardsDto,
  ) {
    return this.qrAccessService.generateBatch(dto.count, actorFrom(user, req));
  }

  @Get('qr-cards/unassigned')
  @Permissions(PERMISSIONS.MEMBER_READ)
  @ResponseMessage('Unassigned cards')
  async unassignedCards(@Query('limit') limit?: string) {
    const cards = await this.qrAccessService.listUnassigned(limit ? Number(limit) : 120);
    return { cards, total: await this.qrAccessService.countUnassigned() };
  }

  @Post('qr-cards/assign')
  @Permissions(PERMISSIONS.MEMBER_UPDATE)
  @ResponseMessage('Card assigned')
  assignCard(
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
    @Body() dto: AssignCardDto,
  ) {
    return this.qrAccessService.assign(
      { cardCode: dto.cardCode, token: dto.token, memberId: dto.memberId, replace: dto.replace },
      actorFrom(user, req),
    );
  }
}
