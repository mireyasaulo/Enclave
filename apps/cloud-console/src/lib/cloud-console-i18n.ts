import { useCallback } from "react";
import {
  getActiveLocale,
  getSurfaceTextDictionary,
  resolveSupportedLocale,
  useAppLocale,
  type SupportedLocale,
} from "@yinjie/i18n";

export type CloudConsoleLocale = SupportedLocale;

export const CLOUD_CONSOLE_ENGLISH_LOCALE: CloudConsoleLocale = "en-US";

type LocalizedTextSet = Record<CloudConsoleLocale, string>;

type CloudConsoleRuntimeDictionary = Partial<
  Record<CloudConsoleLocale, Record<string, string>>
>;

// i18n-ignore-start: Runtime dictionaries intentionally contain source and target copy.
const cloudConsoleRuntimeText: CloudConsoleRuntimeDictionary = {
  "zh-CN": {
    "CLOUD_ADMIN_SECRET is required.": "请输入 CLOUD_ADMIN_SECRET。",
    "CLOUD_ADMIN_SECRET is invalid.": "CLOUD_ADMIN_SECRET 无效。",
    "Cloud admin session is invalid or expired.":
      "云世界管理会话无效或已过期。",
    "Cloud admin token exchange returned an empty response.":
      "云世界管理令牌交换返回空响应。",
    "Cloud admin refresh returned an empty response.":
      "云世界管理会话刷新返回空响应。",
    "Cloud admin request failed.": "云世界管理请求失败。",
    "Network request failed.": "网络请求失败。",
    "Cloud admin API error": "云世界管理 API 错误",
    "Unknown admin sessions error.": "未知管理会话错误。",
    "Clipboard copy failed in this environment.":
      "当前环境无法复制到剪贴板。",
    "Waiting sync task action failed.": "等待同步任务操作失败。",
    "Admin sessions permalink copied.": "管理会话固定链接已复制。",

    "Downloaded admin session audit snapshot for": "已下载管理会话审计快照：",
    "Downloaded focused source snapshot for": "已下载聚焦来源快照：",
    "Downloaded risk snapshot for": "已下载风险快照：",
    "Downloaded risk groups CSV for": "已下载风险分组 CSV：",
    "Downloaded risk sessions CSV for": "已下载风险会话 CSV：",
    "Downloaded risk timeline CSV for": "已下载风险时间线 CSV：",
    "Downloaded daily risk timeline CSV for": "已下载每日风险时间线 CSV：",
    "Downloaded weekly risk timeline CSV for": "已下载每周风险时间线 CSV：",
    "Admin session audit snapshot is ready, but this browser could not start the download.":
      "管理会话审计快照已准备好，但当前浏览器无法开始下载。",
    "Focused source snapshot is ready, but this browser could not start the download.":
      "聚焦来源快照已准备好，但当前浏览器无法开始下载。",
    "Risk snapshot is ready, but this browser could not start the download.":
      "风险快照已准备好，但当前浏览器无法开始下载。",
    "Risk groups CSV is ready, but this browser could not start the download.":
      "风险分组 CSV 已准备好，但当前浏览器无法开始下载。",
    "Risk sessions CSV is ready, but this browser could not start the download.":
      "风险会话 CSV 已准备好，但当前浏览器无法开始下载。",
    "Risk timeline CSV is ready, but this browser could not start the download.":
      "风险时间线 CSV 已准备好，但当前浏览器无法开始下载。",
    "Focused source snapshot is not available.": "聚焦来源快照不可用。",
    "Risk timeline data is not ready for export yet.":
      "风险时间线数据尚未准备好，暂时无法导出。",

    "Waiting sync task replay queued.": "等待同步任务重放已入队。",
    "Waiting sync task replay was skipped.": "等待同步任务重放已跳过。",
    "Waiting sync task cleared.": "等待同步任务已清理。",
    "Waiting sync task clear was skipped.": "等待同步任务清理已跳过。",
    "No matching failed waiting sync tasks to replay.":
      "没有匹配的失败等待同步任务可重放。",
    "No matching failed waiting sync tasks to clear.":
      "没有匹配的失败等待同步任务可清理。",
    "Waiting sync context CSV download failed.":
      "等待同步上下文 CSV 下载失败。",
    "Waiting sync focus CSV download failed.":
      "等待同步聚焦 CSV 下载失败。",
    "Waiting sync CSV download failed.": "等待同步 CSV 下载失败。",
    "Waiting sync context snapshot download failed.":
      "等待同步上下文快照下载失败。",
    "Waiting sync focus snapshot download failed.":
      "等待同步聚焦快照下载失败。",
    "Waiting sync snapshot download failed.": "等待同步快照下载失败。",
    "Waiting sync context groups CSV download failed.":
      "等待同步上下文分组 CSV 下载失败。",
    "Waiting sync context groups snapshot download failed.":
      "等待同步上下文分组快照下载失败。",
    "Waiting sync permalink copied.": "等待同步固定链接已复制。",
    "Waiting sync review context copied.": "等待同步复核上下文已复制。",
    "Waiting sync task context copied.": "等待同步任务上下文已复制。",
    "Waiting sync permalink copy failed.": "等待同步固定链接复制失败。",
    "Waiting sync review context copy failed.":
      "等待同步复核上下文复制失败。",
    "Waiting sync task context copy failed.": "等待同步任务上下文复制失败。",

    "Switch status to All or Failed before running batch failed-task actions.":
      "请先将状态切换为全部或失败，再执行失败任务批量操作。",
    "All failed tasks across every page.": "所有页面中的全部失败任务。",
    "Focus snapshot appears when the current query exactly matches a visible context or target.":
      "当前查询精确匹配可见上下文或目标时，将显示聚焦快照。",
    "Add a context or target query to export a tighter investigation snapshot.":
      "请输入上下文或目标查询，以导出更聚焦的排查快照。",

    "Refresh world": "刷新世界",
    "Refresh phone": "刷新手机号",
    "Invalidate phone": "失效手机号",
    Failed: "失败",
    Pending: "待处理",
    Running: "运行中",
    "Not available": "不可用",
    None: "无",
    All: "全部",
    "Task key": "任务键",
    "Task type": "任务类型",
    Status: "状态",
    Target: "目标",
    Context: "上下文",
    Attempt: "尝试次数",
    Available: "可执行时间",
    Updated: "更新时间",
    Finished: "完成时间",
    "Lease owner": "租约持有者",
    "Last error": "最近错误",
    "Review permalink": "复核固定链接",
    "Requests path": "申请路径",
    "Worlds path": "世界路径",
    "World detail": "世界详情",
    "Visible tasks": "可见任务",
    "Task types": "任务类型",
    "Latest update": "最近更新",
    "Focus path": "聚焦路径",
    "Task ids": "任务 ID",
    "Task keys": "任务键",
    "Target values": "目标值",

    sourceKey: "来源键",
    riskLevel: "风险等级",
    riskSignals: "风险信号",
    issuedFromIp: "签发 IP",
    issuedUserAgent: "签发客户端",
    totalSessions: "总会话数",
    activeSessions: "活跃会话数",
    expiredSessions: "过期会话数",
    revokedSessions: "吊销会话数",
    refreshTokenReuseRevocations: "刷新令牌复用吊销数",
    currentSessions: "当前会话数",
    latestCreatedAt: "最近创建时间",
    latestLastUsedAt: "最近使用时间",
    latestRevokedAt: "最近吊销时间",
    sessionId: "会话 ID",
    status: "状态",
    isCurrent: "是否当前会话",
    expiresAt: "过期时间",
    lastUsedAt: "最近使用时间",
    lastUsedIp: "最近使用 IP",
    lastUsedUserAgent: "最近使用客户端",
    lastRefreshedAt: "最近刷新时间",
    revokedAt: "吊销时间",
    revokedBySessionId: "吊销方会话 ID",
    revocationReason: "吊销原因",
    createdAt: "创建时间",
    updatedAt: "更新时间",
    timestamp: "时间戳",
    eventSummary: "事件摘要",
    day: "日期",
    weekStart: "周开始",
    weekEnd: "周结束",
    pointCount: "点位数",
    id: "ID",
    taskKey: "任务键",
    taskType: "任务类型",
    attempt: "尝试次数",
    maxAttempts: "最大尝试次数",
    targetValue: "目标值",
    context: "上下文",
    availableAt: "可执行时间",
    finishedAt: "完成时间",
    lastError: "最近错误",
    leaseOwner: "租约持有者",
    requestsPath: "申请路径",
    worldsPath: "世界路径",
    worldDetailPath: "世界详情路径",
    total: "总数",
    failed: "失败",
    pending: "待处理",
    running: "运行中",
    taskTypes: "任务类型",
    latestUpdatedAt: "最近更新时间",
    refreshWorldTarget: "刷新世界目标",
    focusPath: "聚焦路径",
    taskIds: "任务 ID",
    taskKeys: "任务键",
    targetValues: "目标值",

    Feedbacks: "意见反馈",
    "User-submitted reports": "用户提交的反馈",
    "User-submitted desktop and web feedback":
      "用户提交的桌面与 Web 反馈",
    "Review user-submitted desktop and web feedback, triage status, and assign handler notes.":
      "查看用户提交的桌面与 Web 反馈，流转状态并填写处理备注。",
    "Loading feedbacks...": "正在加载反馈…",
    "Failed to load feedbacks.": "加载反馈失败。",
    "No feedback matched the current filters.": "没有符合当前筛选条件的反馈。",
    "Search title, detail, owner, phone, email":
      "搜索标题、内容、世界主人、手机号、邮箱",
    "All statuses": "全部状态",
    "All priorities": "全部优先级",
    "All categories": "全部分类",
    "All sources": "全部来源",
    "High priority active": "未完结高优先级",
    Page: "第",
    entries: "条",
    Previous: "上一页",
    Next: "下一页",
    "Handler note": "处理备注",
    "Internal note for this feedback. Saved when you change status.":
      "针对该反馈的内部备注，切换状态时一并保存。",
    Detail: "问题描述",
    Reproduction: "复现步骤",
    Expected: "期望结果",
    "Diagnostic summary": "诊断摘要",
    Phone: "手机号",
    Email: "邮箱",
    Owner: "世界主人",
    "Owner signature": "世界主人签名",
    "App platform": "运行平台",
    "API base url": "实例地址",
    "Submitter IP": "提交方 IP",
    "User agent": "User-Agent",
    "Client record id": "客户端记录 ID",
    "Client submitted at": "客户端提交时间",
    "Created at": "创建时间",
    "Handled at": "处理时间",
    New: "待处理",
    "In progress": "处理中",
    Resolved: "已解决",
    Archived: "已归档",
    new: "待处理",
    in_progress: "处理中",
    resolved: "已解决",
    archived: "已归档",
    High: "高",
    Medium: "中",
    Low: "低",
    high: "高",
    medium: "中",
    low: "低",
    Bug: "功能异常",
    Interaction: "交互体验",
    Performance: "性能",
    Content: "内容口径",
    Feature: "能力建议",
    bug: "功能异常",
    interaction: "交互体验",
    performance: "性能",
    content: "内容口径",
    feature: "能力建议",
    Desktop: "桌面",
    Web: "Web",
    Mobile: "移动端",
    WeChat: "微信",
    desktop: "桌面",
    web: "Web",
    mobile: "移动端",
    wechat: "微信",
    "(no phone)": "（无手机号）",
    "Code:": "邀请码：",
    "Status:": "状态：",
    "IP:": "IP：",
    "Device:": "设备：",
    "Created at:": "创建时间：",
    "Reason:": "原因：",
    "Account:": "账号：",
    "Subscription:": "订阅：",
    "Current plan:": "当前套餐：",
    "Expires at:": "到期时间：",
    "Invite code:": "邀请码：",
    "World status:": "世界状态：",
    "World:": "世界：",
    Overview: "概览",
    Events: "事件",
    Funnel: "漏斗",
    "API health": "API 健康度",
    Errors: "错误",
    "Client telemetry, PV/UV, API health and frontend errors.":
      "客户端埋点上报、PV/UV、API 健康度与前端错误。",
    "Page views (by app)": "页面浏览（按端分组）",
    "Failed to load overview": "加载概览失败",
    "Failed to load line chart": "加载折线失败",
    "Failed to load events": "加载事件失败",
    "Failed to load funnel": "加载漏斗失败",
    "Failed to load API health": "加载 API 健康度失败",
    "Failed to load error list": "加载错误列表失败",
    "Page views PV": "页面浏览 PV",
    "Unique visitors UV": "独立访客 UV",
    Sessions: "会话数",
    "Frontend errors": "前端错误",
    "Average session duration": "平均会话时长",
    "24 hours": "24 小时",
    "7 days": "7 天",
    "30 days": "30 天",
    "All apps": "全部端",
    "Comma-separated event names (in order)": "逗号分隔的事件名（按顺序）",
    "Apply funnel": "应用漏斗",
    "Funnel is empty. Please enter steps first.": "漏斗为空。请先输入步骤。",
    "No events in the current range.": "当前范围内无事件。",
    "No API telemetry in the current range.": "当前范围内无 API 调用埋点。",
    "No error events in the current range.": "当前范围内无错误事件。",
    "Collapse stack": "收起堆栈",
    "Expand stack": "展开堆栈",
    Start: "起点",
    Telemetry: "遥测",
    Path: "路径",
    Calls: "调用次数",
    Success: "成功率",
    p50: "p50",
    p95: "p95",
    Event: "事件",
    Type: "类型",
    Count: "数量",
    "Unique users": "独立用户",
    "Unique anons": "独立匿名",

    Confirm: "确认",
    Cancel: "取消",
    Close: "关闭",
    "Working...": "处理中…",
    Unleased: "未持有租约",
    "Delayed jobs in filter": "当前筛选的延期任务",
    "Inspect provisioning, resume, suspend, and reconcile work for the selected world.":
      "查看所选世界的开通、恢复、暂停与对账工作。",
    "Inspect provisioning, resume, suspend, and reconcile work across the managed world fleet.":
      "查看托管世界全队的开通、恢复、暂停与对账工作。",
    "Existing bootstrap packages and runtime env overlays will become stale until operators redeploy the updated token.":
      "已有的引导包与运行时环境覆盖层会失效，需要运维重新下发新令牌后才会同步。",
    "Rotate token": "轮换令牌",
    "Rotating...": "轮换中…",
    "System ready": "系统正常",
    "System warning": "系统告警",

    App: "应用",
    Site: "站点",
    Wiki: "Wiki",
    "queue: all": "队列：全部",
    "queue: running": "队列：运行中",
    "queue: lease expired": "队列：租约过期",
    "queue: delayed": "队列：延迟",
    "Lease expired": "租约过期",
    Delayed: "延迟",
    Other: "其他",
    "Session id, IP, client, revoker": "会话 ID、IP、客户端、撤销人",
    "Waiting sync status": "等待同步状态",
    "Waiting sync task type": "等待同步任务类型",
    "Waiting sync search": "等待同步搜索",
    "task key, target, context, or error": "任务键、目标、上下文或错误",
    "Waiting sync page size": "等待同步分页大小",
    "Context task review": "上下文任务复核",
    "Recent task receipts": "最近任务回执",

    "Admin sessions": "管理员会话",
    "Review live admin sessions, inspect where they were issued from, filter by revocation path, and page through longer audit history.":
      "查看实时的管理员会话、签发来源、按撤销路径筛选，并翻阅更长的审计历史。",
    "Source groups": "来源分组",
    "Aggregate sessions by issue IP and client under the current filters, then revoke an entire source in one action.":
      "在当前筛选条件下按签发 IP 与客户端聚合会话，并可一键撤销整个来源。",
    "Risk timeline": "风险时间线",
    "Derived from session issue, expiry, and revoke events inside the focused source group under the current filters.":
      "依据当前筛选下聚焦来源分组的会话签发、过期与撤销事件计算得出。",
    "Current rationale": "当前判定依据",
    "Select all active admin sessions": "选中全部活跃的管理员会话",
    "Recent operation receipts": "最近操作回执",
    "Revoke admin session?": "撤销管理员会话？",
    "Revoke selected admin sessions?": "撤销所选的管理员会话？",
    "Revoke all matching admin sessions?": "撤销全部匹配的管理员会话？",
    "Revoke matching risk groups?": "撤销匹配的风险分组？",
    "Revoke source group?": "撤销来源分组？",

    Search: "搜索",
    Revocation: "吊销",
    Scope: "范围",
    "Sort by": "排序字段",
    Direction: "方向",
    "Page size": "每页条数",
    "Source sort": "来源排序",
    "Source direction": "来源方向",
    "Source risk": "来源风险",
    "Source page size": "来源每页条数",
    "All risk": "全部风险",
    "Critical risk": "严重风险",
    "Watch risk": "观察风险",
    "Normal risk": "正常风险",
    Reset: "重置",
    "Request id": "请求 ID",
    "{0} per page": "每页 {0} 条",
    "Focused context": "聚焦上下文",
    "Focused target": "聚焦目标",
    "Artifact summary": "产物摘要",
    API: "API",
  },
  "ja-JP": {
    "CLOUD_ADMIN_SECRET is required.": "CLOUD_ADMIN_SECRET を入力してください。",
    "CLOUD_ADMIN_SECRET is invalid.": "CLOUD_ADMIN_SECRET が無効です。",
    "Cloud admin session is invalid or expired.":
      "クラウド管理セッションが無効、または期限切れです。",
    "Cloud admin token exchange returned an empty response.":
      "クラウド管理トークン交換が空のレスポンスを返しました。",
    "Cloud admin refresh returned an empty response.":
      "クラウド管理セッション更新が空のレスポンスを返しました。",
    "Cloud admin request failed.": "クラウド管理リクエストに失敗しました。",
    "Network request failed.": "ネットワークリクエストに失敗しました。",
    "Cloud admin API error": "クラウド管理 API エラー",
    "Unknown admin sessions error.": "不明な管理セッションエラーです。",
    "Clipboard copy failed in this environment.":
      "この環境ではクリップボードへコピーできません。",

    "Downloaded admin session audit snapshot for":
      "管理セッション監査スナップショットをダウンロードしました:",
    "Downloaded focused source snapshot for":
      "フォーカス元スナップショットをダウンロードしました:",
    "Downloaded risk snapshot for":
      "リスクスナップショットをダウンロードしました:",
    "Downloaded risk groups CSV for":
      "リスクグループ CSV をダウンロードしました:",
    "Downloaded risk sessions CSV for":
      "リスクセッション CSV をダウンロードしました:",
    "Downloaded risk timeline CSV for":
      "リスクタイムライン CSV をダウンロードしました:",
    "Downloaded daily risk timeline CSV for":
      "日次リスクタイムライン CSV をダウンロードしました:",
    "Downloaded weekly risk timeline CSV for":
      "週次リスクタイムライン CSV をダウンロードしました:",
    "Admin session audit snapshot is ready, but this browser could not start the download.":
      "管理セッション監査スナップショットは準備できていますが、このブラウザではダウンロードを開始できません。",
    "Focused source snapshot is ready, but this browser could not start the download.":
      "フォーカス元スナップショットは準備できていますが、このブラウザではダウンロードを開始できません。",
    "Risk snapshot is ready, but this browser could not start the download.":
      "リスクスナップショットは準備できていますが、このブラウザではダウンロードを開始できません。",
    "Risk groups CSV is ready, but this browser could not start the download.":
      "リスクグループ CSV は準備できていますが、このブラウザではダウンロードを開始できません。",
    "Risk sessions CSV is ready, but this browser could not start the download.":
      "リスクセッション CSV は準備できていますが、このブラウザではダウンロードを開始できません。",
    "Risk timeline CSV is ready, but this browser could not start the download.":
      "リスクタイムライン CSV は準備できていますが、このブラウザではダウンロードを開始できません。",
    "Focused source snapshot is not available.":
      "フォーカス元スナップショットは利用できません。",
    "Risk timeline data is not ready for export yet.":
      "リスクタイムラインデータはまだエクスポートできません。",

    "Waiting sync task replay queued.": "待機同期タスクの再実行をキューに追加しました。",
    "Waiting sync task replay was skipped.":
      "待機同期タスクの再実行はスキップされました。",
    "Waiting sync task cleared.": "待機同期タスクをクリアしました。",
    "Waiting sync task clear was skipped.":
      "待機同期タスクのクリアはスキップされました。",
    "No matching failed waiting sync tasks to replay.":
      "再実行できる一致した失敗待機同期タスクはありません。",
    "No matching failed waiting sync tasks to clear.":
      "クリアできる一致した失敗待機同期タスクはありません。",
    "Waiting sync context CSV download failed.":
      "待機同期コンテキスト CSV のダウンロードに失敗しました。",
    "Waiting sync focus CSV download failed.":
      "待機同期フォーカス CSV のダウンロードに失敗しました。",
    "Waiting sync CSV download failed.":
      "待機同期 CSV のダウンロードに失敗しました。",
    "Waiting sync context snapshot download failed.":
      "待機同期コンテキストスナップショットのダウンロードに失敗しました。",
    "Waiting sync focus snapshot download failed.":
      "待機同期フォーカススナップショットのダウンロードに失敗しました。",
    "Waiting sync snapshot download failed.":
      "待機同期スナップショットのダウンロードに失敗しました。",
    "Waiting sync context groups CSV download failed.":
      "待機同期コンテキストグループ CSV のダウンロードに失敗しました。",
    "Waiting sync context groups snapshot download failed.":
      "待機同期コンテキストグループスナップショットのダウンロードに失敗しました。",
    "Waiting sync permalink copied.": "待機同期の固定リンクをコピーしました。",
    "Waiting sync review context copied.":
      "待機同期のレビューコンテキストをコピーしました。",
    "Waiting sync task context copied.":
      "待機同期タスクのコンテキストをコピーしました。",
    "Waiting sync permalink copy failed.":
      "待機同期の固定リンクをコピーできませんでした。",
    "Waiting sync review context copy failed.":
      "待機同期のレビューコンテキストをコピーできませんでした。",
    "Waiting sync task context copy failed.":
      "待機同期タスクのコンテキストをコピーできませんでした。",

    "Switch status to All or Failed before running batch failed-task actions.":
      "失敗タスクの一括操作を実行する前に、ステータスを All または Failed に切り替えてください。",
    "All failed tasks across every page.": "全ページのすべての失敗タスク。",
    "Focus snapshot appears when the current query exactly matches a visible context or target.":
      "現在の検索が表示中のコンテキストまたはターゲットに完全一致すると、フォーカススナップショットが表示されます。",
    "Add a context or target query to export a tighter investigation snapshot.":
      "より絞り込んだ調査スナップショットを出力するには、コンテキストまたはターゲット検索を入力してください。",

    "Refresh world": "ワールド更新",
    "Refresh phone": "電話番号更新",
    "Invalidate phone": "電話番号無効化",
    Failed: "失敗",
    Pending: "保留中",
    Running: "実行中",
    "Not available": "利用不可",
    None: "なし",
    All: "すべて",
    "Task key": "タスクキー",
    "Task type": "タスクタイプ",
    Status: "ステータス",
    Target: "ターゲット",
    Context: "コンテキスト",
    Attempt: "試行",
    Available: "実行可能時刻",
    Updated: "更新日時",
    Finished: "完了日時",
    "Lease owner": "リース所有者",
    "Last error": "最新エラー",
    "Review permalink": "レビュー固定リンク",
    "Requests path": "申請パス",
    "Worlds path": "ワールドパス",
    "World detail": "ワールド詳細",
    "Visible tasks": "表示タスク",
    "Task types": "タスクタイプ",
    "Latest update": "最新更新",
    "Focus path": "フォーカスパス",
    "Task ids": "タスク ID",
    "Task keys": "タスクキー",
    "Target values": "ターゲット値",
    "Waiting sync task action failed.":
      "待機同期タスク操作に失敗しました。",
    "Admin sessions permalink copied.":
      "管理セッションの固定リンクをコピーしました。",
    sourceKey: "ソースキー",
    riskLevel: "リスクレベル",
    riskSignals: "リスクシグナル",
    issuedFromIp: "発行元 IP",
    issuedUserAgent: "発行元クライアント",
    totalSessions: "総セッション数",
    activeSessions: "アクティブセッション数",
    expiredSessions: "期限切れセッション数",
    revokedSessions: "取り消し済みセッション数",
    refreshTokenReuseRevocations: "更新トークン再利用取り消し数",
    currentSessions: "現在のセッション数",
    latestCreatedAt: "最新作成日時",
    latestLastUsedAt: "最新使用日時",
    latestRevokedAt: "最新取り消し日時",
    sessionId: "セッション ID",
    status: "ステータス",
    isCurrent: "現在のセッション",
    expiresAt: "期限日時",
    lastUsedAt: "最終使用日時",
    lastUsedIp: "最終使用 IP",
    lastUsedUserAgent: "最終使用クライアント",
    lastRefreshedAt: "最終更新日時",
    revokedAt: "取り消し日時",
    revokedBySessionId: "取り消し元セッション ID",
    revocationReason: "取り消し理由",
    createdAt: "作成日時",
    updatedAt: "更新日時",
    timestamp: "タイムスタンプ",
    eventSummary: "イベント概要",
    day: "日付",
    weekStart: "週開始",
    weekEnd: "週終了",
    pointCount: "ポイント数",
    id: "ID",
    taskKey: "タスクキー",
    taskType: "タスクタイプ",
    attempt: "試行",
    maxAttempts: "最大試行回数",
    targetValue: "ターゲット値",
    context: "コンテキスト",
    availableAt: "実行可能時刻",
    finishedAt: "完了日時",
    lastError: "最新エラー",
    leaseOwner: "リース所有者",
    requestsPath: "申請パス",
    worldsPath: "ワールドパス",
    worldDetailPath: "ワールド詳細パス",
    total: "合計",
    failed: "失敗",
    pending: "保留中",
    running: "実行中",
    taskTypes: "タスクタイプ",
    latestUpdatedAt: "最新更新日時",
    refreshWorldTarget: "ワールド更新ターゲット",
    focusPath: "フォーカスパス",
    taskIds: "タスク ID",
    taskKeys: "タスクキー",
    targetValues: "ターゲット値",

    Feedbacks: "フィードバック",
    "User-submitted reports": "ユーザーから寄せられた報告",
    "User-submitted desktop and web feedback":
      "ユーザーから寄せられたデスクトップ／Web のフィードバック",
    "Review user-submitted desktop and web feedback, triage status, and assign handler notes.":
      "デスクトップと Web のユーザーフィードバックを確認し、ステータスを切り替え、対応メモを残します。",
    "Loading feedbacks...": "フィードバックを読み込み中…",
    "Failed to load feedbacks.": "フィードバックの読み込みに失敗しました。",
    "No feedback matched the current filters.":
      "現在のフィルタに該当するフィードバックはありません。",
    "Search title, detail, owner, phone, email":
      "タイトル、本文、ワールドオーナー、電話番号、メールで検索",
    "All statuses": "すべての状態",
    "All priorities": "すべての優先度",
    "All categories": "すべてのカテゴリ",
    "All sources": "すべてのソース",
    "High priority active": "未完了の高優先度",
    Page: "ページ",
    entries: "件",
    Previous: "前へ",
    Next: "次へ",
    "Handler note": "対応メモ",
    "Internal note for this feedback. Saved when you change status.":
      "このフィードバックに対する社内メモ。ステータス変更時に保存されます。",
    Detail: "詳細",
    Reproduction: "再現手順",
    Expected: "期待結果",
    "Diagnostic summary": "診断サマリ",
    Phone: "電話番号",
    Email: "メール",
    Owner: "ワールドオーナー",
    "Owner signature": "オーナーの署名",
    "App platform": "実行プラットフォーム",
    "API base url": "API ベース URL",
    "Submitter IP": "送信者 IP",
    "User agent": "User-Agent",
    "Client record id": "クライアント記録 ID",
    "Client submitted at": "クライアント送信時刻",
    "Created at": "作成日時",
    "Handled at": "対応日時",
    New: "新規",
    "In progress": "対応中",
    Resolved: "解決済み",
    Archived: "アーカイブ済み",
    new: "新規",
    in_progress: "対応中",
    resolved: "解決済み",
    archived: "アーカイブ済み",
    High: "高",
    Medium: "中",
    Low: "低",
    high: "高",
    medium: "中",
    low: "低",
    Bug: "不具合",
    Interaction: "操作性",
    Performance: "パフォーマンス",
    Content: "表現整合",
    Feature: "機能要望",
    bug: "不具合",
    interaction: "操作性",
    performance: "パフォーマンス",
    content: "表現整合",
    feature: "機能要望",
    Desktop: "デスクトップ",
    Web: "Web",
    Mobile: "モバイル",
    WeChat: "WeChat",
    desktop: "デスクトップ",
    web: "Web",
    mobile: "モバイル",
    wechat: "WeChat",
    "(no phone)": "（電話番号なし）",
    "Code:": "招待コード:",
    "Status:": "ステータス:",
    "IP:": "IP:",
    "Device:": "デバイス:",
    "Created at:": "作成日時:",
    "Reason:": "理由:",
    "Account:": "アカウント:",
    "Subscription:": "サブスクリプション:",
    "Current plan:": "現在のプラン:",
    "Expires at:": "有効期限:",
    "Invite code:": "招待コード:",
    "World status:": "ワールドステータス:",
    "World:": "ワールド:",
    Overview: "概要",
    Events: "イベント",
    Funnel: "ファネル",
    "API health": "API ヘルス",
    Errors: "エラー",
    "Client telemetry, PV/UV, API health and frontend errors.":
      "クライアント計測（PV/UV）、API ヘルス、フロントエンドエラー。",
    "Page views (by app)": "ページビュー（アプリ別）",
    "Failed to load overview": "概要の読み込みに失敗しました",
    "Failed to load line chart": "折れ線グラフの読み込みに失敗しました",
    "Failed to load events": "イベントの読み込みに失敗しました",
    "Failed to load funnel": "ファネルの読み込みに失敗しました",
    "Failed to load API health": "API ヘルスの読み込みに失敗しました",
    "Failed to load error list": "エラー一覧の読み込みに失敗しました",
    "Page views PV": "ページビュー PV",
    "Unique visitors UV": "ユニークビジター UV",
    Sessions: "セッション数",
    "Frontend errors": "フロントエンドエラー",
    "Average session duration": "平均セッション時間",
    "24 hours": "24 時間",
    "7 days": "7 日間",
    "30 days": "30 日間",
    "All apps": "すべてのアプリ",
    "Comma-separated event names (in order)":
      "カンマ区切りのイベント名（順番通り）",
    "Apply funnel": "ファネルを適用",
    "Funnel is empty. Please enter steps first.":
      "ファネルが空です。先にステップを入力してください。",
    "No events in the current range.": "現在の範囲にイベントがありません。",
    "No API telemetry in the current range.":
      "現在の範囲に API 計測がありません。",
    "No error events in the current range.":
      "現在の範囲にエラーイベントがありません。",
    "Collapse stack": "スタックを折りたたむ",
    "Expand stack": "スタックを展開",
    Start: "起点",
    Telemetry: "テレメトリ",
    Path: "パス",
    Calls: "呼び出し数",
    Success: "成功率",
    p50: "p50",
    p95: "p95",
    Event: "イベント",
    Type: "タイプ",
    Count: "件数",
    "Unique users": "ユニークユーザー",
    "Unique anons": "ユニーク匿名",

    Confirm: "確認",
    Cancel: "キャンセル",
    Close: "閉じる",
    "Working...": "処理中…",
    Unleased: "リース未取得",
    "Delayed jobs in filter": "現在のフィルターで遅延中のジョブ",
    "Inspect provisioning, resume, suspend, and reconcile work for the selected world.":
      "選択したワールドのプロビジョニング・再開・一時停止・整合性確認を確認します。",
    "Inspect provisioning, resume, suspend, and reconcile work across the managed world fleet.":
      "管理対象ワールド全体のプロビジョニング・再開・一時停止・整合性確認を確認します。",
    "Existing bootstrap packages and runtime env overlays will become stale until operators redeploy the updated token.":
      "既存のブートストラップパッケージとランタイム環境のオーバーレイは、運用担当者が更新後のトークンを再デプロイするまで古い状態のままになります。",
    "Rotate token": "トークンをローテーション",
    "Rotating...": "ローテーション中…",
    "System ready": "システム正常",
    "System warning": "システム警告",

    App: "アプリ",
    Site: "サイト",
    Wiki: "Wiki",
    "queue: all": "キュー：すべて",
    "queue: running": "キュー：実行中",
    "queue: lease expired": "キュー：リース期限切れ",
    "queue: delayed": "キュー：遅延",
    "Lease expired": "リース期限切れ",
    Delayed: "遅延",
    Other: "その他",
    "Session id, IP, client, revoker":
      "セッション ID、IP、クライアント、取り消し者",
    "Waiting sync status": "待機同期ステータス",
    "Waiting sync task type": "待機同期タスク種別",
    "Waiting sync search": "待機同期検索",
    "task key, target, context, or error":
      "タスクキー、対象、コンテキスト、またはエラー",
    "Waiting sync page size": "待機同期ページサイズ",
    "Context task review": "コンテキストタスクレビュー",
    "Recent task receipts": "最近のタスク受領",

    "Admin sessions": "管理者セッション",
    "Review live admin sessions, inspect where they were issued from, filter by revocation path, and page through longer audit history.":
      "稼働中の管理者セッションを確認し、発行元を調べ、取り消し経路でフィルタリングし、より長い監査履歴をページングできます。",
    "Source groups": "発行元グループ",
    "Aggregate sessions by issue IP and client under the current filters, then revoke an entire source in one action.":
      "現在のフィルター条件で発行 IP とクライアント単位にセッションを集計し、一括で発行元全体を取り消せます。",
    "Risk timeline": "リスクタイムライン",
    "Derived from session issue, expiry, and revoke events inside the focused source group under the current filters.":
      "現在のフィルター条件で注目している発行元グループ内のセッション発行・期限・取り消しイベントから算出します。",
    "Current rationale": "現在の判定根拠",
    "Select all active admin sessions": "稼働中の管理者セッションをすべて選択",
    "Recent operation receipts": "最近の操作受領",
    "Revoke admin session?": "管理者セッションを取り消しますか？",
    "Revoke selected admin sessions?":
      "選択した管理者セッションを取り消しますか？",
    "Revoke all matching admin sessions?":
      "条件に一致する管理者セッションをすべて取り消しますか？",
    "Revoke matching risk groups?":
      "条件に一致するリスクグループを取り消しますか？",
    "Revoke source group?": "発行元グループを取り消しますか？",

    Search: "検索",
    Revocation: "取り消し",
    Scope: "スコープ",
    "Sort by": "ソートキー",
    Direction: "並び順",
    "Page size": "ページあたりの件数",
    "Source sort": "ソース並び替え",
    "Source direction": "ソース並び順",
    "Source risk": "ソースリスク",
    "Source page size": "ソースのページ件数",
    "All risk": "全リスク",
    "Critical risk": "重大リスク",
    "Watch risk": "監視リスク",
    "Normal risk": "通常リスク",
    Reset: "リセット",
    "Request id": "リクエスト ID",
    "{0} per page": "1 ページあたり {0} 件",
    "Focused context": "フォーカスしたコンテキスト",
    "Focused target": "フォーカスしたターゲット",
    "Artifact summary": "アーティファクトサマリー",
    API: "API",
  },
  "ko-KR": {
    "CLOUD_ADMIN_SECRET is required.": "CLOUD_ADMIN_SECRET을 입력하세요.",
    "CLOUD_ADMIN_SECRET is invalid.": "CLOUD_ADMIN_SECRET이 올바르지 않습니다.",
    "Cloud admin session is invalid or expired.":
      "클라우드 관리자 세션이 유효하지 않거나 만료되었습니다.",
    "Cloud admin token exchange returned an empty response.":
      "클라우드 관리자 토큰 교환이 빈 응답을 반환했습니다.",
    "Cloud admin refresh returned an empty response.":
      "클라우드 관리자 세션 갱신이 빈 응답을 반환했습니다.",
    "Cloud admin request failed.": "클라우드 관리자 요청에 실패했습니다.",
    "Network request failed.": "네트워크 요청에 실패했습니다.",
    "Cloud admin API error": "클라우드 관리자 API 오류",
    "Unknown admin sessions error.": "알 수 없는 관리자 세션 오류입니다.",
    "Clipboard copy failed in this environment.":
      "현재 환경에서는 클립보드에 복사할 수 없습니다.",

    "Downloaded admin session audit snapshot for":
      "관리자 세션 감사 스냅샷을 다운로드했습니다:",
    "Downloaded focused source snapshot for":
      "포커스 소스 스냅샷을 다운로드했습니다:",
    "Downloaded risk snapshot for": "위험 스냅샷을 다운로드했습니다:",
    "Downloaded risk groups CSV for": "위험 그룹 CSV를 다운로드했습니다:",
    "Downloaded risk sessions CSV for": "위험 세션 CSV를 다운로드했습니다:",
    "Downloaded risk timeline CSV for": "위험 타임라인 CSV를 다운로드했습니다:",
    "Downloaded daily risk timeline CSV for":
      "일별 위험 타임라인 CSV를 다운로드했습니다:",
    "Downloaded weekly risk timeline CSV for":
      "주별 위험 타임라인 CSV를 다운로드했습니다:",
    "Admin session audit snapshot is ready, but this browser could not start the download.":
      "관리자 세션 감사 스냅샷은 준비되었지만 이 브라우저에서 다운로드를 시작할 수 없습니다.",
    "Focused source snapshot is ready, but this browser could not start the download.":
      "포커스 소스 스냅샷은 준비되었지만 이 브라우저에서 다운로드를 시작할 수 없습니다.",
    "Risk snapshot is ready, but this browser could not start the download.":
      "위험 스냅샷은 준비되었지만 이 브라우저에서 다운로드를 시작할 수 없습니다.",
    "Risk groups CSV is ready, but this browser could not start the download.":
      "위험 그룹 CSV는 준비되었지만 이 브라우저에서 다운로드를 시작할 수 없습니다.",
    "Risk sessions CSV is ready, but this browser could not start the download.":
      "위험 세션 CSV는 준비되었지만 이 브라우저에서 다운로드를 시작할 수 없습니다.",
    "Risk timeline CSV is ready, but this browser could not start the download.":
      "위험 타임라인 CSV는 준비되었지만 이 브라우저에서 다운로드를 시작할 수 없습니다.",
    "Focused source snapshot is not available.":
      "포커스 소스 스냅샷을 사용할 수 없습니다.",
    "Risk timeline data is not ready for export yet.":
      "위험 타임라인 데이터를 아직 내보낼 수 없습니다.",

    "Waiting sync task replay queued.": "대기 동기화 작업 재실행이 큐에 등록되었습니다.",
    "Waiting sync task replay was skipped.":
      "대기 동기화 작업 재실행을 건너뛰었습니다.",
    "Waiting sync task cleared.": "대기 동기화 작업을 정리했습니다.",
    "Waiting sync task clear was skipped.":
      "대기 동기화 작업 정리를 건너뛰었습니다.",
    "No matching failed waiting sync tasks to replay.":
      "재실행할 일치하는 실패 대기 동기화 작업이 없습니다.",
    "No matching failed waiting sync tasks to clear.":
      "정리할 일치하는 실패 대기 동기화 작업이 없습니다.",
    "Waiting sync context CSV download failed.":
      "대기 동기화 컨텍스트 CSV 다운로드에 실패했습니다.",
    "Waiting sync focus CSV download failed.":
      "대기 동기화 포커스 CSV 다운로드에 실패했습니다.",
    "Waiting sync CSV download failed.":
      "대기 동기화 CSV 다운로드에 실패했습니다.",
    "Waiting sync context snapshot download failed.":
      "대기 동기화 컨텍스트 스냅샷 다운로드에 실패했습니다.",
    "Waiting sync focus snapshot download failed.":
      "대기 동기화 포커스 스냅샷 다운로드에 실패했습니다.",
    "Waiting sync snapshot download failed.":
      "대기 동기화 스냅샷 다운로드에 실패했습니다.",
    "Waiting sync context groups CSV download failed.":
      "대기 동기화 컨텍스트 그룹 CSV 다운로드에 실패했습니다.",
    "Waiting sync context groups snapshot download failed.":
      "대기 동기화 컨텍스트 그룹 스냅샷 다운로드에 실패했습니다.",
    "Waiting sync permalink copied.": "대기 동기화 고정 링크를 복사했습니다.",
    "Waiting sync review context copied.":
      "대기 동기화 검토 컨텍스트를 복사했습니다.",
    "Waiting sync task context copied.":
      "대기 동기화 작업 컨텍스트를 복사했습니다.",
    "Waiting sync permalink copy failed.":
      "대기 동기화 고정 링크 복사에 실패했습니다.",
    "Waiting sync review context copy failed.":
      "대기 동기화 검토 컨텍스트 복사에 실패했습니다.",
    "Waiting sync task context copy failed.":
      "대기 동기화 작업 컨텍스트 복사에 실패했습니다.",

    "Switch status to All or Failed before running batch failed-task actions.":
      "실패 작업 일괄 작업을 실행하기 전에 상태를 All 또는 Failed로 전환하세요.",
    "All failed tasks across every page.": "모든 페이지의 전체 실패 작업.",
    "Focus snapshot appears when the current query exactly matches a visible context or target.":
      "현재 검색어가 표시된 컨텍스트 또는 대상과 정확히 일치하면 포커스 스냅샷이 표시됩니다.",
    "Add a context or target query to export a tighter investigation snapshot.":
      "더 좁은 조사 스냅샷을 내보내려면 컨텍스트 또는 대상 검색어를 입력하세요.",

    "Refresh world": "월드 새로고침",
    "Refresh phone": "전화번호 새로고침",
    "Invalidate phone": "전화번호 무효화",
    Failed: "실패",
    Pending: "대기 중",
    Running: "실행 중",
    "Not available": "사용 불가",
    None: "없음",
    All: "전체",
    "Task key": "작업 키",
    "Task type": "작업 유형",
    Status: "상태",
    Target: "대상",
    Context: "컨텍스트",
    Attempt: "시도",
    Available: "실행 가능 시간",
    Updated: "업데이트 시간",
    Finished: "완료 시간",
    "Lease owner": "리스 소유자",
    "Last error": "최근 오류",
    "Review permalink": "검토 고정 링크",
    "Requests path": "요청 경로",
    "Worlds path": "월드 경로",
    "World detail": "월드 상세",
    "Visible tasks": "표시 작업",
    "Task types": "작업 유형",
    "Latest update": "최근 업데이트",
    "Focus path": "포커스 경로",
    "Task ids": "작업 ID",
    "Task keys": "작업 키",
    "Target values": "대상 값",
    "Waiting sync task action failed.":
      "대기 동기화 작업 동작에 실패했습니다.",
    "Admin sessions permalink copied.":
      "관리자 세션 고정 링크를 복사했습니다.",
    sourceKey: "소스 키",
    riskLevel: "위험 수준",
    riskSignals: "위험 신호",
    issuedFromIp: "발급 IP",
    issuedUserAgent: "발급 클라이언트",
    totalSessions: "전체 세션 수",
    activeSessions: "활성 세션 수",
    expiredSessions: "만료 세션 수",
    revokedSessions: "취소 세션 수",
    refreshTokenReuseRevocations: "갱신 토큰 재사용 취소 수",
    currentSessions: "현재 세션 수",
    latestCreatedAt: "최근 생성 시간",
    latestLastUsedAt: "최근 사용 시간",
    latestRevokedAt: "최근 취소 시간",
    sessionId: "세션 ID",
    status: "상태",
    isCurrent: "현재 세션 여부",
    expiresAt: "만료 시간",
    lastUsedAt: "최근 사용 시간",
    lastUsedIp: "최근 사용 IP",
    lastUsedUserAgent: "최근 사용 클라이언트",
    lastRefreshedAt: "최근 갱신 시간",
    revokedAt: "취소 시간",
    revokedBySessionId: "취소한 세션 ID",
    revocationReason: "취소 이유",
    createdAt: "생성 시간",
    updatedAt: "업데이트 시간",
    timestamp: "타임스탬프",
    eventSummary: "이벤트 요약",
    day: "날짜",
    weekStart: "주 시작",
    weekEnd: "주 종료",
    pointCount: "지점 수",
    id: "ID",
    taskKey: "작업 키",
    taskType: "작업 유형",
    attempt: "시도",
    maxAttempts: "최대 시도",
    targetValue: "대상 값",
    context: "컨텍스트",
    availableAt: "실행 가능 시간",
    finishedAt: "완료 시간",
    lastError: "최근 오류",
    leaseOwner: "리스 소유자",
    requestsPath: "요청 경로",
    worldsPath: "월드 경로",
    worldDetailPath: "월드 상세 경로",
    total: "전체",
    failed: "실패",
    pending: "대기 중",
    running: "실행 중",
    taskTypes: "작업 유형",
    latestUpdatedAt: "최근 업데이트 시간",
    refreshWorldTarget: "월드 새로고침 대상",
    focusPath: "포커스 경로",
    taskIds: "작업 ID",
    taskKeys: "작업 키",
    targetValues: "대상 값",

    Feedbacks: "피드백",
    "User-submitted reports": "사용자 제보",
    "User-submitted desktop and web feedback":
      "사용자가 제출한 데스크톱·웹 피드백",
    "Review user-submitted desktop and web feedback, triage status, and assign handler notes.":
      "데스크톱·웹 사용자 피드백을 확인하고 상태를 전환하며 처리 메모를 작성합니다.",
    "Loading feedbacks...": "피드백을 불러오는 중…",
    "Failed to load feedbacks.": "피드백을 불러오지 못했습니다.",
    "No feedback matched the current filters.":
      "현재 필터에 해당하는 피드백이 없습니다.",
    "Search title, detail, owner, phone, email":
      "제목·본문·월드 오너·전화번호·이메일 검색",
    "All statuses": "모든 상태",
    "All priorities": "모든 우선순위",
    "All categories": "모든 카테고리",
    "All sources": "모든 출처",
    "High priority active": "미완료 높은 우선순위",
    Page: "페이지",
    entries: "건",
    Previous: "이전",
    Next: "다음",
    "Handler note": "처리 메모",
    "Internal note for this feedback. Saved when you change status.":
      "이 피드백에 대한 내부 메모입니다. 상태 변경 시 함께 저장됩니다.",
    Detail: "상세 내용",
    Reproduction: "재현 절차",
    Expected: "기대 결과",
    "Diagnostic summary": "진단 요약",
    Phone: "전화번호",
    Email: "이메일",
    Owner: "월드 오너",
    "Owner signature": "오너 서명",
    "App platform": "실행 플랫폼",
    "API base url": "API 기본 URL",
    "Submitter IP": "제출자 IP",
    "User agent": "User-Agent",
    "Client record id": "클라이언트 기록 ID",
    "Client submitted at": "클라이언트 제출 시각",
    "Created at": "생성 시각",
    "Handled at": "처리 시각",
    New: "신규",
    "In progress": "처리 중",
    Resolved: "해결됨",
    Archived: "보관됨",
    new: "신규",
    in_progress: "처리 중",
    resolved: "해결됨",
    archived: "보관됨",
    High: "높음",
    Medium: "보통",
    Low: "낮음",
    high: "높음",
    medium: "보통",
    low: "낮음",
    Bug: "기능 결함",
    Interaction: "사용성",
    Performance: "성능",
    Content: "표현 정합성",
    Feature: "기능 제안",
    bug: "기능 결함",
    interaction: "사용성",
    performance: "성능",
    content: "표현 정합성",
    feature: "기능 제안",
    Desktop: "데스크톱",
    Web: "웹",
    Mobile: "모바일",
    WeChat: "WeChat",
    desktop: "데스크톱",
    web: "웹",
    mobile: "모바일",
    wechat: "WeChat",
    "(no phone)": "(전화번호 없음)",
    "Code:": "초대 코드:",
    "Status:": "상태:",
    "IP:": "IP:",
    "Device:": "디바이스:",
    "Created at:": "생성 시각:",
    "Reason:": "사유:",
    "Account:": "계정:",
    "Subscription:": "구독:",
    "Current plan:": "현재 요금제:",
    "Expires at:": "만료 시각:",
    "Invite code:": "초대 코드:",
    "World status:": "월드 상태:",
    "World:": "월드:",
    Overview: "개요",
    Events: "이벤트",
    Funnel: "퍼널",
    "API health": "API 상태",
    Errors: "오류",
    "Client telemetry, PV/UV, API health and frontend errors.":
      "클라이언트 텔레메트리(PV/UV), API 상태 및 프런트엔드 오류.",
    "Page views (by app)": "페이지 조회수(앱별)",
    "Failed to load overview": "개요를 불러오지 못했습니다",
    "Failed to load line chart": "라인 차트를 불러오지 못했습니다",
    "Failed to load events": "이벤트를 불러오지 못했습니다",
    "Failed to load funnel": "퍼널을 불러오지 못했습니다",
    "Failed to load API health": "API 상태를 불러오지 못했습니다",
    "Failed to load error list": "오류 목록을 불러오지 못했습니다",
    "Page views PV": "페이지 조회수 PV",
    "Unique visitors UV": "순방문자 UV",
    Sessions: "세션 수",
    "Frontend errors": "프런트엔드 오류",
    "Average session duration": "평균 세션 시간",
    "24 hours": "24시간",
    "7 days": "7일",
    "30 days": "30일",
    "All apps": "모든 앱",
    "Comma-separated event names (in order)":
      "쉼표로 구분된 이벤트 이름(순서대로)",
    "Apply funnel": "퍼널 적용",
    "Funnel is empty. Please enter steps first.":
      "퍼널이 비어 있습니다. 먼저 단계를 입력하세요.",
    "No events in the current range.": "현재 범위에 이벤트가 없습니다.",
    "No API telemetry in the current range.":
      "현재 범위에 API 텔레메트리가 없습니다.",
    "No error events in the current range.":
      "현재 범위에 오류 이벤트가 없습니다.",
    "Collapse stack": "스택 접기",
    "Expand stack": "스택 펼치기",
    Start: "시작점",
    Telemetry: "텔레메트리",
    Path: "경로",
    Calls: "호출 수",
    Success: "성공률",
    p50: "p50",
    p95: "p95",
    Event: "이벤트",
    Type: "유형",
    Count: "건수",
    "Unique users": "순 사용자",
    "Unique anons": "순 익명",

    Confirm: "확인",
    Cancel: "취소",
    Close: "닫기",
    "Working...": "처리 중…",
    Unleased: "리스 미보유",
    "Delayed jobs in filter": "현재 필터에서 지연된 작업",
    "Inspect provisioning, resume, suspend, and reconcile work for the selected world.":
      "선택한 월드의 프로비저닝, 재개, 일시 중지 및 정합성 작업을 확인하세요.",
    "Inspect provisioning, resume, suspend, and reconcile work across the managed world fleet.":
      "관리되는 월드 플릿 전체의 프로비저닝, 재개, 일시 중지 및 정합성 작업을 확인하세요.",
    "Existing bootstrap packages and runtime env overlays will become stale until operators redeploy the updated token.":
      "기존 부트스트랩 패키지와 런타임 환경 오버레이는 운영자가 새 토큰을 다시 배포하기 전까지 오래된 상태로 남습니다.",
    "Rotate token": "토큰 교체",
    "Rotating...": "교체 중…",
    "System ready": "시스템 정상",
    "System warning": "시스템 경고",

    App: "앱",
    Site: "사이트",
    Wiki: "Wiki",
    "queue: all": "큐: 전체",
    "queue: running": "큐: 실행 중",
    "queue: lease expired": "큐: 리스 만료",
    "queue: delayed": "큐: 지연",
    "Lease expired": "리스 만료",
    Delayed: "지연",
    Other: "기타",
    "Session id, IP, client, revoker":
      "세션 ID, IP, 클라이언트, 취소자",
    "Waiting sync status": "대기 동기화 상태",
    "Waiting sync task type": "대기 동기화 작업 유형",
    "Waiting sync search": "대기 동기화 검색",
    "task key, target, context, or error":
      "작업 키, 대상, 컨텍스트 또는 오류",
    "Waiting sync page size": "대기 동기화 페이지 크기",
    "Context task review": "컨텍스트 작업 검토",
    "Recent task receipts": "최근 작업 영수증",

    "Admin sessions": "관리자 세션",
    "Review live admin sessions, inspect where they were issued from, filter by revocation path, and page through longer audit history.":
      "활성 관리자 세션을 검토하고 발급 위치를 조사하며 취소 경로별로 필터링하고 더 긴 감사 이력을 페이지로 탐색합니다.",
    "Source groups": "발급 그룹",
    "Aggregate sessions by issue IP and client under the current filters, then revoke an entire source in one action.":
      "현재 필터에서 발급 IP와 클라이언트별로 세션을 집계하고 한 번의 동작으로 발급원 전체를 취소합니다.",
    "Risk timeline": "위험 타임라인",
    "Derived from session issue, expiry, and revoke events inside the focused source group under the current filters.":
      "현재 필터에서 주목 중인 발급 그룹 내의 세션 발급, 만료, 취소 이벤트에서 도출됩니다.",
    "Current rationale": "현재 근거",
    "Select all active admin sessions": "활성 관리자 세션 모두 선택",
    "Recent operation receipts": "최근 작업 영수증",
    "Revoke admin session?": "관리자 세션을 취소할까요?",
    "Revoke selected admin sessions?": "선택한 관리자 세션을 취소할까요?",
    "Revoke all matching admin sessions?":
      "일치하는 모든 관리자 세션을 취소할까요?",
    "Revoke matching risk groups?": "일치하는 위험 그룹을 취소할까요?",
    "Revoke source group?": "발급 그룹을 취소할까요?",

    Search: "검색",
    Revocation: "취소",
    Scope: "범위",
    "Sort by": "정렬 기준",
    Direction: "방향",
    "Page size": "페이지당 항목 수",
    "Source sort": "출처 정렬",
    "Source direction": "출처 방향",
    "Source risk": "출처 위험도",
    "Source page size": "출처 페이지 항목 수",
    "All risk": "전체 위험도",
    "Critical risk": "심각 위험",
    "Watch risk": "관찰 위험",
    "Normal risk": "일반 위험",
    Reset: "초기화",
    "Request id": "요청 ID",
    "{0} per page": "페이지당 {0}개",
    "Focused context": "집중된 컨텍스트",
    "Focused target": "집중된 대상",
    "Artifact summary": "아티팩트 요약",
    API: "API",
  },
};
// i18n-ignore-end

