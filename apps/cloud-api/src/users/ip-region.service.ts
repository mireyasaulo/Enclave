// i18n-ignore-start: server-side log/admin payloads — not user-facing UI.
import { Injectable, Logger } from "@nestjs/common";

export interface IpRegionLookup {
  ip: string;
  countryCode: string | null;
  // country 字段维持 provider 原文（一般是英文，前端用 Intl.DisplayNames 本地化）。
  country: string | null;
  region: string | null;
  city: string | null;
  source: "ipwho.is" | "ipinfo.io" | "cache" | "unresolved";
}

interface CacheEntry {
  payload: Omit<IpRegionLookup, "source">;
  resolved: boolean;
  cachedAt: number;
}

// 解析成功的结果缓存 7 天；解析失败缓存 30 分钟避免被某个 dead provider 持续拖住。
const POSITIVE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const NEGATIVE_TTL_MS = 30 * 60 * 1000;
const FETCH_TIMEOUT_MS = 5000;

@Injectable()
export class IpRegionService {
  private readonly logger = new Logger(IpRegionService.name);
  private readonly cache = new Map<string, CacheEntry>();

  async resolve(rawIp: string): Promise<IpRegionLookup> {
    const ip = (rawIp ?? "").trim();
    if (!ip) {
      return this.unresolved(ip);
    }

    const cached = this.cache.get(ip);
    if (cached) {
      const ttl = cached.resolved ? POSITIVE_TTL_MS : NEGATIVE_TTL_MS;
      if (Date.now() - cached.cachedAt < ttl) {
        return { ...cached.payload, source: "cache" };
      }
    }

    // ipwho.is 国内访问偶发超时，挂掉就转 ipinfo.io。两个都是 Cloudflare 系，
    // 但服务器侧出口比浏览器走得稳很多，所以保持这个顺序。
    const providers = [
      () => this.fetchIpWhoIs(ip),
      () => this.fetchIpInfoIo(ip),
    ];

    for (const provider of providers) {
      try {
        const result = await provider();
        this.cache.set(ip, {
          payload: result,
          resolved: Boolean(result.countryCode || result.country),
          cachedAt: Date.now(),
        });
        return { ...result, source: result.source };
      } catch (error) {
        this.logger.warn(
          `IP region provider failed for ${ip}: ${(error as Error).message}`,
        );
      }
    }

    const fallback = this.unresolved(ip);
    this.cache.set(ip, {
      payload: { ...fallback },
      resolved: false,
      cachedAt: Date.now(),
    });
    return fallback;
  }

  private unresolved(ip: string): IpRegionLookup {
    return {
      ip,
      countryCode: null,
      country: null,
      region: null,
      city: null,
      source: "unresolved",
    };
  }

  private async fetchIpWhoIs(ip: string): Promise<IpRegionLookup> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const response = await fetch(
        `https://ipwho.is/${encodeURIComponent(ip)}`,
        { signal: controller.signal },
      );
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = (await response.json()) as {
        success?: boolean;
        message?: string;
        country?: string;
        country_code?: string;
        region?: string;
        city?: string;
      };
      if (data.success === false) {
        throw new Error(data.message ?? "lookup failed");
      }
      return {
        ip,
        countryCode: data.country_code ?? null,
        country: data.country ?? null,
        region: data.region ?? null,
        city: data.city ?? null,
        source: "ipwho.is",
      };
    } finally {
      clearTimeout(timer);
    }
  }

  private async fetchIpInfoIo(ip: string): Promise<IpRegionLookup> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const response = await fetch(
        `https://ipinfo.io/${encodeURIComponent(ip)}/json`,
        { signal: controller.signal },
      );
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = (await response.json()) as {
        country?: string;
        region?: string;
        city?: string;
      };
      // ipinfo.io 只回 country 两位 code；country full name 留给前端用 Intl 本地化。
      return {
        ip,
        countryCode: data.country ?? null,
        country: null,
        region: data.region ?? null,
        city: data.city ?? null,
        source: "ipinfo.io",
      };
    } finally {
      clearTimeout(timer);
    }
  }
}
// i18n-ignore-end
