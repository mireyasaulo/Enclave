import Image from "next/image";
import { getServerI18n } from "@/i18n/server";
import type { SupportedLocale } from "@/lib/locales";

const SHOTS: Array<{ key: string; titleZh: string; descZh: string }> = [
  { key: "chat", titleZh: "聊天", descZh: "线程化对话与消息提醒" },
  { key: "moments", titleZh: "朋友圈", descZh: "AI 与人共同的时间线" },
  { key: "feed", titleZh: "频道流", descZh: "频道、视频号、官方账号" },
  { key: "group", titleZh: "群组", descZh: "多人对话与角色互动" },
  { key: "onboarding", titleZh: "入坑引导", descZh: "新人启动与世界初始化" },
  { key: "self-character", titleZh: "我的角色", descZh: "你与 AI 化身的资料卡" },
];

export async function MultiPlatformCarousel({ locale }: { locale: SupportedLocale }) {
  const i18n = await getServerI18n(locale);
  const titles = {
    eyebrow: i18n._("产品截图"),
    title: i18n._("从入坑到日常使用"),
    subtitle: i18n._("六个核心场景一起看，画面均来自 apps/app 当前真实版本。"),
  };

  return (
    <section id="screenshots" className="relative scroll-mt-24 bg-(--surface-shell) py-16 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <header className="max-w-2xl">
          <span className="text-sm font-semibold uppercase tracking-wider text-(--brand-primary)">
            {titles.eyebrow}
          </span>
          <h2 className="mt-2 text-3xl font-bold sm:text-4xl">{titles.title}</h2>
          <p className="mt-3 text-(--text-secondary)">{titles.subtitle}</p>
        </header>
        <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {SHOTS.map((shot) => (
            <li
              key={shot.key}
              className="group overflow-hidden rounded-2xl border border-(--border-subtle) bg-(--surface-card) shadow-(--shadow-soft) transition hover:shadow-(--shadow-lift)"
            >
              <div className="relative aspect-[3/4] bg-(--surface-soft)">
                <Image
                  src={`/screenshots/${locale}/${shot.key}.png`}
                  alt={i18n._(shot.titleZh)}
                  fill
                  sizes="(min-width: 1024px) 360px, (min-width: 640px) 50vw, 100vw"
                  className="object-cover object-top transition group-hover:scale-[1.01]"
                />
              </div>
              <div className="px-5 py-4">
                <h3 className="text-base font-semibold text-(--text-primary)">{i18n._(shot.titleZh)}</h3>
                <p className="mt-1 text-sm text-(--text-secondary)">{i18n._(shot.descZh)}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
