const FEED_PUBLISH_FLASH_KEY = "yinjie:feed-publish-flash";

export function storeFeedPublishFlash(message: string) {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(FEED_PUBLISH_FLASH_KEY, message);
}

export function consumeFeedPublishFlash() {
  if (typeof window === "undefined") {
    return null;
  }

  const value = window.sessionStorage.getItem(FEED_PUBLISH_FLASH_KEY);
  if (!value) {
    return null;
  }

  window.sessionStorage.removeItem(FEED_PUBLISH_FLASH_KEY);
  return value;
}