export function getCurrentCloudConsoleLocale() {
  return getActiveLocale();
}

export function resolveCloudConsoleLocale(
  locale?: string | null,
  fallback: CloudConsoleLocale = CLOUD_CONSOLE_ENGLISH_LOCALE,
): CloudConsoleLocale {
  return resolveSupportedLocale(locale) ?? fallback;
}

export function translateCloudConsoleText(
  value: string,
  locale?: string | null,
) {
  const resolvedLocale = resolveCloudConsoleLocale(locale);
  if (resolvedLocale === CLOUD_CONSOLE_ENGLISH_LOCALE) {
    return value;
  }

  return (
    cloudConsoleRuntimeText[resolvedLocale]?.[value] ??
    getSurfaceTextDictionary("cloud-console", resolvedLocale).get(value) ??
    value
  );
}

export function translateCloudConsoleTextForActiveLocale(value: string) {
  return translateCloudConsoleText(value, getCurrentCloudConsoleLocale());
}

export function useCloudConsoleText() {
  const { locale } = useAppLocale();
  return useCallback(
    (value: string) => translateCloudConsoleText(value, locale),
    [locale],
  );
}

export function selectCloudConsoleText(
  locale: string | null | undefined,
  messages: LocalizedTextSet,
) {
  return messages[resolveCloudConsoleLocale(locale)] ?? messages["en-US"];
}

