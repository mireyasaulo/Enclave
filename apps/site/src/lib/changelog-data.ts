// Hand-curated mirror of root CHANGELOG.md.
// Bump when releases ship; SoftwareApplication.dateModified in
// home-json-ld.tsx should follow the latest entry's date.
//
// Body lines are stored as MessageDescriptor so lingui extract picks
// them up; the page renders via i18n._() to localize.
import { msg } from "@lingui/macro";
import type { MessageDescriptor } from "@lingui/core";

export type ChangelogSection = {
  title: MessageDescriptor;
  items: MessageDescriptor[];
};

export type ChangelogRelease = {
  version: string;
  date: string;
  headline: MessageDescriptor;
  releaseUrl: string;
  sections: ChangelogSection[];
};

export const CHANGELOG: ChangelogRelease[] = [
  {
    version: "0.1.1",
    date: "2026-04-24",
    headline: msg`首次公开之后第一个节奏更新：把"能跑起来"升级到"路人点开就能玩得顺"。`,
    releaseUrl: "https://github.com/yuanzui0728/enclave/releases/tag/v0.1.1",
    sections: [
      {
        title: msg`✨ 新增`,
        items: [
          msg`3 分钟 Docker 一键部署：README 顶部新增 clone → cp .env → docker compose up 三步走流程`,
          msg`多平台联系人导入层：微信 4.x、WeFlow、ChatLab、QQ / Telegram / Discord / WhatsApp / LINE / Instagram`,
          msg`"自己"角色 × 赛博分身闭环：self-agent 路由 + 管理后台控制台 + Cyber Avatar real_world_sync`,
          msg`多模态聊天：图像 / 音频 / 文档全链路，PDF OCR 兜底，群聊也支持多模态回复`,
          msg`提醒任务系统：自然语言解析 + 规则编辑器 + LLM 兜底`,
          msg`真实世界同步：默认 Google News RSS，角色会把新闻带进聊天/朋友圈/群聊`,
          msg`多模型推理路由：按角色 / 场景分发到不同模型，模型人格可批量运维`,
          msg`新角色预设：健身教练、英语教练、酒吧老炮`,
          msg`管理后台 UX 大升级：需求发现 / 角色中心 / 游戏目录 / 推理工作台 / Token 用量 / 实时同步`,
          msg`语言切换器全端铺开（App / Desktop / Admin），日/韩种子翻译完成`,
        ],
      },
      {
        title: msg`🔧 改进`,
        items: [
          msg`移动端 share / copy / forward / favorite 的 notice retry 兜底`,
          msg`桌面端 shell 大规模重构：共享 chat / contacts / moments / official / favorites / search 的 route shells`,
          msg`提醒相关 UI：默认折叠、修改后刷新、collapse 后重新挂载`,
          msg`CI：i18n 硬编码文案 ratchet，新增文案默认不能出现硬编码中文`,
        ],
      },
      {
        title: msg`🐛 修复`,
        items: [
          msg`桌面端路由尾斜杠归一化（数十个路径）`,
          msg`移动端 Web 运行时与路由一揽子修复`,
          msg`WeFlow 启动流程、上游服务查询错误现形`,
          msg`群聊邀请 / 分享 / 复制回退、朋友圈返回路径、探针会话污染聊天列表 等长尾 bug`,
        ],
      },
    ],
  },
  {
    version: "0.1.0",
    date: "2026-04-19",
    headline: msg`首次公开：一个属于你的 AI 虚拟世界。`,
    releaseUrl: "https://github.com/yuanzui0728/enclave/releases/tag/v0.1.0",
    sections: [
      {
        title: msg`核心能力`,
        items: [
          msg`AI 居民的人格 / 作息 / 多场景人设 / 与你的亲密度`,
          msg`AI 与 AI 之间的关系网（熟人 / 朋友 / 对手 / 导师 / 恋人）`,
          msg`共享世界时间：季节 / 天气 / 时段 / 节假日 / 虚拟位置`,
          msg`叙事弧线：每段关系的进度、阶段、里程碑`,
          msg`社交闭环：聊天 / 群聊 / 朋友圈 / 视频号 / 发现`,
          msg`通向现实的两座桥：Action 执行框架 + 真实世界信号`,
          msg`一套 monorepo：api / apps/app / apps/admin / apps/desktop / 移动端壳`,
        ],
      },
    ],
  },
];
