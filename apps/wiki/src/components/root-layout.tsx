import { Link, Outlet, useNavigate } from "@tanstack/react-router";
import { Suspense, useState } from "react";
import { LoadingBlock } from "@yinjie/ui";
import { clearSession, hasRole, roleLabel } from "../lib/auth-store";
import { useAuth } from "../lib/use-auth";

export function RootLayout() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-[var(--border-subtle)] bg-[var(--bg-surface)]">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center gap-6">
          <Link to="/" className="text-lg font-semibold">
            隐界世界角色管理平台
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link to="/" className="hover:underline">
              角色
            </Link>
            {user && (
              <Link to="/create" className="hover:underline">
                创建
              </Link>
            )}
            <Link to="/recent-changes" className="hover:underline">
              最近修改
            </Link>
            {user && (
              <Link to="/watchlist" className="hover:underline">
                观察列表
              </Link>
            )}
            {hasRole(user, "patroller") && (
              <Link to="/pending-reviews" className="hover:underline">
                待审编辑
              </Link>
            )}
            {hasRole(user, "admin") && (
              <>
                <Link to="/admin/users" className="hover:underline">
                  用户
                </Link>
                <Link to="/admin/blocks" className="hover:underline">
                  封禁
                </Link>
                <Link to="/admin/protection" className="hover:underline">
                  保护
                </Link>
                <Link to="/admin/reports" className="hover:underline">
                  举报
                </Link>
              </>
            )}
          </nav>
          <form
            className="ml-auto flex items-center"
            onSubmit={(e) => {
              e.preventDefault();
              const term = q.trim();
              if (!term) return;
              void navigate({ to: "/search", search: { q: term } });
            }}
          >
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="搜索词条…"
              className="text-sm border border-[var(--border-subtle)] rounded px-3 py-1 w-48 bg-white"
            />
          </form>
          <div className="flex items-center gap-3 text-sm">
            {user ? (
              <>
                <span className="text-[var(--text-muted)]">
                  {user.username}（{roleLabel(user.role)}）
                </span>
                <button
                  type="button"
                  className="px-3 py-1 rounded border border-[var(--border-subtle)] hover:bg-[var(--bg-canvas)]"
                  onClick={() => {
                    clearSession();
                    window.location.href = "/login";
                  }}
                >
                  退出
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className="px-3 py-1 rounded border border-[var(--border-subtle)] hover:bg-[var(--bg-canvas)]"
                >
                  登录
                </Link>
                <Link
                  to="/register"
                  className="px-3 py-1 rounded bg-[var(--accent)] text-white"
                >
                  注册
                </Link>
              </>
            )}
          </div>
        </div>
      </header>
      <main className="flex-1 max-w-6xl mx-auto w-full px-6 py-6">
        <Suspense fallback={<LoadingBlock className="m-6" />}>
          <Outlet />
        </Suspense>
      </main>
      <footer className="border-t border-[var(--border-subtle)] py-4 text-center text-xs text-[var(--text-muted)]">
        隐界世界角色管理平台 · 任何登录用户都可以提交角色创建、编辑和生命周期变更，由巡查员审核生效
      </footer>
    </div>
  );
}
