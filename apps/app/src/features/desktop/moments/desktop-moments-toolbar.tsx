import { msg } from "@lingui/macro";
import { useRuntimeTranslator } from "@yinjie/i18n";
import { Button, ErrorBlock, InlineNotice } from "@yinjie/ui";
import { ArrowUp, PenSquare, RefreshCcw } from "lucide-react";

type DesktopMomentsToolbarProps = {
  commentErrorMessage?: string | null;
  deleteErrorMessage?: string | null;
  errors?: string[];
  likeErrorMessage?: string | null;
  successNotice?: string;
  /** 当前已加载到前端的动态数（visibleMoments.length） */
  loadedCount: number;
  /** 服务端 MomentsPageResponse.total。null = 首页还没拿到 */
  totalCount?: number | null;
  /** auto-prefetch 已经把所有页拉完。完成后只显示「共 N 条」 */
  isFullyLoaded?: boolean;
  onBackToTop: () => void;
  onOpenCompose: () => void;
  onRefresh: () => void;
};

export function DesktopMomentsToolbar({
  commentErrorMessage,
  deleteErrorMessage,
  errors = [],
  likeErrorMessage,
  successNotice,
  loadedCount,
  totalCount = null,
  isFullyLoaded = true,
  onBackToTop,
  onOpenCompose,
  onRefresh,
}: DesktopMomentsToolbarProps) {
  const t = useRuntimeTranslator();
  return (
    <div className="border-b border-[color:var(--border-faint)] bg-white/74 px-6 py-4 backdrop-blur-xl">
      <div className="mx-auto w-full max-w-[720px]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="text-[18px] font-semibold text-[color:var(--text-primary)]">
              {t(msg`朋友圈`)}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" size="sm" onClick={onRefresh}>
              <RefreshCcw size={14} />
              {t(msg`刷新`)}
            </Button>
            <Button variant="secondary" size="sm" onClick={onBackToTop}>
              <ArrowUp size={14} />
              {t(msg`回到顶部`)}
            </Button>
            <Button variant="primary" size="sm" onClick={onOpenCompose}>
              <PenSquare size={14} />
              {t(msg`发朋友圈`)}
            </Button>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-end">
          {/* 之前一律 "当前共 X 条动态"，但 auto-prefetch 中途 X 还在涨，
              用户读着以为 X 就是总数 ——「我才 100 条朋友圈？」其实有 240。
              未跑完时拿服务端 total 当上限显示「已加载 100 / 共 240」；跑完后
              回到客户端 visible count（loadedCount）—— 服务端 total 没扣黑名单
              过滤的角色 moments，跑完显示 240 但客户端只能看 235 会反过来误导。
              首页响应还没拿到时（totalCount=null && loadedCount=0），feed 正在
              转 LoadingBlock，count 区藏起来避免「共 0 条」与 loading spinner 撞车。 */}
          {totalCount === null && loadedCount === 0 ? null : (
            <div className="text-[12px] text-[color:var(--text-muted)]">
              {!isFullyLoaded && totalCount !== null && totalCount > loadedCount
                ? t(msg`已加载 ${loadedCount} / 共 ${totalCount} 条动态`)
                : t(msg`共 ${loadedCount} 条动态`)}
            </div>
          )}
        </div>

        {successNotice ? (
          <div className="mt-4">
            <InlineNotice
              tone="success"
              className="border-[color:var(--border-faint)] bg-white"
            >
              {successNotice}
            </InlineNotice>
          </div>
        ) : null}

        {errors.length > 0 ? (
          <div className="mt-4 space-y-3">
            {errors.map((message, index) => (
              <ErrorBlock key={`${message}-${index}`} message={message} />
            ))}
          </div>
        ) : null}

        {likeErrorMessage ? (
          <div className="mt-4">
            <ErrorBlock message={likeErrorMessage} />
          </div>
        ) : null}

        {commentErrorMessage ? (
          <div className="mt-4">
            <ErrorBlock message={commentErrorMessage} />
          </div>
        ) : null}

        {deleteErrorMessage ? (
          <div className="mt-4">
            <ErrorBlock message={deleteErrorMessage} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
