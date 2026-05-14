import {
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AppError } from '../../common/app-error.exception';
import { CharactersService } from './characters.service';
import { CharacterEntity } from './character.entity';
import { AdminGuard } from '../admin/admin.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PrivateCharacterRateLimitGuard } from './guards/private-character-rate-limit.guard';

@Controller('characters')
export class CharactersController {
  constructor(private readonly charactersService: CharactersService) {}

  @Get()
  findAll() {
    return this.charactersService.findAllVisibleToOwner();
  }

  @Get('preset-catalog')
  listPresetCatalog() {
    return this.charactersService.listPresetCatalog();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const char =
      (await this.charactersService.findById(id)) ??
      (await this.charactersService.ensurePresetCharacterInstalled(id));
    if (!char)
      throw new AppError('CHARACTER_NOT_FOUND', {
        status: HttpStatus.NOT_FOUND,
        params: { id },
        legacyMessage: `Character ${id} not found`,
      });
    return char;
  }

  @Post()
  @UseGuards(AdminGuard)
  async create(@Body() body: Partial<CharacterEntity>) {
    const char = {
      ...body,
      id: body.id ?? `char_${Date.now()}`,
    } as CharacterEntity;
    await this.charactersService.upsert(char);
    return char;
  }

  @Patch(':id')
  @UseGuards(AdminGuard)
  async update(@Param('id') id: string, @Body() body: Partial<CharacterEntity>) {
    const existing = await this.charactersService.findById(id);
    if (!existing)
      throw new AppError('CHARACTER_NOT_FOUND', {
        status: HttpStatus.NOT_FOUND,
        params: { id },
        legacyMessage: `Character ${id} not found`,
      });
    const updated = { ...existing, ...body, id } as CharacterEntity;
    await this.charactersService.upsert(updated);
    return updated;
  }

  @Delete(':id')
  @UseGuards(AdminGuard)
  async remove(@Param('id') id: string) {
    await this.charactersService.delete(id);
    return { success: true };
  }

  // 用户可切换某角色的"默认用语音回复"开关。
  // 开启后所有 assistant 回复都自动转 TTS（受 speech-02-hd token plan 配额节流）。
  // 不挂 guard：跟 social.controller 的 setFriendStarred/updateFriendProfile
  // 等用户级 toggle 保持一致；多租户隔离由 nginx + 端口分配那一层负责，
  // 本地单机模式下根本不发 Authorization Bearer，挂 JwtAuthGuard 会 401。
  @Patch(':id/default-voice-reply')
  async setDefaultVoiceReply(
    @Param('id') id: string,
    @Body() body: { enabled: boolean },
  ) {
    const existing = await this.charactersService.findById(id);
    if (!existing) {
      throw new AppError('CHARACTER_NOT_FOUND', {
        status: HttpStatus.NOT_FOUND,
        params: { id },
        legacyMessage: `Character ${id} not found`,
      });
    }
    existing.defaultVoiceReply = Boolean(body?.enabled);
    await this.charactersService.upsert(existing);
    return { id, defaultVoiceReply: existing.defaultVoiceReply };
  }

  /**
   * Tenant-facing 导入端点：接收 wiki "我的私有角色" 导出 JSON，按 name upsert
   * 到 characters 表，并自动为 world-owner 建 friendship。
   * 同名→覆盖（仅限 sourceType='private_import' 的旧记录）；不存在→新建。
   */
  @Post('import-personal')
  @UseGuards(JwtAuthGuard, PrivateCharacterRateLimitGuard)
  async importPersonal(@Body() body: unknown) {
    const parsed = parsePrivateCharacterImportBody(body);
    type ServiceInput = Parameters<
      CharactersService['importPersonalCharacter']
    >[0];
    return this.charactersService.importPersonalCharacter({
      ...parsed,
      recipe: parsed.recipe as ServiceInput['recipe'],
      profile: parsed.profile as ServiceInput['profile'],
    });
  }
}

const PRIVATE_CHARACTER_EXPORT_SCHEMA = 'yinjie-private-character/v1' as const;

function parsePrivateCharacterImportBody(payload: unknown): {
  name: string;
  avatar?: string;
  bio?: string;
  personality?: string | null;
  relationship?: string;
  relationshipType?: string;
  expertDomains?: string[];
  triggerScenes?: string[] | null;
  recipe?: unknown;
  profile?: unknown;
} {
  if (!payload || typeof payload !== 'object') {
    throw new AppError('PRIVATE_IMPORT_INVALID', {
      status: HttpStatus.BAD_REQUEST,
      legacyMessage: '导入内容不是合法 JSON。',
    });
  }
  const p = payload as Record<string, unknown>;
  const schema = typeof p.$schema === 'string' ? p.$schema : null;
  if (schema && schema !== PRIVATE_CHARACTER_EXPORT_SCHEMA) {
    throw new AppError('PRIVATE_IMPORT_INVALID', {
      status: HttpStatus.BAD_REQUEST,
      legacyMessage: `不支持的 schema：${schema}`,
    });
  }
  const name = typeof p.name === 'string' ? p.name.trim() : '';
  if (!name) {
    throw new AppError('PRIVATE_IMPORT_INVALID', {
      status: HttpStatus.BAD_REQUEST,
      legacyMessage: '导入文件缺少 name 字段。',
    });
  }
  // 缺失字段一律返回 undefined（不返回 null/空），由 service 决定是否跳过。
  // 这样 round-trip 后 bundle 里没写的字段不会把已存在角色的字段清空。
  return {
    name,
    avatar: typeof p.avatar === 'string' ? p.avatar : undefined,
    bio: typeof p.bio === 'string' ? p.bio : undefined,
    personality: typeof p.personality === 'string' ? p.personality : undefined,
    relationship:
      typeof p.relationship === 'string' ? p.relationship : undefined,
    relationshipType:
      typeof p.relationshipType === 'string' ? p.relationshipType : undefined,
    expertDomains: Array.isArray(p.expertDomains)
      ? (p.expertDomains as unknown[]).filter(
          (x): x is string => typeof x === 'string',
        )
      : undefined,
    triggerScenes: Array.isArray(p.triggerScenes)
      ? (p.triggerScenes as unknown[]).filter(
          (x): x is string => typeof x === 'string',
        )
      : undefined,
    // typeof [] === 'object'，要再排掉 Array；否则 {"recipe":[1,2,3]} /
    // {"profile":[1,2,3]} 会被当成合法 object 存进去，下游读 .xxx 会炸。
    recipe:
      p.recipe && typeof p.recipe === 'object' && !Array.isArray(p.recipe)
        ? p.recipe
        : undefined,
    profile:
      p.profile && typeof p.profile === 'object' && !Array.isArray(p.profile)
        ? p.profile
        : undefined,
  };
}
