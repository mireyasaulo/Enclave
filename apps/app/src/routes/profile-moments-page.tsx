import { useEffect, useMemo } from "react";
import { msg } from "@lingui/macro";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { getMoments } from "@yinjie/contracts";
import { useRuntimeTranslator } from "@yinjie/i18n";
import {
  AppPage,
  Button,
  ErrorBlock,
  LoadingBlock,
} from "@yinjie/ui";
import { AvatarChip } from "../components/avatar-chip";
import { EmptyState } from "../components/empty-state";
import { MomentMediaGallery } from "../components/moment-media-gallery";
import { TabPageTopBar } from "../components/tab-page-top-bar";
import { useDesktopLayout } from "../features/shell/use-desktop-layout";
import { formatTimestamp } from "../lib/format";
import { navigateBackOrFallback } from "../lib/history-back";
import { describeRequestError } from "../lib/request-error";
import { useAppRuntimeConfig } from "../runtime/runtime-config-store";
import { useWorldOwnerStore } from "../store/world-owner-store";

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
    return momentsQuery.data.filter((moment) => moment.authorId === ownerId);
  }, [momentsQuery.data, ownerId]);

  const goBack = () =>
    navigateBackOrFallback(() => {
      void navigate({ to: "/tabs/profile" });
    });

  return (
    <AppPage
      className="bg-[color:var(--bg-canvas)] px-4 pt-6"
      style={{
        paddingBottom: "max(1.5rem, calc(env(safe-area-inset-bottom, 0px) + 1.5rem))",
      }}
    >
      <TabPageTopBar
        title={t(msg`朋友圈`)}
        titleAlign="center"
        leftActions={
          <Button
            onClick={goBack}
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-full bg-transparent text-[color:var(--text-primary)] shadow-none active:bg-black/[0.05]"
            aria-label={t(msg`返回`)}
          >
            <ArrowLeft size={17} />
          </Button>
        }
      />

      <div className="mx-auto flex max-w-2xl flex-col gap-4">
        <section className="relative overflow-hidden rounded-[24px] bg-[linear-gradient(135deg,#a8e6a3,#6dbf68_60%,#3a8b35)] px-5 pt-10 pb-4 shadow-none">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.35),transparent_55%)]" />
          <div className="relative flex items-end justify-end gap-3">
            <div className="text-right text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.25)]">
              <div className="text-[15px] font-medium">
                {ownerName?.trim() || t(msg`世界主人`)}
              </div>
            </div>
            <AvatarChip name={ownerName ?? undefined} src={ownerAvatar} size="lg" />
          </div>
        </section>

        {momentsQuery.isLoading ? (
          <LoadingBlock label={t(msg`正在加载我的朋友圈…`)} />
        ) : momentsQuery.error ? (
          <ErrorBlock message={describeRequestError(momentsQuery.error)} />
        ) : ownMoments.length === 0 ? (
          <EmptyState
            title={t(msg`还没有发布过朋友圈`)}
            description={t(msg`在发现页的朋友圈里发布动态，记录你的世界。`)}
            action={
              <Button
                variant="primary"
                className="rounded-2xl bg-[#07c160] text-white shadow-none hover:bg-[#06ad56]"
                onClick={() => void navigate({ to: "/discover/moments" })}
              >
                {t(msg`去发布`)}
              </Button>
            }
          />
        ) : (
          <div className="space-y-3">
            {ownMoments.map((moment) => (
              <article
                key={moment.id}
                className="rounded-[18px] border border-[color:var(--border-faint)] bg-white px-4 py-4 shadow-none"
              >
                <div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--text-muted)]">
                  {formatTimestamp(moment.postedAt)}
                </div>
                {moment.text ? (
                  <p className="mt-2 whitespace-pre-wrap text-[14px] leading-7 text-[color:var(--text-primary)]">
                    {moment.text}
                  </p>
                ) : null}
                {moment.media.length ? (
                  <div className="mt-3">
                    <MomentMediaGallery
                      contentType={moment.contentType}
                      media={moment.media}
                      variant="mobile"
                    />
                  </div>
                ) : null}
                {moment.location ? (
                  <div className="mt-2 text-[12px] text-[color:var(--text-secondary)]">
                    {moment.location}
                  </div>
                ) : null}
                <div className="mt-3 flex gap-4 text-[12px] text-[color:var(--text-muted)]">
                  <span>
                    {t(msg`点赞`)} {moment.likeCount}
                  </span>
                  <span>
                    {t(msg`评论`)} {moment.commentCount}
                  </span>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </AppPage>
  );
}
