// i18n-ignore-start: provider adapter — internal interface only.
import type { MinimaxJobEntity } from './minimax-job.entity';
import type { MinimaxJobTargetType } from './minimax-job.types';

export interface MinimaxJobCallback {
  onCompleted(job: MinimaxJobEntity): Promise<void>;
  onFailed(job: MinimaxJobEntity): Promise<void>;
}

export type MinimaxCallbackTargetType = MinimaxJobTargetType;

// i18n-ignore-end
