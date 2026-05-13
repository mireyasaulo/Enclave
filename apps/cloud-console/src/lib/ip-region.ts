import { useQuery } from "@tanstack/react-query";

export interface IpRegionInfo {
  // 用于直接渲染的人类可读地区文案（已尽量本地化为中文国家名 + 英文省市）
  display: string;
  countryCode: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
}

interface IpWhoIsResponse {
  success?: boolean;
  ip?: string;
  country?: string;
  country_code?: string;
  region?: string;
  city?: string;
  message?: string;
}

// 私网/保留段：直接本地判断，省一次外部调用
function classifyLocalIp(ip: string): IpRegionInfo | null {
  const trimmed = ip.trim();
  if (!trimmed) return null;
  if (trimmed === "::1" || trimmed.startsWith("127.")) return makeLocal("本机");
  if (trimmed.startsWith("10.")) return makeLocal("内网 (10/8)");
  if (trimmed.startsWith("192.168.")) return makeLocal("内网 (192.168/16)");
  if (trimmed.startsWith("169.254.")) return makeLocal("链路本地 (169.254/16)");
  const m172 = trimmed.match(/^172\.(\d{1,3})\./);
  if (m172) {
    const second = Number(m172[1]);
    if (second >= 16 && second <= 31) return makeLocal("内网 (172.16/12)");
  }
  // CGNAT 100.64.0.0/10：中国移动/联通 4G/5G 客户端常见
  const m100 = trimmed.match(/^100\.(\d{1,3})\./);
  if (m100) {
    const second = Number(m100[1]);
    if (second >= 64 && second <= 127) return makeLocal("CGNAT (100.64/10)");
  }
  // IPv6 link-local fe80::/10, unique-local fc00::/7
  if (/^fe[89ab][0-9a-f]?:/i.test(trimmed)) return makeLocal("IPv6 链路本地");
  if (/^f[cd][0-9a-f]{2}:/i.test(trimmed)) return makeLocal("IPv6 ULA");
  if (/^(::ffff:)?(0\.|255\.)/.test(trimmed)) return makeLocal("保留段");
  return null;
}

function makeLocal(label: string): IpRegionInfo {
  return {
    display: label,
    countryCode: null,
    country: null,
    region: null,
    city: null,
  };
}

let regionDisplayNames: Intl.DisplayNames | null | undefined;
function getRegionDisplayNames(): Intl.DisplayNames | null {
  if (regionDisplayNames !== undefined) return regionDisplayNames;
  try {
    regionDisplayNames = new Intl.DisplayNames(["zh-CN"], { type: "region" });
  } catch {
    regionDisplayNames = null;
  }
  return regionDisplayNames;
}

function localizeCountry(
  countryCode: string | undefined | null,
  fallback: string | undefined | null,
): string | null {
  if (countryCode) {
    const names = getRegionDisplayNames();
    if (names) {
      try {
        const localized = names.of(countryCode.toUpperCase());
        if (localized && localized !== countryCode) return localized;
      } catch {
        // ignore
      }
    }
  }
  return fallback?.trim() || null;
}

function composeDisplay(
  info: Omit<IpRegionInfo, "display">,
  ipFallback: string,
): string {
  const parts: string[] = [];
  if (info.country) parts.push(info.country);
  if (info.region && info.region !== info.country) parts.push(info.region);
  if (info.city && info.city !== info.region) parts.push(info.city);
  // API 命中但所有字段都空（bogon / 内网穿透 IP 等），退回展示原始 IP
  return parts.length ? parts.join(" · ") : ipFallback;
}

async function fetchIpRegion(
  ip: string,
  signal?: AbortSignal,
): Promise<IpRegionInfo> {
  const local = classifyLocalIp(ip);
  if (local) return local;

  // ipwho.is 免费无 key，支持 HTTPS + CORS，命中失败也返回 200，依赖 success 字段
  const response = await fetch(`https://ipwho.is/${encodeURIComponent(ip)}`, {
    signal,
  });
  if (!response.ok) {
    throw new Error(`ipwho.is HTTP ${response.status}`);
  }
  const data = (await response.json()) as IpWhoIsResponse;
  if (data.success === false) {
    throw new Error(data.message ?? "ipwho.is lookup failed");
  }

  const country = localizeCountry(data.country_code, data.country);
  const info = {
    countryCode: data.country_code ?? null,
    country,
    region: data.region ?? null,
    city: data.city ?? null,
  };
  return { ...info, display: composeDisplay(info, ip) };
}

export function useIpRegion(ip: string | null | undefined) {
  const trimmed = typeof ip === "string" ? ip.trim() : "";
  return useQuery({
    queryKey: ["ip-region", trimmed],
    queryFn: ({ signal }) => fetchIpRegion(trimmed, signal),
    enabled: Boolean(trimmed),
    // 同一 IP 解析结果几乎不变，长期复用；失败不要狂重试拖慢列表
    staleTime: Infinity,
    gcTime: Infinity,
    retry: 1,
  });
}
