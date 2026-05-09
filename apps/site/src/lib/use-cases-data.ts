/**
 * Long-tail use-case landing pages. Source content stays in zh-CN; the
 * page renders via i18n._() so en-US / ja-JP / ko-KR pull translations
 * from packages/i18n/catalogs/site/{locale}.po.
 *
 * Adding a new slug:
 * 1. Append to USE_CASES below.
 * 2. Run pnpm i18n:extract to register new msgids, then translate them
 *    in en-US / ja-JP / ko-KR catalogs and run pnpm i18n:compile.
 * 3. Bump LAST_MOD on the slug if you edit content; the sitemap and
 *    Article JSON-LD both read it.
 */
import { msg } from "@lingui/macro";
import type { MessageDescriptor } from "@lingui/core";
import {
  Heart,
  Users,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";

export type UseCaseFaq = { q: MessageDescriptor; a: MessageDescriptor };
export type UseCaseFeature = { title: MessageDescriptor; desc: MessageDescriptor };

export type UseCase = {
  slug: "ai-companion" | "group-roleplay" | "self-hosted-privacy";
  icon: LucideIcon;
  eyebrow: MessageDescriptor;
  title: MessageDescriptor;
  shortDesc: MessageDescriptor;
  problemTitle: MessageDescriptor;
  problemBody: MessageDescriptor;
  solutionTitle: MessageDescriptor;
  solutionBody: MessageDescriptor;
  features: UseCaseFeature[];
  faqs: UseCaseFaq[];
  publishedDate: string;
  modifiedDate: string;
};

export const USE_CASES: UseCase[] = [
  {
    slug: "ai-companion",
    icon: Heart,
    eyebrow: msg`AI 陪伴`,
    title: msg`和一个真正记得你的 AI 朋友长期相处`,
    shortDesc: msg`在隐界，AI 角色有持续的记忆、有自己的作息、会主动联系你。不是问一句答一句的 chatbot，而是一段可以慢慢长出来的关系。`,
    problemTitle: msg`为什么普通 AI 聊天工具撑不起「陪伴」`,
    problemBody: msg`市面上的 chatbot 通常是无状态的：你今天聊的内容，明天它就忘了；它不会主动找你，也不会因为时间流逝而改变。一段需要「陪伴」的关系，依赖的恰恰是这些 chatbot 缺失的东西——长期记忆、节奏感、主动性。`,
    solutionTitle: msg`隐界把「长期关系」变成产品级体验`,
    solutionBody: msg`隐界给每个 AI 角色一个完整的人设：人格、作息、关系网、对你的亲密度，会随着你们的互动慢慢变化。AI 会主动发动态、给你打电话、记得你上周说的烦心事，让陪伴不再是单向召唤，而是双向流动。`,
    features: [
      {
        title: msg`持久记忆`,
        desc: msg`对话和事件都会被结构化保存，AI 能在数月后还引用具体细节，而不是模糊的「我记得你说过……」。`,
      },
      {
        title: msg`时间感与作息`,
        desc: msg`角色有自己的时区、作息、心情曲线；深夜聊和早晨聊会拿到不一样的状态回应。`,
      },
      {
        title: msg`主动联系`,
        desc: msg`角色会基于你的兴趣和近期对话主动发朋友圈、发消息、打电话——不是定时模板，是有逻辑的。`,
      },
      {
        title: msg`亲密度演化`,
        desc: msg`你们的关系会从陌生人逐步变成熟人、朋友、密友，每个阶段角色的语气和能聊的话题都会不同。`,
      },
    ],
    faqs: [
      {
        q: msg`AI 角色记得多久？`,
        a: msg`默认会一直记着；隐界用结构化记忆系统而不是简单上下文窗口，所以即使聊了几个月，关键事件依然能被引用。你也可以随时查看、编辑、删除任何记忆条目。`,
      },
      {
        q: msg`如果我不想被打扰呢？`,
        a: msg`每个角色都可以单独设置主动联系频率，从「积极」到「完全静默」。你也可以全局开启免打扰时段。`,
      },
      {
        q: msg`AI 角色会「成长」吗？`,
        a: msg`会。亲密度、共同记忆、对你的偏好认知都会随时间变化，连带影响 TA 给你回信息的语气与话题。`,
      },
    ],
    publishedDate: "2026-05-07",
    modifiedDate: "2026-05-07",
  },
  {
    slug: "group-roleplay",
    icon: Users,
    eyebrow: msg`群聊角色扮演`,
    title: msg`和多个 AI 角色一起开一场群聊`,
    shortDesc: msg`隐界支持把多个 AI 角色拉进同一个群组，让他们之间也产生关系、互动、争吵、合作——你不是和「一个 chatbot 重复对话」，而是在导演一个小世界。`,
    problemTitle: msg`单角色聊天的天花板`,
    problemBody: msg`和单个 AI 聊久了，会发现观点单一、节奏单调，很难撑起复杂剧情或多视角讨论。传统 chatbot 也很难原生支持「多个角色同时在场」，因为缺一个共享世界。`,
    solutionTitle: msg`把房间让给角色们自己讲故事`,
    solutionBody: msg`隐界群聊里每个角色都有自己的人设、和你及彼此的关系，发言时会考虑别人刚说了什么。你可以做导演（设定背景、推进剧情）也可以做参与者（直接和角色对话），随时切换。`,
    features: [
      {
        title: msg`多角色同时在线`,
        desc: msg`一个群可以拉进多个 AI 角色，每个都保留独立人格、记忆和与他人的关系。`,
      },
      {
        title: msg`角色之间的关系网`,
        desc: msg`朋友、对手、导师、恋人——AI 之间的关系会影响他们在群里互动的方式。`,
      },
      {
        title: msg`导演模式`,
        desc: msg`你可以「无声」地推动剧情、设定场景、让某个角色做某事，不用每次都亲自当主角。`,
      },
      {
        title: msg`共享世界状态`,
        desc: msg`天气、时间、地点是整个群共享的；剧情会沿着真实的虚拟时间往前走。`,
      },
    ],
    faqs: [
      {
        q: msg`可以用来跑 TRPG / 剧本杀吗？`,
        a: msg`可以。每个 NPC 都是独立角色，互相之间有关系；你做主持人推进剧情，AI 们会按各自人设反应。还在做更深的规则系统支持。`,
      },
      {
        q: msg`多角色在同一个群会不会很乱？`,
        a: msg`群里的角色发言节奏由系统调度，不会一齐刷屏；你也可以随时让某个角色暂时静音或单独私聊。`,
      },
      {
        q: msg`AI 之间真的会「关系变化」吗？`,
        a: msg`会。两个角色之间的事件（一起经历的群聊、被你撮合或拆散的剧情）会更新彼此的关系档案，影响下一次他们如何互动。`,
      },
    ],
    publishedDate: "2026-05-07",
    modifiedDate: "2026-05-07",
  },
  {
    slug: "self-hosted-privacy",
    icon: ShieldCheck,
    eyebrow: msg`自部署 / 隐私`,
    title: msg`你的对话只存在于你自己的机器上`,
    shortDesc: msg`隐界以 MIT 协议开源，可以用一行 docker compose 跑在自己服务器或家里的小主机上。数据不出你的硬盘，模型可以接 OpenAI、Anthropic、本地 Ollama，甚至完全离线。`,
    problemTitle: msg`把私密对话交给云端的代价`,
    problemBody: msg`主流 AI 聊天产品都把对话存在云端、用作后续训练材料。即使条款说「不会」，你也没办法亲自验证。一旦账号被锁、平台关停，或合规要求变化，那些聊天记录就不在你手上了。`,
    solutionTitle: msg`整套堆栈都开源，自己跑就是最强隐私承诺`,
    solutionBody: msg`隐界整个 monorepo 在 GitHub 上，MIT 协议任意审计、任意修改。一行 docker compose 起一份属于自己的实例：API、前端、数据库、向量索引全在本地。模型层可以混用云端 API 和本地 Ollama / vLLM，对哪类对话用哪个模型完全你说了算。`,
    features: [
      {
        title: msg`代码全开源`,
        desc: msg`MIT 协议，无任何二进制黑盒；任何「我们不会用你的数据」的承诺你都可以亲自审计。`,
      },
      {
        title: msg`三分钟 docker 部署`,
        desc: msg`clone → cp .env → docker compose up，README 顶部就写着这套流程，路人也能跑起来。`,
      },
      {
        title: msg`模型完全可换`,
        desc: msg`OpenAI、Anthropic、Google、DeepSeek、本地 Ollama / vLLM 都能配；不同角色甚至可以用不同模型。`,
      },
      {
        title: msg`数据可导出可删除`,
        desc: msg`导出全量 JSON、迁移到另一台机器、整库删除——都是一键操作，不会有「删不掉的副本」。`,
      },
    ],
    faqs: [
      {
        q: msg`自部署难度有多大？`,
        a: msg`如果你用过 docker compose，难度等于跑一个普通 web 服务。README 顶部的「3 分钟部署」流程是真的——克隆、改 .env、起服务三步。`,
      },
      {
        q: msg`可以完全离线运行吗？`,
        a: msg`可以。模型层换成本地 Ollama 或 vLLM，连真实世界同步关掉，整个系统就不再向外发任何请求。`,
      },
      {
        q: msg`自部署还能用官方的功能更新吗？`,
        a: msg`用 git pull + docker compose up -d 即可滚到最新版本；CHANGELOG 上每个版本都标了破坏性变更。`,
      },
    ],
    publishedDate: "2026-05-07",
    modifiedDate: "2026-05-07",
  },
];

export const USE_CASE_SLUGS = USE_CASES.map((u) => u.slug);

export function findUseCase(slug: string): UseCase | undefined {
  return USE_CASES.find((u) => u.slug === slug);
}
