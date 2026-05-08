import { useEffect, useMemo } from "react";
import { msg } from "@lingui/macro";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, PenSquare } from "lucide-react";
import { getMoments } from "@yinjie/contracts";
import { useRuntimeTranslator } from "@yinjie/i18n";
import {
  AppPage,
  Button,
  ErrorBlock,
  LoadingBlock,
  cn,
} from "@yinjie/ui";
import { AvatarChip } from "../components/avatar-chip";
import { EmptyState } from "../components/empty-state";
import { MomentMediaGallery } from "../components/moment-media-gallery";
import { TabPageTopBar } from "../components/tab-page-top-bar";
import { buildDesktopMomentsRouteHash } from "../features/moments/moments-route-state";
import { buildMobileMomentsPublishRouteHash } from "../features/moments/mobile-moments-publish-route-state";
import { useDesktopLayout } from "../features/shell/use-desktop-layout";
import { formatTimestamp } from "../lib/format";
import { navigateBackOrFallback } from "../lib/history-back";
import { describeRequestError } from "../lib/request-error";
import { useAppRuntimeConfig } from "../runtime/runtime-config-store";
import { useWorldOwnerStore } from "../store/world-owner-store";

const PUBLISH_RETURN_HASH = buildMobileMomentsPublishRouteHash({
  returnPath: "/profile/moments",
});

export function ProfileMomentsPage() {
  const t = useRuntimeTranslator();
  const navigate = useNavigate();
  const isDesktopLayout = useDesktopLayout();
  const runtimeConfig = useAppRuntimeConfig();
  const baseUrl = runtimeConfig.apiBaseUrl;
  const ownerId = useWorldOwnerStore((state) => state.id);
  const ownerName = useWorldOwnerStore((state) => state.username);
  const ownerAvatar = useWorldOwnerStore((state) => state.avatar);

  useEffect(() => {
    if (isDesktopLayout) {
      void navigate({ to: "/tabs/moments", replace: true });
    }
  }, [isDesktopLayout, navigate]);

  const momentsQuery = useQuery({
    queryKey: ["app-moments", baseUrl],
    queryFn: () => getMoments(baseUrl),
  });

  const ownMoments = useMemo(() => {
    if (!momentsQuery.data || !ownerId) {
      return [];
    }
    return momentsQuery.data.filter(
      (moment) => moment.authorType === "user" && moment.authorId === ownerId,
    );
  }, [momentsQuery.data, ownerId]);

  if (isDesktopLayout) {
    return null;
  }

  const goBack = () =>
    navigateBackOrFallback(() =>
      navigate({ to: "/tabs/profile", replace: true }),
    );

  const goPublish = () =>
    navigate({
      to: "/discover/moments/publish",
      hash: PUBLISH_RETURN_HASH,
    });

  const displayName = ownerName?.trim() || t(msg`世界主人`);

  return (
    <AppPage className="space-y-0 bg-[color:var(--bg-canvas)] px-0 py-0">
      <TabPageTopBar
        title={t(msg`我的朋友圈`)}
        titleAlign="center"
        leftActions={
          <button
            type="button"
            onClick={goBack}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[color:var(--text-primary)] transition-colors active:bg-black/[0.05]"
            aria-label={t(msg`返回`)}
          >
            <ArrowLeft size={17} />
          </button>
        }
        rightActions={
          <button
            type="button"
            onClick={goPublish}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[color:var(--text-primary)] transition-colors active:bg-black/[0.05]"
            aria-label={t(msg`发条朋友圈`)}
          >
            <PenSquare size={17} />
          </button>
        }
      />

      <section className="relative h-44 w-full overflow-hidden bg-[linear-gradient(135deg,#34a853_0%,#0f8b3a_55%,#085c25_100%)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_25%,rgba(255,255,255,0.32),transparent_60%)]" />
        <div className="absolute bottom-3 right-4 flex items-end gap-3">
          <div className="text-right text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.28)]">
            <div className="text-[15px] font-medium leading-tight">
              {displayName}
            </div>
          </div>
          <div className="translate-y-7">
            <AvatarChip name={displayName} src={ownerAvatar} size="lg" />
          </div>
        </div>
      </section>

      <div className="space-y-2.5 pb-[calc(env(safe-area-inset-bottom,0px)+1.5rem)] pt-10">
        {momentsQuery.isLoading ? (
          <div className="px-4">
            <LoadingBlock label={t(msg`正在加载我的朋友圈`)} />
          </div>
        ) : null}

        {momentsQuery.isError && momentsQuery.error ? (
          <div className="px-4">
            <ErrorBlock message={describeRequestError(momentsQuery.error)} />
          </div>
        ) : null}

        {!momentsQuery.isLoading &&
        !momentsQuery.isError &&
        ownMoments.length === 0 ? (
          <div className="px-4">
            <EmptyState
              title={t(msg`还没有发布过朋友圈`)}
              description={t(msg`记录此刻，你的朋友圈会出现在这里。`)}
              action={
                <Button
                  variant="primary"
                  className="rounded-full bg-[#07c160] px-5 text-[13px] text-white shadow-none hover:bg-[#06ad56]"
                  onClick={goPublish}
                >
                  {t(msg`发条朋友圈`)}
                </Button>
              }
            />
          </div>
        ) : null}

        {ownMoments.map((moment) => {
          const detailHash = buildDesktopMomentsRouteHash({
            momentId: moment.id,
            returnPath: "/profile/moments",
          });

          return (
            <Link
              key={moment.id}
              to="/tabs/moments"
              hash={detailHash}
              className={cn(
                "mx-4 block rounded-[14px] border border-[color:var(--border-faint)] bg-white px-4 py-3 transition-colors",
                "active:bg-[color:var(--surface-card-hover)]",
              )}
            >
              <div className="text-[11px] tracking-[0.04em] text-[color:var(--text-muted)]">
                {formatTimestamp(moment.postedAt)}
              </div>
              {moment.text ? (
                <p className="mt-1.5 whitespace-pre-wrap text-[14px] leading-7 text-[color:var(--text-primary)]">
                  {moment.text}
                </p>
              ) : null}
              {moment.media.length ? (
                <div className="mt-2.5">
                  <MomentMediaGallery
                    contentType={moment.contentType}
                    media={moment.media}
                    variant="mobile"
                    stopPropagation
                  />
                </div>
              ) : null}
              {moment.location ? (
                <div className="mt-2 text-[12px] text-[color:var(--text-secondary)]">
                  {moment.location}
                </div>
              ) : null}
              <div className="mt-2.5 flex gap-3 text-[12px] text-[color:var(--text-muted)]">
                <span>
                  {t(msg`点赞`)} {moment.likeCount}
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  {t(msg`评论`)} {moment.commentCount}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </AppPage>
  );
}