export function translateCloudConsoleCsvRow(
  row: readonly string[],
  locale?: string | null,
) {
  return row.map((value) => translateCloudConsoleText(value, locale));
}

// i18n-ignore-start: Dynamic formatter variants are localized at runtime.
export function formatCloudConsoleUnableToReachApiMessage({
  apiBase,
  detail,
  locale,
}: {
  apiBase: string;
  detail: string;
  locale?: string | null;
}) {
  return selectCloudConsoleText(locale, {
    "en-US": `Unable to reach the cloud admin API at ${apiBase}. ${detail}`,
    "zh-CN": `无法连接云世界管理 API（${apiBase}）。${detail}`,
    "ja-JP": `クラウド管理 API（${apiBase}）に接続できません。${detail}`,
    "ko-KR": `클라우드 관리자 API(${apiBase})에 연결할 수 없습니다. ${detail}`,
  });
}

export function formatCloudConsoleApiStatusError(
  status: number,
  locale?: string | null,
) {
  return selectCloudConsoleText(locale, {
    "en-US": `Cloud admin API error ${status}`,
    "zh-CN": `云世界管理 API 错误 ${status}`,
    "ja-JP": `クラウド管理 API エラー ${status}`,
    "ko-KR": `클라우드 관리자 API 오류 ${status}`,
  });
}

