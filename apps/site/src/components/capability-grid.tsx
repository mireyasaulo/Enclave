import {
  MessageSquareText,
  PhoneCall,
  Sparkles,
  Newspaper,
  AppWindow,
  Gamepad2,
  StickyNote,
  CreditCard,
  type LucideIcon,
} from "lucide-react";
import { getServerI18n } from "@/i18n/server";
import type { SupportedLocale } from "@/lib/locales";

type Capability = {
  icon: LucideIcon;
  titleZh: string;
  descZh: string;
};

const ITEMS: Capability[] = [
  {
    icon: MessageSquareText,
    titleZh: "聊天与群组",
    descZh: "一对一对话、群聊、线程讨论；消息提醒、强提醒、已读标记一应俱全。",
  },
  {
    icon: PhoneCall,
    titleZh: "AI 数字人通话",
    descZh: "和虚拟角色实时对话——支持 1 对 1、群组、视频与语音多种形式。",
  },
  {
    icon: Newspaper,
    titleZh: "朋友圈与动态",
    descZh: "发布与浏览朋友动态，AI 角色也会发帖、互动、出现在你的时间线。",
  },
  {
    icon: AppWindow,
    titleZh: "小程序工作区",
    descZh: "内嵌的小程序生态，随手打开工具、拓展隐界的能力边界。",
  },
  {
    icon: Gamepad2,
    titleZh: "游戏中心",
    descZh: "游戏库与邀请系统，把朋友、AI 角色都拉进同一桌。",
  },
  {
    icon: StickyNote,
    titleZh: "笔记工作区（桌面）",
    descZh: "桌面端多窗口笔记，灵感随手记，无缝同步、不受应用边界约束。",
  },
  {
    icon: Sparkles,
    titleZh: "发现与场景社交",
    descZh: "遇见陌生人、按场景社交、浏览世界人物库，遇见新角色与新故事。",
  },
  {
    icon: CreditCard,
    titleZh: "云订阅与权限",
    descZh: "灵活的功能分级与支付，按需开启更高级的模型与能力。",
  },
];

export async function CapabilityGrid({ locale }: { locale: SupportedLocale }) {
  const i18n = await getServerI18n(locale);
  const titles = {
    eyebrow: i18n._("核心能力"),
    title: i18n._("不是 chatbot，而是一整个生态"),
    subtitle: i18n._("基于 apps/app 的真实代码盘点而成的能力清单：每一项都已在产品中跑通。"),
  };

  return (
    <section id="capabilities" className="relative scroll-mt-24 py-16 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <header className="max-w-2xl">
          <span className="text-sm font-semibold uppercase tracking-wider text-(--brand-primary)">
            {titles.eyebrow}
          </span>
          <h2 className="mt-2 text-3xl font-bold sm:text-4xl">{titles.title}</h2>
          <p className="mt-3 text-(--text-secondary)">{titles.subtitle}</p>
        </header>
        <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <li
                key={item.titleZh}
                className="group rounded-2xl border border-(--border-subtle) bg-(--surface-card) p-5 transition hover:border-(--brand-primary) hover:shadow-(--shadow-card)"
              >
                <div className="mb-4 grid size-10 place-items-center rounded-xl bg-(--surface-soft) text-(--brand-primary) transition group-hover:bg-(--brand-primary) group-hover:text-white">
                  <Icon size={20} strokeWidth={2} />
                </div>
                <h3 className="text-base font-semibold text-(--text-primary)">
                  {i18n._(item.titleZh)}
                </h3>
                <p className="mt-2 text-sm leading-6 text-(--text-secondary)">
                  {i18n._(item.descZh)}
                </p>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
