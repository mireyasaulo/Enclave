import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { msg } from "@lingui/macro";
import { Heart, MessageCircle } from "lucide-react";
import { translateRuntimeMessage } from "@yinjie/i18n";

const t = translateRuntimeMessage;

type WeChatActionBubbleProps = {
  open: boolean;
  anchorRect: DOMRect | null;
  liked: boolean;
  onLike: () => void;
  onComment: () => void;
  onClose: () => void;
};

export function WeChatActionBubble({
  open,
  anchorRect,
  liked,
  onLike,
  onComment,
  onClose,
}: WeChatActionBubbleProps) {
  const [mounted, setMounted] = useState(false);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number }>({
    top: -1000,
    left: -1000,
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  // Close on outside tap, scroll, resize, or Escape.
  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: Event) => {
      const target = event.target as Node | null;
      if (target && bubbleRef.current?.contains(target)) {
        return;
      }
      onClose();
    };
    const handleScroll = () => onClose();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("pointerdown", handlePointerDown, true);
    window.addEventListener("scroll", handleScroll, true);
    window.addEventListener("resize", handleScroll);
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown, true);
      window.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("resize", handleScroll);
      window.removeEventListener("keydown", handleKey);
    };
  }, [open, onClose]);

  useLayoutEffect(() => {
    if (!open || !anchorRect || !bubbleRef.current) return;
    const bubble = bubbleRef.current.getBoundingClientRect();
    // 微信样式：气泡出现在 ⋯ 按钮左侧，垂直居中
    const desiredLeft = anchorRect.left - bubble.width - 6;
    const desiredTop =
      anchorRect.top + (anchorRect.height - bubble.height) / 2;

    const safeLeft = Math.max(8, desiredLeft);
    const safeTop = Math.max(8, desiredTop);
    setPosition({ left: safeLeft, top: safeTop });
  }, [open, anchorRect]);

  if (!mounted || !open || !anchorRect) {
    return null;
  }

  return createPortal(
    <div
      ref={bubbleRef}
      role="menu"
      style={{
        position: "fixed",
        top: position.top,
        left: position.left,
        zIndex: 1000,
      }}
      className="flex h-9 items-stretch overflow-hidden rounded-[6px] bg-[#4C4C4C] text-[14px] text-white shadow-[0_4px_18px_rgba(0,0,0,0.25)]"
    >
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onLike();
          onClose();
        }}
        className="flex items-center gap-1 px-3.5 transition-colors active:bg-black/30"
      >
        <Heart
          size={14}
          className={liked ? "fill-[#FA5151] text-[#FA5151]" : "text-white"}
        />
        <span>{liked ? t(msg`取消`) : t(msg`赞`)}</span>
      </button>
      <span className="my-1.5 w-px bg-white/25" aria-hidden="true" />
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onComment();
          onClose();
        }}
        className="flex items-center gap-1 px-3.5 transition-colors active:bg-black/30"
      >
        <MessageCircle size={14} />
        <span>{t(msg`评论`)}</span>
      </button>

      <span
        aria-hidden="true"
        className="absolute"
        style={{
          right: -5,
          top: "50%",
          transform: "translateY(-50%) rotate(45deg)",
          width: 8,
          height: 8,
          backgroundColor: "#4C4C4C",
        }}
      />
    </div>,
    document.body,
  );
}
