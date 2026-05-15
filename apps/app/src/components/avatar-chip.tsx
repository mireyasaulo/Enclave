import { useEffect, useState } from "react";
import defaultAvatarDusk from "../assets/default-avatar-dusk.svg";
import defaultAvatarEmber from "../assets/default-avatar-ember.svg";
import defaultAvatarMint from "../assets/default-avatar-mint.svg";
import defaultOwnerAvatar from "../assets/default-owner-avatar.svg";
import { resolveAppMediaUrl } from "../lib/media-url";

const fallbackAvatars = [
  defaultOwnerAvatar,
  defaultAvatarEmber,
  defaultAvatarMint,
  defaultAvatarDusk,
];

export function AvatarChip({
  name,
  src,
  size = "md",
}: {
  name?: string | null;
  src?: string | null;
  size?: "sm" | "md" | "lg" | "xl" | "wechat";
}) {
  const [loadFailed, setLoadFailed] = useState(false);
  const classes =
    size === "sm"
      ? "h-9 w-9 rounded-[16px] text-sm"
      : size === "xl"
        ? "h-16 w-16 rounded-full text-2xl"
        : size === "wechat"
          ? "h-12 w-12 rounded-xl text-base"
          : size === "lg"
            ? "h-14 w-14 rounded-full text-xl"
            : "h-11 w-11 rounded-full text-base";
  const trimmedSrc = src?.trim() ?? "";

  useEffect(() => {
    setLoadFailed(false);
  }, [trimmedSrc]);

  // 角色 / 好友请求里 avatar 经常被存成单 emoji（比如 🌙 / 💬 / ☀️），
  // 之前 isLikelyImageSource 直接 false → 全部回落到默认渐变头像，导致「新的朋友」
  // 里 4/5 张头像都长得一样、看不出谁是谁。这里把 emoji 直接当文字 glyph 渲染，
  // 背景仍然走稳定 hash 出的渐变色，肉眼能立刻区分。
  if (!isLikelyImageSource(trimmedSrc) && isEmojiAvatar(trimmedSrc)) {
    const emojiTextSize =
      size === "sm"
        ? "text-[18px]"
        : size === "xl"
          ? "text-[34px]"
          : size === "wechat"
            ? "text-[24px]"
            : size === "lg"
              ? "text-[28px]"
              : "text-[22px]";
    return (
      <span
        aria-label={name ?? "avatar"}
        className={`${classes} ${emojiTextSize} yj-no-callout flex items-center justify-center border border-white/80 bg-[color:var(--surface-console,#f5f5f5)] leading-none shadow-[var(--shadow-soft)]`}
      >
        <span aria-hidden="true">{trimmedSrc}</span>
      </span>
    );
  }

  const fallbackSrc = pickFallbackAvatar(name, trimmedSrc);
  const resolvedSrc =
    !loadFailed && isLikelyImageSource(trimmedSrc)
      ? resolveAvatarSource(trimmedSrc)
      : fallbackSrc;

  return (
    <img
      src={resolvedSrc}
      alt={name ?? "avatar"}
      loading="lazy"
      decoding="async"
      onError={() => {
        if (!loadFailed) {
          setLoadFailed(true);
        }
      }}
      draggable={false}
      className={`${classes} yj-no-callout border border-white/80 object-cover shadow-[var(--shadow-soft)]`}
    />
  );
}

const EMOJI_PICTOGRAPHIC = /\p{Extended_Pictographic}/u;

function isEmojiAvatar(value: string) {
  if (!value) {
    return false;
  }
  // 限定到「短串 + 含 emoji code point」：避免把名字里有 emoji 的长字符串当 emoji
  // 头像渲染（那种应该走文字 fallback）。一个复合 emoji（带 ZWJ / 修饰符）大概
  // 6~8 个 UTF-16 code unit，这里给 12 留点余地。
  if (value.length > 12) {
    return false;
  }
  return EMOJI_PICTOGRAPHIC.test(value);
}

function isLikelyImageSource(value: string) {
  if (!value) {
    return false;
  }

  return (
    value.startsWith("/") ||
    value.startsWith("./") ||
    value.startsWith("../") ||
    value.startsWith("blob:") ||
    /^https?:\/\//i.test(value) ||
    /^data:image\//i.test(value) ||
    /\.(png|jpe?g|gif|webp|avif|svg)(\?.*)?$/i.test(value)
  );
}

function resolveAvatarSource(value: string) {
  if (!value.startsWith("/api/")) {
    return value;
  }
  // 走 resolveAppMediaUrl 统一处理：(a) 拼前缀时保留 /cloud/world-api，
  // (b) 远程公网入口下追加 ?token= 让 cloud-api guard 放行（commit 1c20a2fe
  // 把裸 /api/ 在公网 Host 一律 403 兜底防匿名直通本机 owner db）。
  return resolveAppMediaUrl(value);
}

function pickFallbackAvatar(name?: string | null, src?: string | null) {
  const seedParts = [name?.trim(), src?.trim()].filter(Boolean);
  const seed = seedParts.join(":") || "yinjie-avatar";
  let hash = 0;

  for (const character of seed) {
    hash = (hash * 33 + (character.codePointAt(0) ?? 0)) >>> 0;
  }

  return fallbackAvatars[hash % fallbackAvatars.length] ?? defaultOwnerAvatar;
}
