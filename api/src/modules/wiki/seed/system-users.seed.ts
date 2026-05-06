import type { DeepPartial } from 'typeorm';
import { UserEntity } from '../../auth/user.entity';

export const SYSTEM_BOT_ID = 'user_wiki_antivandal_bot';

/**
 * Wiki 系统用户（反破坏 bot 与自动锁的 actor）。
 * Role=admin 是为了能调用 setProtection / decide / revert 全套权限路径。
 * 密码字段填占位 hash，不可登录（前端登录不会接受这个 username）。
 */
export const WIKI_SYSTEM_USERS: Array<DeepPartial<UserEntity>> = [
  {
    id: SYSTEM_BOT_ID,
    username: '__system_wiki_antivandal_bot__',
    passwordHash: '!disabled-system-account',
    userType: 'system',
    role: 'admin',
    onboardingCompleted: true,
    roleGrantedBy: 'system_seed',
    roleGrantedAt: new Date(),
  },
];