export function formatCloudConsolePageOfTotal(
  page: number,
  totalPages: number,
  locale?: string | null,
) {
  return selectCloudConsoleText(locale, {
    "en-US": `Page ${page} / ${totalPages}`,
    "zh-CN": `第 ${page} 页 / 共 ${totalPages} 页`,
    "ja-JP": `${page} / ${totalPages} ページ`,
    "ko-KR": `${page} / ${totalPages} 페이지`,
  });
}

export function formatCloudConsoleVisibleSessionsRange(
  start: number,
  end: number,
  total: number,
  locale?: string | null,
) {
  if (total === 0 || end < start) {
    return selectCloudConsoleText(locale, {
      "en-US": "Showing 0 sessions",
      "zh-CN": "暂无会话",
      "ja-JP": "セッションなし",
      "ko-KR": "세션 없음",
    });
  }
  return selectCloudConsoleText(locale, {
    "en-US": `Showing ${start}-${end} of ${total}`,
    "zh-CN": `显示第 ${start}-${end} 条，共 ${total} 条`,
    "ja-JP": `${start}-${end} / ${total} 件を表示`,
    "ko-KR": `${start}-${end} / 총 ${total}건 표시`,
  });
}

export function formatCloudConsoleVisibleGroupsRange(
  start: number,
  end: number,
  total: number,
  locale?: string | null,
) {
  if (total === 0 || end < start) {
    return selectCloudConsoleText(locale, {
      "en-US": "Showing 0 groups",
      "zh-CN": "暂无分组",
      "ja-JP": "グループなし",
      "ko-KR": "그룹 없음",
    });
  }
  return selectCloudConsoleText(locale, {
    "en-US": `Showing ${start}-${end} of ${total} groups`,
    "zh-CN": `显示第 ${start}-${end} 组，共 ${total} 组`,
    "ja-JP": `${start}-${end} / ${total} グループを表示`,
    "ko-KR": `${start}-${end} / 총 ${total}개 그룹 표시`,
  });
}

