import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserPrivateCharacterEntity } from '../entities/user-private-character.entity';
import type { CharacterBlueprintRecipeValue } from '../../characters/character-blueprint.types';
import { assertPrivateCharacterFieldLimits } from '../../characters/characters.service';
import type { PersonalityProfile } from '../../ai/ai.types';

export const PRIVATE_CHARACTER_EXPORT_SCHEMA =
  'yinjie-private-character/v1' as const;

export type PrivateCharacterDto = {
  name: string;
  avatar?: string;
  bio?: string;
  personality?: string | null;
  relationship?: string;
  relationshipType?: string;
  expertDomains?: string[];
  triggerScenes?: string[] | null;
  recipe?: CharacterBlueprintRecipeValue | null;
  profile?: PersonalityProfile | null;
};

export type PrivateCharacterExportBundle = {
  $schema: typeof PRIVATE_CHARACTER_EXPORT_SCHEMA;
  name: string;
  avatar: string;
  bio: string;
  personality?: string | null;
  relationship: string;
  relationshipType: string;
  expertDomains: string[];
  triggerScenes?: string[] | null;
  recipe?: CharacterBlueprintRecipeValue | null;
  profile?: PersonalityProfile | null;
  meta: {
    exportedAt: string;
    exportedBy: string;
    version: 1;
  };
};

@Injectable()
export class WikiPrivateCharacterService {
  constructor(
    @InjectRepository(UserPrivateCharacterEntity)
    private readonly repo: Repository<UserPrivateCharacterEntity>,
  ) {}

  listForOwner(ownerUserId: string): Promise<UserPrivateCharacterEntity[]> {
    return this.repo.find({
      where: { ownerUserId },
      order: { updatedAt: 'DESC' },
    });
  }

  async getById(
    ownerUserId: string,
    id: string,
  ): Promise<UserPrivateCharacterEntity> {
    const row = await this.repo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('私有角色不存在');
    if (row.ownerUserId !== ownerUserId) {
      throw new ForbiddenException('无权访问该私有角色');
    }
    return row;
  }

  /**
   * @deprecated 历史 API：等同 `upsertByName`，会无声覆盖同名旧记录。
   * 新代码请用 `createStrict`（重名抛 Conflict）或显式 `upsertByName`。
   * 暂保留是为不破坏其它内部调用方；外部 controller 已经迁移到 createStrict。
   */
  async create(
    ownerUserId: string,
    dto: PrivateCharacterDto,
  ): Promise<UserPrivateCharacterEntity> {
    const { record } = await this.upsertByName(ownerUserId, dto);
    return record;
  }

  /**
   * 严格新建：同名直接抛 Conflict。
   * `POST /wiki/my-characters` 入口走这里 —— 用户的"创建"语义就是新建一条，
   * 不要默默覆盖。覆盖语义留给 import 路径（用户上传文件意图明确）。
   */
  async createStrict(
    ownerUserId: string,
    dto: PrivateCharacterDto,
  ): Promise<UserPrivateCharacterEntity> {
    if (!dto || typeof dto !== 'object') {
      throw new BadRequestException('请求体格式不正确');
    }
    const trimmedName = (dto.name ?? '').trim();
    if (!trimmedName) {
      throw new BadRequestException('角色名不能为空');
    }
    assertPrivateCharacterFieldLimits({ ...dto, name: trimmedName });
    const clash = await this.repo.findOne({
      where: { ownerUserId, name: trimmedName },
    });
    if (clash) {
      throw new ConflictException(
        `已存在同名私有角色 "${trimmedName}"。如需覆盖，请先删除旧角色或改用导入功能。`,
      );
    }
    const created = this.repo.create({ ownerUserId, name: trimmedName });
    this.applyDto(created, { ...dto, name: trimmedName });
    return this.repo.save(created);
  }

  async update(
    ownerUserId: string,
    id: string,
    dto: PrivateCharacterDto,
  ): Promise<UserPrivateCharacterEntity> {
    if (!dto || typeof dto !== 'object') {
      throw new BadRequestException('请求体格式不正确');
    }
    const existing = await this.getById(ownerUserId, id);
    const trimmedName = (dto.name ?? existing.name).trim();
    if (!trimmedName) {
      throw new BadRequestException('角色名不能为空');
    }
    assertPrivateCharacterFieldLimits({ ...dto, name: trimmedName });
    // 改名时若与另一行同名 → 拒绝（避免无声丢数据）
    if (trimmedName !== existing.name) {
      const clash = await this.repo.findOne({
        where: { ownerUserId, name: trimmedName },
      });
      if (clash && clash.id !== id) {
        throw new ConflictException(
          `已存在同名私有角色 "${trimmedName}"，请改名后再保存`,
        );
      }
    }
    this.applyDto(existing, { ...dto, name: trimmedName });
    return this.repo.save(existing);
  }

  async delete(ownerUserId: string, id: string): Promise<void> {
    const existing = await this.getById(ownerUserId, id);
    await this.repo.delete({ id: existing.id });
  }

