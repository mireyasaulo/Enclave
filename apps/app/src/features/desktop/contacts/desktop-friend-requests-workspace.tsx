import { msg } from "@lingui/macro";
import type { MessageDescriptor } from "@lingui/core";
import { Clock3, UserPlus } from "lucide-react";
import type { FriendRequest } from "@yinjie/contracts";
import { Button, ErrorBlock, InlineNotice, LoadingBlock, cn } from "@yinjie/ui";
import { useRuntimeTranslator } from "@yinjie/i18n";
import { AvatarChip } from "../../../components/avatar-chip";
import { EmptyState } from "../../../components/empty-state";
import { DesktopUtilityShell } from "../desktop-utility-shell";

type DesktopFriendRequestsWorkspaceProps = {
  loading: boolean;
  error: string | null;
  notice: string | null;
  requests: FriendRequest[];
  acceptPendingId?: string | null;
  declinePendingId?: string | null;
  onAccept: (requestId: string) => void;
  onDecline: (requestId: string) => void;
  onOpenAddFriend: () => void;
};

export function DesktopFriendRequestsWorkspace({
  loading,
  error,
  notice,
  requests,
  acceptPendingId = null,
  declinePendingId = null,
  onAccept,
  onDecline,
  onOpenAddFriend,
}: DesktopFriendRequestsWorkspaceProps) {
  const t = useRuntimeTranslator();
  const pendingCount = requests.filter((item) => item.status === "pending").length;

  return (
    <DesktopUtilityShell
      title={t(msg`新的朋友`)}
      subtitle={
        pendingCount > 0
          ? t(msg`当前有 ${pendingCount} 条待处理好友申请`)
          : t(msg`查看并处理来自世界角色的好友申请`)
      }
      sidebar={
        <div className="flex h-full min-h-0 flex-col">
          <div className="border-b border-[color:var(--border-faint)] px-4 py-4">
            <div className="flex items-center gap-2 text-sm font-medium text-[color:var(--text-primary)]">
              <UserPlus size={16} className="text-[#07c160]" />
              <span>{t(msg`好友入口`)}</span>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-auto p-3">
            <button
              type="button"
              onClick={onOpenAddFriend}
              className="flex w-full items-center justify-between rounded-[14px] border border-[color:var(--border-faint)] bg-white px-4 py-3 text-left transition hover:bg-[color:var(--surface-console)]"
            >
              <div className="min-w-0">
                <div className="text-sm font-medium text-[color:var(--text-primary)]">
                  {t(msg`添加朋友`)}
                </div>
                <div className="mt-1 text-xs text-[color:var(--text-muted)]">
                  {t(msg`搜索隐界号或角色名，发送验证申请`)}
                </div>
              </div>
            </button>

            <button
              type="button"
              className="mt-2 flex w-full items-center justify-between rounded-[14px] border border-[rgba(7,193,96,0.14)] bg-[rgba(7,193,96,0.08)] px-4 py-3 text-left"
            >
              <div className="min-w-0">
                <div className="text-sm font-medium text-[color:var(--text-primary)]">
                  {t(msg`新的朋友`)}
                </div>
                <div className="mt-1 text-xs text-[color:var(--text-muted)]">
                  {t(msg`查看好友申请和最新处理结果`)}
                </div>
              </div>
              <span className="rounded-full bg-white/90 px-2 py-0.5 text-[11px] text-[#15803d]">
                {t(msg`当前`)}
              </span>
            </button>

            <div className="mt-4 rounded-[16px] border border-[color:var(--border-faint)] bg-white p-4">
              <div className="text-xs font-medium tracking-[0.08em] text-[color:var(--text-muted)]">
                {t(msg`处理建议`)}
              </div>
              <div className="mt-3 space-y-2 text-xs leading-6 text-[color:var(--text-secondary)]">
                <div className="rounded-[12px] bg-[color:var(--surface-console)] px-3 py-2.5">
                  {t(msg`接受后会直接进入通讯录，可以立刻开始聊天。`)}
                </div>
                <div className="rounded-[12px] bg-[color:var(--surface-console)] px-3 py-2.5">
                  {t(msg`拒绝只会处理当前申请，不会删除角色资料。`)}
                </div>
              </div>
            </div>
          </div>
        </div>
      }
      aside={
        <div className="flex h-full min-h-0 flex-col">
          <div className="border-b border-[color:var(--border-faint)] px-5 py-4">
            <div className="text-sm font-medium text-[color:var(--text-primary)]">
              {t(msg`请求概览`)}
            </div>
            <div className="mt-1 text-xs text-[color:var(--text-muted)]">
              {t(msg`在桌面端集中处理所有待通过好友申请。`)}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-auto p-5">
            <div className="space-y-3">
              <MetaCard label={t(msg`待处理`)} value={`${pendingCount}`} />
              <MetaCard label={t(msg`总申请`)} value={`${requests.length}`} />
            </div>

            <div className="mt-5 rounded-[16px] border border-[color:var(--border-faint)] bg-white p-4">
              <div className="text-xs font-medium tracking-[0.08em] text-[color:var(--text-muted)]">
                {t(msg`来源说明`)}
              </div>
              <div className="mt-3 space-y-2">
                <SourceHint
                  title={t(msg`来自搜索添加`)}
                  description={t(msg`桌面端手动搜索角色后发送的验证申请。`)}
                />
                <SourceHint
                  title={t(msg`来自摇一摇/场景`)}
                  description={t(msg`系统事件触发的角色主动相遇请求。`)}
                />
              </div>
            </div>
          </div>
        </div>
      }
    >
      <div className="h-full px-6 py-6">
        {notice ? (
          <div className="mb-4">
            <InlineNotice tone="success">{notice}</InlineNotice>
          </div>
        ) : null}

        <div className="h-[calc(100%-4px)] overflow-hidden rounded-[24px] border border-[color:var(--border-faint)] bg-[rgba(255,255,255,0.78)]">
          {loading ? (
            <div className="flex h-full items-center justify-center px-6">
              <LoadingBlock label={t(msg`正在读取好友请求...`)} />
            </div>
          ) : error ? (
            <div className="px-6 py-6">
              <ErrorBlock message={error} />
            </div>
          ) : requests.length ? (
            <div className="h-full overflow-auto px-5 py-5">
              <div className="space-y-3">
                {requests.map((request) => (
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
                            <div className="truncate text-[16px] font-medium text-[color:var(--text-primary)]">
                              {request.characterName}
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-[12px] text-[color:var(--text-muted)]">
                              <span>{t(getFriendRequestSourceLabel(request.triggerScene))}</span>
                              <span>·</span>
                              <span className="inline-flex items-center gap-1">
                                <Clock3 size={12} />
                                {formatFriendRequestDate(request.createdAt, t)}
                              </span>
                            </div>
                          </div>
                          <div
                            className={cn(
                              "rounded-full px-2.5 py-1 text-[11px]",
                              request.status === "pending"
                                ? "bg-[rgba(250,204,21,0.10)] text-[#a16207]"
                                : request.status === "accepted"
                                  ? "bg-[rgba(22,163,74,0.08)] text-[#15803d]"
                                  : "bg-[rgba(226,232,240,0.88)] text-[color:var(--text-muted)]",
                            )}
                          >
                            {request.status === "pending"
                              ? t(msg`待处理`)
                              : request.status === "accepted"
                                ? t(msg`已通过`)
                                : t(msg`已忽略`)}
                          </div>
                        </div>

                        <div className="mt-4 rounded-[16px] bg-[rgba(245,247,247,0.92)] px-4 py-3 text-[14px] leading-7 text-[color:var(--text-secondary)]">
                          {request.greeting || t(msg`想认识你。`)}
                        </div>

                        <div className="mt-4 flex items-center justify-end gap-3">
                          <Button
                            variant="secondary"
                            size="lg"
                            disabled={
                              request.status !== "pending" ||
                              Boolean(acceptPendingId || declinePendingId)
                            }
                            onClick={() => onDecline(request.id)}
                            className="rounded-[12px] border-[color:var(--border-faint)] bg-white px-5 shadow-none hover:bg-[color:var(--surface-console)]"
                          >
                            {declinePendingId === request.id ? t(msg`处理中...`) : t(msg`拒绝`)}
                          </Button>
                          <Button
                            variant="primary"
                            size="lg"
                            disabled={
                              request.status !== "pending" ||
                              Boolean(acceptPendingId || declinePendingId)
                            }
                            onClick={() => onAccept(request.id)}
                            className="rounded-[12px] bg-[#07c160] px-5 text-white shadow-none hover:bg-[#06ad56]"
                          >
                            {acceptPendingId === request.id ? t(msg`接受中...`) : t(msg`接受`)}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </section>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center px-6">
              <EmptyState
                title={t(msg`暂时没有新的好友请求`)}
                description={t(msg`去添加朋友里搜索角色，或等待世界里的相遇事件触发新的申请。`)}
                action={
                  <Button variant="secondary" onClick={onOpenAddFriend}>
                    {t(msg`去添加朋友`)}
                  </Button>
                }
              />
            </div>
          )}
        </div>
      </div>
    </DesktopUtilityShell>
  );
}

function MetaCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[16px] border border-[color:var(--border-faint)] bg-white p-4 shadow-[var(--shadow-soft)]">
      <div className="text-[11px] font-medium tracking-[0.08em] text-[color:var(--text-muted)]">
        {label}
      </div>
      <div className="mt-2 text-[24px] font-medium text-[color:var(--text-primary)]">
        {value}
      </div>
    </div>
  );
}

function SourceHint({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-[12px] bg-[color:var(--surface-console)] px-3 py-2.5">
      <div className="text-[12px] font-medium text-[color:var(--text-primary)]">
        {title}
      </div>
      <div className="mt-1 text-[11px] leading-6 text-[color:var(--text-muted)]">
        {description}
      </div>
    </div>
  );
}

function getFriendRequestSourceLabel(triggerScene?: string): MessageDescriptor {
  if (!triggerScene) {
    return msg`新的朋友`;
  }

  if (triggerScene === "shake") {
    return msg`来自摇一摇`;
  }

  if (triggerScene === "manual_add") {
    return msg`来自搜索添加`;
  }

  return msg`来自 ${triggerScene}`;
}

function formatFriendRequestDate(
  createdAt: string,
  t: (descriptor: MessageDescriptor) => string,
) {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const now = new Date();
  const sameYear = date.getFullYear() === now.getFullYear();
  const sameMonth = sameYear && date.getMonth() === now.getMonth();
  const sameDay = sameMonth && date.getDate() === now.getDate();

  if (sameDay) {
    return t(msg`今天`);
  }

  const formatter = new Intl.DateTimeFormat(undefined, {
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(date).replace(/\//g, "-");
}
