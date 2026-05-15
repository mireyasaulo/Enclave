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
import { PrivateCharacterRateLimitGuard } from '../../characters/guards/private-character-rate-limit.guard';
import {
  WIKI_AVATAR_UPLOAD_LIMIT_BYTES,
  WikiAvatarService,
  type UploadedWikiAvatarFile,
} from '../services/wiki-avatar.service';

// 头像上传必须登录（防止匿名灌内容到磁盘），GET 不挂 guard：保存到角色后任意人
// 都要能在角色卡里看到这张图，再过一层 token 鉴权就读不动了。
//
// 用 PrivateCharacterRateLimitGuard（60/h/user，与私有角色 CRUD 共桶）挡脚本
// 滥用——一次正常创建角色顶多上传 3-5 次 + 1-2 次 save，离上限差得远；恶意
// 脚本最多 60 * 4MB = 240MB/h，磁盘可控。
@Controller('wiki/avatars')
export class WikiAvatarController {
  constructor(private readonly avatars: WikiAvatarService) {}

  @Post()
  @UseGuards(JwtAuthGuard, PrivateCharacterRateLimitGuard)
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
    // sendFile 内部用 send-stream，会按自己 options 覆写 Cache-Control，所以
    // 长缓存必须通过 maxAge / immutable 传进去，不能 setHeader 后再 sendFile。
    // 文件名带 ts + 8 位 uuid，整张图永远不会被覆盖 → 一年 immutable，省掉
    // 每次重新渲染列表都过一道 304 revalidate。
    //
    // nosniff（through `headers` option）：挡 MIME 嗅探。即便我们已经按
    // mimetype 推 .ext，多一层兜底防止老浏览器把 polyglot 文件按 HTML 执行。
    return res.sendFile(this.avatars.resolveReadablePath(fileName), {
      maxAge: 365 * 24 * 60 * 60 * 1000,
      immutable: true,
      headers: {
        'X-Content-Type-Options': 'nosniff',
      },
    });
  }
}
