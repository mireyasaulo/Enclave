import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { msg } from "@lingui/macro";
import {
  type InfiniteData,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import type { Moment, MomentsPageResponse } from "@yinjie/contracts";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { ChevronRight, Play, Plus, X } from "lucide-react";
import { translateRuntimeMessage } from "@yinjie/i18n";
import { AppPage, InlineNotice, cn } from "@yinjie/ui";
import { TabPageTopBar } from "../components/tab-page-top-bar";
import { RouteRedirectState } from "../components/route-redirect-state";
import { useDesktopLayout } from "../features/shell/use-desktop-layout";
import { storeMomentPublishFlash } from "../features/moments/moment-publish-flash";
import {
  buildDesktopMomentsRouteHash,
} from "../features/moments/moments-route-state";
import { parseMobileMomentsPublishRouteState } from "../features/moments/mobile-moments-publish-route-state";
import {
  publishMomentComposeDraft,
  useMomentComposeDraft,
} from "../features/moments/moment-compose-media";
import { isDesktopOnlyPath, navigateBackOrFallback } from "../lib/history-back";
import { pickImageFiles } from "../runtime/native-image-picker";
import { useAppRuntimeConfig } from "../runtime/runtime-config-store";

const t = translateRuntimeMessage;

export function MobileMomentsPublishPage() {
  const isDesktopLayout = useDesktopLayout();
  const navigate = useNavigate();
  const hash = useRouterState({
    select: (state) => state.location.hash,
  });
  const queryClient = useQueryClient();
  const runtimeConfig = useAppRuntimeConfig();
  const baseUrl = runtimeConfig.apiBaseUrl;
  const composeDraft = useMomentComposeDraft();
  const routeState = useMemo(
    () => parseMobileMomentsPublishRouteState(hash),
    [hash],
  );
  const safeReturnPath =
    routeState.returnPath && !isDesktopOnlyPath(routeState.returnPath)
      ? routeState.returnPath
      : undefined;
  const safeReturnHash = safeReturnPath ? routeState.returnHash : undefined;
  const resetComposeDraft = composeDraft.reset;
  const videoInputRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false);
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);
  const [toast, setToast] = useState<string>("");

  // textarea 高度跟内容长——原来 rows={4} 是死高，写长一点的朋友圈就只能在 4 行
  // 的小框里内部滚动（手指在 textarea 里另起一个滚动事件，体感跟微信完全不一样）。
  // 让它跟着 scrollHeight 长，最低 4 行（≈104px），最高 320px 后转内部滚动避免占满屏。
  useLayoutEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    const next = Math.min(ta.scrollHeight, 320);
    ta.style.height = `${next}px`;
  }, [composeDraft.text]);

  const createMutation = useMutation({
    mutationFn: () =>
      publishMomentComposeDraft({
        text: composeDraft.text,
        imageDrafts: composeDraft.imageDrafts,
        videoDraft: composeDraft.videoDraft,
        baseUrl,
      }),
    onSuccess: (newMoment) => {
      storeMomentPublishFlash(t(msg`朋友圈已发布。`));
      composeDraft.reset();
      // 把新发布的 moment prepend 到 paged 头部 + 收回到 page 1。跳转后 moments-page mount
      // 能立刻看到自己刚发的内容；后台 invalidate 再去合并服务端最新状态（评论/点赞等）。
      queryClient.setQueryData<InfiniteData<MomentsPageResponse>>(
        ["app-moments-paged", baseUrl],
        (current) =>
          current && current.pages.length > 0
            ? {
                pages: [
                  {
                    ...current.pages[0]!,
                    items: [newMoment, ...current.pages[0]!.items],
                  },
                ],
                pageParams: current.pageParams.slice(0, 1),
              }
            : current,
      );
      queryClient.setQueryData<Moment[]>(["app-moments", baseUrl], (current) =>
        current ? [newMoment, ...current] : current,
      );
      // fire-and-forget：原来 await refetch 让"发表中"按钮多卡 600ms+。
      void queryClient.invalidateQueries({ queryKey: ["app-moments", baseUrl] });
      void queryClient.invalidateQueries({
        queryKey: ["app-moments-paged", baseUrl],
      });
      // 只在用户还停在 publish 页时才 navigate。isPending 期间 我把 取消按钮
      // 禁了 + handleBack guard 了，但浏览器层的 swipe-back / Android 物理返回键
      // 这种系统手势绕过 React 拦不住——用户已经离开后 onSuccess 再 navigate 会
      // 把他从当前页拽回 /discover/moments，体验是「我都返回了它又把我抓回来」。
      // 已经离开就让 sessionStorage 里的 flash 在他下次自然进朋友圈时再弹。
      if (
        typeof window !== "undefined" &&
        window.location.pathname === "/discover/moments/publish"
      ) {
        void navigate({
          to: safeReturnPath ?? "/discover/moments",
          ...(safeReturnHash ? { hash: safeReturnHash } : {}),
          replace: true,
        });
      }
    },
  });

  useEffect(() => {
    resetComposeDraft();
  }, [baseUrl, resetComposeDraft]);

  useEffect(() => {
    if (!isDesktopLayout) return;
    void navigate({
      to: "/tabs/moments",
      hash:
        buildDesktopMomentsRouteHash({
          returnPath: safeReturnPath,
          returnHash: safeReturnHash,
        }) ?? undefined,
      replace: true,
    });
  }, [isDesktopLayout, navigate, safeReturnHash, safeReturnPath]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 1600); // i18n-ignore-line: clearing state
    return () => window.clearTimeout(timer);
  }, [toast]);

  // ESC 关闭「放弃发表」确认弹窗 / 媒体选择器（和 farm 的 sheet/modal 处理对齐）。
  useEffect(() => {
    if (!discardConfirmOpen && !mediaPickerOpen) {
      return;
    }
    const handleKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (discardConfirmOpen) {
        dismissDiscardConfirm();
        return;
      }
      if (mediaPickerOpen) {
        setMediaPickerOpen(false);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [discardConfirmOpen, mediaPickerOpen]);

  function performBack() {
    navigateBackOrFallback(
      () => {
        if (safeReturnPath) {
          void navigate({
            to: safeReturnPath,
            ...(safeReturnHash ? { hash: safeReturnHash } : {}),
          });
          return;
        }
        void navigate({ to: "/discover/moments" });
      },
      safeReturnPath ?? "/discover/moments",
    );
  }

  function handleBack() {
    // 正在上传/发表中：禁止返回——TanStack mutation 没接 AbortSignal，悄悄走人也
    // 拦不下来这次发表（用户以为放弃了，但 onSuccess 仍会触发 flash + 跳回朋友圈
    // 看到自己刚才说"放弃"的那条已经在列表里）。强制等 isPending 翻到 false。
    if (createMutation.isPending) {
      return;
    }
    if (composeDraft.hasContent) {
      setDiscardConfirmOpen(true);
      return;
    }
    performBack();
  }

  // 关闭「放弃发表」modal 的三个路径都一样：先收 modal、再把焦点还回 textarea。
  // 用户语义就是要接着写，焦点丢失会让他得再 tap 一次 textarea 才能唤回键盘。
  function dismissDiscardConfirm() {
    setDiscardConfirmOpen(false);
    textareaRef.current?.focus();
  }

  function handleConfirmDiscard() {
    setDiscardConfirmOpen(false);
    composeDraft.reset();
    performBack();
  }

  async function handlePickImages() {
    try {
      const files = await pickImageFiles({ multiple: true });
      if (files.length === 0) {
        return;
      }
      await composeDraft.addImageFiles(files);
    } catch (error) {
      composeDraft.setMediaError(
        error instanceof Error ? error.message : t(msg`图片选择失败，请稍后重试。`),
      );
    }
  }

  async function handleVideoFileSelected(file: File | null) {
    try {
      await composeDraft.replaceVideoFile(file);
    } catch (error) {
      composeDraft.setMediaError(
        error instanceof Error ? error.message : t(msg`视频选择失败，请稍后重试。`),
      );
    }
  }

  if (isDesktopLayout) {
    return (
      <RouteRedirectState
        title={t(msg`正在回到桌面朋友圈`)}
        description={t(msg`发朋友圈在桌面布局里已经并入朋友圈工作区，这里会自动带你返回桌面入口。`)}
        loadingLabel={t(msg`正在打开朋友圈...`)}
      />
    );
  }

  const canSubmit = composeDraft.hasContent && !createMutation.isPending;
  const errorMessage =
    composeDraft.mediaError ??
    (createMutation.isError && createMutation.error instanceof Error
      ? createMutation.error.message
      : null);

  const imageCount = composeDraft.imageDrafts.length;
  const showAddTile =
    !composeDraft.videoDraft && imageCount < 9 && composeDraft.canAddImages;
  const showVideoSlot = Boolean(composeDraft.videoDraft);
  const showImageGrid = imageCount > 0;

  return (
    <AppPage className="space-y-0 bg-[#F7F7F7] px-0 py-0">
      <TabPageTopBar
        title="" // i18n-ignore-line: intentionally empty
        className="mx-0 mb-0 mt-0 border-b border-[#ECECEC] bg-[#F7F7F7] px-3 pb-1.5 pt-1.5 text-[#1A1A1A] shadow-none"
        leftActions={
          <button
            type="button"
            onClick={handleBack}
            disabled={createMutation.isPending}
            className={cn(
              "h-9 px-2 text-[15px] active:opacity-70",
              createMutation.isPending
                ? "text-[#B0B0B0]"
                : "text-[#1A1A1A]",
            )}
          >
            {t(msg`取消`)}
          </button>
        }
        rightActions={
          <button
            type="button"
            onClick={() => {
              // JS 层兜底防双击：disabled 属性靠 React 下次 commit 才生效，
              // 用户在第一次 mutate 触发到 isPending 翻 true 中间那一帧再点一下
              // 也会再发一份 mutation —— TanStack Query 不去重，两条 POST 都会
              // 跑完，朋友圈直接出两条一模一样的帖子。
              if (!canSubmit) return;
              createMutation.mutate();
            }}
            disabled={!canSubmit}
            className={cn(
              // min-w 让"发表"(2 字) → "发表中"(3 字) 的状态切换不再撑大按钮，
              // 避免顶栏右上角看起来抖一下；按住够装下 isPending 文案。
              "h-7 min-w-[3.75rem] rounded-[3px] px-3 text-[14px] font-medium transition",
              canSubmit
                ? "bg-[#07C160] text-white active:bg-[#06AD56]"
                : "bg-[#9DD9B0] text-white",
            )}
          >
            {createMutation.isPending ? t(msg`发表中`) : t(msg`发表`)}
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto">
        {errorMessage ? (
          <div className="px-4 pt-3">
            <InlineNotice
              tone="info"
              className="rounded-[8px] border border-[#ECECEC] bg-white px-3 py-2 text-[12px] shadow-none"
            >
              {errorMessage}
            </InlineNotice>
          </div>
        ) : null}

        <section className="bg-white px-4 pt-4">
          <textarea
            ref={textareaRef}
            value={composeDraft.text}
            onChange={(event) => composeDraft.setText(event.target.value)}
            placeholder={t(msg`这一刻的想法...`)}
            rows={4}
            // 2000 字软上限，配合后端 MOMENTS_TEXT_TOO_LONG（同上限）形成双保险——
            // 之前没有任何上限，粘贴一段 50K 字符的全文会让 createUserMoment 通过、
            // 然后列表渲染那条卡片把整段 whitespace-pre-wrap 一次性绘出来，
            // 移动 Safari 直接卡顿，且 DB 里 moment_posts.text 持续膨胀。
            maxLength={2000}
            // outline-none 干掉浏览器原生轮廓；focus/focus-visible:shadow-none 干掉
            // tokens.css 里 :focus-visible 的全局 3px 绿光 box-shadow——autoFocus
            // 一进页面就吃这一圈、看起来像微信里冒出来一个绿色描边的输入框，
            // 实际 WeChat compose 没有这层 ring。
            className="block w-full resize-none border-0 bg-transparent text-[17px] leading-[26px] text-[#1A1A1A] outline-none placeholder:text-[#B0B0B0] focus:shadow-none focus-visible:shadow-none"
            style={{ minHeight: "104px" }}
            autoFocus
          />

          {showImageGrid || showVideoSlot ? (
            // 已经有图片/视频：进入 3 列 grid 布局，把媒体格子和"再加一张"小 +
            // 放一起，体感与微信发朋友圈一致。
            <div
              className="mt-3 grid"
              style={{
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: "4px",
              }}
            >
              {composeDraft.imageDrafts.map((draft) => (
                <div
                  key={draft.id}
                  className="relative overflow-hidden bg-[#EAEAEA]"
                  style={{ aspectRatio: "1 / 1" }}
                >
                  <img
                    src={draft.previewUrl}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => composeDraft.removeImageDraft(draft.id)}
                    disabled={createMutation.isPending}
                    aria-label={t(msg`移除图片`)}
                    className={cn(
                      "absolute right-1 top-1 inline-flex h-5 w-5 items-center justify-center rounded-full text-white",
                      createMutation.isPending
                        ? "bg-black/20"
                        : "bg-black/45",
                    )}
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}

              {showVideoSlot && composeDraft.videoDraft ? (
                <div
                  className="relative overflow-hidden bg-black"
                  style={{ aspectRatio: "1 / 1" }}
                >
                  {composeDraft.videoDraft.posterPreviewUrl ? (
                    <img
                      src={composeDraft.videoDraft.posterPreviewUrl}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    // 封面生成失败时退到 <video> 显示首帧。preload="metadata" 必须
                    // 显式给——移动端 Safari 默认 "none"，啥都不加载就是一片黑。
                    <video
                      src={composeDraft.videoDraft.previewUrl}
                      muted
                      playsInline
                      preload="metadata"
                      className="h-full w-full object-cover"
                    />
                  )}
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-black/55 text-white">
                      <Play size={16} className="translate-x-[1px] fill-current" />
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => composeDraft.clearVideoDraft()}
                    disabled={createMutation.isPending}
                    aria-label={t(msg`移除视频`)}
                    className={cn(
                      "absolute right-1 top-1 inline-flex h-5 w-5 items-center justify-center rounded-full text-white",
                      createMutation.isPending
                        ? "bg-black/20"
                        : "bg-black/45",
                    )}
                  >
                    <X size={12} />
                  </button>
                </div>
              ) : null}

              {showAddTile && !showVideoSlot ? (
                <button
                  type="button"
                  // 走到这里 grid 已经在渲染（showImageGrid 或 showVideoSlot 触发），
                  // 又因为 !showVideoSlot 排除了纯视频情况，剩下只可能是 imageCount>0，
                  // 用户已经在"图片相册"模式里，再 + 就直接进系统相册，跳过中间 sheet。
                  onClick={() => {
                    void handlePickImages();
                  }}
                  disabled={createMutation.isPending}
                  className="flex items-center justify-center bg-[#F7F7F7] text-[#B0B0B0] disabled:opacity-50 active:bg-[#EFEFEF]"
                  style={{ aspectRatio: "1 / 1" }}
                  aria-label={t(msg`添加图片`)}
                >
                  <Plus size={28} strokeWidth={1.4} />
                </button>
              ) : null}
            </div>
          ) : showAddTile ? (
            // 还没选媒体：留一个大点的入口，按一下走 picker sheet 决定走图片还是
            // 视频；和微信发朋友圈的初始空态一致。
            <div className="mt-3">
              <button
                type="button"
                onClick={() => setMediaPickerOpen(true)}
                disabled={createMutation.isPending}
                className="flex h-[110px] w-[110px] items-center justify-center bg-[#F2F2F2] text-[#B0B0B0] disabled:opacity-50 active:bg-[#EAEAEA]"
                // aria-label 要描述真实行为：这个入口走的是 picker sheet（图片
                // 和视频两路都开），不是 grid 内的纯图片 +。错描述会让无障碍
                // 用户以为没法发视频。
                aria-label={t(msg`添加图片或视频`)}
              >
                <Plus size={32} strokeWidth={1.4} />
              </button>
            </div>
          ) : null}

          <div className="h-3" />
        </section>

        <section className="mt-2 bg-white">
          <SettingRow
            label={t(msg`所在位置`)}
            value={t(msg`不显示位置`)}
            onTap={() => setToast(t(msg`敬请期待`))}
          />
          <SettingRow
            label={t(msg`提醒谁看`)}
            value=""
            onTap={() => setToast(t(msg`敬请期待`))}
          />
          <SettingRow
            label={t(msg`谁可以看`)}
            value={t(msg`公开`)}
            onTap={() => setToast(t(msg`敬请期待`))}
            isLast
          />
        </section>

        <div className="px-4 pt-3 text-[11px] leading-5 text-[#9A9A9A]">
          {t(msg`图片最多 9 张，视频当前支持 1 条且不超过 5 分钟，暂不支持图片和视频混发。`)}
        </div>

        <div className="h-[calc(env(safe-area-inset-bottom,0px)+24px)]" />
      </div>

      {mediaPickerOpen ? (
        <MediaPickerSheet
          onPickImages={() => {
            setMediaPickerOpen(false);
            void handlePickImages();
          }}
          onPickVideo={() => {
            setMediaPickerOpen(false);
            videoInputRef.current?.click();
          }}
          onClose={() => setMediaPickerOpen(false)}
          videoDisabled={!composeDraft.canAddVideo}
        />
      ) : null}

      {toast ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom,0px)+96px)] z-[1100] flex justify-center">
          <div className="rounded-[6px] bg-black/72 px-3 py-1.5 text-[13px] text-white">
            {toast}
          </div>
        </div>
      ) : null}

      {discardConfirmOpen ? (
        // z-[1300]：alert 必须盖在 toast (z-1100) / mediaPickerSheet (z-1200) 之上。
        // 之前 z-[100] 太低，用户在 1.6s 内连点 SettingRow → 取消，刚冒的 toast 会
        // 把 modal 底边吃掉。
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="moments-publish-discard-title"
          aria-describedby="moments-publish-discard-desc"
          className="fixed inset-0 z-[1300] flex items-center justify-center bg-[rgba(17,24,39,0.32)] p-6 backdrop-blur-[3px]"
        >
          <button
            type="button"
            aria-label={t(msg`关闭提示`)}
            onClick={dismissDiscardConfirm}
            className="absolute inset-0"
          />
          <div className="relative w-[min(320px,calc(100vw-2rem))] overflow-hidden rounded-[12px] bg-white shadow-[var(--shadow-overlay)]">
            <div className="px-6 pb-3 pt-6 text-center">
              <div
                id="moments-publish-discard-title"
                className="text-[16px] font-medium text-[#1A1A1A]"
              >
                {t(msg`放弃发表`)}
              </div>
              <div
                id="moments-publish-discard-desc"
                className="mt-2 text-[13px] leading-6 text-[#9A9A9A]"
              >
                {t(msg`返回会丢失已编辑的文字与媒体，确定不发布吗？`)}
              </div>
            </div>
            <div className="grid grid-cols-2 border-t border-[#ECECEC]">
              <button
                type="button"
                onClick={dismissDiscardConfirm}
                className="border-r border-[#ECECEC] py-3 text-[15px] text-[#576B95] active:bg-black/[0.04]"
              >
                {t(msg`继续编辑`)}
              </button>
              <button
                type="button"
                onClick={handleConfirmDiscard}
                className="py-3 text-[15px] font-medium text-[#FA5151] active:bg-black/[0.04]"
              >
                {t(msg`放弃`)}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <input
        ref={videoInputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={(event) => {
          void handleVideoFileSelected(event.currentTarget.files?.[0] ?? null);
          event.currentTarget.value = "";
        }}
      />
    </AppPage>
  );
}

function SettingRow({
  label,
  value,
  onTap,
  isLast,
}: {
  label: string;
  value: string;
  onTap: () => void;
  isLast?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onTap}
      className={cn(
        "flex w-full items-center justify-between gap-3 px-4 py-3 text-left active:bg-[#F2F2F2]",
        isLast ? "" : "border-b border-[#ECECEC]",
      )}
    >
      <span className="text-[15px] text-[#1A1A1A]">{label}</span>
      <span className="flex items-center gap-1 text-[14px] text-[#9A9A9A]">
        {value ? <span>{value}</span> : null}
        <ChevronRight size={16} className="text-[#C5C5C5]" />
      </span>
    </button>
  );
}

