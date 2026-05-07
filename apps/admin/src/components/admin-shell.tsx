import { useEffect, type ReactNode } from "react";

type AdminShellProps = {
  sidebar: ReactNode;
  topbar: ReactNode;
  children: ReactNode;
  mobileNavOpen: boolean;
  onCloseMobileNav: () => void;
  /** the current pathname; closing drawer on route change */
  pathname: string;
};

export function AdminShell({
  sidebar,
  topbar,
  children,
  mobileNavOpen,
  onCloseMobileNav,
  pathname,
}: AdminShellProps) {
  // close drawer on route change
  useEffect(() => {
    if (mobileNavOpen) onCloseMobileNav();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // lock body scroll while drawer open
  useEffect(() => {
    if (!mobileNavOpen) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [mobileNavOpen]);

  return (
    <div className="relative min-h-screen bg-transparent text-[color:var(--text-primary)]">
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 opacity-45"
        style={{
          backgroundImage: "var(--bg-grid)",
          backgroundSize: "24px 24px",
          maskImage: "linear-gradient(180deg, rgba(0,0,0,0.42), transparent 88%)",
        }}
      />
      <div className="relative min-h-screen lg:grid lg:grid-cols-[260px_minmax(0,1fr)] xl:grid-cols-[280px_minmax(0,1fr)]">
        {/* Desktop sidebar */}
        <div className="hidden lg:sticky lg:top-0 lg:block lg:h-screen lg:overflow-hidden">
          {sidebar}
        </div>

        {/* Mobile / tablet drawer */}
        {mobileNavOpen ? (
          <div className="fixed inset-0 z-40 lg:hidden">
            <div
              aria-hidden="true"
              onClick={onCloseMobileNav}
              className="absolute inset-0 bg-[color:var(--text-primary)]/40 backdrop-blur-sm"
            />
            <aside className="absolute left-0 top-0 h-full w-[280px] max-w-[88vw] overflow-y-auto bg-[color:var(--surface-shell)] shadow-[var(--shadow-overlay)]">
              {sidebar}
            </aside>
          </div>
        ) : null}

        <div className="min-w-0">
          <div className="sticky top-0 z-20 px-4 pt-4 sm:px-6 sm:pt-5 lg:px-8 lg:pt-6">
            {topbar}
          </div>
          <div className="px-4 py-4 sm:px-6 sm:py-5 lg:px-8 lg:py-6">{children}</div>
        </div>
      </div>
    </div>
  );
}
