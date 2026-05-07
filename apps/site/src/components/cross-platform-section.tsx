import { Smartphone, Monitor, Check } from "lucide-react";
import { getServerI18n } from "@/i18n/server";
import type { SupportedLocale } from "@/lib/locales";

const MOBILE_FEATURES = [
  "聊天与群组",
  "朋友圈与动态",
  "AI 数字人通话",
  "小程序工作区",
  "游戏中心",
  "发现与场景社交",
];

const DESKTOP_FEATURES = [
  "聊天工作区（多窗口）",
  "笔记工作区（多窗口）",
  "聊天文件中心",
  "聊天记录全局搜索",
  "视频号直播伴侣",
  "原生托盘 / 锁屏",
];

export async function CrossPlatformSection({ locale }: { locale: SupportedLocale }) {
  const i18n = await getServerI18n(locale);
  const labels = {
    eyebrow: i18n._("跨端"),
    title: i18n._("移动随手用，桌面深度用"),
    subtitle: i18n._(
      "在浏览器、电脑、手机上都能用，对话和动态实时同步。一个账号，无缝接管。",
    ),
    mobile: i18n._("移动端"),
    mobileDesc: i18n._("浏览器 / iOS / Android"),
    desktop: i18n._("桌面端"),
    desktopDesc: i18n._("Windows / macOS / Linux"),
  };

  return (
    <section id="cross-platform" className="relative scroll-mt-24 bg-(--surface-shell) py-16 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <header className="max-w-2xl">
          <span className="text-sm font-semibold uppercase tracking-wider text-(--brand-primary)">
            {labels.eyebrow}
          </span>
          <h2 className="mt-2 text-3xl font-bold sm:text-4xl">{labels.title}</h2>
          <p className="mt-3 text-(--text-secondary)">{labels.subtitle}</p>
        </header>
        <div className="mt-10 grid gap-5 lg:grid-cols-2">
          <article className="rounded-2xl border border-(--border-subtle) bg-(--surface-card) p-6 sm:p-8">
            <div className="flex items-center gap-3">
              <span className="grid size-11 place-items-center rounded-xl bg-(--brand-gradient) text-white shadow-(--shadow-soft)">
                <Smartphone size={22} strokeWidth={2} />
              </span>
              <div>
                <h3 className="text-lg font-semibold text-(--text-primary)">{labels.mobile}</h3>
                <p className="text-xs text-(--text-muted)">{labels.mobileDesc}</p>
              </div>
            </div>
            <ul className="mt-6 grid gap-2 text-sm text-(--text-secondary) sm:grid-cols-2">
              {MOBILE_FEATURES.map((f) => (
                <li key={f} className="flex items-center gap-2">
                  <Check size={14} className="shrink-0 text-(--brand-accent)" />
                  <span>{i18n._(f)}</span>
                </li>
              ))}
            </ul>
          </article>
          <article className="rounded-2xl border border-(--border-subtle) bg-(--surface-card) p-6 sm:p-8">
            <div className="flex items-center gap-3">
              <span className="grid size-11 place-items-center rounded-xl bg-(--brand-gradient) text-white shadow-(--shadow-soft)">
                <Monitor size={22} strokeWidth={2} />
              </span>
              <div>
                <h3 className="text-lg font-semibold text-(--text-primary)">{labels.desktop}</h3>
                <p className="text-xs text-(--text-muted)">{labels.desktopDesc}</p>
              </div>
            </div>
            <ul className="mt-6 grid gap-2 text-sm text-(--text-secondary) sm:grid-cols-2">
              {DESKTOP_FEATURES.map((f) => (
                <li key={f} className="flex items-center gap-2">
                  <Check size={14} className="shrink-0 text-(--brand-accent)" />
                  <span>{i18n._(f)}</span>
                </li>
              ))}
            </ul>
          </article>
        </div>
      </div>
    </section>
  );
}
