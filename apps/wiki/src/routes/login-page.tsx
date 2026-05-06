import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  AppSection,
  Button,
  InlineNotice,
  TextField,
} from "@yinjie/ui";
import { setSession } from "../lib/auth-store";
import { wikiApi } from "../lib/wiki-api";
import { PageShell } from "../components/page-shell";
import { FormRow } from "../components/form-row";

type Mode = "password" | "email";

export function LoginPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("password");

  return (
    <PageShell narrow eyebrow="账号" title="登录">
      <AppSection>
        <div className="mb-4 flex gap-2">
          <Button
            type="button"
            variant={mode === "password" ? "primary" : "ghost"}
            onClick={() => setMode("password")}
            className="flex-1"
          >
            用户名密码
          </Button>
          <Button
            type="button"
            variant={mode === "email" ? "primary" : "ghost"}
            onClick={() => setMode("email")}
            className="flex-1"
          >
            邮箱验证码
          </Button>
        </div>

        {mode === "password" ? (
          <PasswordForm onSuccess={() => void navigate({ to: "/" })} />
        ) : (
          <EmailCodeForm onSuccess={() => void navigate({ to: "/" })} />
        )}

        <div className="mt-4 text-center text-sm text-[color:var(--text-muted)]">
          还没有账号？
          <Link
            to="/register"
            className="ml-1 font-medium text-[color:var(--brand-primary)] hover:underline"
          >
            创建一个
          </Link>
          {mode === "password" ? (
            <span className="ml-1">或直接用邮箱登录。</span>
          ) : null}
        </div>
      </AppSection>
    </PageShell>
  );
}

function PasswordForm({ onSuccess }: { onSuccess: () => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const session = await wikiApi.login(username, password);
      setSession(session.token, session.user);
      onSuccess();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <FormRow label="用户名">
        <TextField
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          autoFocus
        />
      </FormRow>
      <FormRow label="密码">
        <TextField
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </FormRow>
      {error && <InlineNotice tone="danger">{error}</InlineNotice>}
      <Button
        type="submit"
        variant="primary"
        disabled={loading}
        className="w-full"
      >
        {loading ? "登录中..." : "登录"}
      </Button>
    </form>
  );
}

function EmailCodeForm({ onSuccess }: { onSuccess: () => void }) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const cooldownTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(
    () => () => {
      if (cooldownTimer.current) clearInterval(cooldownTimer.current);
    },
    [],
  );

  function startCooldown(seconds: number) {
    setCooldown(seconds);
    if (cooldownTimer.current) clearInterval(cooldownTimer.current);
    cooldownTimer.current = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          if (cooldownTimer.current) clearInterval(cooldownTimer.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  async function sendCode() {
    setError(null);
    setInfo(null);
    setSending(true);
    try {
      const result = await wikiApi.sendEmailCode(email.trim());
      startCooldown(60);
      setInfo(
        result.debugCode
          ? `开发模式：验证码已打印到服务端日志（debug=${result.debugCode}）`
          : "验证码已发送，请查收邮箱（含垃圾邮件箱）。",
      );
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSending(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setVerifying(true);
    try {
      const session = await wikiApi.verifyEmailCode(email.trim(), code.trim());
      setSession(session.token, session.user);
      onSuccess();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setVerifying(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <FormRow label="邮箱">
        <TextField
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoFocus
          placeholder="you@example.com"
        />
      </FormRow>
      <FormRow label="验证码" hint="6 位数字，10 分钟内有效">
        <div className="flex gap-2">
          <TextField
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
            inputMode="numeric"
            pattern="[0-9]{6}"
            maxLength={6}
          />
          <Button
            type="button"
            variant="ghost"
            disabled={!email.trim() || sending || cooldown > 0}
            onClick={() => void sendCode()}
          >
            {cooldown > 0
              ? `${cooldown}s 后重发`
              : sending
                ? "发送中..."
                : "发送验证码"}
          </Button>
        </div>
      </FormRow>
      {info && <InlineNotice tone="info">{info}</InlineNotice>}
      {error && <InlineNotice tone="danger">{error}</InlineNotice>}
      <Button
        type="submit"
        variant="primary"
        disabled={verifying || !email.trim() || code.trim().length < 6}
        className="w-full"
      >
        {verifying ? "登录中..." : "登录 / 注册"}
      </Button>
    </form>
  );
}
