import { useState } from "react";
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

export function RegisterPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
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
      eyebrow="账号"
      title="注册"
      description="新账号默认为「新人」。提交的编辑需经巡查员审核后生效；累积达标后会自动晋升为「自动确认」。"
    >
      <AppSection>
        <form onSubmit={submit} className="space-y-4">
          <FormRow label="用户名" hint="≥ 2 字">
            <TextField
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              minLength={2}
              autoFocus
            />
          </FormRow>
          <FormRow label="密码" hint="≥ 6 位">
            <TextField
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </FormRow>
          {error && <InlineNotice tone="danger">{error}</InlineNotice>}
          <Button
            type="submit"
            variant="primary"
            disabled={loading}
            className="w-full"
          >
            {loading ? "注册中..." : "注册"}
          </Button>
        </form>
        <div className="mt-4 text-center text-sm text-[color:var(--text-muted)]">
          已有账号？
          <Link
            to="/login"
            className="ml-1 font-medium text-[color:var(--brand-primary)] hover:underline"
          >
            登录
          </Link>
        </div>
      </AppSection>
    </PageShell>
  );
}
