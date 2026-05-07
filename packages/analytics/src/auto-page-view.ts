import { isInitialized, trackPageView } from "./index";

let attached = false;

export function attachAutoPageView(): void {
  if (attached || typeof window === "undefined" || !isInitialized()) return;
  attached = true;

  const originalPush = history.pushState;
  const originalReplace = history.replaceState;

  history.pushState = function patchedPush(...args) {
    const ret = originalPush.apply(this, args as Parameters<typeof originalPush>);
    queueMicrotask(() => trackPageView());
    return ret;
  };
  history.replaceState = function patchedReplace(...args) {
    const ret = originalReplace.apply(this, args as Parameters<typeof originalReplace>);
    queueMicrotask(() => trackPageView());
    return ret;
  };
  window.addEventListener("popstate", () => {
    queueMicrotask(() => trackPageView());
  });
}
