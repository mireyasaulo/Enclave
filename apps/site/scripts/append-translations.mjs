// Append new translations to site PO files (idempotent: skips msgid already present).
// Tuples: [zh-CN, en-US, ja-JP, ko-KR]
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const ROOT = "/home/ps/claude/yinjie-app/packages/i18n/catalogs/site";

const TRANSLATIONS = [
  // ===== Commit 6: philosophy / cross-platform / self-host / FAQ =====
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
  ["克隆、起 docker、起飞", "Clone it, docker compose up, lift off", "クローン → docker compose up → 完了", "클론, docker compose up, 시작"],
  ["完全开源，MIT 许可。无任何外部 SaaS 依赖；一台机器、一条 docker compose up，几分钟就能跑起来。", "Fully open source, MIT licensed. No external SaaS dependency — one machine, one docker compose up, ready in minutes.", "完全オープンソース、MIT ライセンス。外部 SaaS への依存はなく、一台のマシンと docker compose up で数分で起動します。", "완전 오픈소스, MIT 라이선스. 외부 SaaS 의존이 없으며, 한 대의 머신에서 docker compose up 으로 몇 분 만에 실행됩니다."],
  ["克隆仓库", "Clone the repo", "リポジトリをクローン", "리포지토리 클론"],
  ["一键启动", "One-line bring-up", "ワンコマンド起動", "한 줄로 실행"],
  ["浏览器访问", "Open in your browser", "ブラウザでアクセス", "브라우저에서 열기"],
  ["查看完整自部署指南", "Read the full self-host guide", "セルフホストガイドを読む", "자체 호스팅 가이드 보기"],
  ["在 GitHub 上 Star", "Star on GitHub", "GitHub でスター", "GitHub 에서 Star"],
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
  // ===== Commit 7: download / privacy / terms =====
  ["挑一种最顺手的方式开始用隐界", "Pick the way that fits you best", "あなたに合った形で隐界を始めましょう", "당신에게 가장 잘 맞는 방식으로 엔클레이브를 시작해 보세요"],
  ["桌面端原生封装、网页版即开即用，自部署提供完整自主权。移动端与小程序在路上。", "Native desktop builds, an instant web preview, and full sovereignty via self-hosting. Mobile apps and a WeChat mini-program are on the way.", "ネイティブのデスクトップアプリ、すぐ使える Web 版、自己ホストによる完全な自由。モバイルアプリと WeChat ミニプログラムは準備中です。", "네이티브 데스크톱 빌드, 즉시 사용 가능한 웹 버전, 자체 호스팅을 통한 완전한 자율성. 모바일 앱과 WeChat 미니 프로그램은 준비 중입니다."],
  ["敬请期待", "Coming soon", "近日公開", "출시 예정"],
  ["Windows 桌面端", "Windows Desktop", "Windows デスクトップ", "Windows 데스크톱"],
  ["Tauri 原生封装，附带托盘和锁屏", "Native Tauri build with tray + lock screen", "Tauri ネイティブビルド、トレイ／ロック画面付き", "Tauri 네이티브 빌드, 트레이와 잠금 화면 포함"],
  ["前往 GitHub Releases", "Open GitHub Releases", "GitHub Releases を開く", "GitHub Releases 열기"],
  ["macOS 桌面端", "macOS Desktop", "macOS デスクトップ", "macOS 데스크톱"],
  ["适配 Apple Silicon 与 Intel", "Apple Silicon and Intel builds", "Apple Silicon と Intel に対応", "Apple Silicon 과 Intel 모두 지원"],
  ["网页版（在线试用）", "Web (try online)", "Web 版（オンライン試用）", "웹 버전(온라인 체험)"],
  ["无需安装，直接在浏览器里体验", "No install — try it right in your browser", "インストール不要、ブラウザですぐ体験", "설치 없이 브라우저에서 바로 체험"],
  ["打开网页版", "Open the web app", "Web 版を開く", "웹 앱 열기"],
  ["iOS / Android", "iOS / Android", "iOS / Android", "iOS / Android"],
  ["Capacitor 移动壳，敬请期待", "Capacitor mobile shell — coming soon", "Capacitor モバイルシェル — 近日公開", "Capacitor 모바일 셸 — 출시 예정"],
  ["微信小程序", "WeChat Mini-program", "WeChat ミニプログラム", "WeChat 미니 프로그램"],
  ["适配国内场景，敬请期待", "Tailored for the Chinese market — coming soon", "中国市場向け、近日公開", "중국 시장 맞춤 — 출시 예정"],
  ["自部署（推荐）", "Self-host (recommended)", "セルフホスト（推奨）", "자체 호스팅(권장)"],
  ["克隆仓库、docker compose up，几分钟跑起来", "Clone the repo, docker compose up, running in minutes", "リポジトリをクローンし docker compose up、数分で起動", "리포지토리 클론, docker compose up, 수 분 내 실행"],
  ["查看部署指南", "Read the deploy guide", "デプロイガイドを読む", "배포 가이드 보기"],
  // Privacy
  ["最近更新", "Last updated", "最終更新", "최근 업데이트"],
  ["一、我们的隐私立场", "1. Our privacy stance", "一、当社のプライバシー方針", "1. 개인정보 보호 원칙"],
  ["隐界采用一人一世界的独立实例架构。除非你主动选择官方托管的云服务，否则你的数据保存在你自己部署的实例里，与任何中央服务器无关。", "Enclave runs on an instance-per-person architecture. Unless you opt into our managed cloud, your data lives on the instance you deploy yourself — completely independent of any central server.", "エンクレイブはひとりにひとつのインスタンス構成で動作します。マネージドクラウドを選択しない限り、データはご自身のインスタンス内にのみ保存され、いかなる中央サーバーとも切り離されています。", "엔클레이브는 한 사람당 하나의 인스턴스 구조로 동작합니다. 매니지드 클라우드를 선택하지 않는 한, 데이터는 직접 배포한 인스턴스에만 저장되며 어떤 중앙 서버와도 무관합니다."],
  ["二、自部署用户", "2. Self-hosted users", "二、セルフホストユーザー", "2. 자체 호스팅 사용자"],
  ["你完全控制数据存放位置（本地数据库 / 自有服务器 / 云盘）。隐界不会向第三方发送任何用户数据，除非你显式连接外部模型供应商；此时仅相关对话内容根据你的配置发送给该供应商。", "You decide exactly where data is stored (local database, your own server, your own cloud). Enclave never forwards user data to any third party — except when you explicitly connect an external model provider, at which point only the relevant conversation is sent according to your config.", "データの保管先（ローカル DB／自己サーバー／クラウド）はあなたが完全にコントロールします。外部モデルプロバイダーを明示的に接続した場合を除き、エンクレイブが第三者にユーザーデータを送信することはありません。接続時にも、設定に応じた会話のみが送信されます。", "데이터 저장 위치(로컬 DB / 자체 서버 / 클라우드)는 사용자가 완전히 결정합니다. 외부 모델 제공자를 명시적으로 연결하지 않는 한, 엔클레이브는 어떠한 사용자 데이터도 제3자에게 전송하지 않습니다. 연결 시에는 설정에 따른 대화만 전송됩니다."],
  ["三、托管云服务用户", "3. Managed-cloud users", "三、マネージドクラウドユーザー", "3. 매니지드 클라우드 사용자"],
  ["如选择官方托管，我们仅采集运行所需的最少数据：账号标识、订阅状态、错误堆栈与请求日志。这些数据不会用于广告，也不会与第三方共享，仅用于服务运维与计费。", "If you choose our managed cloud, we collect only the minimum data needed to run the service: account identifier, subscription status, error stack traces, and request logs. We never use this for advertising or share it with third parties — only for ops and billing.", "マネージドクラウドを利用する場合、当社はサービス稼働に必要な最小限のデータ（アカウント識別子、サブスク状態、エラースタック、リクエストログ）のみを収集します。これらは広告に利用せず、第三者にも共有しません。運用・請求のみに使用します。", "매니지드 클라우드를 선택하실 경우, 서비스 운영에 필요한 최소한의 데이터(계정 식별자, 구독 상태, 오류 스택, 요청 로그)만 수집합니다. 광고 목적으로 사용하거나 제3자와 공유하지 않으며, 오직 운영과 결제에만 활용합니다."],
  ["四、模型供应商", "4. Model providers", "四、モデルプロバイダー", "4. 모델 제공자"],
  ["AI 对话内容会按你的配置发送给所选模型供应商（OpenAI、Anthropic、Google、DeepSeek 等，或你自部署的本地模型）。具体数据处理方式请参考各供应商的隐私政策。", "AI conversations are sent — per your configuration — to the model provider you select (OpenAI, Anthropic, Google, DeepSeek, etc., or your self-hosted model). Refer to each provider's privacy policy for specifics.", "AI 会話の内容は、設定に従って選択したモデルプロバイダー（OpenAI、Anthropic、Google、DeepSeek など、またはセルフホストモデル）に送信されます。各プロバイダーのプライバシーポリシーをご参照ください。", "AI 대화 내용은 설정에 따라 선택하신 모델 제공자(OpenAI, Anthropic, Google, DeepSeek 등 또는 자체 호스팅 모델)로 전송됩니다. 처리 방식은 각 제공자의 개인정보 처리방침을 참고하시기 바랍니다."],
  ["五、你的权利", "5. Your rights", "五、あなたの権利", "5. 사용자의 권리"],
  ["你可以随时导出全部数据、迁移到其他实例、永久删除自己的世界。我们不会保留任何无法删除的数据副本。", "You can export all your data, migrate to another instance, or permanently delete your world at any time. We do not retain any copy you cannot delete.", "いつでも全データのエクスポート、他インスタンスへの移行、世界の完全削除が可能です。当社が削除できないコピーを保持することはありません。", "언제든 모든 데이터를 내보내거나 다른 인스턴스로 이전, 또는 자신의 세계를 완전히 삭제할 수 있습니다. 사용자가 삭제할 수 없는 사본은 보관하지 않습니다."],
  ["六、联系我们", "6. Contact", "六、お問い合わせ", "6. 문의"],
  ["有任何隐私相关疑问，请发邮件至 yuanzui0728@gmail.com。", "For privacy questions, email yuanzui0728@gmail.com.", "プライバシーに関するご質問は yuanzui0728@gmail.com までメールでお寄せください。", "개인정보 관련 문의는 yuanzui0728@gmail.com 으로 이메일을 보내주세요."],
  // Terms
  ["一、开源许可", "1. Open-source license", "一、オープンソースライセンス", "1. 오픈소스 라이선스"],
  ["隐界以 MIT 许可证发布。你可以自由使用、修改、分发本项目源代码与产物，包括商业用途，请遵循 MIT 协议中的署名要求。", "Enclave is released under the MIT License. You may freely use, modify, and redistribute the source and artifacts — including commercially — subject to the attribution clause of the MIT License.", "エンクレイブは MIT ライセンスで公開されています。MIT ライセンスの帰属表示を遵守する限り、ソースおよび成果物を自由に使用・改変・再配布できます（商用利用を含む）。", "엔클레이브는 MIT 라이선스로 공개됩니다. MIT 라이선스의 출처 표시 의무를 준수하시는 한, 상용을 포함한 자유로운 사용·수정·재배포가 가능합니다."],
  ["二、合理使用", "2. Acceptable use", "二、適切な利用", "2. 적절한 사용"],
  ["请不要利用隐界从事违反所在国家或地区法律的活动；不要将其用于骚扰、欺诈、传播虚假信息或制造伤害。AI 角色生成的内容由用户负责审阅与判断，不视为隐界开发者的立场或建议。", "Don't use Enclave for activities that break the laws of your jurisdiction. Don't use it for harassment, fraud, disinformation, or to harm others. AI-generated content is the user's responsibility to review — it is not an opinion or recommendation of the Enclave maintainers.", "ご利用地域の法律に違反する活動、嫌がらせ、詐欺、虚偽情報の拡散、他者への加害目的でエンクレイブを利用しないでください。AI が生成するコンテンツの確認・判断はユーザーの責任であり、エンクレイブ開発者の立場や推奨を表すものではありません。", "거주 지역의 법률을 위반하는 활동, 괴롭힘, 사기, 허위 정보 유포, 타인에게 해를 끼치는 목적으로 엔클레이브를 사용하지 마십시오. AI 가 생성한 내용은 사용자가 직접 검토·판단해야 하며, 엔클레이브 개발자의 입장이나 권장 사항이 아닙니다."],
  ["三、订阅与计费", "3. Subscription & billing", "三、サブスクと請求", "3. 구독 및 결제"],
  ["若你选择官方托管的云服务并购买订阅，账单与你接入的模型供应商绑定，按使用量结算。订阅可随时取消，未使用部分按月按比例退还。", "If you subscribe to our managed cloud, billing is tied to the model provider you connect and metered by usage. You can cancel anytime; unused portions are prorated monthly and refunded.", "マネージドクラウドのサブスクをご利用の場合、請求は接続したモデルプロバイダーに紐づき、使用量ベースで計算されます。いつでも解約可能で、未使用分は月割りで返金されます。", "매니지드 클라우드를 구독하실 경우, 결제는 연결한 모델 제공자에 종속되며 사용량 기준으로 산정됩니다. 언제든 해지할 수 있으며, 사용하지 않은 부분은 월 단위로 환불됩니다."],
  ["四、免责声明", "4. Disclaimer", "四、免責事項", "4. 면책 조항"],
  ["本软件按现状提供，不对适销性、特定用途适用性、不侵权或可用性作任何明示或暗示担保。在适用法律允许的最大范围内，作者与贡献者不承担因使用本软件而产生的任何损失。", "The software is provided 'as is' without any warranty of merchantability, fitness for a particular purpose, non-infringement, or availability. To the extent allowed by law, authors and contributors are not liable for any loss arising from use of the software.", "本ソフトウェアは現状のまま提供され、商品性、特定目的への適合性、非侵害性、可用性のいずれも明示・黙示を問わず保証されません。適用法が許す最大限の範囲で、作者および貢献者はソフトウェアの利用により生じた損害について一切責任を負いません。", "본 소프트웨어는 '있는 그대로' 제공되며, 상품성·특정 목적 적합성·비침해성·가용성에 대한 어떠한 명시적·묵시적 보증도 하지 않습니다. 적용 가능한 법률이 허용하는 최대 범위 내에서, 작성자와 기여자는 본 소프트웨어 사용으로 인해 발생하는 손해에 대해 책임지지 않습니다."],
  ["五、变更", "5. Changes", "五、変更", "5. 변경"],
  ["条款可能根据法律法规与产品演进调整，重大变更我们会在仓库与本页公告。", "These terms may evolve with the product and applicable laws; we will announce material changes both in the repo and on this page.", "本規約は法令や製品の発展に応じて改定されることがあります。重要な変更はリポジトリおよび本ページにてお知らせします。", "본 약관은 법령과 제품 발전에 따라 개정될 수 있습니다. 중대한 변경 사항은 리포지토리와 본 페이지에서 공지합니다."],
  ["如对条款有任何疑问，请发邮件至 yuanzui0728@gmail.com。", "For terms questions, email yuanzui0728@gmail.com.", "規約に関するご質問は yuanzui0728@gmail.com までメールでお寄せください。", "약관 관련 문의는 yuanzui0728@gmail.com 으로 이메일을 보내주세요."],
];

const LOCALES = ["zh-CN", "en-US", "ja-JP", "ko-KR"];

function appendIfMissing(po, msgid, msgstr) {
  if (po.includes(`msgid ${JSON.stringify(msgid)}`)) {
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
