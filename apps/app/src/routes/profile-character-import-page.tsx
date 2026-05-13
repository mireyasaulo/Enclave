import { useRef, useState } from "react";
import { msg } from "@lingui/macro";
import { useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  CheckCircle2,
  FileJson,
  FileUp,
  RefreshCcw,
  X,
} from "lucide-react";
import {
  importPersonalCharacter,
  type Character,
} from "@yinjie/contracts";
import { useRuntimeTranslator } from "@yinjie/i18n";
import { AppPage, Button, cn } from "@yinjie/ui";
import { TabPageTopBar } from "../components/tab-page-top-bar";
import { navigateBackOrFallback } from "../lib/history-back";
import { describeRequestError } from "../lib/request-error";

type Result =
  | {
      kind: "success";
      character: Character;
      overwrote: boolean;
    }
  | { kind: "danger"; message: string };

type FilePreview = {
  fileName: string;
  fileSize: number;
  payload: Record<string, unknown>;
};

// 桌面端 profile-page 直接 redirect 到 /desktop/settings 不渲染入口，所以
// "导入角色" Link 只在移动布局出现。但桌面用户通过 URL 直接访问这个页面
// 时不应该被无关 redirect 踢走 — 让它在桌面也可以工作（顶部栏是移动风格
// 但功能完整）。
export function ProfileCharacterImportPage() {
  const t = useRuntimeTranslator();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [preview, setPreview] = useState<FilePreview | null>(null);
  const [dragging, setDragging] = useState(false);

  const goBack = () =>
    navigateBackOrFallback(() => {
      void navigate({ to: "/tabs/profile" });
    });

  async function readFile(file: File) {
    // 清掉之前的预览和结果，避免新文件解析失败时还残留上一张预览卡误导用户
    setResult(null);
    setPreview(null);
    // 防御性：bundle 实际只有几十 KB，超过 5 MB 几乎一定是用户选错文件
    // （视频、压缩包等）。早早 reject 避免 file.text() 把上 GB 内容读到
    // 浏览器内存里把页面卡死。
    const MAX_BYTES = 5 * 1024 * 1024;
    if (file.size > MAX_BYTES) {
      setResult({
        kind: "danger",
        message: t(
          msg`文件太大（${formatFileSize(file.size)}），上限 5 MB。确认是 .character.json 文件后再试。`,
        ),
      });
      return;
    }
    let text: string;
    try {
      text = await file.text();
    } catch (err) {
      setResult({
        kind: "danger",
        message: t(msg`读取文件失败：${(err as Error).message}`),
      });
      return;
    }
    let payload: unknown;
    try {
      payload = JSON.parse(text);
    } catch (err) {
      setResult({
        kind: "danger",
        message: t(
          msg`JSON 解析失败，请确认文件没被破坏：${(err as Error).message}`,
        ),
      });
      return;
    }
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      setResult({
        kind: "danger",
        message: t(msg`文件内容不是有效的 JSON 对象。`),
      });
      return;
    }
    const p = payload as Record<string, unknown>;
    if (typeof p.name !== "string" || !p.name.trim()) {
      setResult({
        kind: "danger",
        message: t(msg`文件缺少 name 字段；这不是一个合法的角色 bundle。`),
      });
      return;
    }
    setPreview({
      fileName: file.name,
      fileSize: file.size,
      payload: p,
    });
  }

  function pickFile() {
    fileInputRef.current?.click();
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    void readFile(file);
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) void readFile(file);
  }

  function clearSelection() {
    setPreview(null);
    setResult(null);
  }

  async function confirmImport() {
    if (!preview) return;
    setSubmitting(true);
    setResult(null);
    try {
      const res = await importPersonalCharacter(preview.payload);
      setResult({
        kind: "success",
        character: res.character,
        overwrote: res.overwrote,
      });
      setPreview(null);
    } catch (err) {
      setResult({
        kind: "danger",
        message: describeRequestError(err, t(msg`导入失败，请稍后再试`)),
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppPage className="space-y-0 bg-[color:var(--bg-canvas)] px-0 py-0">
      <TabPageTopBar
        title={t(msg`导入角色`)}
        titleAlign="center"
        leftActions={
          <button
            type="button"
            onClick={goBack}
            aria-label={t(msg`返回`)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[color:var(--text-primary)] transition-colors active:bg-black/[0.05]"
          >
            <ArrowLeft size={17} />
          </button>
        }
      />

      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={handleFileChange}
      />

      <div className="space-y-4 px-4 pb-10 pt-3">
        {/* 步骤引导 */}
        <ol className="rounded-2xl border border-[color:var(--border-faint)] bg-[color:var(--bg-canvas-elevated)] p-4 text-[13px] leading-relaxed text-[color:var(--text-secondary)]">
          <li className="flex gap-2">
            <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[rgba(56,189,248,0.12)] text-[11px] font-semibold text-[#0891b2]">
              1
            </span>
            <span>
              {t(
                msg`在「世界角色管理平台」编辑或新建角色，点「📤 导出 JSON」下载文件`,
              )}
            </span>
          </li>
          <li className="mt-2 flex gap-2">
            <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[rgba(56,189,248,0.12)] text-[11px] font-semibold text-[#0891b2]">
              2
            </span>
            <span>
              {t(msg`回到这里，拖入或选择刚才下载的 .character.json 文件`)}
            </span>
          </li>
          <li className="mt-2 flex gap-2">
            <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[rgba(56,189,248,0.12)] text-[11px] font-semibold text-[#0891b2]">
              3
            </span>
            <span>
              {t(
                msg`确认无误后点「导入到我的世界」。同名会覆盖（保留原 id 和好友关系），不同名则新建并加为好友。`,
              )}
            </span>
          </li>
        </ol>

        {/* 文件投放区 / 预览区 */}
        {!preview && (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              if (!dragging) setDragging(true);
            }}
            onDragLeave={(e) => {
              // 防止鼠标拖到子元素时父元素 dragLeave 误触发产生闪烁；
              // 只有真正离开整个 drop zone 才 setDragging(false)。
              const next = e.relatedTarget as Node | null;
              if (next && e.currentTarget.contains(next)) return;
              setDragging(false);
            }}
            onDrop={handleDrop}
            className={cn(
              "flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed px-4 py-10 text-center transition-colors",
              dragging
                ? "border-[#0891b2] bg-[rgba(56,189,248,0.06)]"
                : "border-[color:var(--border-default)] bg-[color:var(--bg-canvas-elevated)]",
            )}
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[rgba(56,189,248,0.12)] text-[#0891b2]">
              <FileUp size={24} />
            </div>
            <div className="space-y-1">
              <div className="text-[14px] font-medium text-[color:var(--text-primary)]">
                {dragging
                  ? t(msg`松手即可读取`)
                  : t(msg`拖入文件，或点下面按钮选择`)}
              </div>
              <div className="text-[11px] text-[color:var(--text-muted)]">
                {t(msg`仅支持 .character.json / application/json`)}
              </div>
            </div>
            <Button
              type="button"
              variant="primary"
              onClick={pickFile}
              disabled={submitting}
            >
              {t(msg`选择文件`)}
            </Button>
          </div>
        )}

        {preview && (
          <FilePreviewCard
            preview={preview}
            onCancel={clearSelection}
            onConfirm={confirmImport}
            submitting={submitting}
          />
        )}

        {/* 结果反馈 */}
        {result?.kind === "success" && (
          <SuccessCard
            character={result.character}
            overwrote={result.overwrote}
            onImportAnother={clearSelection}
            onGoCharacters={() =>
              void navigate({ to: "/contacts/world-characters" as never })
            }
          />
        )}
        {result?.kind === "danger" && (
          <div className="flex items-start gap-3 rounded-2xl bg-[rgba(220,38,38,0.08)] px-4 py-3 text-[13px] text-[#b42318]">
            <X size={16} className="mt-0.5 shrink-0" />
            <div>{result.message}</div>
          </div>
        )}
      </div>
    </AppPage>
  );
}

function FilePreviewCard({
  preview,
  onCancel,
  onConfirm,
  submitting,
}: {
  preview: FilePreview;
  onCancel: () => void;
  onConfirm: () => void;
  submitting: boolean;
}) {
  const t = useRuntimeTranslator();
  const p = preview.payload;
  const name = typeof p.name === "string" ? p.name : "";
  const avatar = typeof p.avatar === "string" ? p.avatar : "";
  const bio = typeof p.bio === "string" ? p.bio : "";
  const relationship = typeof p.relationship === "string" ? p.relationship : "";
  const relationshipType =
    typeof p.relationshipType === "string" ? p.relationshipType : "friend";
  const expertDomains = Array.isArray(p.expertDomains)
    ? (p.expertDomains as unknown[]).filter(
        (x): x is string => typeof x === "string",
      )
    : [];
  const schema = typeof p.$schema === "string" ? p.$schema : null;
  const hasExpectedSchema = schema === "yinjie-private-character/v1";
  return (
    <div className="space-y-3 rounded-2xl border border-[color:var(--border-faint)] bg-[color:var(--bg-canvas-elevated)] p-4">
      <div className="flex items-center gap-2 text-[12px] text-[color:var(--text-muted)]">
        <FileJson size={14} />
        <span className="truncate">{preview.fileName}</span>
        <span className="opacity-50">·</span>
        <span>{formatFileSize(preview.fileSize)}</span>
      </div>

      <div className="flex items-start gap-3">
        <PreviewAvatar avatar={avatar} name={name} />
        <div className="min-w-0 flex-1 space-y-1">
          <div className="truncate text-[16px] font-semibold text-[color:var(--text-primary)]">
            {name}
          </div>
          <div className="truncate text-[11px] text-[color:var(--text-muted)]">
            {relationship || relationshipType}
          </div>
          {bio && (
            <p className="line-clamp-3 text-[12px] leading-relaxed text-[color:var(--text-secondary)]">
              {bio}
            </p>
          )}
        </div>
      </div>

      {expertDomains.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {expertDomains.slice(0, 6).map((d, idx) => (
            <span
              key={`${d}-${idx}`}
              className="rounded-full bg-[color:var(--surface-soft)] px-2 py-0.5 text-[10px] text-[color:var(--text-secondary)]"
            >
              {d}
            </span>
          ))}
        </div>
      )}

      {!hasExpectedSchema && (
        <div className="rounded-lg bg-[rgba(245,158,11,0.10)] px-3 py-2 text-[11px] leading-relaxed text-[#92400e]">
          {schema
            ? t(
                msg`文件 $schema 是 "${schema}"，期望 "yinjie-private-character/v1"。仍可尝试导入，但可能字段不完整。`,
              )
            : t(
                msg`文件缺少 $schema 标识；仍可尝试导入，但建议检查内容是否齐全。`,
              )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t border-[color:var(--border-faint)] pt-3">
        <Button
          type="button"
          variant="primary"
          onClick={onConfirm}
          disabled={submitting}
        >
          {submitting ? t(msg`导入中…`) : t(msg`✅ 导入到我的世界`)}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={onCancel}
          disabled={submitting}
        >
          {t(msg`换一个文件`)}
        </Button>
      </div>
    </div>
  );
}

function SuccessCard({
  character,
  overwrote,
  onImportAnother,
  onGoCharacters,
}: {
  character: Character;
  overwrote: boolean;
  onImportAnother: () => void;
  onGoCharacters: () => void;
}) {
  const t = useRuntimeTranslator();
  return (
    <div className="space-y-3 rounded-2xl border border-emerald-400/30 bg-[rgba(16,185,129,0.08)] p-4">
      <div className="flex items-start gap-2 text-[13px] font-medium text-[#047857]">
        <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
        <div>
          {overwrote
            ? t(msg`已覆盖同名角色：${character.name}`)
            : t(msg`已导入新角色：${character.name}`)}
        </div>
      </div>
      <div className="text-[11px] text-[#047857]/80">
        {overwrote
          ? t(msg`原有 id 和好友关系都保留了。`)
          : t(msg`已自动加为你的好友，可以在世界角色列表里找到。`)}
      </div>
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <Button
          type="button"
          variant="primary"
          size="sm"
          onClick={onGoCharacters}
        >
          {t(msg`查看世界角色`)}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onImportAnother}
        >
          <RefreshCcw size={14} className="mr-1" />
          {t(msg`再导入一个`)}
        </Button>
      </div>
    </div>
  );
}

function PreviewAvatar({ avatar, name }: { avatar: string; name: string }) {
  const trimmed = (avatar ?? "").trim();
  const isUrl = /^https?:\/\//i.test(trimmed) || trimmed.startsWith("/");
  if (isUrl) {
    return (
      <img
        src={trimmed}
        alt=""
        className="h-12 w-12 shrink-0 rounded-2xl object-cover"
      />
    );
  }
  const display = trimmed.length > 0 ? trimmed.slice(0, 2) : name.slice(0, 1);
  return (
    <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[rgba(139,92,246,0.12)] text-lg text-[#7c3aed]">
      {display}
    </div>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
