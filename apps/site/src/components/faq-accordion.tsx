import { ChevronDown } from "lucide-react";
import { getServerI18n } from "@/i18n/server";
import type { SupportedLocale } from "@/lib/locales";

const FAQS: Array<{ qZh: string; aZh: string }> = [
  {
    qZh: "隐界真的开源吗？",
    aZh: "是。整个 monorepo（apps/app、apps/desktop、cloud-api、admin、site 等）都在 GitHub 上以 MIT 许可证开放，欢迎自部署、二次开发、商用。",
  },
  {
    qZh: "我的数据保存在哪里？",
    aZh: "保存在你自己部署的实例里。隐界采用一人一世界的独立实例架构，没有中心化的数据后台，没有跨用户的数据合并；你拥有数据所有权。",
  },
  {
    qZh: "用什么模型？能换模型吗？",
    aZh: "默认与多家主流模型供应商兼容（OpenAI 兼容协议），可在订阅页或自部署配置里切换；本地模型同样支持，只要服务能开 OpenAI 兼容的 HTTP 接口。",
  },
  {
    qZh: "可以离线使用吗？",
    aZh: "本地客户端（Tauri 桌面壳、Capacitor 移动壳）可离线浏览历史；AI 对话需要联网到模型服务（无论你是连云端还是本地模型）。",
  },
  {
    qZh: "需要付费吗？",
    aZh: "自部署完全免费。如果选择官方托管的云服务，按使用量付费——账单与你接入的模型供应商绑定，没有中间溢价。",
  },
  {
    qZh: "支持中英日韩之外的语言吗？",
    aZh: "界面目前支持简中 / English / 日本語 / 한국어。AI 角色对话本身不限语种，跟着模型能力走。",
  },
];

export async function FaqAccordion({ locale }: { locale: SupportedLocale }) {
  const i18n = await getServerI18n(locale);
  const labels = {
    eyebrow: i18n._("常见问题"),
    title: i18n._("FAQ"),
    subtitle: i18n._("没找到你的问题？欢迎邮件联系我们。"),
  };

  return (
    <section id="faq" className="relative scroll-mt-24 bg-(--surface-shell) py-16 sm:py-24">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <header className="text-center">
          <span className="text-sm font-semibold uppercase tracking-wider text-(--brand-primary)">
            {labels.eyebrow}
          </span>
          <h2 className="mt-2 text-3xl font-bold sm:text-4xl">{labels.title}</h2>
          <p className="mt-3 text-(--text-secondary)">{labels.subtitle}</p>
        </header>
        <ul className="mt-10 space-y-3">
          {FAQS.map((f) => (
            <li
              key={f.qZh}
              className="overflow-hidden rounded-2xl border border-(--border-subtle) bg-(--surface-card)"
            >
              <details className="group">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-left text-base font-semibold text-(--text-primary) transition hover:bg-(--surface-soft)">
                  <span>{i18n._(f.qZh)}</span>
                  <ChevronDown
                    size={18}
                    className="shrink-0 text-(--text-muted) transition group-open:rotate-180 group-open:text-(--brand-primary)"
                  />
                </summary>
                <div className="border-t border-(--border-faint) px-5 py-4 text-sm leading-7 text-(--text-secondary)">
                  {i18n._(f.aZh)}
                </div>
              </details>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
