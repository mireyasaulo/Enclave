import { msg } from "@lingui/macro";
import type { MessageDescriptor } from "@lingui/core";
import type { FriendRequest } from "@yinjie/contracts";
import { Button, ErrorBlock, InlineNotice, LoadingBlock, cn } from "@yinjie/ui";
import { useRuntimeTranslator } from "@yinjie/i18n";
import { AvatarChip } from "../../../components/avatar-chip";
import { EmptyState } from "../../../components/empty-state";
import { getFriendRequestSourceLabel } from "../../contacts/friend-request-scene-label";

type DesktopContactsFriendRequestsPaneProps = {
  requests: FriendRequest[];
  loading: boolean;
  error?: string | null;
  actionError?: string | null;
  actionSuccess?: string | null;
  acceptPendingId?: string | null;
  declinePendingId?: string | null;
  onAccept: (requestId: string) => void;
  onDecline: (requestId: string) => void;
};

export function DesktopContactsFriendRequestsPane({
  requests,
  loading,
  error = null,
  actionError = null,
  actionSuccess = null,
  acceptPendingId = null,
  declinePendingId = null,
  onAccept,
  onDecline,
}: DesktopContactsFriendRequestsPaneProps) {
  const t = useRuntimeTranslator();
  // 后端 /social/friend-requests 只返回 status='pending'，但 expiresAt 过期后
  // 请求不会从列表里自动消失。这里把过期/非过期分开计数：侧栏 shortcut 拿到
  // 的 pendingRequestCount 是 requests.length（含过期），面板顶端用同一份口径
  // 显示总数 + 单独点出过期条数，避免侧栏说"5 条待处理"而面板里只数 3 条。
  const expiredCount = requests.filter((item) =>
    isFriendRequestExpired(item.expiresAt),
  ).length;
  const pendingCount = requests.length;

  return (
    // 外层不能再背 overflow-auto，否则 header 会跟着列表一起往上卷出视区。
    // 改成 header + 独立滚动容器（content），跟 starred-friends pane 同款结构，
    // 用户批处理时顶端的"x 条待处理"一直可见。
    <div className="flex h-full min-h-0 flex-col bg-[rgba(245,247,247,0.96)]">
      <div className="border-b border-[color:var(--border-faint)] bg-white/82 px-8 py-6 backdrop-blur-xl">
        <div className="min-w-0">
          <div className="text-[22px] font-medium text-[color:var(--text-primary)]">
            {t(msg`新的朋友`)}
          </div>
          <div className="mt-2 text-sm text-[color:var(--text-secondary)]">
            {pendingCount > 0
              ? expiredCount > 0
                ? t(
                    msg`当前有 ${pendingCount} 条待处理好友申请（${expiredCount} 条已过期，可清除）`,
                  )
                : t(msg`当前有 ${pendingCount} 条待处理好友申请`)
              : t(msg`查看收到的好友申请和处理结果。`)}
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-8 py-6">
        {actionError ? (
          <div className="mb-4">
            <InlineNotice tone="danger">{actionError}</InlineNotice>
          </div>
        ) : actionSuccess ? (
          <div className="mb-4">
            <InlineNotice tone="success">{actionSuccess}</InlineNotice>
          </div>
        ) : null}

        {loading ? (
          <div className="flex h-full items-center justify-center">
            <LoadingBlock label={t(msg`正在读取好友请求...`)} />
          </div>
        ) : error && !requests.length ? (
          // 仅当没有数据时把 ErrorBlock 撑满；refetch 失败但 query 还留着前一次
          // 成功的 data 时，把列表保住，让用户接着处理手头那一批，错误以下面顶部
          // 的 actionError 提示。
          <ErrorBlock message={error} />
        ) : requests.length ? (
          <div className="space-y-3">
            {requests.map((request) => {
              const expired = isFriendRequestExpired(request.expiresAt);
              const disabled =
                request.status !== "pending" ||
                Boolean(acceptPendingId || declinePendingId);

              return (
                <section
                  key={request.id}
                  className="rounded-[22px] border border-[color:var(--border-faint)] bg-white px-5 py-5 shadow-[var(--shadow-soft)]"
                >
                  <div className="flex items-start gap-4">
                    <AvatarChip
                      name={request.characterName}
                      src={request.characterAvatar}
                      size="wechat"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div
                            className={cn(
                              "truncate text-[16px] font-medium text-[color:var(--text-primary)]",
                              expired ? "opacity-70" : undefined,
                            )}
                          >
                            {request.characterName}
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-[12px] text-[color:var(--text-muted)]">
                            <span className={expired ? "opacity-70" : undefined}>
                              {t(getFriendRequestSourceLabel(
                                request.triggerScene,
                              ))}
                            </span>
                            <span className={expired ? "opacity-70" : undefined}>·</span>
                            <span className={expired ? "opacity-70" : undefined}>
                              {formatFriendRequestDate(request.createdAt, t)}
                            </span>
                          </div>
                        </div>
                        {expired ? (
                          <div className="shrink-0 rounded-full bg-[rgba(245,158,11,0.12)] px-2.5 py-1 text-[11px] font-medium text-[color:var(--state-warning-text)]">
                            {t(msg`已过期`)}
                          </div>
                        ) : null}
                      </div>

                      <div
                        className={cn(
                          "mt-4 rounded-[16px] bg-[rgba(245,247,247,0.92)] px-4 py-3 text-[14px] leading-7 text-[color:var(--text-secondary)]",
                          expired ? "opacity-70" : undefined,
                        )}
                      >
                        {request.greeting || t(msg`想认识你。`)}
                      </div>

                      <div className="mt-4 flex items-center justify-end gap-3">
                        <Button
                          variant="secondary"
                          size="lg"
                          disabled={disabled}
                          onClick={() => onDecline(request.id)}
                          className="rounded-[12px] border-[color:var(--border-faint)] bg-white px-5 shadow-none hover:bg-[color:var(--surface-console)]"
                        >
                          {declinePendingId === request.id
                            ? expired
                              ? t(msg`清除中...`)
                              : t(msg`处理中...`)
                            : expired
                              ? t(msg`清除`)
                              : t(msg`拒绝`)}
                        </Button>
                        {expired ? null : (
                          <Button
                            variant="primary"
                            size="lg"
                            disabled={disabled}
                            onClick={() => onAccept(request.id)}
                            className="rounded-[12px] bg-[#07c160] px-5 text-white shadow-none hover:bg-[#06ad56]"
                          >
                            {acceptPendingId === request.id
                              ? t(msg`接受中...`)
                              : t(msg`接受`)}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </section>
              );
            })}
          </div>
        ) : (
          <div className="flex h-full items-center justify-center">
            <EmptyState
              title={t(msg`暂时没有新的好友请求`)}
              description={t(msg`等待世界里的相遇事件触发新的申请。`)}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function isFriendRequestExpired(expiresAt?: string | null) {
  if (!expiresAt) {
    return false;
  }
  const date = new Date(expiresAt);
  if (Number.isNaN(date.getTime())) {
    return false;
  }
  return date.getTime() <= Date.now();
}

// 复用同一份 formatter 实例，避免每条请求渲染时都新建一次 Intl.DateTimeFormat
// （Intl 对象构造比想象贵，10+ 条申请 * 每次输入框抖动都重建会被 React Profiler
// 标红）。跨年时 createdAt 落到去年，应该把年份带出来——光是 "12-15" 在 2026-05
// 看会让人误以为是当年 12 月 15 日。
const sameYearFormatter = new Intl.DateTimeFormat(undefined, {
  month: "2-digit",
  day: "2-digit",
});
const crossYearFormatter = new Intl.DateTimeFormat(undefined, {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function formatFriendRequestDate(
  createdAt: string,
  t: (descriptor: MessageDescriptor) => string,
) {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) {
    // 后端偶发返回脏数据（空串 / 异常 ISO 串），不能让面板渲染出「来源 · 」这种
    // 后面空一截的诡异 meta 行，至少给一个占位。
    return t(msg`时间未知`);
  }

  const now = new Date();
  const sameYear = date.getFullYear() === now.getFullYear();
  const sameMonth = sameYear && date.getMonth() === now.getMonth();
  const sameDay = sameMonth && date.getDate() === now.getDate();

  if (sameDay) {
    return t(msg`今天`);
  }

  const formatter = sameYear ? sameYearFormatter : crossYearFormatter;
  return formatter.format(date).replace(/\//g, "-");
}
