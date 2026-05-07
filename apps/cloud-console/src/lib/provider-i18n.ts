import {
  selectCloudConsoleText,
  type CloudConsoleLocale,
} from "./cloud-console-i18n";

// i18n-ignore-start: Maps backend provider keys to locale-aware UI labels.
const PROVIDER_LABELS: Record<
  string,
  Partial<Record<CloudConsoleLocale, string>>
> = {
  "local-process": {
    "en-US": "Local Process Provider",
    "zh-CN": "本机进程供应方",
    "ja-JP": "ローカルプロセス プロバイダー",
    "ko-KR": "로컬 프로세스 공급자",
  },
  mock: {
    "en-US": "Mock Local Provider",
    "zh-CN": "本地 Mock 供应方",
    "ja-JP": "ローカルモック プロバイダー",
    "ko-KR": "로컬 모의 공급자",
  },
  "docker-ssh": {
    "en-US": "Docker SSH Host",
    "zh-CN": "Docker SSH 主机",
    "ja-JP": "Docker SSH ホスト",
    "ko-KR": "Docker SSH 호스트",
  },
  "manual-docker": {
    "en-US": "Manual Docker Host",
    "zh-CN": "手动 Docker 主机",
    "ja-JP": "手動 Docker ホスト",
    "ko-KR": "수동 Docker 호스트",
  },
};

const PROVIDER_DESCRIPTIONS: Record<
  string,
  Partial<Record<CloudConsoleLocale, string>>
> = {
  "local-process": {
    "en-US":
      "Spawns a per-account main-api child process with isolated database and media directories.",
    "zh-CN":
      "为每个账号启动一个独立的 main-api 子进程，并隔离其数据库与媒体目录。",
    "ja-JP":
      "アカウントごとに main-api 子プロセスを起動し、データベースとメディアディレクトリを分離します。",
    "ko-KR":
      "계정별로 main-api 자식 프로세스를 실행하며 데이터베이스와 미디어 디렉터리를 분리합니다.",
  },
  mock: {
    "en-US": "Mock provider for local testing without real compute.",
    "zh-CN": "用于本地联调的 Mock 供应方，不会创建真实算力。",
    "ja-JP": "実コンピュートを使わないローカルテスト向けのモックプロバイダーです。",
    "ko-KR": "실제 컴퓨트를 사용하지 않는 로컬 테스트용 모의 공급자입니다.",
  },
};
// i18n-ignore-end

export function localizeProviderLabel(
  providerKey?: string | null,
  fallbackLabel?: string | null,
  locale?: string | null,
) {
  const key = (providerKey ?? "").trim();
  if (key && PROVIDER_LABELS[key]) {
    return selectCloudConsoleText(locale, {
      "en-US": PROVIDER_LABELS[key]["en-US"] ?? fallbackLabel ?? key,
      "zh-CN": PROVIDER_LABELS[key]["zh-CN"] ?? fallbackLabel ?? key,
      "ja-JP": PROVIDER_LABELS[key]["ja-JP"] ?? fallbackLabel ?? key,
      "ko-KR": PROVIDER_LABELS[key]["ko-KR"] ?? fallbackLabel ?? key,
    });
  }
  return fallbackLabel ?? key;
}

export function localizeProviderDescription(
  providerKey?: string | null,
  fallbackDescription?: string | null,
  locale?: string | null,
) {
  const key = (providerKey ?? "").trim();
  if (key && PROVIDER_DESCRIPTIONS[key]) {
    return selectCloudConsoleText(locale, {
      "en-US":
        PROVIDER_DESCRIPTIONS[key]["en-US"] ?? fallbackDescription ?? "",
      "zh-CN":
        PROVIDER_DESCRIPTIONS[key]["zh-CN"] ?? fallbackDescription ?? "",
      "ja-JP":
        PROVIDER_DESCRIPTIONS[key]["ja-JP"] ?? fallbackDescription ?? "",
      "ko-KR":
        PROVIDER_DESCRIPTIONS[key]["ko-KR"] ?? fallbackDescription ?? "",
    });
  }
  return fallbackDescription ?? "";
}
