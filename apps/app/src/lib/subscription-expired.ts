import type {
  ApiRequestError,
  ChatErrorPayload,
  SubscriptionExpiredErrorBody,
} from "@yinjie/contracts";
import { useSubscriptionExpiredDialogStore } from "../store/subscription-expired-dialog-store";

function normalizeSubscriptionExpiredMeta(
  meta: unknown,
): SubscriptionExpiredErrorBody["meta"] | null {
  if (!meta || typeof meta !== "object") {
    return null;
  }

  const parsedMeta = meta as SubscriptionExpiredErrorBody["meta"];
  return parsedMeta;
}

export function openSubscriptionExpiredDialog(input: {
  message: string;
  meta?: unknown;
}) {
  useSubscriptionExpiredDialogStore.getState().openDialog({
    message: input.message,
    meta: normalizeSubscriptionExpiredMeta(input.meta),
  });
}

export function handleApiSubscriptionExpiredError(error: ApiRequestError) {
  if (
    error.statusCode !== 402 ||
    (error.errorCode !== "SUBSCRIPTION_EXPIRED" &&
      error.code !== "SUBSCRIPTION_EXPIRED")
  ) {
    return;
  }

  openSubscriptionExpiredDialog({
    message: error.message,
    meta: error.meta,
  });
}

export function handleSocketSubscriptionExpiredError(
  payload: ChatErrorPayload,
) {
  if (payload.code !== "SUBSCRIPTION_EXPIRED") {
    return false;
  }

  openSubscriptionExpiredDialog({
    message: payload.message,
    meta: payload.meta,
  });
  return true;
}
