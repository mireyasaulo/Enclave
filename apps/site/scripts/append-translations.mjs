// Append new translations to site PO files (idempotent: skips msgid already present).
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const ROOT = "/home/ps/claude/yinjie-app/packages/i18n/catalogs/site";

const TRANSLATIONS = [
  // OnePersonWorld
  ["理念", "Philosophy", "理念", "철학"],
  ["一个属于你的世界，从架构开始", "Your own world — architected from the ground up", "あなたのための世界、設計から始まる", "당신만의 세계, 설계 단계부터"],
  ["隐界不是一个共享的 chatbot 服务，而是一套可独立部署的 AI 社交基础设施。每个实例只为一个人存在。", "Enclave is not a shared chatbot service. It is AI social infrastructure you can self-deploy — one instance per person.", "エンクレイブは共有のチャットボットではなく、自社デプロイ可能な AI ソーシャル基盤です。インスタンスはひとりにひとつ。", "엔클레이브는 공유 챗봇 서비스가 아니라, 자체 배포 가능한 AI 소셜 인프라입니다. 인스턴스는 사용자당 하나입니다."],
  ["一人一世界", "One person, one world", "ひとりにひとつの世界", "한 사람당 하나의 세계"],
  ["独立实例架构，数据真正属于用户。隐私不靠承诺，靠架构层保障。", "Independent instances mean the data is genuinely yours. Privacy is enforced by architecture, not promises.", "独立インスタンス構成。データは確かにあなたのもの。プライバシーは約束ではなくアーキテクチャで守られます。", "독립 인스턴스 구조. 데이터는 진정으로 당신의 것이며, 개인정보는 약속이 아니라 아키텍처로 보호됩니다."],
  ["数据自主", "Data sovereignty", "データ主権", "데이터 주권"],
  ["全部数据可导入导出，可整包迁移；离开隐界，世界还是你的。", "All data is importable and exportable; you can take the whole world with you when you leave.", "すべてのデータは入出力・パッケージ移行が可能。エンクレイブを離れても、世界はあなたのものです。", "모든 데이터는 가져오기·내보내기 및 통째 이전이 가능합니다. 엔클레이브를 떠나도 세계는 그대로 당신의 것입니다."],
  ["AI 平权", "Equal access to AI", "AI のアクセス平等", "AI 평등권"],
  ["高质量对话不应被少数平台垄断。隐界让任何人都能拥有自己的 AI 居民。", "High-quality conversation shouldn't be monopolized by a handful of platforms. Enclave lets anyone host their own AI residents.", "質の高い会話は一部のプラットフォームに独占されるべきではありません。エンクレイブは、誰もが自分の AI 住人を持てるようにします。", "양질의 대화가 소수 플랫폼의 전유물이어선 안 됩니다. 엔클레이브는 누구나 자신의 AI 주민을 가질 수 있게 합니다."],
  ["不取代现实", "Doesn't replace reality", "現実を置き換えない", "현실을 대체하지 않는다"],
  ["白天有同事、有老板，晚上回到隐界有心理咨询师；它补全你的情感维度，而不是替代真实关系。", "By day you have colleagues and bosses; by night you have a counselor in Enclave. It complements your emotional life — it doesn't replace real relationships.", "昼は同僚や上司がいて、夜にはエンクレイブに相談相手がいる。現実の関係を置き換えるのではなく、感情の幅を広げます。", "낮에는 동료와 상사가 있고, 밤에는 엔클레이브에 상담사가 있습니다. 현실의 관계를 대체하지 않고 감정의 결을 더해 줍니다."],
  // CrossPlatformSection
  ["移动随手用，桌面深度用", "Casual on mobile, deep on desktop", "モバイルでは手軽に、デスクトップでは深く", "모바일은 가볍게, 데스크톱은 깊게"],
  ["apps/app 是一份 React 19 + TypeScript 代码库，同时跑在 Web、iOS / Android Capacitor 壳、以及 Tauri 桌面壳上。", "apps/app is one React 19 + TypeScript codebase that runs on Web, iOS/Android (Capacitor), and Tauri desktop shells.", "apps/app は一つの React 19 + TypeScript コードベースで、Web、iOS / Android（Capacitor）、Tauri デスクトップシェルで動きます。", "apps/app 은 하나의 React 19 + TypeScript 코드베이스로, Web, iOS / Android (Capacitor), Tauri 데스크톱 셸에서 모두 동작합니다."],
  ["移动端", "Mobile", "モバイル", "모바일"],
  ["Web / iOS / Android", "Web / iOS / Android", "Web / iOS / Android", "Web / iOS / Android"],
  ["桌面端", "Desktop", "デスクトップ", "데스크톱"],
  ["Tauri · Windows / macOS / Linux", "Tauri · Windows / macOS / Linux", "Tauri · Windows / macOS / Linux", "Tauri · Windows / macOS / Linux"],
  ["聊天工作区（多窗口）", "Chat workspace (multi-window)", "チャットワークスペース（マルチウィンドウ）", "채팅 워크스페이스(멀티 윈도우)"],
  ["聊天文件中心", "Chat file center", "チャットファイル管理", "채팅 파일 센터"],
  ["聊天记录全局搜索", "Global chat search", "全文チャット検索", "전역 채팅 검색"],
  ["视频号直播伴侣", "Channels live companion", "ライブ配信コンパニオン", "라이브 컴패니언"],
  ["原生托盘 / 锁屏", "Native tray & lock screen", "ネイティブトレイ / ロック画面", "네이티브 트레이 / 잠금 화면"],
  // SelfHostSection
  ["克隆、起 docker、起飞", "Clone it, docker compose up, lift off", "クローン → docker compose up → 完了", "클론, docker compose up, 시작"],
  ["完全开源，MIT 许可。无任何外部 SaaS 依赖；一台机器、一条 docker compose up，几分钟就能跑起来。", "Fully open source, MIT licensed. No external SaaS dependency — one machine, one docker compose up, ready in minutes.", "完全オープンソース、MIT ライセンス。外部 SaaS への依存はなく、一台のマシンと docker compose up で数分で起動します。", "완전 오픈소스, MIT 라이선스. 외부 SaaS 의존이 없으며, 한 대의 머신에서 docker compose up 으로 몇 분 만에 실행됩니다."],
  ["克隆仓库", "Clone the repo", "リポジトリをクローン", "리포지토리 클론"],
  ["一键启动", "One-line bring-up", "ワンコマンド起動", "한 줄로 실행"],
  ["浏览器访问", "Open in your browser", "ブラウザでアクセス", "브라우저에서 열기"],
  ["查看完整自部署指南", "Read the full self-host guide", "セルフホストガイドを読む", "자체 호스팅 가이드 보기"],
  ["在 GitHub 上 Star", "Star on GitHub", "GitHub でスター", "GitHub 에서 Star"],
  // FaqAccordion
  ["常见问题", "FAQ", "よくある質問", "자주 묻는 질문"],
  ["FAQ", "FAQ", "FAQ", "FAQ"],
  ["没找到你的问题？欢迎邮件联系我们。", "Don't see your question? Drop us an email.", "ご質問が見つかりませんか？お気軽にメールでお問い合わせください。", "찾으시는 질문이 없나요? 언제든 이메일로 문의해 주세요."],
  ["隐界真的开源吗？", "Is Enclave really open source?", "エンクレイブは本当にオープンソースですか？", "엔클레이브는 정말 오픈소스인가요?"],
  ["是。整个 monorepo（apps/app、apps/desktop、cloud-api、admin、site 等）都在 GitHub 上以 MIT 许可证开放，欢迎自部署、二次开发、商用。", "Yes. The entire monorepo (apps/app, apps/desktop, cloud-api, admin, site, etc.) is on GitHub under the MIT license — feel free to self-host, fork, or build commercial offerings on top of it.", "はい。monorepo 全体（apps/app、apps/desktop、cloud-api、admin、site など）は MIT ライセンスで GitHub に公開されています。セルフホスト、改変、商用利用を歓迎します。", "네. 모든 monorepo (apps/app, apps/desktop, cloud-api, admin, site 등)가 MIT 라이선스로 GitHub 에 공개되어 있으며, 자체 호스팅 / 포크 / 상용화 모두 환영합니다."],
  ["我的数据保存在哪里？", "Where is my data stored?", "私のデータはどこに保存されますか？", "내 데이터는 어디에 저장되나요?"],
  ["保存在你自己部署的实例里。隐界采用一人一世界的独立实例架构，没有中心化的数据后台，没有跨用户的数据合并；你拥有数据所有权。", "On the instance you deploy yourself. Enclave uses an instance-per-person architecture — there is no centralized backend and no cross-user data fusion. You own the data outright.", "ご自身が立てたインスタンスに保存されます。エンクレイブはひとりにひとつのインスタンス構成で、中央集権的なデータベースやユーザー横断のマージはありません。データの所有権はあなたにあります。", "직접 배포한 인스턴스에 저장됩니다. 엔클레이브는 한 사람당 하나의 인스턴스 구조로 운영되며, 중앙 데이터 백엔드도 사용자 간 데이터 병합도 없습니다. 데이터 소유권은 전적으로 사용자에게 있습니다."],
  ["用什么模型？能换模型吗？", "Which models are supported? Can I swap them?", "どのモデルが使えますか？切り替えはできますか？", "어떤 모델을 지원하나요? 교체할 수 있나요?"],
  ["默认与多家主流模型供应商兼容（OpenAI 兼容协议），可在订阅页或自部署配置里切换；本地模型同样支持，只要服务能开 OpenAI 兼容的 HTTP 接口。", "Out of the box we support major model providers via the OpenAI-compatible protocol, switchable from the subscription page or your self-host config. Local models work too — anything that exposes an OpenAI-compatible HTTP endpoint.", "デフォルトで OpenAI 互換プロトコルにより主要なモデルプロバイダーに対応し、サブスク画面またはセルフホスト設定で切り替え可能。OpenAI 互換 HTTP エンドポイントを提供すればローカルモデルも利用できます。", "기본적으로 OpenAI 호환 프로토콜을 통해 주요 모델 제공자를 지원하며, 구독 화면 혹은 자체 호스팅 설정에서 전환할 수 있습니다. OpenAI 호환 HTTP 엔드포인트를 제공하면 로컬 모델도 그대로 사용할 수 있습니다."],
  ["可以离线使用吗？", "Can I use it offline?", "オフラインで使えますか？", "오프라인 사용이 가능한가요?"],
  ["本地客户端（Tauri 桌面壳、Capacitor 移动壳）可离线浏览历史；AI 对话需要联网到模型服务（无论你是连云端还是本地模型）。", "The local clients (Tauri desktop shell, Capacitor mobile shell) can browse history offline. AI conversation needs network access to a model service — whether it's a cloud provider or your local one.", "ローカルクライアント（Tauri デスクトップ、Capacitor モバイル）は履歴をオフラインで閲覧できます。AI 会話はクラウド／ローカルを問わずモデルサービスへの通信が必要です。", "로컬 클라이언트(Tauri 데스크톱, Capacitor 모바일)는 오프라인에서도 기록을 볼 수 있습니다. AI 대화는 클라우드든 로컬이든 모델 서비스와의 통신이 필요합니다."],
  ["需要付费吗？", "Do I need to pay?", "料金はかかりますか？", "유료인가요?"],
  ["自部署完全免费。如果选择官方托管的云服务，按使用量付费——账单与你接入的模型供应商绑定，没有中间溢价。", "Self-hosting is free. If you opt into our managed cloud, you pay for usage — billed directly through the model provider you connect, without middle-man markup.", "セルフホストは完全無料です。マネージドクラウドを選んだ場合は従量課金で、接続したモデルプロバイダーへ直接請求され、中間マージンはありません。", "자체 호스팅은 완전 무료입니다. 매니지드 클라우드를 선택하시면 사용량 기반으로 청구되며, 연결한 모델 제공자에게 직접 결제되고 중간 마진은 없습니다."],
  ["支持中英日韩之外的语言吗？", "What about languages beyond zh / en / ja / ko?", "中・英・日・韓以外の言語にも対応していますか？", "중·영·일·한 외 다른 언어도 지원하나요?"],
  ["界面目前支持简中 / English / 日本語 / 한국어。AI 角色对话本身不限语种，跟着模型能力走。", "The UI currently ships in zh-CN / English / 日本語 / 한국어. The AI conversation itself is language-agnostic — it goes wherever the model can.", "UI は現在 zh-CN / English / 日本語 / 한국어 に対応。AI 会話自体は言語を問わず、モデルの能力次第です。", "UI 는 현재 zh-CN / English / 日本語 / 한국어 를 지원합니다. AI 대화 자체는 언어에 구애받지 않으며, 모델의 역량을 따릅니다."],
];

const LOCALES = ["zh-CN", "en-US", "ja-JP", "ko-KR"];

function appendIfMissing(po, msgid, msgstr) {
  if (po.includes(`msgid "${msgid}"`)) {
    return po;
  }
  const block = `\n#. js-lingui-explicit-id\nmsgid ${JSON.stringify(msgid)}\nmsgstr ${JSON.stringify(msgstr)}\n`;
  return po.replace(/\n*$/, "") + block + "\n";
}

for (let li = 0; li < LOCALES.length; li += 1) {
  const loc = LOCALES[li];
  const file = path.join(ROOT, `${loc}.po`);
  let po = readFileSync(file, "utf-8");
  let added = 0;
  for (const tuple of TRANSLATIONS) {
    const zh = tuple[0];
    const target = tuple[li];
    if (!po.includes(`msgid ${JSON.stringify(zh)}`)) {
      po = appendIfMissing(po, zh, target);
      added += 1;
    }
  }
  writeFileSync(file, po);
  console.log(`${loc}: appended ${added}`);
}
