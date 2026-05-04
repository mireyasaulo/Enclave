import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity } from '../../auth/user.entity';
import type { AuthenticatedUser } from '../../auth/jwt-auth.guard';
import { UserWikiProfileEntity } from '../entities/user-wiki-profile.entity';
import { WikiProtectionService } from './wiki-protection.service';

const ROLES = ['newcomer', 'autoconfirmed', 'patroller', 'admin'] as const;
type WikiRole = (typeof ROLES)[number];

@Injectable()
export class WikiRoleService {
  private readonly logger = new Logger(WikiRoleService.name);

  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    @InjectRepository(UserWikiProfileEntity)
    private readonly profileRepo: Repository<UserWikiProfileEntity>,
    private readonly config: ConfigService,
    private readonly protection: WikiProtectionService,
  ) {}

  private daysThreshold(): number {
    return Number(this.config.get<string>('WIKI_AUTOCONFIRM_DAYS') ?? 4);
  }

  private editsThreshold(): number {
    return Number(this.config.get<string>('WIKI_AUTOCONFIRM_EDITS') ?? 10);
  }

  private revertRatioCeiling(): number {
    return Number(this.config.get<string>('WIKI_AUTOCONFIRM_MAX_REVERT_RATIO') ?? 0.2);
  }

  /** Returns true if the user was promoted. Safe to call after every edit submission. */
  async checkPromotion(userId: string): Promise<boolean> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user || user.role !== 'newcomer' || user.userType !== 'wiki_member') {
      return false;
    }
    const profile = await this.profileRepo.findOne({ where: { userId } });
    if (!profile) return false;
    const ageDays =
      (Date.now() - new Date(user.createdAt).getTime()) / 86_400_000;
    if (ageDays < this.daysThreshold()) return false;
    if (profile.approvedEditCount < this.editsThreshold()) return false;
    const ratio =
      profile.revertedCount / Math.max(profile.approvedEditCount, 1);
    if (ratio >= this.revertRatioCeiling()) return false;

    user.role = 'autoconfirmed';
    user.roleGrantedAt = new Date();
    user.roleGrantedBy = 'auto_promotion';
    await this.userRepo.save(user);
    profile.autoconfirmedAt = new Date();
    await this.profileRepo.save(profile);
    this.logger.log(
      `auto-promoted ${user.username} → autoconfirmed (edits=${profile.approvedEditCount}, reverts=${profile.revertedCount})`,
    );
    return true;
  }

  async setRole(
    targetUserId: string,
    actor: AuthenticatedUser,
    input: { role: WikiRole; reason?: string },
  ): Promise<UserEntity> {
    if (!ROLES.includes(input.role)) {
      throw new BadRequestException('role 必须是 newcomer / autoconfirmed / patroller / admin');
    }
    const user = await this.userRepo.findOne({ where: { id: targetUserId } });
    if (!user) throw new NotFoundException('用户不存在');
    if (user.userType !== 'wiki_member' && input.role !== 'admin') {
      throw new ForbiddenException('该用户非 wiki 成员，仅可保留为 admin 角色');
    }
    user.role = input.role;
    user.roleGrantedAt = new Date();
    user.roleGrantedBy = `admin:${actor.username}${
      input.reason ? `:${input.reason}` : ''
    }`;
    await this.userRepo.save(user);
    this.logger.log(
      `manual role change: ${user.username} → ${input.role} by ${actor.username}`,
    );
    return user;
  }

  async listUsers(): Promise<
    Array<{
      id: string;
      username: string;
      role: string;
      userType: string;
      createdAt: Date;
      roleGrantedAt?: Date | null;
      profile?: UserWikiProfileEntity | null;
    }>
  > {
    const users = await this.userRepo.find({
      order: { createdAt: 'DESC' },
    });
    const profiles = await this.profileRepo.find();
    const profileMap = new Map(profiles.map((p) => [p.userId, p]));
    return users.map((u) => ({
      id: u.id,
      username: u.username,
      role: u.role,
      userType: u.userType,
      createdAt: u.createdAt,
      roleGrantedAt: u.roleGrantedAt ?? null,
      profile: profileMap.get(u.id) ?? null,
    }));
  }

  /** Daily sweep: promote any newcomers that crossed the threshold and clean expired protections. */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async dailySweep(): Promise<void> {
    const newcomers = await this.userRepo.find({
      where: { role: 'newcomer', userType: 'wiki_member' },
    });
    let promoted = 0;
    for (const u of newcomers) {
      if (await this.checkPromotion(u.id)) promoted += 1;
    }
    const expiredProtections = await this.protection.sweepExpired();
    if (promoted || expiredProtections) {
      this.logger.log(
        `daily sweep: promoted=${promoted}, expired_protections=${expiredProtections}`,
      );
    }
  }
}
