import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { msg } from "@lingui/macro";
import {
  type MomentAudioAsset,
  type MomentContentType,
  type MomentImageAsset,
  type MomentMediaAsset,
  type MomentVideoAsset,
} from "@yinjie/contracts";
import { ChevronLeft, ChevronRight, Play, X } from "lucide-react";
import { translateRuntimeMessage } from "@yinjie/i18n";
import { cn } from "@yinjie/ui";
import { formatMomentDurationLabel } from "../features/moments/moment-compose-media";
import { AudioCard } from "./audio-card";
import { resolveAppMediaUrl } from "../lib/media-url";

const t = translateRuntimeMessage;

type MomentMediaGalleryProps = {
  contentType: MomentContentType;
  media: MomentMediaAsset[];
  variant?: "desktop" | "detail" | "mobile";
  stopPropagation?: boolean;
};

type ViewerState =
  | {
      kind: "image";
      index: number;
    }
  | {
      kind: "video";
    };

export function MomentMediaGallery({
  contentType,
  media,
  variant = "desktop",
  stopPropagation = false,
}: MomentMediaGalleryProps) {
  const [viewerState, setViewerState] = useState<ViewerState | null>(null);

  useEffect(() => {
    if (!viewerState) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setViewerState(null);
        return;
      }

      if (viewerState.kind !== "image") {
        return;
      }

      if (event.key === "ArrowLeft") {
        setViewerState((current) => {
          if (!current || current.kind !== "image") {
            return current;
          }

          return {
            kind: "image",
            index: current.index > 0 ? current.index - 1 : current.index,
          };
        });
      }

      if (event.key === "ArrowRight") {
        setViewerState((current) => {
          if (!current || current.kind !== "image") {
            return current;
          }

          return {
            kind: "image",
            index:
              current.index < media.length - 1 ? current.index + 1 : current.index,
          };
        });
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [media.length, viewerState]);

  if (!media.length) {
    return null;
  }

  const images = media.filter(
    (asset): asset is MomentImageAsset => asset.kind === "image",
  );
  const handleRootClick = stopPropagation
    ? (event: MouseEvent<HTMLDivElement>) => {
        event.stopPropagation();
      }
    : undefined;

  if (contentType === "audio_card" && media[0]?.kind === "audio") {
    const audio = media[0] as MomentAudioAsset;
    return (
      <div onClick={handleRootClick}>
        <AudioCard
          url={audio.url}
          posterUrl={audio.posterUrl}
          title={audio.title || audio.fileName}
          durationMs={audio.durationMs}
          variant={variant === "mobile" ? "moment" : "feed"}
        />
      </div>
    );
  }

  if (contentType === "video" && media[0]?.kind === "video") {
    const video = media[0] as MomentVideoAsset;
    return (
      <>
        <div
          className={cn(
            "relative overflow-hidden rounded-[20px] border border-[color:var(--border-faint)] bg-black",
            variant === "detail"
              ? "max-w-full"
              : variant === "mobile"
                ? "max-w-[320px]"
                : "max-w-[360px]",
          )}
          onClick={handleRootClick}
        >
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setViewerState({ kind: "video" });
            }}
            className="group relative block w-full text-left"
            aria-label={t(msg`打开视频预览`)}
          >
            {video.posterUrl ? (
              <img
                src={resolveAppMediaUrl(video.posterUrl)}
                alt={video.fileName || t(msg`朋友圈视频`)}
                loading="lazy"
                decoding="async"
                className="w-full bg-black object-cover"
                style={{
                  aspectRatio:
                    video.width && video.height
                      ? `${video.width} / ${video.height}`
                      : "16 / 9",
                }}
              />
            ) : (
              <video
                src={resolveAppMediaUrl(video.url)}
                className="w-full bg-black object-cover"
                style={{
                  aspectRatio:
                    video.width && video.height
                      ? `${video.width} / ${video.height}`
                      : "16 / 9",
                }}
                muted
                playsInline
                preload="metadata"
                onError={() => {
                  // codec/src 不支持时静默；外层已经有 Play 按钮和封面，UI 不会破
                }}
              />
            )}

            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(15,23,42,0.04),rgba(15,23,42,0.42))]" />
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-black/56 text-white transition group-hover:scale-[1.04] group-active:scale-[0.98]">
                <Play size={22} className="translate-x-[1px] fill-current" />
              </span>
            </div>
            <div className="pointer-events-none absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-black/58 px-3 py-1 text-[11px] font-medium text-white">
              <Play size={12} className="fill-current" />
              {t(msg`视频`)}
            </div>
            {video.durationMs ? (
              <div className="pointer-events-none absolute bottom-3 right-3 rounded-full bg-black/58 px-3 py-1 text-[11px] font-medium text-white">
                {formatMomentDurationLabel(video.durationMs)}
              </div>
            ) : null}
          </button>
        </div>

        {viewerState?.kind === "video" ? (
          <MomentVideoViewerOverlay
            video={video}
            onClose={() => setViewerState(null)}
          />
        ) : null}
      </>
    );
  }

  const activeImage =
    viewerState?.kind === "image" ? images[viewerState.index] ?? null : null;
  const isMobileVariant = variant === "mobile";

  // WeChat 九宫格规则（1:1 视觉克隆）：
  // 1 张：单图按原比例自适应（最大 ~210px 宽）
  // 4 张：2×2，宽度 = 2 × 单格 + 1 × gap
  // 其他：3 列方格
  const cellSize = 105; // i18n-ignore-line: dev comment - px，单方格边长（mobile）
  const cellSizeNonMobile = 110;
  const gridGapPx = 4;
  const cellPx = isMobileVariant ? cellSize : cellSizeNonMobile;

  if (isMobileVariant && images.length === 1) {
    const single = images[0]!;
    return (
      <>
        <div onClick={handleRootClick}>
          <button
            key={single.id}
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setViewerState({ kind: "image", index: 0 });
            }}
            className="relative block overflow-hidden rounded-[3px] bg-[#EAEAEA] text-left"
            style={computeWeChatSingleImageStyle(single)}
          >
            <img
              src={resolveAppMediaUrl(single.thumbnailUrl || single.url)}
              alt={single.fileName || t(msg`朋友圈图片`)}
              className="h-full w-full object-cover"
              loading="lazy"
              decoding="async"
            />
            {single.livePhoto?.enabled ? (
              <div className="pointer-events-none absolute left-1.5 top-1.5 rounded-[2px] bg-black/58 px-1.5 py-0.5 text-[10px] font-medium text-white">
                {t(msg`实况`)}
              </div>
            ) : null}
          </button>
        </div>

        {activeImage ? (
          <MomentImageViewerOverlay
            image={activeImage}
            activeIndex={viewerState?.kind === "image" ? viewerState.index : 0}
            total={images.length}
            onClose={() => setViewerState(null)}
            onPrevious={undefined}
            onNext={undefined}
            variant={variant}
          />
        ) : null}
      </>
    );
  }

  if (isMobileVariant && images.length === 4) {
    const totalWidth = cellPx * 2 + gridGapPx;
    return (
      <>
        <div onClick={handleRootClick}>
          <div
            className="grid grid-cols-2"
            style={{
              gap: `${gridGapPx}px`,
              width: `${totalWidth}px`,
            }}
          >
            {images.map((asset, index) => (
              <WeChatGridCell
                key={asset.id}
                asset={asset}
                size={cellPx}
                onOpen={() =>
                  setViewerState({ kind: "image", index })
                }
              />
            ))}
          </div>
        </div>

        {activeImage ? (
          <MomentImageViewerOverlay
            image={activeImage}
            activeIndex={viewerState?.kind === "image" ? viewerState.index : 0}
            total={images.length}
            onClose={() => setViewerState(null)}
            onPrevious={
              viewerState?.kind === "image" && viewerState.index > 0
                ? () =>
                    setViewerState((current) =>
                      current?.kind === "image"
                        ? {
                            kind: "image",
                            index: Math.max(current.index - 1, 0),
                          }
                        : current,
                    )
                : undefined
            }
            onNext={
              viewerState?.kind === "image" &&
              viewerState.index < images.length - 1
                ? () =>
                    setViewerState((current) =>
                      current?.kind === "image"
                        ? {
                            kind: "image",
                            index: Math.min(
                              current.index + 1,
                              images.length - 1,
                            ),
                          }
                        : current,
                    )
                : undefined
            }
            variant={variant}
          />
        ) : null}
      </>
    );
  }

  if (isMobileVariant) {
    // 2-3 张：单行；5-9 张：3 列方格
    const columns = Math.min(images.length === 2 ? 2 : 3, images.length);
    const totalWidth = cellPx * columns + gridGapPx * (columns - 1);
    return (
      <>
        <div onClick={handleRootClick}>
          <div
            className="grid"
            style={{
              gridTemplateColumns: `repeat(${columns}, ${cellPx}px)`,
              gap: `${gridGapPx}px`,
              width: `${totalWidth}px`,
            }}
          >
            {images.map((asset, index) => (
              <WeChatGridCell
                key={asset.id}
                asset={asset}
                size={cellPx}
                onOpen={() =>
                  setViewerState({ kind: "image", index })
                }
              />
            ))}
          </div>
        </div>

        {activeImage ? (
          <MomentImageViewerOverlay
            image={activeImage}
            activeIndex={viewerState?.kind === "image" ? viewerState.index : 0}
            total={images.length}
            onClose={() => setViewerState(null)}
            onPrevious={
              viewerState?.kind === "image" && viewerState.index > 0
                ? () =>
                    setViewerState((current) =>
                      current?.kind === "image"
                        ? {
                            kind: "image",
                            index: Math.max(current.index - 1, 0),
                          }
                        : current,
                    )
                : undefined
            }
            onNext={
              viewerState?.kind === "image" &&
              viewerState.index < images.length - 1
                ? () =>
                    setViewerState((current) =>
                      current?.kind === "image"
                        ? {
                            kind: "image",
                            index: Math.min(
                              current.index + 1,
                              images.length - 1,
                            ),
                          }
                        : current,
                    )
                : undefined
            }
            variant={variant}
          />
        ) : null}
      </>
    );
  }

  // Desktop / detail variants 保持原有 grid 布局
  const columnClassName =
    images.length === 1
      ? "grid-cols-1"
      : images.length === 2 || images.length === 4
        ? "grid-cols-2"
        : "grid-cols-3";

  return (
    <>
      <div
        className={cn(
          "grid gap-2.5",
          columnClassName,
          variant === "detail" ? "max-w-full" : "max-w-[360px]",
        )}
        onClick={handleRootClick}
      >
        {images.map((asset, index) => (
          <button
            key={asset.id}
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setViewerState({
                kind: "image",
                index,
              });
            }}
            className="relative overflow-hidden rounded-[18px] border border-[color:var(--border-faint)] bg-[color:var(--surface-console)] text-left"
            style={{
              aspectRatio:
                images.length === 1 && asset.width && asset.height
                  ? `${asset.width} / ${asset.height}`
                  : "1 / 1",
            }}
          >
            <img
              src={resolveAppMediaUrl(asset.thumbnailUrl || asset.url)}
              alt={asset.fileName || t(msg`朋友圈图片`)}
              className="h-full w-full object-cover transition duration-200 hover:scale-[1.015]"
              loading="lazy"
              decoding="async"
            />
            {asset.livePhoto?.enabled ? (
              <div className="pointer-events-none absolute left-2 top-2 rounded-full bg-black/58 px-2.5 py-1 text-[10px] font-medium text-white">
                {t(msg`实况`)}
              </div>
            ) : null}
          </button>
        ))}
      </div>

      {activeImage ? (
        <MomentImageViewerOverlay
          image={activeImage}
          activeIndex={viewerState?.kind === "image" ? viewerState.index : 0}
          total={images.length}
          onClose={() => setViewerState(null)}
          onPrevious={
            viewerState?.kind === "image" && viewerState.index > 0
              ? () =>
                  setViewerState((current) => {
                    if (!current || current.kind !== "image") {
                      return current;
                    }

                    return {
                      kind: "image",
                      index: Math.max(current.index - 1, 0),
                    };
                  })
              : undefined
          }
          onNext={
            viewerState?.kind === "image" && viewerState.index < images.length - 1
              ? () =>
                  setViewerState((current) => {
                    if (!current || current.kind !== "image") {
                      return current;
                    }

                    return {
                      kind: "image",
                      index: Math.min(current.index + 1, images.length - 1),
                    };
                  })
              : undefined
          }
          variant={variant}
        />
      ) : null}
    </>
  );
}

