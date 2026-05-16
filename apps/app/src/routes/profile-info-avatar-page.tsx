import { useEffect, useMemo, useRef, useState } from "react";
import { msg } from "@lingui/macro";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ImagePlus, RotateCcw, X } from "lucide-react";
import { updateWorldOwner } from "@yinjie/contracts";
import { useRuntimeTranslator } from "@yinjie/i18n";
import { AppPage, TextField, cn } from "@yinjie/ui";
import defaultOwnerAvatar from "../assets/default-owner-avatar.svg";
import { AvatarChip } from "../components/avatar-chip";
import { TabPageTopBar } from "../components/tab-page-top-bar";
import { useDesktopLayout } from "../features/shell/use-desktop-layout";
import { navigateBackOrFallback } from "../lib/history-back";
import { pickImageFiles } from "../runtime/native-image-picker";
import { useAppRuntimeConfig } from "../runtime/runtime-config-store";
import { useWorldOwnerStore } from "../store/world-owner-store";

const MAX_AVATAR_BYTES = 1024 * 1024;
// 跟服务端 api/.../world-owner.service.ts 的 MAX_OWNER_AVATAR_LENGTH 对齐：
// avatar 字段（URL 或 data URL）落库时最长 2MB。客户端校到这条线，可以让
// 「粘贴一坨巨型 data URL」的用户在按完成前就拿到反馈，不用先等几秒上传被
// 服务端 400 拒掉、还看一段中文 legacyMessage。
const MAX_AVATAR_INPUT_LENGTH = 2 * 1024 * 1024;

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

type UrlInputError = "format" | "too_large" | null;

// 之前 URL 输入框完全不校验，用户输 "abc"、"https//x"（漏冒号）这种
// 也能 disable 不掉「完成」一路提交到服务端落库，AvatarChip 加载失败
// 静默回落到 fallback。用户以为头像改好了，profile 里却是 initials —
// 拍照 / 重新进来 / 等等几个入口都看不出哪里错了，毫无反馈。
// 跟 profile-settings 校验 customApiBase 同样的逻辑：trim + 用 URL
// 构造器 try / catch 一下，只放行 http(s) 和 data:image/。
function checkAvatarUrlInput(value: string): UrlInputError {
  if (!value) return null; // 空 = 不打算改，由 canSave 单独 gate
  if (/^data:image\//i.test(value)) {
    // 粘贴的 data URL 也要校长度，不然超 2MB 的话要等上传完才被服务端拒
    return value.length > MAX_AVATAR_INPUT_LENGTH ? "too_large" : null;
  }
  let parsed: URL | null = null;
  try {
    parsed = new URL(value);
  } catch {
    return "format";
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return "format";
  }
  return value.length > MAX_AVATAR_INPUT_LENGTH ? "too_large" : null;
}

