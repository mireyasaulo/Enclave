import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { msg } from "@lingui/macro";
import { translateRuntimeMessage } from "@yinjie/i18n";
import { cn } from "@yinjie/ui";
import { registerAndroidBackInterceptor } from "../runtime/android-back-button";

const t = translateRuntimeMessage;

export type WeChatCommentBarReplyTarget = {
  authorId: string;
  authorName: string;
  commentId: string;
};

type WeChatCommentBarProps = {
  open: boolean;
  /** 当 `replyTo` 为空时为「发表评论」；否则为「回复 xxx」。 */
  replyTo?: WeChatCommentBarReplyTarget | null;
  /** 已经持久化的草稿（用于父组件控制；可为空字符串）。 */
  value: string;
  onChange: (value: string) => void;
  pending?: boolean;
  onSubmit: () => void;
  onClose: () => void;
};

export function WeChatCommentBar({
  open,
  replyTo,
  value,
  onChange,
  pending = false,
  onSubmit,
  onClose,
}: WeChatCommentBarProps) {
  const [mounted, setMounted] = useState(false);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const [keyboardOffset, setKeyboardOffset] = useState(0);
  // 同步防双击锁——下方 handleSubmit 原本只 guard `canSubmit`，但 canSubmit 是
  // 上一次 render 时定下的 const，同一帧里连点 5 次会拿到同一份 canSubmit=true
  // 同步通过 5 次（CDP 实测：5 click → 5 POST /api/moments/X/comment 在 1ms 内
  // 飞出，朋友圈出 5 条一模一样的评论）。ref 同步赋值，第一次 click 翻 true
  // 后同帧内的所有后续 click 都被早返兜住。bar 每次重新 open（包括切换 moment）
  // 时清回 false，让下一条评论能正常发。
  const submittingRef = useRef(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Auto focus when opening; reset offset + submit lock when closing/reopening.
  useEffect(() => {
    if (!open) {
      setKeyboardOffset(0);
      return;
    }
    // 每次 bar 重新 open 都把同步锁清掉，让下一次评论能正常发——
    // 一次 send 锁住后 bar 关闭、mutation 完成、bar 再开（同 moment 或别的
    // moment）都会走这条 effect 把锁释放。
    submittingRef.current = false;
    requestAnimationFrame(() => {
      textAreaRef.current?.focus();
    });
  }, [open]);

  // mutation 失败时 bar 通常保持 open（父组件在 onSuccess 才关 bar；onError
  // 路径下 commentBarTarget 留着让用户能直接改文案重发）。pending 跟着翻回
  // false，看着可以重发，但 submittingRef 只在 open 转 true 时才清——bar 没
  // 关掉之前同步锁一直挂着，handleSubmit 早返。用户改完文案点"发送"完全
  // 没反应（点一次→等几秒→什么都没发生），只能先点空白关 bar 再重开才能
  // 发出去。盯 pending 的下沿，settle 后释放锁，bar 不需要 remount 也能继
  // 续发。
  useEffect(() => {
    if (!pending) {
      submittingRef.current = false;
    }
  }, [pending]);

  // Adjust for soft keyboard via VisualViewport.
  useEffect(() => {
    if (!open || typeof window === "undefined") return;
    const viewport = window.visualViewport;
    if (!viewport) return;

    const update = () => {
      const offset =
        window.innerHeight - (viewport.height + viewport.offsetTop);
      setKeyboardOffset(offset > 24 ? offset : 0);
    };

    update();
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    return () => {
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
    };
  }, [open]);

  // Close on Escape.
  // 走查 R1：之前 ESC handler 不看 IME composing —— 中文 / 日文用户在 textarea
  // 打字开候选窗时按 ESC 想关候选窗（系统行为），keydown 一样冒出来命中这条
  // handler 把整个评论 bar 关掉，已经敲的草稿留在 commentDrafts 不丢但 bar 自
  // 己消失用户必须再点一次评论入口才能继续。跟桌面广场动态 R1 (902d9f0a) 同
  // 修法：event.isComposing / event.keyCode===229 时跳过。
  useEffect(() => {
    if (!open) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (event.isComposing || event.keyCode === 229) return;
      onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  // Android 硬件 Back：bar 打开时按 Back 应该收 bar 而不是退掉整页。
  // 跟 chat 系列 (38a65fa5) / mobile-feed-publish discardConfirm / MomentMediaGallery
  // viewer 一致的模式。preventDefault + 返回 true 消费按键。
  useEffect(() => {
    if (!open) return;
    return registerAndroidBackInterceptor((event) => {
      event.preventDefault();
      onClose();
      return true;
    });
  }, [open, onClose]);

  // Auto-grow textarea up to 5 lines.
  useLayoutEffect(() => {
    const ta = textAreaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    const next = Math.min(ta.scrollHeight, 5 * 22 + 18);
    ta.style.height = `${next}px`;
  }, [value, open]);

  const placeholder = useMemo(() => {
    if (replyTo) {
      return t(msg`回复 ${replyTo.authorName}：`);
    }
    return t(msg`评论`);
  }, [replyTo]);

  const canSubmit = value.trim().length > 0 && !pending;

  const handleSubmit = () => {
    if (submittingRef.current) return;
    if (!canSubmit) return;
    submittingRef.current = true;
    onSubmit();
  };

  if (!mounted || !open) {
    return null;
  }

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[1000] bg-black/30 backdrop-blur-[1px]"
        onPointerDown={onClose}
      />
      <div
        className="fixed inset-x-0 z-[1001] bg-[#F7F7F7] shadow-[0_-4px_16px_rgba(0,0,0,0.08)]"
        style={{
          bottom: 0,
          paddingBottom: `max(env(safe-area-inset-bottom,0px), 6px)`,
          transform: keyboardOffset
            ? `translateY(-${keyboardOffset}px)`
            : "translateY(0)",
          transition: "transform 120ms ease-out",
        }}
      >
        <div className="flex items-end gap-2 px-3 py-2.5">
          <div className="min-w-0 flex-1 rounded-[6px] border border-[#E5E5E5] bg-white px-3 py-2 text-[15px] text-[#1A1A1A]">
            <textarea
              ref={textAreaRef}
              value={value}
              onChange={(event) => onChange(event.target.value)}
              placeholder={placeholder}
              rows={1}
              // 500 字软上限，跟后端 MOMENT_COMMENT_TOO_LONG 对齐——之前没有任何
              // 上限，长文评论会把整段 footer 撑开把卡片正文挤压到看不见。
              maxLength={500}
              className="block w-full resize-none border-0 bg-transparent text-[15px] leading-[22px] outline-none placeholder:text-[#B0B0B0]"
              onKeyDown={(event) => {
                if (event.key !== "Enter" || event.shiftKey) return;
                // 走查新一轮 Round 3：Android Chrome 部分 IME（搜狗 / 百度键盘
                // 等）在 composing 期间按 Enter 确认候选时，原生 KeyboardEvent
                // 的 isComposing 没置 true，仅 keyCode 走 229 信号；上方 ESC
                // 监听已经按这套双判定兜过，这条 Enter 路径却只看 isComposing
                // 漏了 keyCode。中文用户敲拼音回车选词时 handleSubmit 直接把
                // 半个词当评论发出去，UI 视感是"刚要选词突然评论就发了"。
                // 跟 desktop-feed-compose-panel R1 (76行) 同模式补全。
                if (
                  event.nativeEvent.isComposing ||
                  event.nativeEvent.keyCode === 229
                ) {
                  return;
                }
                event.preventDefault();
                handleSubmit();
              }}
            />
          </div>
          <button
            type="button"
            disabled={!canSubmit}
            onClick={handleSubmit}
            className={cn(
              "h-[36px] shrink-0 rounded-[4px] px-4 text-[14px] font-medium transition-colors",
              canSubmit
                ? "bg-[#07C160] text-white active:bg-[#06AD56]"
                : "bg-[#E5E5E5] text-[#B0B0B0]",
            )}
          >
            {pending ? t(msg`发送中`) : t(msg`发送`)}
          </button>
        </div>
      </div>
    </>,
    document.body,
  );
}
