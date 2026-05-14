import { useEffect, useRef, useState } from "react";
import { msg } from "@lingui/macro";
import { useMutation } from "@tanstack/react-query";
import {
  changeCloudPassword,
  sendCloudChangePasswordCode,
} from "@yinjie/contracts";
import { useRuntimeTranslator } from "@yinjie/i18n";
import { Button, InlineNotice, TextField } from "@yinjie/ui";
import { describeRequestError } from "../../lib/request-error";
import { useAppRuntimeConfig } from "../../runtime/runtime-config-store";
import { useCloudSessionStore } from "../../store/cloud-session-store";

const RESEND_COOLDOWN_SECONDS = 60;

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
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (resendCountdown <= 0) {
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
      return;
    }
    if (countdownRef.current) return;
    countdownRef.current = setInterval(() => {
      setResendCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => {
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
    };
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
      setFeedback({
        tone: "danger",
        message: describeRequestError(error, t(msg`发送验证码失败，请稍后重试。`)),
      });
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
    if (newPassword !== confirmPassword) {
      setFeedback({
        tone: "danger",
        message: t(msg`两次输入的密码不一致。`),
      });
      return;
    }
    changePasswordMutation.mutate();
  }

  return (
    <div className="space-y-4">
      <InlineNotice tone="muted">
        {t(
          msg`修改密码需要邮箱验证码确认；验证码会发送至当前账号绑定的邮箱。`,
        )}
      </InlineNotice>

      <div className="space-y-3 rounded-2xl border border-[color:var(--border-faint)] bg-white p-4">
        <label className="block space-y-2">
          <span className="text-xs uppercase tracking-[0.24em] text-[color:var(--text-muted)]">
            {t(msg`邮箱验证码`)}
          </span>
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <TextField
                value={code}
                onChange={(event) => {
                  setCode(event.target.value);
                  setFeedback(null);
                }}
                placeholder={t(msg`请输入邮箱收到的 6 位验证码`)}
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
          <span className="text-xs uppercase tracking-[0.24em] text-[color:var(--text-muted)]">
            {t(msg`新密码`)}
          </span>
          <TextField
            type="password"
            value={newPassword}
            onChange={(event) => {
              setNewPassword(event.target.value);
              setFeedback(null);
            }}
            placeholder={t(msg`8-32 位，包含字母和数字`)}
          />
        </label>

        <label className="block space-y-2">
          <span className="text-xs uppercase tracking-[0.24em] text-[color:var(--text-muted)]">
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
          />
        </label>

        <Button
          onClick={handleSubmit}
          disabled={changePasswordMutation.isPending || !accessToken}
          size="lg"
          className="w-full rounded-2xl"
        >
          {changePasswordMutation.isPending
            ? t(msg`提交中...`)
            : t(msg`更新密码`)}
        </Button>
      </div>

      {feedback ? (
        <InlineNotice tone={feedback.tone}>{feedback.message}</InlineNotice>
      ) : null}
    </div>
  );
}
