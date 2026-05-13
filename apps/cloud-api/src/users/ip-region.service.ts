// i18n-ignore-start: server-side log/admin payloads — not user-facing UI.
import { Injectable, Logger } from "@nestjs/common";
import {
  translateChineseCity,
  translateChineseRegion,
} from "./cn-region-i18n";

export interface IpRegionLookup {
  ip: string;
  countryCode: string | null;
  // country 字段维持 provider 原文（一般是英文，前端用 Intl.DisplayNames 本地化）。
  country: string | null;
  region: string | null;
  city: string | null;
  source: "ip-api.com" | "ipwho.is" | "cache" | "unresolved";
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

    // 首选 ip-api.com：lang=zh-CN 直接给中文国家/省/市，免去前端再做一遍翻译；
    // 但 free tier 是 HTTP only，服务器侧调没问题（浏览器走 HTTPS 会被 mixed-
    // content 拦）。挂掉再退到 ipwho.is（HTTPS，返回英文，前端 Intl 兜底）。
    const providers = [
      () => this.fetchIpApi(ip),
      () => this.fetchIpWhoIs(ip),
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

  private async fetchIpApi(ip: string): Promise<IpRegionLookup> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const response = await fetch(
        `http://ip-api.com/json/${encodeURIComponent(ip)}?lang=zh-CN&fields=status,message,country,countryCode,regionName,city`,
        { signal: controller.signal },
      );
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = (await response.json()) as {
        status?: string;
        message?: string;
        country?: string;
        countryCode?: string;
        // regionName 是省/州的完整名（lang=zh-CN 下是中文），不是 state code
        regionName?: string;
        city?: string;
      };
      if (data.status !== "success") {
        throw new Error(data.message ?? "ip-api lookup failed");
      }
      return {
        ip,
        countryCode: data.countryCode ?? null,
        country: data.country ?? null,
        region: data.regionName ?? null,
        city: data.city ?? null,
        source: "ip-api.com",
      };
    } finally {
      clearTimeout(timer);
    }
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
      // ipwho.is 国内 region/city 是英文，按 CN 词表回填中文；其它国家保持
      // 英文原值（map miss 时翻译函数直接返回原 region/city）。
      const isChina = (data.country_code ?? "").toUpperCase() === "CN";
      const region = isChina
        ? translateChineseRegion(data.region)
        : (data.region ?? null);
      const city = isChina
        ? translateChineseCity(data.city)
        : (data.city ?? null);
      return {
        ip,
        countryCode: data.country_code ?? null,
        country: data.country ?? null,
        region,
        city,
        source: "ipwho.is",
      };
    } finally {
      clearTimeout(timer);
    }
  }
}
// i18n-ignore-end