function MomentImageViewerOverlay({
  image,
  activeIndex,
  total,
  onClose,
  onPrevious,
  onNext,
  variant,
}: {
  image: MomentImageAsset;
  activeIndex: number;
  total: number;
  onClose: () => void;
  onPrevious?: () => void;
  onNext?: () => void;
  variant: "desktop" | "detail" | "mobile";
}) {
  const isMobile = variant === "mobile";

  return (
    <div className="fixed inset-0 z-50 bg-[rgba(15,23,42,0.92)] backdrop-blur-sm">
      <button
        type="button"
        onClick={onClose}
        className="absolute inset-0"
        aria-label={t(msg`关闭图片预览`)}
      />
      <div className="absolute inset-x-0 top-[calc(env(safe-area-inset-top,0px)+0.75rem)] z-10 flex items-center justify-between gap-3 px-4 text-white">
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/12 text-white"
          aria-label={t(msg`关闭图片预览`)}
        >
          <X size={18} />
        </button>
        <div className="min-w-0 flex-1 text-center">
          <div className="truncate text-sm font-medium">
            {image.fileName || t(msg`朋友圈图片`)}
          </div>
          <div className="mt-1 text-xs text-white/70">
            {activeIndex + 1} / {total}
          </div>
        </div>
        <div className="w-10 shrink-0" aria-hidden="true" />
      </div>

      <div className="absolute inset-0 flex items-center justify-center px-4 pb-[calc(env(safe-area-inset-bottom,0px)+4.5rem)] pt-[calc(env(safe-area-inset-top,0px)+4.5rem)]">
        <img
          src={resolveAppMediaUrl(image.url)}
          alt={image.fileName || t(msg`朋友圈图片`)}
          className="max-h-full max-w-full object-contain"
        />
      </div>

      {onPrevious ? (
        <ViewerNavButton
          position={isMobile ? "bottom-left" : "left"}
          label={t(msg`上一张`)}
          onClick={onPrevious}
        >
          <ChevronLeft size={20} />
        </ViewerNavButton>
      ) : null}
      {onNext ? (
        <ViewerNavButton
          position={isMobile ? "bottom-right" : "right"}
          label={t(msg`下一张`)}
          onClick={onNext}
        >
          <ChevronRight size={20} />
        </ViewerNavButton>
      ) : null}
    </div>
  );
}

