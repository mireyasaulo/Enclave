import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { CurrentUser } from '../../auth/current-user.decorator';
import {
  JwtAuthGuard,
  type AuthenticatedUser,
} from '../../auth/jwt-auth.guard';
import { PrivateCharacterRateLimitGuard } from '../../characters/guards/private-character-rate-limit.guard';
import { WikiPrivateCharacterService } from '../services/wiki-private-character.service';
import type { PrivateCharacterDto } from '../services/wiki-private-character.service';

@Controller('wiki/my-characters')
@UseGuards(JwtAuthGuard)
export class WikiPrivateCharacterController {
  constructor(private readonly service: WikiPrivateCharacterService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.service.listForOwner(user.id);
  }

  @Post()
  @UseGuards(PrivateCharacterRateLimitGuard)
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: PrivateCharacterDto,
  ) {
    // 走 createStrict（重名抛 Conflict）—— 旧的 create 走 upsertByName 会
    // 把同名旧记录无声覆盖；用户在 /my-characters/new 输入已存在 name 后
    // 期望"新建"，结果默默盖掉旧角色。createStrict 把 upsert 语义只留给
    // import 路径，create 路径必须显式新建。
    return this.service.createStrict(user.id, body);
  }

  @Get(':id')
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.service.getById(user.id, id);
  }

  @Put(':id')
  @UseGuards(PrivateCharacterRateLimitGuard)
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: PrivateCharacterDto,
  ) {
    return this.service.update(user.id, id, body);
  }

  @Delete(':id')
  @UseGuards(PrivateCharacterRateLimitGuard)
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    await this.service.delete(user.id, id);
    return { success: true };
  }

  @Get(':id/export')
  async exportOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Res({ passthrough: false }) res: Response,
  ) {
    const record = await this.service.getById(user.id, id);
    const bundle = this.service.toExportBundle(record, user.id);
    const safeName = record.name.replace(/[\\/:*?"<>|\r\n\t]+/g, '_').slice(
      0,
      80,
    );
    const baseName = safeName || 'character';
    // ASCII fallback：非 ASCII 字符替换成 '_'，保证老浏览器也能拿到合法 filename。
    // 同时按 RFC 5987 给 filename*=UTF-8''…，modern 浏览器优先用它，正确显示中文。
    const asciiName = baseName.replace(/[^\x20-\x7E]/g, '_');
    const utf8Encoded = encodeURIComponent(baseName);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${asciiName}.character.json"; filename*=UTF-8''${utf8Encoded}.character.json`,
    );
    res.send(JSON.stringify(bundle, null, 2));
  }

  @Post('import')
  @UseGuards(PrivateCharacterRateLimitGuard)
  async importOne(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: unknown,
  ) {
    const dto = this.service.parseImportBundle(body);
    return this.service.upsertByName(user.id, dto);
  }
}