  /**
   * 同名（trim 后大小写敏感）→ 覆盖；无则新建。
   * 返回 { record, overwrote }，方便调用方区分两种结果。
   */
  async upsertByName(
    ownerUserId: string,
    dto: PrivateCharacterDto,
  ): Promise<{ record: UserPrivateCharacterEntity; overwrote: boolean }> {
    if (!dto || typeof dto !== 'object') {
      throw new BadRequestException('请求体格式不正确');
    }
    const trimmedName = (dto.name ?? '').trim();
    if (!trimmedName) {
      throw new BadRequestException('角色名不能为空');
    }
    assertPrivateCharacterFieldLimits({ ...dto, name: trimmedName });
    const existing = await this.repo.findOne({
      where: { ownerUserId, name: trimmedName },
    });
    if (existing) {
      this.applyDto(existing, { ...dto, name: trimmedName });
      const record = await this.repo.save(existing);
      return { record, overwrote: true };
    }
    const created = this.repo.create({ ownerUserId, name: trimmedName });
    this.applyDto(created, { ...dto, name: trimmedName });
    const record = await this.repo.save(created);
    return { record, overwrote: false };
  }

  toExportBundle(
    record: UserPrivateCharacterEntity,
    exportedBy: string,
  ): PrivateCharacterExportBundle {
    return {
      $schema: PRIVATE_CHARACTER_EXPORT_SCHEMA,
      name: record.name,
      avatar: record.avatar,
      bio: record.bio,
      personality: record.personality ?? null,
      relationship: record.relationship,
      relationshipType: record.relationshipType,
      expertDomains: record.expertDomains ?? [],
      triggerScenes: record.triggerScenes ?? null,
      recipe: record.recipe ?? null,
      profile: record.profile ?? null,
      meta: {
        exportedAt: new Date().toISOString(),
        exportedBy,
        version: 1,
      },
    };
  }

  /**
   * 解析上传的 JSON：兼容裸 DTO（无 $schema）与 v1 bundle。
   * 缺失字段一律返回 undefined（不返回 null/空），由 applyDto 决定是否跳过。
   * 这样 round-trip 后 bundle 里没写的字段不会把已存在私有角色的字段清空。
   */
  parseImportBundle(payload: unknown): PrivateCharacterDto {
    if (!payload || typeof payload !== 'object') {
      throw new BadRequestException('文件内容不是合法的角色 JSON');
    }
    const p = payload as Record<string, unknown>;
    const schema = typeof p.$schema === 'string' ? p.$schema : null;
    if (schema && schema !== PRIVATE_CHARACTER_EXPORT_SCHEMA) {
      throw new BadRequestException(`不支持的 schema：${schema}`);
    }
    const name = typeof p.name === 'string' ? p.name.trim() : '';
    if (!name) {
      throw new BadRequestException('文件里没有有效的 name 字段');
    }
    return {
      name,
      avatar: typeof p.avatar === 'string' ? p.avatar : undefined,
      bio: typeof p.bio === 'string' ? p.bio : undefined,
      personality:
        typeof p.personality === 'string' ? p.personality : undefined,
      relationship:
        typeof p.relationship === 'string' ? p.relationship : undefined,
      relationshipType:
        typeof p.relationshipType === 'string'
          ? p.relationshipType
          : undefined,
      expertDomains: Array.isArray(p.expertDomains)
        ? p.expertDomains.filter((x): x is string => typeof x === 'string')
        : undefined,
      triggerScenes: Array.isArray(p.triggerScenes)
        ? p.triggerScenes.filter((x): x is string => typeof x === 'string')
        : undefined,
      // typeof null/array 都是 'object'，要再排掉 Array — 否则
      // {"recipe":[1,2,3]} 会被误当成合法 recipe 存进去，下游读
      // recipe.identity 会炸。
      recipe:
        p.recipe &&
        typeof p.recipe === 'object' &&
        !Array.isArray(p.recipe)
          ? (p.recipe as CharacterBlueprintRecipeValue)
          : undefined,
      profile:
        p.profile &&
        typeof p.profile === 'object' &&
        !Array.isArray(p.profile)
          ? (p.profile as PersonalityProfile)
          : undefined,
    };
  }

  private applyDto(
    target: UserPrivateCharacterEntity,
    dto: PrivateCharacterDto,
  ): void {
    if (!dto || typeof dto !== 'object') return;
    if (typeof dto.name === 'string') target.name = dto.name.trim();
    if (typeof dto.avatar === 'string') target.avatar = dto.avatar;
    if (typeof dto.bio === 'string') target.bio = dto.bio;
    if (dto.personality !== undefined) {
      target.personality = dto.personality ?? null;
    }
    if (typeof dto.relationship === 'string') {
      target.relationship = dto.relationship;
    }
    if (typeof dto.relationshipType === 'string') {
      target.relationshipType = dto.relationshipType;
    }
    if (Array.isArray(dto.expertDomains)) {
      target.expertDomains = dto.expertDomains;
    }
    if (dto.triggerScenes !== undefined) {
      target.triggerScenes = dto.triggerScenes ?? null;
    }
    // 同样防 PUT body 把 recipe/profile 传成 array 或非 object：
    if (dto.recipe !== undefined) {
      const r = dto.recipe;
      target.recipe =
        r && typeof r === 'object' && !Array.isArray(r) ? r : null;
    }
    if (dto.profile !== undefined) {
      const pf = dto.profile;
      target.profile =
        pf && typeof pf === 'object' && !Array.isArray(pf) ? pf : null;
    }
  }
}
