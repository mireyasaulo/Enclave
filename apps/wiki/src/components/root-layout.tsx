import {
  Link,
  Outlet,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import { Suspense, useEffect, useMemo, useState } from "react";
import { Button, LoadingBlock } from "@yinjie/ui";
import { clearSession, hasRole, roleLabel } from "../lib/auth-store";
import { useAuth } from "../lib/use-auth";

type NavItem = {
  to: string;
  label: string;
  icon: string;
  /** True when the item should be highlighted given the current pathname. */
  match?: (pathname: string) => boolean;
  /** Returns true if this item should be visible for the current user. */
  show: (user: ReturnType<typeof useAuth>["user"]) => boolean;
};

type NavGroup = {
  title: string;
  items: NavItem[];
};

const NAV_GROUPS: NavGroup[] = [
  {
    title: "浏览",
    items: [
      {
        to: "/",
        label: "角色目录",
        icon: "📚",
        match: (p) =>
          p === "/" ||
          (p.startsWith("/character/") && !p.endsWith("/diff")),
        show: () => true,
      },
      {
        to: "/recent-changes",
        label: "最近修改",
        icon: "🕘",
        show: () => true,
      },
      {
        to: "/search",
        label: "搜索",
        icon: "🔍",
        show: () => true,
      },
    ],
  },
  {
    title: "编辑",
    items: [
      {
        to: "/create",
        label: "创建角色",
        icon: "✨",
        show: (u) => !!u,
      },
      {
        to: "/watchlist",
        label: "我的观察列表",
        icon: "👁",
        show: (u) => !!u,
      },
    ],
  },
  {
    title: "巡查",
    items: [
      {
        to: "/pending-reviews",
        label: "待审编辑",
        icon: "📝",
        show: (u) => hasRole(u, "patroller"),
      },
    ],
  },
  {
    title: "管理",
    items: [
      {
        to: "/admin/users",
        label: "用户与权限",
        icon: "👤",
        show: (u) => hasRole(u, "admin"),
      },
      {
        to: "/admin/blocks",
        label: "封禁",
        icon: "⛔",
        show: (u) => hasRole(u, "admin"),
      },
      {
        to: "/admin/protection",
        label: "页面保护",
        icon: "🛡",
        show: (u) => hasRole(u, "admin"),
      },
      {
        to: "/admin/reports",
        label: "举报队列",
        icon: "🚩",
        show: (u) => hasRole(u, "admin"),
      },
      {
        to: "/admin/abuse-filters",
        label: "反破坏过滤器",
        icon: "🧪",
        show: (u) => hasRole(u, "admin"),
      },
      {
        to: "/admin/wiki-stats",
        label: "治理仪表盘",
        icon: "📊",
        show: (u) => hasRole(u, "admin"),
      },
    ],
  },
];

export function RootLayout() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [q, setQ] = useState("");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Close mobile nav on route change.
  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  const visibleGroups = useMemo(
    () =>
      NAV_GROUPS.map((g) => ({
        ...g,
        items: g.items.filter((it) => it.show(user)),
      })).filter((g) => g.items.length > 0),
    [user],
  );

  function submitSearch(event: React.FormEvent) {
    event.preventDefault();
    const term = q.trim();
    if (!term) return;
    void navigate({ to: "/search", search: { q: term } });
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-30 border-b border-[color:var(--border-subtle)] bg-[color:var(--surface-shell)] backdrop-blur">
        <div className="mx-auto flex w-full max-w-screen-2xl items-center gap-3 px-4 py-3 sm:px-6">
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[color:var(--border-subtle)] bg-white text-lg lg:hidden"
            aria-label="打开导航"
            onClick={() => setMobileNavOpen((v) => !v)}
          >
            ☰
          </button>
          <Link
            to="/"
            className="flex min-w-0 items-center gap-2 text-base font-semibold sm:text-lg"
          >
            <span className="grid h-9 w-9 place-items-center rounded-2xl bg-[image:var(--brand-gradient)] text-base text-[color:var(--text-on-brand)] shadow-[var(--shadow-card)]">
              隐
            </span>
            <span className="hidden truncate sm:inline">
              隐界世界角色管理平台
            </span>
            <span className="truncate sm:hidden">隐界角色管理</span>
          </Link>
          <form
            className="ml-auto hidden flex-1 max-w-md md:block"
            onSubmit={submitSearch}
          >
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--text-muted)]">
                🔍
              </span>
              <input
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="搜索角色词条…（回车）"
                className="h-10 w-full rounded-full border border-[color:var(--border-subtle)] bg-[color:var(--surface-input)] pl-9 pr-3 text-sm shadow-[var(--shadow-soft)] outline-none focus:border-[color:var(--brand-primary)]"
              />
            </div>
          </form>
          <div className="ml-auto flex items-center gap-2 md:ml-4">
            {user ? (
              <>
                <div className="hidden text-right text-xs leading-tight md:block">
                  <div className="font-medium text-[color:var(--text-primary)]">
                    {user.username}
                  </div>
                  <div className="text-[color:var(--text-muted)]">
                    {roleLabel(user.role)}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    clearSession();
                    window.location.href = "/login";
                  }}
                >
                  退出
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void navigate({ to: "/login" })}
                >
                  登录
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => void navigate({ to: "/register" })}
                >
                  注册
                </Button>
              </>
            )}
          </div>
        </div>
        {/* Mobile search */}
        <div className="mx-auto w-full max-w-screen-2xl px-4 pb-3 md:hidden">
          <form onSubmit={submitSearch}>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--text-muted)]">
                🔍
              </span>
              <input
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="搜索词条…"
                className="h-10 w-full rounded-full border border-[color:var(--border-subtle)] bg-[color:var(--surface-input)] pl-9 pr-3 text-sm shadow-[var(--shadow-soft)] outline-none focus:border-[color:var(--brand-primary)]"
              />
            </div>
          </form>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-screen-2xl flex-1 gap-6 px-4 pb-12 pt-6 sm:px-6">
        <aside
          className={`${
            mobileNavOpen ? "block" : "hidden"
          } lg:block lg:w-64 lg:shrink-0`}
        >
          <div className="lg:sticky lg:top-[88px]">
            <NavList groups={visibleGroups} pathname={pathname} />
          </div>
        </aside>
        <main
          className={`${
            mobileNavOpen ? "hidden" : "block"
          } min-w-0 flex-1 lg:block`}
        >
          <Suspense fallback={<LoadingBlock className="m-6" />}>
            <Outlet />
          </Suspense>
        </main>
      </div>

      <footer className="border-t border-[color:var(--border-subtle)] py-4 text-center text-xs text-[color:var(--text-muted)]">
        隐界世界角色管理平台 · 任何登录用户都可以提交角色创建、编辑和生命周期变更，由巡查员审核生效
      </footer>
    </div>
  );
}

function NavList({
  groups,
  pathname,
}: {
  groups: NavGroup[];
  pathname: string;
}) {
  return (
    <nav className="space-y-5">
      {groups.map((group) => (
        <div key={group.title}>
          <div className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--text-muted)]">
            {group.title}
          </div>
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const active = item.match
                ? item.match(pathname)
                : pathname === item.to ||
                  pathname.startsWith(`${item.to}/`);
              return (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    aria-current={active ? "page" : undefined}
                    className={`flex items-center gap-3 rounded-2xl px-3 py-2 text-sm transition-colors ${
                      active
                        ? "bg-[image:var(--brand-gradient)] text-[color:var(--text-on-brand)] shadow-[var(--shadow-soft)]"
                        : "text-[color:var(--text-secondary)] hover:bg-[color:var(--surface-card-hover)] hover:text-[color:var(--text-primary)]"
                    }`}
                  >
                    <span aria-hidden className="text-base leading-none">
                      {item.icon}
                    </span>
                    <span className="truncate">{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
