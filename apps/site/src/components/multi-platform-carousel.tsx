import Image from "next/image";
import { msg } from "@lingui/macro";
import type { MessageDescriptor } from "@lingui/core";
import { getServerI18n } from "@/i18n/server";
import type { SupportedLocale } from "@/lib/locales";

const SHOTS: Array<{
  key: string;
  title: MessageDescriptor;
  desc: MessageDescriptor;
  alt: MessageDescriptor;
}> = [
  {
    key: "chat",
    title: msg`聊天`,
    desc: msg`线程化对话与消息提醒`,
    alt: msg`隐界聊天界面：与 AI 角色的线程化对话、消息提醒、强提醒、已读标记`,
  },
  {
    key: "moments",
    title: msg`朋友圈`,
    desc: msg`AI 与人共同的时间线`,
    alt: msg`隐界朋友圈：AI 角色与你共享的私人时间线，会主动发动态与互动`,
  },
  {
    key: "feed",
    title: msg`频道流`,
    desc: msg`频道、视频号、官方账号`,
    alt: msg`隐界频道流：频道、视频号、官方账号的内容聚合界面`,
  },
  {
    key: "group",
    title: msg`群组`,
    desc: msg`多人对话与角色互动`,
    alt: msg`隐界群组：多 AI 角色与你的多人对话场景`,
  },
  {
    key: "onboarding",
    title: msg`入坑引导`,
    desc: msg`新人启动与世界初始化`,
    alt: msg`隐界新人引导：首次进入虚拟世界的角色初始化与世界设定`,
  },
  {
    key: "self-character",
    title: msg`我的角色`,
    desc: msg`你与 AI 化身的资料卡`,
    alt: msg`隐界我的角色：你与 AI 化身的资料卡、个性、形象设定`,
  },
];

export async function MultiPlatformCarousel({ locale }: { locale: SupportedLocale }) {
  const i18n = await getServerI18n(locale);
  const titles = {
    eyebrow: i18n._("产品截图"),
    title: i18n._("从入坑到日常使用"),
    subtitle: i18n._("六个核心场景一起看，画面均来自当前线上版本。"),
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
                  alt={i18n._(shot.alt)}
                  fill
                  sizes="(min-width: 1024px) 360px, (min-width: 640px) 50vw, 100vw"
                  className="object-cover object-top transition group-hover:scale-[1.01]"
                />
              </div>
              <div className="px-5 py-4">
                <h3 className="text-base font-semibold text-(--text-primary)">{i18n._(shot.title)}</h3>
                <p className="mt-1 text-sm text-(--text-secondary)">{i18n._(shot.desc)}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
