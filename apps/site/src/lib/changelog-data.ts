// Hand-curated mirror of root CHANGELOG.md.
// Bump when releases ship; SoftwareApplication.dateModified in
// home-json-ld.tsx should follow the latest entry's date.
//
// Each section's body lines are stored as plain strings so the page
// component can choose its own rendering. Lists are flat; nested groups
// (✨ 新增 / 🔧 改进 / 🐛 修复 / 📚 文档) are kept as section objects.

export type ChangelogSection = {
  titleZh: string;
  items: string[];
};

export type ChangelogRelease = {
  version: string;
  date: string;
  headlineZh: string;
  releaseUrl: string;
  sections: ChangelogSection[];
};

export const CHANGELOG: ChangelogRelease[] = [
  {
    version: "0.1.1",
    date: "2026-04-24",
    headlineZh:
      "首次公开之后第一个节奏更新：把\"能跑起来\"升级到\"路人点开就能玩得顺\"。",
    releaseUrl: "https://github.com/yuanzui0728/enclave/releases/tag/v0.1.1",
    sections: [
      {
        titleZh: "✨ 新增",
        items: [
          "3 分钟 Docker 一键部署：README 顶部新增 clone → cp .env → docker compose up 三步走流程",
          "多平台联系人导入层：微信 4.x、WeFlow、ChatLab、QQ / Telegram / Discord / WhatsApp / LINE / Instagram",
          "\"自己\"角色 × 赛博分身闭环：self-agent 路由 + 管理后台控制台 + Cyber Avatar real_world_sync",
          "多模态聊天：图像 / 音频 / 文档全链路，PDF OCR 兜底，群聊也支持多模态回复",
          "提醒任务系统：自然语言解析 + 规则编辑器 + LLM 兜底",
          "真实世界同步：默认 Google News RSS，角色会把新闻带进聊天/朋友圈/群聊",
          "多模型推理路由：按角色 / 场景分发到不同模型，模型人格可批量运维",
          "新角色预设：健身教练、英语教练、酒吧老炮",
          "管理后台 UX 大升级：需求发现 / 角色中心 / 游戏目录 / 推理工作台 / Token 用量 / 实时同步",
          "语言切换器全端铺开（App / Desktop / Admin），日/韩种子翻译完成",
        ],
      },
      {
        titleZh: "🔧 改进",
        items: [
          "移动端 share / copy / forward / favorite 的 notice retry 兜底",
          "桌面端 shell 大规模重构：共享 chat / contacts / moments / official / favorites / search 的 route shells",
          "提醒相关 UI：默认折叠、修改后刷新、collapse 后重新挂载",
          "CI：i18n 硬编码文案 ratchet，新增文案默认不能出现硬编码中文",
        ],
      },
      {
        titleZh: "🐛 修复",
        items: [
          "桌面端路由尾斜杠归一化（数十个路径）",
          "移动端 Web 运行时与路由一揽子修复",
          "WeFlow 启动流程、上游服务查询错误现形",
          "群聊邀请 / 分享 / 复制回退、朋友圈返回路径、探针会话污染聊天列表 等长尾 bug",
        ],
      },
    ],
  },
  {
    version: "0.1.0",
    date: "2026-04-19",
    headlineZh: "首次公开：一个属于你的 AI 虚拟世界。",
    releaseUrl: "https://github.com/yuanzui0728/enclave/releases/tag/v0.1.0",
    sections: [
      {
        titleZh: "核心能力",
        items: [
          "AI 居民的人格 / 作息 / 多场景人设 / 与你的亲密度",
          "AI 与 AI 之间的关系网（熟人 / 朋友 / 对手 / 导师 / 恋人）",
          "共享世界时间：季节 / 天气 / 时段 / 节假日 / 虚拟位置",
          "叙事弧线：每段关系的进度、阶段、里程碑",
          "社交闭环：聊天 / 群聊 / 朋友圈 / 视频号 / 发现",
          "通向现实的两座桥：Action 执行框架 + 真实世界信号",
          "一套 monorepo：api / apps/app / apps/admin / apps/desktop / 移动端壳",
        ],
      },
    ],
  },
];