function MomentVideoViewerOverlay({
  video,
  onClose,
}: {
  video: MomentVideoAsset;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [needsManualPlay, setNeedsManualPlay] = useState(false);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    const promise = el.play();
    if (promise && typeof promise.catch === "function") {
      promise.catch(() => {
        // iOS / 静音策略 / codec 不支持 → 回退到手动播放按钮
        setNeedsManualPlay(true);
      });
    }
  }, []);

  const handleManualPlay = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    const el = videoRef.current;
    if (!el) return;
    const promise = el.play();
    if (promise && typeof promise.catch === "function") {
      promise.catch(() => {
        // 仍失败时保持按钮可见，不再上报
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[rgba(15,23,42,0.94)] backdrop-blur-sm">
      <button
        type="button"
        onClick={onClose}
        className="absolute inset-0"
        aria-label={t(msg`关闭视频预览`)}
      />
      <div className="absolute inset-x-0 top-[calc(env(safe-area-inset-top,0px)+0.75rem)] z-10 flex items-center justify-between gap-3 px-4 text-white">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">
            {video.fileName || t(msg`朋友圈视频`)}
          </div>
          {video.durationMs ? (
            <div className="mt-1 text-xs text-white/70">
              {t(msg`时长 ${formatMomentDurationLabel(video.durationMs)}`)}
            </div>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/12 text-white"
          aria-label={t(msg`关闭视频预览`)}
        >
          <X size={18} />
        </button>
      </div>

      <div className="absolute inset-0 flex items-center justify-center px-4 pb-[calc(env(safe-area-inset-bottom,0px)+2rem)] pt-[calc(env(safe-area-inset-top,0px)+4.5rem)]">
        <video
          ref={videoRef}
          src={resolveAppMediaUrl(video.url)}
          poster={video.posterUrl ? resolveAppMediaUrl(video.posterUrl) : undefined}
          className="max-h-full max-w-full rounded-[20px] bg-black"
          controls
          playsInline
          onError={() => setNeedsManualPlay(true)}
          onPlay={() => setNeedsManualPlay(false)}
        />
        {needsManualPlay ? (
          <button
            type="button"
            onClick={handleManualPlay}
            className="absolute inset-0 z-10 flex items-center justify-center bg-black/30"
            aria-label={t(msg`播放视频`)}
          >
            <span className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-black/68 text-white">
              <Play size={28} className="translate-x-[2px] fill-current" />
            </span>
          </button>
        ) : null}
      </div>
    </div>
  );
}

function WeChatGridCell({
  asset,
  size,
  onOpen,
}: {
  asset: MomentImageAsset;
  size: number;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onOpen();
      }}
      className="relative overflow-hidden rounded-[3px] bg-[#EAEAEA] text-left"
      style={{ width: `${size}px`, height: `${size}px` }}
    >
      <img
        src={resolveAppMediaUrl(asset.thumbnailUrl || asset.url)}
        alt={asset.fileName || t(msg`朋友圈图片`)}
        className="h-full w-full object-cover"
        loading="lazy"
        decoding="async"
      />
      {asset.livePhoto?.enabled ? (
        <div className="pointer-events-none absolute left-1.5 top-1.5 rounded-[2px] bg-black/58 px-1.5 py-0.5 text-[10px] font-medium text-white">
          {t(msg`实况`)}
        </div>
      ) : null}
    </button>
  );
}

function computeWeChatSingleImageStyle(
  asset: MomentImageAsset,
): { width: string; height: string } {
  const SQUARE = 165; // i18n-ignore-line: dev comment
  const LONG = 220; // i18n-ignore-line: dev comment
  const SHORT = 145; // i18n-ignore-line: dev comment
  const w = asset.width ?? 0;
  const h = asset.height ?? 0;

  if (!w || !h) {
    return { width: `${SQUARE}px`, height: `${SQUARE}px` };
  }

  const ratio = w / h;
  if (ratio >= 1.18) {
    // 横图
    return { width: `${LONG}px`, height: `${SHORT}px` };
  }
  if (ratio <= 0.84) {
    // 竖图
    return { width: `${SHORT}px`, height: `${LONG}px` };
  }
  // 接近方形
  return { width: `${SQUARE}px`, height: `${SQUARE}px` };
}

function ViewerNavButton({
  position,
  label,
  onClick,
  children,
}: {
  position: "left" | "right" | "bottom-left" | "bottom-right";
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn(
        "absolute z-10 inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/12 text-white transition hover:bg-white/18",
        position === "left" ? "left-5 top-1/2 -translate-y-1/2" : "",
        position === "right" ? "right-5 top-1/2 -translate-y-1/2" : "",
        position === "bottom-left"
          ? "bottom-[calc(env(safe-area-inset-bottom,0px)+1rem)] left-5"
          : "",
        position === "bottom-right"
          ? "bottom-[calc(env(safe-area-inset-bottom,0px)+1rem)] right-5"
          : "",
      )}
    >
      {children}
    </button>
  );
}
