import { useEffect, useState } from "react";
import { msg } from "@lingui/macro";
import { useMutation } from "@tanstack/react-query";
import {
  changeCloudPassword,
  isApiRequestError,
  sendCloudChangePasswordCode,
} from "@yinjie/contracts";
import { useRuntimeTranslator } from "@yinjie/i18n";
import { Button, InlineNotice, TextField } from "@yinjie/ui";
import { describeRequestError } from "../../lib/request-error";
import { useAppRuntimeConfig } from "../../runtime/runtime-config-store";
import { useCloudSessionStore } from "../../store/cloud-session-store";

const RESEND_COOLDOWN_SECONDS = 60;

// 后端 429 走两条文案：
//   1) "验证码发送过于频繁，请在 {n} 秒后重试。"（60 秒滑窗）
//   2) "该邮箱验证码请求次数过多，请稍后再试。"（小时窗口超 5 条上限）
// 第一条里能 parse 出真实 retryAfter；第二条只能给个保守冷却，避免按钮回弹后再来一发又被打回。
function resolveRateLimitCooldown(message: string | undefined): number {
  if (!message) return RESEND_COOLDOWN_SECONDS;
  const match = /(\d+)\s*秒/.exec(message);
  if (match) {
    const seconds = Number.parseInt(match[1], 10);
    if (Number.isFinite(seconds) && seconds > 0) {
      return Math.min(seconds, 600);
    }
  }
  return RESEND_COOLDOWN_SECONDS;
}

function normalizeBaseUrl(value: string | undefined | null) {
  return (value ?? "").trim().replace(/\/+$/, "");
}

