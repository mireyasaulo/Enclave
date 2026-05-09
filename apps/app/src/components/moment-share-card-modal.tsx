import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { msg } from "@lingui/macro";
import * as htmlToImage from "html-to-image";
import QRCode from "qrcode";
import { translateRuntimeMessage } from "@yinjie/i18n";
import type { Moment } from "@yinjie/contracts";
import { WeChatMomentCard } from "./wechat-moment-card";

const t = translateRuntimeMessage;

// 水印里的 QR 与文案都指向 site 主域名。
// 不读 env，因为 app 客户端的 SITE_URL 没有现成常量，且这个值固定。
const SITE_URL = "https://www.enclave.top";

type Props = {
  moment: Moment | null;
  /** 卡片上"自己点过赞"展示用 — 不影响导出逻辑，与 actionBubble 共享 */
  liked: boolean;
  /** 当前用户 id，传给 WeChatMomentCard 用于"是否本人发布"等判断 */
  ownerId: string | null;
  /** 水印文案里的 "{name} 的 AI 朋友圈" */
  ownerDisplayName: string;
  onClose: () => void;
};

export function MomentShareCardModal({
  moment,
  liked,
  ownerId,
  ownerDisplayName,
  onClose,
}: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [pngDataUrl, setPngDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 生成一次 QR — site URL 固定。失败时悄悄省掉，水印仍然有文字。
  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(SITE_URL, {
      margin: 1,
      width: 128,
      errorCorrectionLevel: "M",
    })
      .then((url) => {
        if (!cancelled) setQr(url);
      })
      .catch(() => {
        if (!cancelled) setQr(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // 截图触发：每次换 moment 重做。等 QR 准备好（避免水印缺图）后再画。
  useEffect(() => {
    if (!moment) return;
    setPngDataUrl(null);
    setError(null);
    let cancelled = false;

    const run = async () => {
      // 等两帧让 React 完成首次绘制
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      );
      const node = cardRef.current;
      if (!node || cancelled) return;

      // 视频节点 html-to-image 画不出来（canvas drawImage 需要 video 加载完才行，
      // 实际上这里 video 通常没加载到 metadata）。把它替换成 poster 图，
      // 没 poster 就直接隐藏 — 这样导出图里不会出现一个空白方块。
      node.querySelectorAll("video").forEach((video) => {
        const poster = video.getAttribute("poster");
        if (poster) {
          const placeholder = document.createElement("img");
          placeholder.src = poster;
          placeholder.style.cssText = video.getAttribute("style") ?? "";
          placeholder.className = video.className;
          placeholder.width = video.clientWidth;
          placeholder.height = video.clientHeight;
          video.replaceWith(placeholder);
        } else {
          video.style.display = "none";
        }
      });

      // 把所有 <img> 转成同源 data URL — 避免 cross-origin 把 canvas tainted 后
      // toDataURL 抛 SecurityError。fetch 失败的图就让它空着，不影响其他元素。
      const imgs = Array.from(node.querySelectorAll("img"));
      await Promise.all(
        imgs.map(async (img) => {
          // 已经是 data: 的不动。
          if (!img.src || img.src.startsWith("data:")) return;
          try {
            const resp = await fetch(img.src, { cache: "force-cache" });
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const blob = await resp.blob();
            const dataUrl = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(String(reader.result));
              reader.onerror = () => reject(reader.error);
              reader.readAsDataURL(blob);
            });
            img.src = dataUrl;
            // 等一帧让 src 替换生效再继续
            await new Promise<void>((r) =>
              img.complete
                ? r()
                : img.addEventListener("load", () => r(), { once: true }),
            );
          } catch {
            // 单图加载失败不要拦住整张图卡，让它空着
          }
        }),
      );
      if (cancelled) return;

      try {
        const dataUrl = await htmlToImage.toPng(node, {
          pixelRatio: 2,
          cacheBust: false, // 已经转成 data URL 了，不再需要 cacheBust
          backgroundColor: "#ffffff",
        });
        if (!cancelled) setPngDataUrl(dataUrl);
      } catch (err) {
        console.error("[moment-share] export failed", err);
        if (!cancelled) {
          setError(t(msg`图片生成失败，请稍后重试`));
        }
      }
    };

    run();
    return () => {
      cancelled = true;
    };
    // moment 引用每次父组件 render 都新；只用 id 判定是否换了目标，避免无限重画。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moment?.id, qr]);

  // ESC 关闭 — 必须放在任何条件 return 之前以遵守 hooks 规则
  useEffect(() => {
    if (!moment) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [moment, onClose]);

  if (!moment) return null;

  const handleSaveOrShare = async () => {
    if (!pngDataUrl) return;
    const fileName = `enclave-moment-${moment.id}.png`;

    try {
      // 移动端优先尝试 Web Share API（带文件），iOS 15.4+ / Android Chrome 都支持
      if (
        typeof navigator !== "undefined" &&
        "canShare" in navigator &&
        "share" in navigator
      ) {
        try {
          const blob = await fetch(pngDataUrl).then((r) => r.blob());
          const file = new File([blob], fileName, { type: "image/png" });
          if (navigator.canShare({ files: [file] })) {
            await navigator.share({
              files: [file],
              title: t(msg`我的隐界朋友圈`),
              text: SITE_URL,
            });
            return;
          }
        } catch (shareErr) {
          // AbortError = 用户取消，不算错误；其它继续 fall through 到下载兜底
          if (
            shareErr instanceof Error &&
            shareErr.name === "AbortError"
          ) {
            return;
          }
        }
      }

      // 桌面 / 不支持 Web Share 的环境：直接触发下载
      const a = document.createElement("a");
      a.href = pngDataUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      console.error("[moment-share] save failed", err);
      setError(t(msg`保存失败，请长按图片手动保存`));
    }
  };

  // 导出渲染时禁用 ⋯ 按钮 + 删除按钮（onDelete 不传即可）
  const exportMoment: Moment = { ...moment, canInteract: false };

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/60 p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      {/* 离屏渲染目标：fixed + left:-10000 避开视口但仍参与布局，html-to-image 能拿到尺寸 */}
      <div
        aria-hidden="true"
        style={{
          position: "fixed",
          left: "-10000px",
          top: 0,
          width: 480,
          pointerEvents: "none",
        }}
      >
        <div
          ref={cardRef}
          style={{
            width: 480,
            background: "#FFFFFF",
            fontFamily:
              "-apple-system, BlinkMacSystemFont, 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Segoe UI', sans-serif",
          }}
        >
          <WeChatMomentCard
            moment={exportMoment}
            ownerId={ownerId}
            liked={liked}
            flush={false}
            onOpenActionMenu={() => {}}
          />
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              padding: "14px 16px 18px",
              borderTop: "1px solid #EDEDED",
              background: "#F7F7F7",
            }}
          >
            {qr ? (
              <img
                src={qr}
                alt=""
                width={72}
                height={72}
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: 6,
                  background: "#FFFFFF",
                  padding: 4,
                  border: "1px solid #E5E5E5",
                }}
              />
            ) : null}
            <div style={{ flex: 1, minWidth: 0, lineHeight: 1.5 }}>
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 600,
                  color: "#1A1A1A",
                  marginBottom: 2,
                }}
              >
                {t(msg`隐界 Enclave`)}
              </div>
              <div style={{ fontSize: 13, color: "#4C4C4C" }}>
                {t(msg`${ownerDisplayName} 的 AI 朋友圈`)}
              </div>
              <div style={{ fontSize: 12, color: "#9A9A9A", marginTop: 2 }}>
                {t(msg`enclave.top · 浏览器即开即用`)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 用户可见的预览 + 操作 */}
      <div className="relative flex w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <div className="text-[15px] font-medium text-gray-900">
            {t(msg`分享我的朋友圈`)}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t(msg`关闭`)}
            className="rounded-md px-2 py-1 text-sm text-gray-500 active:bg-gray-100"
          >
            ✕
          </button>
        </div>

        <div className="max-h-[60vh] overflow-auto bg-[#F2F2F2] p-3">
          {error ? (
            <div className="py-12 text-center text-sm text-red-500">{error}</div>
          ) : pngDataUrl ? (
            <img
              src={pngDataUrl}
              alt={t(msg`分享图卡预览`)}
              className="w-full rounded-md shadow-sm"
            />
          ) : (
            <div className="py-12 text-center text-sm text-gray-500">
              {t(msg`生成图片中…`)}
            </div>
          )}
        </div>

        <div className="border-t border-gray-100 px-4 py-3">
          <div className="mb-3 text-center text-[12px] text-gray-500">
            {t(msg`保存图片到相册，发到 X / 小红书 / 微博 让朋友看看你的 AI 世界`)}
          </div>
          <button
            type="button"
            onClick={handleSaveOrShare}
            disabled={!pngDataUrl}
            className="w-full rounded-full bg-[#07C160] py-3 text-[15px] font-medium text-white active:bg-[#06A050] disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            {t(msg`保存 / 分享图片`)}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

