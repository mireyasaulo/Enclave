/**
 * Single source of truth for the 8 capability cards on the home page.
 * Both <CapabilityGrid> (UI) and <HomeJsonLd> (SoftwareApplication
 * schema, featureList field) consume this list — keep them in sync by
 * editing here.
 */
import { msg } from "@lingui/macro";
import type { MessageDescriptor } from "@lingui/core";
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

export type Capability = {
  icon: LucideIcon;
  title: MessageDescriptor;
  desc: MessageDescriptor;
};

export const CAPABILITIES: Capability[] = [
  {
    icon: MessageSquareText,
    title: msg`聊天与群组`,
    desc: msg`一对一对话、群聊、线程讨论；消息提醒、强提醒、已读标记一应俱全。`,
  },
  {
    icon: PhoneCall,
    title: msg`AI 数字人通话`,
    desc: msg`和虚拟角色实时对话——支持 1 对 1、群组、视频与语音多种形式。`,
  },
  {
    icon: Newspaper,
    title: msg`朋友圈与动态`,
    desc: msg`发布与浏览朋友动态，AI 角色也会发帖、互动、出现在你的时间线。`,
  },
  {
    icon: AppWindow,
    title: msg`小程序工作区`,
    desc: msg`内嵌的小程序生态，随手打开工具、拓展隐界的能力边界。`,
  },
  {
    icon: Gamepad2,
    title: msg`游戏中心`,
    desc: msg`游戏库与邀请系统，把朋友、AI 角色都拉进同一桌。`,
  },
  {
    icon: StickyNote,
    title: msg`笔记工作区（多窗口）`,
    desc: msg`桌面端多窗口笔记，灵感随手记，无缝同步、不受应用边界约束。`,
  },
  {
    icon: Sparkles,
    title: msg`发现与场景社交`,
    desc: msg`遇见陌生人、按场景社交、浏览世界人物库，遇见新角色与新故事。`,
  },
  {
    icon: CreditCard,
    title: msg`云订阅与权限`,
    desc: msg`灵活的功能分级与支付，按需开启更高级的模型与能力。`,
  },
];

/**
 * Screenshot keys for the multi-platform carousel + SoftwareApp
 * schema's screenshot[] field. Each renders to
 * /screenshots/<locale>/<key>.png at runtime.
 */
export type ScreenshotKey = {
  key: string;
  title: MessageDescriptor;
};

export const SCREENSHOT_KEYS: readonly ScreenshotKey[] = [
  { key: "chat", title: msg`聊天` },
  { key: "moments", title: msg`朋友圈` },
  { key: "feed", title: msg`频道流` },
  { key: "group", title: msg`群组` },
  { key: "onboarding", title: msg`入坑引导` },
  { key: "self-character", title: msg`我的角色` },
];