export function AccountSecurityPanel() {
  const t = useRuntimeTranslator();
  const runtimeConfig = useAppRuntimeConfig();
  const cloudApiBaseUrl = normalizeBaseUrl(runtimeConfig.cloudApiBaseUrl);
  const accessToken = useCloudSessionStore((state) => state.accessToken);

  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [feedback, setFeedback] = useState<{
    tone: "success" | "danger";
    message: string;
  } | null>(null);
  const [resendCountdown, setResendCountdown] = useState(0);

  useEffect(() => {
    if (resendCountdown <= 0) return;
    const timer = setInterval(() => {
      setResendCountdown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCountdown]);

  const sendCodeMutation = useMutation({
    mutationFn: async () => {
      if (!accessToken) {
        throw new Error("Missing cloud access token.");
      }
      return sendCloudChangePasswordCode(
        accessToken,
        cloudApiBaseUrl || undefined,
      );
    },
    onSuccess: (result) => {
      setFeedback({
        tone: "success",
        message: result.debugCode
          ? t(msg`开发模式：验证码已打印到服务端日志。`)
          : t(msg`验证码已发送至绑定邮箱，请查收（含垃圾邮件箱）。`),
      });
      if (result.debugCode) {
        setCode(result.debugCode);
      }
      setResendCountdown(RESEND_COOLDOWN_SECONDS);
    },
    onError: (error) => {
      const description = describeRequestError(
        error,
        t(msg`发送验证码失败，请稍后重试。`),
      );
      setFeedback({ tone: "danger", message: description });
      // 429 时把按钮 lock 住，否则用户读完报错连点 → 又一条 429，反复打到后端节流。
      if (isApiRequestError(error) && error.statusCode === 429) {
        setResendCountdown(resolveRateLimitCooldown(error.message));
      }
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: async () => {
      if (!accessToken) {
        throw new Error("Missing cloud access token.");
      }
      return changeCloudPassword(
        { code: code.trim(), newPassword },
        accessToken,
        cloudApiBaseUrl || undefined,
      );
    },
    onSuccess: () => {
      setFeedback({
        tone: "success",
        message: t(msg`密码已更新，下次登录可使用新密码。`),
      });
      setCode("");
      setNewPassword("");
      setConfirmPassword("");
    },
    onError: (error) => {
      setFeedback({
        tone: "danger",
        message: describeRequestError(error, t(msg`修改密码失败，请稍后重试。`)),
      });
    },
  });

  function handleSubmit() {
    if (!code.trim()) {
      setFeedback({
        tone: "danger",
        message: t(msg`请输入邮箱收到的 6 位验证码。`),
      });
      return;
    }
    if (newPassword.length < 8 || newPassword.length > 32) {
      setFeedback({
        tone: "danger",
        message: t(msg`新密码长度需在 8-32 位之间。`),
      });
      return;
    }
    // 后端 password-policy 也会拦空格，但跑到 cloud-api 才报让 UX 一坨。
    // 这里先在客户端拦掉，配合 placeholder 「8-32 位，任意字符（不含空格）」一致。
    if (/\s/.test(newPassword)) {
      setFeedback({
        tone: "danger",
        message: t(msg`新密码不能包含空格。`),
      });
      return;
    }
    if (newPassword !== confirmPassword) {
      setFeedback({
        tone: "danger",
        message: t(msg`两次输入的密码不一致。`),
      });
      return;
    }
    changePasswordMutation.mutate();
  }

  // 把核心提交条件统一到一个 flag 上，避免 disabled / 视觉态各走各的。
  const submitDisabled =
    changePasswordMutation.isPending ||
    !accessToken ||
    !code.trim() ||
    !newPassword ||
    !confirmPassword;

  return (
    <div className="space-y-4">
      <InlineNotice tone="muted">
        {t(
          msg`修改密码需要邮箱验证码确认；验证码会发送至当前账号绑定的邮箱。`,
        )}
      </InlineNotice>

      <form
        className="space-y-3 rounded-2xl border border-[color:var(--border-faint)] bg-white p-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (submitDisabled) return;
          handleSubmit();
        }}
      >
        <label className="block space-y-2">
          <span className="text-[12px] font-medium text-[color:var(--text-secondary)]">
            {t(msg`邮箱验证码`)}
          </span>
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <TextField
                value={code}
                onChange={(event) => {
                  // 后端验证码硬是 6 位数字（email-auth.service.ts generateCode），
                  // 移动端给一个 numeric 键盘 + 长度截断，少一次"输错位数才报错"的来回。
                  const next = event.target.value
                    .replace(/\D+/g, "")
                    .slice(0, 6);
                  setCode(next);
                  setFeedback(null);
                }}
                placeholder={t(msg`6 位数字`)}
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                pattern="\d{6}"
              />
            </div>
            <Button
              onClick={() => sendCodeMutation.mutate()}
              disabled={
                sendCodeMutation.isPending ||
                resendCountdown > 0 ||
                !accessToken
              }
              variant="secondary"
              size="lg"
              className="shrink-0 rounded-2xl border-black/5 bg-[#f5f5f5] px-5 shadow-none hover:border-[rgba(7,193,96,0.16)] hover:bg-white"
            >
              {sendCodeMutation.isPending
                ? t(msg`发送中...`)
                : resendCountdown > 0
                  ? `${resendCountdown}s`
                  : t(msg`发送验证码`)}
            </Button>
          </div>
        </label>

        <label className="block space-y-2">
          <span className="text-[12px] font-medium text-[color:var(--text-secondary)]">
            {t(msg`新密码`)}
          </span>
          <TextField
            type="password"
            value={newPassword}
            onChange={(event) => {
              setNewPassword(event.target.value);
              setFeedback(null);
            }}
            placeholder={t(msg`8-32 位，任意字符（不含空格）`)}
            autoComplete="new-password"
            maxLength={32}
          />
        </label>

        <label className="block space-y-2">
          <span className="text-[12px] font-medium text-[color:var(--text-secondary)]">
            {t(msg`确认新密码`)}
          </span>
          <TextField
            type="password"
            value={confirmPassword}
            onChange={(event) => {
              setConfirmPassword(event.target.value);
              setFeedback(null);
            }}
            placeholder={t(msg`再次输入新密码`)}
            autoComplete="new-password"
            maxLength={32}
          />
        </label>

        <Button
          type="submit"
          disabled={submitDisabled}
          size="lg"
          className="w-full rounded-2xl"
        >
          {changePasswordMutation.isPending
            ? t(msg`提交中...`)
            : t(msg`更新密码`)}
        </Button>
      </form>

      {feedback ? (
        <InlineNotice tone={feedback.tone}>{feedback.message}</InlineNotice>
      ) : null}
    </div>
  );
}
