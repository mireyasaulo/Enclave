import { type CSSProperties, type MouseEventHandler } from "react";
import { Camera } from "lucide-react";
import { cn } from "@yinjie/ui";

const DEFAULT_COVER_GRADIENT =
  "linear-gradient(135deg,#5d7fa6 0%,#6f8caa 38%,#9aaec4 100%)";

type WeChatMomentsCoverProps = {
  nickname: string;
  avatarUrl?: string | null;
  coverUrl?: string | null;
  className?: string;
  /**
   * 当为 true 时显示一个空的右下方相机图标（仅装饰，不绑功能），
   * 微信封面右下角是更换封面的入口。
   */
  showCoverEditHint?: boolean;
  onAvatarTap?: MouseEventHandler<HTMLButtonElement>;
};

export function WeChatMomentsCover({
  nickname,
  avatarUrl,
  coverUrl,
  className,
  showCoverEditHint = false,
  onAvatarTap,
}: WeChatMomentsCoverProps) {
  const safeNickname = nickname?.trim() || " ";
  const initial = safeNickname.slice(0, 1).toUpperCase();

  const coverStyle: CSSProperties = coverUrl
    ? {
        backgroundImage: `url(${JSON.stringify(coverUrl)})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }
    : { backgroundImage: DEFAULT_COVER_GRADIENT };

  return (
    <section
      className={cn(
        "relative h-[260px] w-full overflow-hidden bg-[#9aaec4]",
        className,
      )}
      style={coverStyle}
    >
      {!coverUrl ? (
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_22%_28%,rgba(255,255,255,0.35),transparent_55%),radial-gradient(circle_at_82%_82%,rgba(15,23,42,0.22),transparent_50%)]" />
      ) : null}

      {showCoverEditHint ? (
        <div className="pointer-events-none absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-black/30 px-2.5 py-1 text-[11px] text-white/85 backdrop-blur-sm">
          <Camera size={13} />
        </div>
      ) : null}

      <div className="absolute bottom-3 right-4 flex items-end gap-3">
        <div
          className="max-w-[60vw] truncate text-right text-[17px] font-semibold leading-[22px] text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.32)]"
          aria-label={safeNickname}
        >
          {safeNickname}
        </div>
        {onAvatarTap ? (
          <button
            type="button"
            onClick={onAvatarTap}
            aria-label={safeNickname}
            className="translate-y-7 rounded-[6px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
          >
            <CoverAvatar src={avatarUrl} alt={safeNickname} initial={initial} />
          </button>
        ) : (
          <div className="translate-y-7">
            <CoverAvatar src={avatarUrl} alt={safeNickname} initial={initial} />
          </div>
        )}
      </div>
    </section>
  );
}

function CoverAvatar({
  src,
  alt,
  initial,
}: {
  src?: string | null;
  alt: string;
  initial: string;
}) {
  const trimmed = (src ?? "").trim();

  if (trimmed) {
    return (
      <img
        src={trimmed}
        alt={alt}
        loading="lazy"
        decoding="async"
        draggable={false}
        className="h-16 w-16 rounded-[6px] border border-white/85 object-cover shadow-[0_2px_10px_rgba(0,0,0,0.18)]"
      />
    );
  }

  return (
    <div className="flex h-16 w-16 items-center justify-center rounded-[6px] border border-white/85 bg-[linear-gradient(135deg,#cbd6e2,#9aaec4)] text-[20px] font-semibold text-white shadow-[0_2px_10px_rgba(0,0,0,0.18)]">
      {initial}
    </div>
  );
}