export function formatCloudConsoleVisibleJobsRange(
  start: number,
  end: number,
  total: number,
  locale?: string | null,
) {
  return selectCloudConsoleText(locale, {
    "en-US": `Showing ${start}-${end} of ${total} jobs.`,
    "zh-CN": `显示第 ${start}-${end} 项，共 ${total} 项任务。`,
    "ja-JP": `${start}-${end} / ${total} 件のジョブを表示`,
    "ko-KR": `${start}-${end} / 총 ${total}개 작업 표시`,
  });
}

export function formatCloudConsolePageSize(
  size: number,
  locale?: string | null,
) {
  return selectCloudConsoleText(locale, {
    "en-US": `page size: ${size}`,
    "zh-CN": `每页 ${size} 条`,
    "ja-JP": `1ページ ${size} 件`,
    "ko-KR": `페이지당 ${size}건`,
  });
}

export function formatCloudConsoleActiveVersion(
  version: number,
  locale?: string | null,
) {
  return selectCloudConsoleText(locale, {
    "en-US": `Active version ${version}`,
    "zh-CN": `当前版本 ${version}`,
    "ja-JP": `現行バージョン ${version}`,
    "ko-KR": `현재 버전 ${version}`,
  });
}

export function formatCloudConsoleVersionShort(
  version: number,
  locale?: string | null,
) {
  return selectCloudConsoleText(locale, {
    "en-US": `v${version}`,
    "zh-CN": `v${version}`,
    "ja-JP": `v${version}`,
    "ko-KR": `v${version}`,
  });
}

