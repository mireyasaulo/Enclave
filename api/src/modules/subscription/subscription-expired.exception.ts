import { HttpException, HttpStatus } from '@nestjs/common';

export type SubscriptionExpiredCopy = {
  expiredTitle: string;
  expiredMessage: string;
  expiredCta: string;
  expiredHint: string;
  checkoutManualHint: string;
  checkoutContactInfo: string;
  inviteShareTitle: string;
  inviteShareBody: string;
  welcomePromoBanner: string | null;
};

export type SubscriptionExpiredPlan = {
  id: string;
  code: string;
  name: string;
  durationDays: number;
  priceCents: number;
  currency: string;
  isActive: boolean;
  isTrial: boolean;
  isPubliclyPurchasable: boolean;
  sortOrder: number;
  description: string | null;
};

export type SubscriptionExpiredMeta = {
  expiredAt: string | null;
  plans: SubscriptionExpiredPlan[];
  copy: SubscriptionExpiredCopy;
  ctaUrl: string;
};

export class SubscriptionExpiredException extends HttpException {
  static readonly CODE = 'SUBSCRIPTION_EXPIRED' as const;

  constructor(message: string, public readonly meta: SubscriptionExpiredMeta) {
    super(
      {
        code: SubscriptionExpiredException.CODE,
        message,
        meta,
      },
      HttpStatus.PAYMENT_REQUIRED,
    );
  }
}