export function ProfileInfoAvatarPage() {
  const t = useRuntimeTranslator();
  const navigate = useNavigate();
  const isDesktopLayout = useDesktopLayout();
  const runtimeConfig = useAppRuntimeConfig();
  const baseUrl = runtimeConfig.apiBaseUrl;
  const queryClient = useQueryClient();

  const username = useWorldOwnerStore((state) => state.username);
  const avatar = useWorldOwnerStore((state) => state.avatar);
  const hydrateOwner = useWorldOwnerStore((state) => state.hydrateOwner);

  // 用户没自定义过头像时 store.avatar 是打包出来的 default-owner-avatar.svg
  // 资源路径（类似 /assets/default-owner-avatar-xxx.svg）。直接当成"当前 URL"
  // 灌进输入框，用户会看到一串完全无意义的本地资源路径，所以把"等于默认"等
  // 同没设置。
  const hasCustomAvatar = useMemo(
    () => Boolean(avatar) && avatar !== defaultOwnerAvatar,
    [avatar],
  );
  // 之前存过 base64 本地图的用户，第二次打开本页时 avatar 是「data:image/...」
  // 巨型字符串。如果把它当 URL 灌进 TextField，又退化回 Round 1 修掉的卡顿/误改
  // 长串那一套。所以「URL 输入框」只接受真正的 URL，存的是 data URL 时一律把
  // 输入框留空（preview 仍然显示当前头像）。
  const storedIsDataUrl = avatar.startsWith("data:");
  const initialDraft = hasCustomAvatar && !storedIsDataUrl ? avatar : "";
  // draft 只装「URL」型的取值，pickedLocal 单独存从相册选的 data URL：
  // 之前把 base64 直接塞进 TextField，~1MB 的字符串显示在单行输入框里既看不
  // 清也容易让用户误改一个字符破坏整段 data URL；而且每次输入触发 React 重
  // 渲染都要把这坨字符串过一次 reconciler，明显卡顿。
  const [draft, setDraft] = useState(initialDraft);
  const [pickedLocal, setPickedLocal] = useState<{
    dataUrl: string;
    size: number;
    name: string;
  } | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  // 用户已经在 URL 输入框里改过 / 已经从相册选过图时，不要被后台 hydrate
  // 把这俩 draft 覆盖回 store 值——会吞用户输入。
  const userTouchedRef = useRef(false);
  // 保存上传中，用户如果手动点了 ← 返回 / 系统硬件 Back 退出本页，此时
  // saveMutation 在 React Query 里仍然继续跑，几秒后 onSuccess 还会调一次
  // goBack——但 navigate 这时是从用户已经退到的页面（如 /profile/info）再
  // 退一格，跳到 /tabs/profile，整个一跳两格的诡异感。用 isMounted ref
  // 在 onSuccess 里 gating，让用户主动退出后不要再被这次保存抢二次导航。
  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!userTouchedRef.current) {
      setDraft(initialDraft);
      setPickedLocal(null);
    }
  }, [initialDraft]);

  useEffect(() => {
    if (isDesktopLayout) {
      void navigate({ to: "/desktop/settings", replace: true });
    }
  }, [isDesktopLayout, navigate]);

  const goBack = () =>
    navigateBackOrFallback(
      () => navigate({ to: "/profile/info", replace: true }),
      "/profile/info",
    );

  const trimmed = draft.trim();
  // 优先使用本地选图；没选过 → 才看 URL 输入框
  const valueToSave = pickedLocal?.dataUrl || trimmed;
  const baseline = hasCustomAvatar ? avatar.trim() : "";
  const dirty = valueToSave !== baseline;
  // pickedLocal 是 FileReader 给的 data URL，size 已经被 MAX_AVATAR_BYTES
  // (1MB) 拦过；只有用户手敲 / 粘贴的 draft 才需要校 URL 格式 + 长度。
  const urlInputError: UrlInputError = pickedLocal
    ? null
    : checkAvatarUrlInput(trimmed);
  const canSave = valueToSave.length > 0 && dirty && urlInputError === null;
  const previewSrc =
    pickedLocal?.dataUrl ||
    trimmed ||
    (hasCustomAvatar ? avatar : defaultOwnerAvatar);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const owner = await updateWorldOwner({ avatar: valueToSave }, baseUrl);
      queryClient.setQueryData(["world-owner", baseUrl], owner);
      hydrateOwner(owner);
    },
    onSuccess: () => {
      if (!isMountedRef.current) return;
      goBack();
    },
  });

  // 之前没有路径把已存的头像清回默认（系统打包出来的 SVG）：URL 输入框
  // 留空 + 不选图 → valueToSave="" → canSave=false，「完成」按钮永远灰着。
  // 用户哪天后悔自定义头像、想恢复默认，只能输个奇怪的旧 URL 顶一下，体验
  // 很糟。加一个独立的「恢复默认头像」入口，hasCustomAvatar 才显示，独立
  // mutation 单发 avatar:""，绕开 valueToSave gating。
  const resetMutation = useMutation({
    mutationFn: async () => {
      const owner = await updateWorldOwner({ avatar: "" }, baseUrl);
      queryClient.setQueryData(["world-owner", baseUrl], owner);
      hydrateOwner(owner);
    },
    onSuccess: () => {
      if (!isMountedRef.current) return;
      goBack();
    },
  });
  // FileReader 异步 readAsDataURL 期间：pickedLocal 还是 null，draft 还是
  // 旧 URL。如果此刻用户已经把 draft 改成了非旧 baseline、canSave 又是 true
  // （改 URL 又紧接着选图的极端情况），点「完成」会把那个 URL 而不是刚选的图
  // 落库。reader.onload 之后 pickedLocal 才出来、setDraft("") 才执行，但已经
  // 晚了。用一个 isReadingFile 标志在读图期间锁住「完成」/「恢复默认」。
  const [isReadingFile, setIsReadingFile] = useState(false);
  const isSaving =
    saveMutation.isPending || resetMutation.isPending || isReadingFile;

  // 防 race：用户连点「从相册选择」两次时，FileReader 是各自独立的，且
  // 不保证 readAsDataURL 完成顺序——大文件 A 先开始读、小文件 B 后开始
  // 读但更快完成，会出现 B 的 onload 先 setPickedLocal(B)、A 的 onload
  // 再 setPickedLocal(A)，最终用户看到 A（实际想要 B）。用一个自增 id 给
  // 每次 pick 编号，onload 时校验是不是最新那次，不是就丢弃。
  const latestPickIdRef = useRef(0);

  async function handlePickAvatar() {
    const pickId = ++latestPickIdRef.current;
    const files = await pickImageFiles({ multiple: false });
    if (pickId !== latestPickIdRef.current) return;
    const file = files[0];
    if (!file) {
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setLocalError(t(msg`图片过大，请压缩到 1MB 以内再试。`));
      return;
    }
    if (file.size === 0) {
      // 0 字节文件多半是相册导出失败、文件损坏。当时不拦的话 FileReader 会
      // 读出 "data:image/...;base64,"（只有 MIME 头没有数据），照样塞进
      // pickedLocal → canSave=true → 用户能保存这个「空头像」，下次进来
      // AvatarChip onError 回落到 fallback；用户以为自己改了头像、profile
      // 里却是 initials，毫无线索可查。
      setLocalError(t(msg`这张图片是空文件，请换一张试试。`));
      return;
    }
    if (!file.type.startsWith("image/")) {
      // <input accept="image/*"> 在多数浏览器只是 hint，桌面版 Safari /
      // 拖拽场景下仍能丢一个 application/pdf / text/plain 进来。FileReader
      // 照读不误，能塞进 pickedLocal 拼出 "data:application/pdf;base64,..."
      // 落库，AvatarChip 当然加载失败回 fallback。跟 chat-composer
      // (line 5592) / compress-chat-background-image (line 18) 同款 MIME 严校。
      setLocalError(t(msg`只能选择图片文件。`));
      return;
    }
    setLocalError(null);
    // 上次保存失败 → 错误 banner 钉死在底部，用户重新选了张图也还挂着——
    // 既看着新选了图、又同时挂着上次保存失败的红字，容易让用户以为新选的
    // 图也已经被尝试保存了。新一次的用户动作意味着「上一次失败的 attempt 翻篇」，
    // reset 两个 mutation 把红字清掉。
    saveMutation.reset();
    resetMutation.reset();
    setIsReadingFile(true);
    const reader = new FileReader();
    const finish = () => {
      // 只有最新 pickId 才负责把 reading 状态关掉，避免被 stale onload
      // 提前 clear（race 时旧文件的 onload 比新文件早到）。
      if (pickId === latestPickIdRef.current) {
        setIsReadingFile(false);
      }
    };
    reader.onerror = () => {
      if (pickId !== latestPickIdRef.current) return;
      setLocalError(t(msg`读取图片失败，请换一张试试。`));
      finish();
    };
    reader.onload = () => {
      if (pickId !== latestPickIdRef.current) {
        return;
      }
      const result = reader.result;
      if (typeof result === "string") {
        userTouchedRef.current = true;
        setPickedLocal({ dataUrl: result, size: file.size, name: file.name });
        // 选了本地图后，URL 输入框里的旧 URL 不再适用，先清掉
        setDraft("");
      }
      finish();
    };
    reader.readAsDataURL(file);
  }

  function clearPickedLocal() {
    setPickedLocal(null);
    setLocalError(null);
  }

  if (isDesktopLayout) {
    return null;
  }

  const errorMessage =
    localError ??
    (saveMutation.isError && saveMutation.error instanceof Error
      ? saveMutation.error.message
      : resetMutation.isError && resetMutation.error instanceof Error
        ? resetMutation.error.message
        : null);

  return (
    <AppPage className="space-y-0 bg-[color:var(--bg-canvas)] px-0 py-0">
      <TabPageTopBar
        title={t(msg`更换头像`)}
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
            disabled={!canSave || isSaving}
            onClick={() => saveMutation.mutate()}
            className={cn(
              "rounded-full px-3 py-1 text-[13px] font-medium transition-colors",
              !canSave || isSaving
                ? "text-[color:var(--text-dim)]"
                : "text-[#07c160] active:bg-black/[0.05]",
            )}
          >
            {saveMutation.isPending ? t(msg`保存中`) : t(msg`完成`)}
          </button>
        }
      />

      <div className="mt-1 flex flex-col items-center gap-2 border-y border-[color:var(--border-faint)] bg-[color:var(--bg-canvas-elevated)] px-4 py-6">
        <AvatarChip
          name={username?.trim() || "avatar"}
          src={previewSrc}
          size="xl"
        />
        <div className="text-[11px] text-[color:var(--text-muted)]">
          {t(msg`点击下方更换`)}
        </div>
      </div>

      {pickedLocal ? (
        <div className="mt-2 border-y border-[color:var(--border-faint)] bg-[color:var(--bg-canvas-elevated)] px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[rgba(7,193,96,0.10)] text-[#15803d]">
              <ImagePlus size={16} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] text-[color:var(--text-primary)]">
                {pickedLocal.name || t(msg`本地图片`)}
              </div>
              <div
                className="mt-0.5 text-[11px] text-[color:var(--text-muted)]"
                data-i18n-skip="true"
              >
                {formatBytes(pickedLocal.size)}
              </div>
            </div>
            <button
              type="button"
              disabled={isSaving}
              onClick={clearPickedLocal}
              aria-label={t(msg`清除已选图片`)}
              // h-7 w-7（28×28）触摸点比 Apple HIG 44pt 最低线还小一大截，
              // 真机上点击 X 经常戳到旁边的文件名行甚至不响应。把视觉保留小
              // 巧的同时，用 -mr-2 / 同级 padding 把可点击区域撑到 44px 宽，
              // 视觉上 X 仍居右、不占用文件名行。
              // disabled={isSaving}: save/reset 期间禁掉，跟同页其它控件保持一致。
              className="relative -mr-2 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[color:var(--text-muted)] transition-colors active:bg-black/[0.05] disabled:opacity-50 disabled:active:bg-transparent"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-2 border-y border-[color:var(--border-faint)] bg-[color:var(--bg-canvas-elevated)] px-4 py-3">
          <div className="mb-1.5 text-[11px] font-medium text-[color:var(--text-secondary)]">
            {t(msg`图片地址`)}
          </div>
          <TextField
            // type="url"：iOS Safari / 系统键盘会切到 URL 模式（自带 .com /
            // / 键、关掉首字母大写和拼写校正），跟「粘贴图片 URL」的语义对齐。
            // 没有外层 <form>，所以 type=url 不会触发浏览器默认表单校验拦住
            // 提交；只是键盘改 layout。auto-capitalize/correct 都关，URL 不
            // 该被改写。
            type="url"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            inputMode="url"
            value={draft}
            disabled={isSaving}
            onChange={(event) => {
              userTouchedRef.current = true;
              setDraft(event.target.value);
              setLocalError(null);
              // 用户已经动手改新的 URL，意味着上一次保存失败这件事翻篇了，把
              // 红字 banner 清掉，免得新尝试还挂着旧 attempt 的失败说明。
              saveMutation.reset();
              resetMutation.reset();
            }}
            onKeyDown={(event) => {
              // 跟 profile-info-name-page 同款：粘完 URL 习惯性按回车直接
              // submit，外面没 <form> 不会自动触发；手动接一下，可保存就走
              // saveMutation。
              if (event.key === "Enter" && canSave && !isSaving) {
                event.preventDefault();
                saveMutation.mutate();
              }
            }}
            enterKeyHint="done"
            placeholder={t(msg`粘贴图片 URL 或留空`)}
            // text-[16px]: iOS Safari focus 时 <16px 会强制 viewport zoom-in。
            // tap 一下输入框整页抖一下。
            className="rounded-[10px] border-[color:var(--border-faint)] bg-white px-3 py-2.5 text-[16px] shadow-none focus:translate-y-0 disabled:bg-[color:var(--bg-canvas)] disabled:text-[color:var(--text-muted)]"
          />
          {storedIsDataUrl ? (
            <div className="mt-2 text-[11px] leading-4 text-[color:var(--text-muted)]">
              {t(msg`当前头像已存为本地图片。粘贴新 URL 或重新选择都会替换它。`)}
            </div>
          ) : null}
          {trimmed && urlInputError === "format" ? (
            <div className="mt-2 text-[11px] leading-4 text-[#92400e]">
              {t(msg`需要是 http/https 开头的合法图片链接。`)}
            </div>
          ) : null}
          {trimmed && urlInputError === "too_large" ? (
            <div className="mt-2 text-[11px] leading-4 text-[#92400e]">
              {t(msg`粘贴的图片超过 2MB 上限，请压缩或换个 URL。`)}
            </div>
          ) : null}
        </div>
      )}

      <div className="mt-2 border-y border-[color:var(--border-faint)] bg-[color:var(--bg-canvas-elevated)]">
        <button
          type="button"
          disabled={isSaving}
          onClick={() => {
            void handlePickAvatar();
          }}
          // 保存进行中（按钮文案变「保存中」）但「从相册选择」还能点：用户点
          // 完「完成」后趁着上传那几秒又选了张图，结果 save success → goBack
          // 把页面退回 /profile/info，新选的图被一起带走没机会落库——用户白
          // 选一遍且毫无提示。同样的窗口 URL 输入框也照理 disable，下面 TextField
          // disabled={isSaving}。
          className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors active:bg-[color:var(--surface-card-hover)] disabled:opacity-60 disabled:active:bg-transparent"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[rgba(7,193,96,0.10)] text-[#15803d]">
            <ImagePlus size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[14px] text-[color:var(--text-primary)]">
              {t(msg`从相册选择`)}
            </div>
            <div className="mt-0.5 text-[11px] text-[color:var(--text-muted)]">
              {t(msg`图片大小不超过 1MB`)}
            </div>
          </div>
        </button>
      </div>

      {hasCustomAvatar ? (
        <div className="mt-2 border-y border-[color:var(--border-faint)] bg-[color:var(--bg-canvas-elevated)]">
          <button
            type="button"
            disabled={isSaving}
            onClick={() => resetMutation.mutate()}
            className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors active:bg-[color:var(--surface-card-hover)] disabled:opacity-60 disabled:active:bg-transparent"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[rgba(148,163,184,0.16)] text-[color:var(--text-secondary)]">
              <RotateCcw size={16} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[14px] text-[color:var(--text-primary)]">
                {resetMutation.isPending
                  ? t(msg`正在恢复…`)
                  : t(msg`恢复默认头像`)}
              </div>
              <div className="mt-0.5 text-[11px] text-[color:var(--text-muted)]">
                {t(msg`清掉自定义头像，换回系统默认。`)}
              </div>
            </div>
          </button>
        </div>
      ) : null}

      {errorMessage ? (
        <div className="mx-4 mt-3 rounded-[10px] border border-[rgba(220,38,38,0.18)] bg-[rgba(254,242,242,0.96)] px-3 py-2 text-[12px] leading-5 text-[color:var(--state-danger-text)]">
          {errorMessage}
        </div>
      ) : null}
    </AppPage>
  );
}
