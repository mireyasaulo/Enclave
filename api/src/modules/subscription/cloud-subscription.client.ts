import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  SubscriptionExpiredCopy,
  SubscriptionExpiredPlan,
} from './subscription-expired.exception';

export type CloudSubscriptionLookup = {
  status: 'active' | 'expired' | 'none';
  expiresAt: string | null;
  planCode: string | null;
  isTrial: boolean;
  hardBlockEnabled: boolean;
  copy: SubscriptionExpiredCopy;
  plans: SubscriptionExpiredPlan[];
};

@Injectable()
export class CloudSubscriptionClient {
  private readonly logger = new Logger(CloudSubscriptionClient.name);

  constructor(private readonly config: ConfigService) {}

  resolveOwnerPhone(): string | null {
    return this.config.get<string>('CLOUD_OWNER_PHONE')?.trim() || null;
  }

  resolveCloudApiBaseUrl(): string | null {
    return this.config.get<string>('CLOUD_API_BASE_URL')?.trim() || null;
  }

  resolveServiceToken(): string | null {
    return this.config.get<string>('CLOUD_SERVICE_TOKEN')?.trim() || null;
  }

  async lookup(phone: string): Promise<CloudSubscriptionLookup | null> {
    const baseUrl = this.resolveCloudApiBaseUrl();
    const token = this.resolveServiceToken();
    if (!baseUrl || !token) {
      return null;
    }
    try {
      const url = new URL('/cloud/internal/subscription/lookup', baseUrl).toString();
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Service-Token': token,
        },
        body: JSON.stringify({ phone }),
      });
      if (!res.ok) {
        this.logger.warn(
          `Cloud subscription lookup failed: status=${res.status} phone=${phone}`,
        );
        return null;
      }
      return (await res.json()) as CloudSubscriptionLookup;
    } catch (error) {
      this.logger.warn(
        `Cloud subscription lookup error: ${(error as Error).message}`,
      );
      return null;
    }
  }
}