export function formatCloudConsolePayeeProfileCount(
  count: number,
  locale?: string | null,
) {
  return selectCloudConsoleText(locale, {
    "en-US": `${count} payee profiles`,
    "zh-CN": `${count} 个收益人档案`,
    "ja-JP": `${count} 件の受取人プロファイル`,
    "ko-KR": `${count}개 수취인 프로필`,
  });
}

export function formatCloudConsoleAllocationCount(
  count: number,
  locale?: string | null,
) {
  return selectCloudConsoleText(locale, {
    "en-US": `${count} allocations`,
    "zh-CN": `${count} 条分配记录`,
    "ja-JP": `${count} 件の割当`,
    "ko-KR": `${count}건 할당`,
  });
}

export function formatCloudConsoleSettlementGenerated(
  batchId: string,
  amount: string,
  locale?: string | null,
) {
  return selectCloudConsoleText(locale, {
    "en-US": `Settlement ${batchId} generated for ${amount}.`,
    "zh-CN": `已生成结算 ${batchId}，金额 ${amount}。`,
    "ja-JP": `決済 ${batchId} を金額 ${amount} で生成しました。`,
    "ko-KR": `정산 ${batchId}을(를) 금액 ${amount}(으)로 생성했습니다.`,
  });
}

export function formatCloudConsoleJobLeaseRemaining(
  duration: string,
  locale?: string | null,
) {
  return selectCloudConsoleText(locale, {
    "en-US": `remaining ${duration}`,
    "zh-CN": `剩余 ${duration}`,
    "ja-JP": `残り ${duration}`,
    "ko-KR": `남은 시간 ${duration}`,
  });
}

