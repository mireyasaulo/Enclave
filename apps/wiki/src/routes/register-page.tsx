import { useState } from "react";
import { msg } from "@lingui/macro";
import { Trans } from "@lingui/react/macro";
import { Link, useNavigate } from "@tanstack/react-router";
import { translateRuntimeMessage } from "@yinjie/i18n";
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

export function RegisterPage() {
  const t = translateRuntimeMessage;
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const passwordMismatch =
    confirmPassword.length > 0 && confirmPassword !== password;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError(t(msg`两次输入的密码不一致`));
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const session = await wikiApi.register(username, password);
      setSession(session.token, session.user);
      void navigate({ to: "/" });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <PageShell
      narrow
      eyebrow={t(msg`账号`)}
      title={t(msg`注册`)}
      description={t(
        msg`新账号默认为「新人」。提交的编辑需经巡查员审核后生效；累积达标后会自动晋升为「自动确认」。`,
      )}
    >
      <AppSection>
        <form onSubmit={submit} className="space-y-4">
          <FormRow label={t(msg`用户名`)} hint={t(msg`≥ 2 字`)}>
            <TextField
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              minLength={2}
              autoFocus
              autoComplete="username"
            />
          </FormRow>
          <FormRow label={t(msg`密码`)} hint={t(msg`≥ 6 位`)}>
            <TextField
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
            />
          </FormRow>
          <FormRow
            label={t(msg`确认密码`)}
            hint={
              passwordMismatch
                ? t(msg`两次输入不一致`)
                : t(msg`再输一次以确认`)
            }
          >
            <TextField
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
            />
          </FormRow>
          {error && <InlineNotice tone="danger">{error}</InlineNotice>}
          <Button
            type="submit"
            variant="primary"
            disabled={loading || passwordMismatch || confirmPassword.length === 0}
            className="w-full"
          >
            {loading ? t(msg`注册中...`) : t(msg`注册`)}
          </Button>
        </form>
        <div className="mt-4 text-center text-sm text-[color:var(--text-muted)]">
          <Trans>已有账号？</Trans>
          <Link
            to="/login"
            className="ml-1 font-medium text-[color:var(--brand-primary)] hover:underline"
          >
            <Trans>登录</Trans>
          </Link>
        </div>
      </AppSection>
    </PageShell>
  );
}
