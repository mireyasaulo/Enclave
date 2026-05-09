import { resolveAppCoreApiBaseUrl } from "./runtime-config";

// 把 /api/... 这类相对路径补全成完整 URL；http(s):// / blob: / data: 原样返回。
// 用于 <audio>/<video>/<img> 等媒体元素 src — 这些元素按 document.origin 解析相对路径，
// 而我们的 origin 不一定代理 /api/*（HTTPS 公网 / 原生壳），所以必须 absolutize 到 API base。
export function resolveAppMediaUrl(
  maybeRelative: string | null | undefined,
): string {
  if (!maybeRelative) return "";
  const url = maybeRelative.trim();
  if (!url) return "";
  if (/^(?:https?:|blob:|data:)/i.test(url)) return url;
  if (!url.startsWith("/")) return url;
  try {
    const base = resolveAppCoreApiBaseUrl();
    return `${base.replace(/\/+$/, "")}${url}`;
  } catch {
    return url;
  }
}