export function formatCloudConsoleJobLeaseExpires(
  date: string,
  locale?: string | null,
) {
  return selectCloudConsoleText(locale, {
    "en-US": `expires ${date}`,
    "zh-CN": `到期 ${date}`,
    "ja-JP": `期限 ${date}`,
    "ko-KR": `만료 ${date}`,
  });
}

export function formatCloudConsoleJobLeaseAvailable(
  date: string,
  locale?: string | null,
) {
  return selectCloudConsoleText(locale, {
    "en-US": `available ${date}`,
    "zh-CN": `可执行 ${date}`,
    "ja-JP": `実行可能 ${date}`,
    "ko-KR": `실행 가능 ${date}`,
  });
}

export function formatCloudConsoleProviderWorldsCount(
  count: number,
  locale?: string | null,
) {
  return selectCloudConsoleText(locale, {
    "en-US": `${count} worlds`,
    "zh-CN": `${count} 个世界`,
    "ja-JP": `${count} ワールド`,
    "ko-KR": `${count}개 월드`,
  });
}

export function formatCloudConsoleProviderRunningError(
  running: number,
  errorCount: number,
  locale?: string | null,
) {
  return selectCloudConsoleText(locale, {
    "en-US": `Running ${running} · Error ${errorCount}`,
    "zh-CN": `运行中 ${running} · 错误 ${errorCount}`,
    "ja-JP": `実行中 ${running} · エラー ${errorCount}`,
    "ko-KR": `실행 중 ${running} · 오류 ${errorCount}`,
  });
}

