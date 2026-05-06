import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import type { AuthenticatedUser } from '../../auth/jwt-auth.guard';
import { WikiFieldProtectionEntity } from '../entities/wiki-field-protection.entity';
import { rankOf } from '../guards/wiki-role.guard';
import { WIKI_FIELD_PROTECTION_SEEDS } from '../seed/field-protections.seed';

export type FieldPolicyMap = Map<string, string>; // fieldPath -> minRole

@Injectable()
export class WikiFieldProtectionService implements OnModuleInit {
  private readonly logger = new Logger(WikiFieldProtectionService.name);

  constructor(
    @InjectRepository(WikiFieldProtectionEntity)
    private readonly repo: Repository<WikiFieldProtectionEntity>,
  ) {}

  async onModuleInit(): Promise<void> {
    for (const seed of WIKI_FIELD_PROTECTION_SEEDS) {
      const existing = await this.repo.findOne({
        where: {
          characterId: seed.characterId!,
          fieldPath: seed.fieldPath!,
        },
      });
      if (!existing) {
        await this.repo.save(this.repo.create(seed));
      }
    }
  }

  async list(): Promise<WikiFieldProtectionEntity[]> {
    return this.repo.find({ order: { createdAt: 'ASC' } });
  }

  async listForCharacter(
    characterId: string,
  ): Promise<WikiFieldProtectionEntity[]> {
    return this.repo.find({
      where: { characterId: In([characterId, '*']) },
      order: { createdAt: 'ASC' },
    });
  }

  async getEffectivePolicy(characterId: string): Promise<FieldPolicyMap> {
    const rows = await this.listForCharacter(characterId);
    const map: FieldPolicyMap = new Map();
    // Apply global '*' first, then character-specific to override.
    for (const row of rows) {
      if (row.characterId === '*') {
        map.set(row.fieldPath, row.minRoleToEdit);
      }
    }
    for (const row of rows) {
      if (row.characterId !== '*') {
        // character-specific takes precedence (last write wins, ordered by createdAt)
        map.set(row.fieldPath, row.minRoleToEdit);
      }
    }
    return map;
  }

  async assertCanEditPaths(
    user: AuthenticatedUser,
    characterId: string,
    changedPaths: string[],
  ): Promise<void> {
    if (changedPaths.length === 0) return;
    const policy = await this.getEffectivePolicy(characterId);
    if (policy.size === 0) return;
    const userRank = rankOf(user.role);
    for (const path of changedPaths) {
      const violated = matchProtectedPath(path, policy);
      if (!violated) continue;
      const minRank = rankOf(violated.minRole);
      if (userRank < minRank) {
        throw new ForbiddenException(
          `字段 ${violated.protectedPath} 受保护，至少需要 ${violated.minRole} 权限`,
        );
      }
    }
  }

  async create(
    input: Pick<
      WikiFieldProtectionEntity,
      'characterId' | 'fieldPath' | 'minRoleToEdit' | 'reason'
    > & { createdBy?: string | null },
  ): Promise<WikiFieldProtectionEntity> {
    return this.repo.save(this.repo.create(input));
  }

  async update(
    id: string,
    patch: Partial<WikiFieldProtectionEntity>,
  ): Promise<WikiFieldProtectionEntity> {
    await this.repo.update({ id }, patch);
    const next = await this.repo.findOne({ where: { id } });
    if (!next) throw new NotFoundException('字段保护策略不存在');
    return next;
  }

  async remove(id: string): Promise<void> {
    await this.repo.delete({ id });
  }
}

/**
 * 找出哪个保护路径应用于当前 changed path：
 *   - 完全相等
 *   - changed path 是被保护路径的子路径（即被保护路径是 prefix，且分隔点在边界）
 * 返回最严格匹配（minRank 最大）。
 */
function matchProtectedPath(
  changedPath: string,
  policy: FieldPolicyMap,
): { protectedPath: string; minRole: string } | null {
  let best: { protectedPath: string; minRole: string; rank: number } | null =
    null;
  for (const [protectedPath, minRole] of policy.entries()) {
    if (
      changedPath === protectedPath ||
      changedPath.startsWith(`${protectedPath}.`) ||
      protectedPath.startsWith(`${changedPath}.`)
    ) {
      const rank = rankOf(minRole);
      if (!best || rank > best.rank) {
        best = { protectedPath, minRole, rank };
      }
    }
  }
  return best ? { protectedPath: best.protectedPath, minRole: best.minRole } : null;
}
