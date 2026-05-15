import {
  Controller,
  Get,
  Param,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { AppError } from '../../../common/app-error.exception';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import {
  WIKI_AVATAR_UPLOAD_LIMIT_BYTES,
  WikiAvatarService,
  type UploadedWikiAvatarFile,
} from '../services/wiki-avatar.service';

// 头像上传必须登录（防止匿名灌内容到磁盘），GET 不挂 guard：保存到角色后任意人
// 都要能在角色卡里看到这张图，再过一层 token 鉴权就读不动了。
@Controller('wiki/avatars')
export class WikiAvatarController {
  constructor(private readonly avatars: WikiAvatarService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: WIKI_AVATAR_UPLOAD_LIMIT_BYTES },
    }),
  )
  async uploadAvatar(
    @UploadedFile() file: UploadedWikiAvatarFile | undefined,
  ) {
    if (!file) {
      throw new AppError('WIKI_AVATAR_FILE_REQUIRED', {
        legacyMessage: '请先选择一张头像图片。',
      });
    }
    return this.avatars.saveUploadedAvatar(file);
  }

  @Get(':fileName')
  getAvatar(@Param('fileName') fileName: string, @Res() res: Response) {
    return res.sendFile(this.avatars.resolveReadablePath(fileName));
  }
}