export function formatCloudConsoleLastGeneratedAt(
  date: string,
  locale?: string | null,
) {
  return selectCloudConsoleText(locale, {
    "en-US": `Last generated ${date}`,
    "zh-CN": `最近生成于 ${date}`,
    "ja-JP": `最終生成 ${date}`,
    "ko-KR": `최근 생성 ${date}`,
  });
}

export function formatCloudConsoleJobsGroupCount(
  count: number,
  locale?: string | null,
) {
  return selectCloudConsoleText(locale, {
    "en-US": `${count} jobs`,
    "zh-CN": `${count} 项任务`,
    "ja-JP": `${count} 件のジョブ`,
    "ko-KR": `${count}개 작업`,
  });
}

export function formatCloudConsoleProviderLeaseLabel(
  owner: string,
  locale?: string | null,
) {
  return selectCloudConsoleText(locale, {
    "en-US": `Lease ${owner}`,
    "zh-CN": `租约 ${owner}`,
    "ja-JP": `リース ${owner}`,
    "ko-KR": `리스 ${owner}`,
  });
}

export function formatCloudConsoleAvailableAtLine(
  date: string,
  locale?: string | null,
) {
  return selectCloudConsoleText(locale, {
    "en-US": `Available: ${date}`,
    "zh-CN": `可执行时间：${date}`,
    "ja-JP": `実行可能：${date}`,
    "ko-KR": `실행 가능: ${date}`,
  });
}

export function formatCloudConsoleUpdatedAtLine(
  date: string,
  locale?: string | null,
) {
  return selectCloudConsoleText(locale, {
    "en-US": `Updated: ${date}`,
    "zh-CN": `更新时间：${date}`,
    "ja-JP": `更新：${date}`,
    "ko-KR": `업데이트: ${date}`,
  });
}

export function formatCloudConsoleFinishedAtLine(
  date: string,
  locale?: string | null,
) {
  return selectCloudConsoleText(locale, {
    "en-US": `Finished: ${date}`,
    "zh-CN": `完成时间：${date}`,
    "ja-JP": `完了：${date}`,
    "ko-KR": `완료: ${date}`,
  });
}

export function formatCloudConsoleReceiptCountSummary(
  visible: number,
  limit: number,
  locale?: string | null,
) {
  return selectCloudConsoleText(locale, {
    "en-US": `Showing the latest ${visible} of up to ${limit} receipt(s) for this review task.`,
    "zh-CN": `正在显示该复核任务的最近 ${visible} / 共 ${limit} 条回执。`,
    "ja-JP": `このレビュータスクの最新 ${visible} / 最大 ${limit} 件の受領を表示中。`,
    "ko-KR": `이 검토 작업에 대해 최신 ${visible} / 최대 ${limit}개 영수증을 표시 중.`,
  });
}

export function formatCloudConsoleFunnelFromPrev(
  percent: string,
  locale?: string | null,
) {
  return selectCloudConsoleText(locale, {
    "en-US": `From previous step ${percent}%`,
    "zh-CN": `从上一步 ${percent}%`,
    "ja-JP": `前ステップから ${percent}%`,
    "ko-KR": `이전 단계에서 ${percent}%`,
  });
}

export function formatCloudConsoleFunnelOverall(
  percent: string,
  locale?: string | null,
) {
  return selectCloudConsoleText(locale, {
    "en-US": `Overall ${percent}%`,
    "zh-CN": `整体 ${percent}%`,
    "ja-JP": `全体 ${percent}%`,
    "ko-KR": `전체 ${percent}%`,
  });
}

export function formatCloudConsoleSuspendWorldTitle(
  worldName: string,
  locale?: string | null,
) {
  return selectCloudConsoleText(locale ?? getCurrentCloudConsoleLocale(), {
    "en-US": `Suspend ${worldName}?`,
    "zh-CN": `暂停世界 ${worldName}？`,
    "ja-JP": `ワールド ${worldName} を一時停止しますか？`,
    "ko-KR": `월드 ${worldName}을(를) 일시 중지할까요?`,
  });
}

export function formatCloudConsoleRetryWorldRecoveryTitle(
  worldName: string,
  locale?: string | null,
) {
  return selectCloudConsoleText(locale ?? getCurrentCloudConsoleLocale(), {
    "en-US": `Retry recovery for ${worldName}?`,
    "zh-CN": `为世界 ${worldName} 重试恢复？`,
    "ja-JP": `ワールド ${worldName} の復旧を再試行しますか？`,
    "ko-KR": `월드 ${worldName} 복구를 재시도할까요?`,
  });
}

export function formatCloudConsoleLegacyProviderLabel(
  providerKey: string,
  locale?: string | null,
) {
  return selectCloudConsoleText(locale, {
    "en-US": `${providerKey} (legacy)`,
    "zh-CN": `${providerKey}（遗留）`,
    "ja-JP": `${providerKey}（レガシー）`,
    "ko-KR": `${providerKey}(레거시)`,
  });
}
// i18n-ignore-end