function MediaPickerSheet({
  onPickImages,
  onPickVideo,
  onClose,
  videoDisabled,
}: {
  onPickImages: () => void;
  onPickVideo: () => void;
  onClose: () => void;
  videoDisabled?: boolean;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t(msg`选择媒体`)}
      className="fixed inset-0 z-[1200] flex items-end justify-center bg-black/40"
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute inset-0"
        aria-label={t(msg`关闭`)}
      />
      <div className="relative w-full max-w-[480px] rounded-t-[12px] bg-white pb-[calc(env(safe-area-inset-bottom,0px)+8px)]">
        <button
          type="button"
          onClick={onPickImages}
          className="block w-full border-b border-[#ECECEC] py-3.5 text-center text-[16px] text-[#1A1A1A] active:bg-[#F2F2F2]"
        >
          {t(msg`从相册选择图片`)}
        </button>
        <button
          type="button"
          onClick={onPickVideo}
          disabled={videoDisabled}
          className={cn(
            "block w-full border-b border-[#ECECEC] py-3.5 text-center text-[16px] active:bg-[#F2F2F2]",
            videoDisabled ? "text-[#B0B0B0]" : "text-[#1A1A1A]",
          )}
        >
          {t(msg`选择视频`)}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="mt-2 block w-full bg-[#F7F7F7] py-3.5 text-center text-[16px] text-[#1A1A1A] active:bg-[#EFEFEF]"
        >
          {t(msg`取消`)}
        </button>
      </div>
    </div>
  );
}
