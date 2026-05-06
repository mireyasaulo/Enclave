import { Injectable, Logger } from '@nestjs/common';
import {
  CloudSubscriptionClient,
  type CloudSubscriptionLookup,
} from './cloud-subscription.client';
import {
  SubscriptionExpiredException,
  type SubscriptionExpiredMeta,
} from './subscription-expired.exception';

const CACHE_TTL_MS = 60 * 1000;

const FALLBACK_COPY: SubscriptionExpiredMeta['copy'] = {
  expiredTitle: '会员已到期',
  expiredMessage: '你的隐界会员已到期，AI 能力暂时无法使用。',
  expiredCta: '立即续费',
  expiredHint: '你仍可查看历史记录，AI 功能恢复需要会员',
  checkoutManualHint: '请联系运营开通会员，开通后将自动到账',
  checkoutContactInfo: '',
  inviteShareTitle: '快来加入隐界，免费体验 AI 社交世界',
  inviteShareBody: '使用我的邀请码注册，我们都能获得 30 天会员奖励。',
  welcomePromoBanner: null,
};

const FALLBACK_LOOKUP: CloudSubscriptionLookup = {
  status: 'active',
  expiresAt: null,
  planCode: null,
  isTrial: false,
  hardBlockEnabled: false,
  copy: FALLBACK_COPY,
  plans: [],
};

@Injectable()
export class SubscriptionService {
  private readonly logger = new Logger(SubscriptionService.name);
  private cached: { value: CloudSubscriptionLookup; expiresAt: number } | null = null;

  constructor(private readonly cloudClient: CloudSubscriptionClient) {}

  async getStatus(): Promise<CloudSubscriptionLookup> {
    const phone = this.cloudClient.resolveOwnerPhone();
    if (!phone) {
      // 本地直连或未托管模式：放行
      return FALLBACK_LOOKUP;
    }
    const now = Date.now();
    if (this.cached && this.cached.expiresAt > now) {
      return this.cached.value;
    }
    const fresh = await this.cloudClient.lookup(phone);
    if (!fresh) {
      // 拉取失败：30 秒短缓存，避免放行带来的滥用，但允许后续重试
      const fallback: CloudSubscriptionLookup = {
        ...FALLBACK_LOOKUP,
        status: this.cached?.value.status ?? 'active',
        hardBlockEnabled: false,
      };
      this.cached = { value: fallback, expiresAt: now + 30 * 1000 };
      return fallback;
    }
    this.cached = { value: fresh, expiresAt: now + CACHE_TTL_MS };
    return fresh;
  }

  async assertCanUseAi(_feature: 'text' | 'image' | 'audio'): Promise<void> {
    const status = await this.getStatus();
    if (!status.hardBlockEnabled) {
      return;
    }
    if (status.status === 'active') {
      return;
    }
    const meta: SubscriptionExpiredMeta = {
      expiredAt: status.expiresAt,
      plans: status.plans,
      copy: status.copy,
      ctaUrl: '/profile/subscription',
    };
    throw new SubscriptionExpiredException(status.copy.expiredMessage, meta);
  }

  invalidateCache() {
    this.cached = null;
  }
}
