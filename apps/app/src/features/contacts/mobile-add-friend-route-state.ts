import { isDesktopOnlyPath } from "../../lib/history-back";

export type MobileAddFriendRouteState = {
  returnPath?: string;
  returnHash?: string;
  keyword?: string;
};

function normalizeReturnPath(value?: string | null) {
  const nextValue = value?.trim();
  if (
    !nextValue ||
    !nextValue.startsWith("/") ||
    isDesktopOnlyPath(nextValue)
  ) {
    return undefined;
  }

  return nextValue;
}

function normalizeHash(value?: string | null) {
  const nextValue = value?.trim();
  if (!nextValue) {
    return undefined;
  }

  return nextValue.startsWith("#") ? nextValue.slice(1) : nextValue;
}

export function parseMobileAddFriendRouteState(
  hash: string,
): MobileAddFriendRouteState {
  const normalizedHash = normalizeHash(hash);
  if (!normalizedHash) {
    return {};
  }

  const params = new URLSearchParams(normalizedHash);
  const returnPath = normalizeReturnPath(params.get("returnPath"));
  const keyword = params.get("q")?.trim() || undefined;

  return {
    returnPath,
    returnHash: returnPath
      ? normalizeHash(params.get("returnHash"))
      : undefined,
    keyword,
  };
}

export function buildMobileAddFriendRouteHash(
  state: MobileAddFriendRouteState,
) {
  const params = new URLSearchParams();
  const returnPath = normalizeReturnPath(state.returnPath);

  if (returnPath) {
    params.set("returnPath", returnPath);
  }

  const returnHash = normalizeHash(state.returnHash);
  if (returnPath && returnHash) {
    params.set("returnHash", returnHash);
  }

  const keyword = state.keyword?.trim();
  if (keyword) {
    params.set("q", keyword);
  }

  return params.toString() || undefined;
}
