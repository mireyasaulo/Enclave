import { Global, Module } from '@nestjs/common';
import { CloudSubscriptionClient } from './cloud-subscription.client';
import { SubscriptionService } from './subscription.service';

@Global()
@Module({
  providers: [SubscriptionService, CloudSubscriptionClient],
  exports: [SubscriptionService, CloudSubscriptionClient],
})
export class SubscriptionModule {}
