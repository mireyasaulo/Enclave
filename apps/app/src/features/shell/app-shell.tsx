import { Suspense, lazy, type PropsWithChildren } from "react";
import { MobileShell } from "../../components/mobile-shell";
import { useDesktopLayout } from "./use-desktop-layout";

// DesktopShell ~1180 行，含桌面端导航 / 头像菜单 / 各类弹窗 / 路由匹配等大量
// 桌面专属代码。原本静态 import 会被打进 entry chunk，移动 web 用户也得下完
// 才能跑首屏 → 公网隧道下白白浪费几十 KB gzip。改 React.lazy + Suspense：
// useDesktopLayout 同步返回布局判断，desktop 用户立即触发懒加载，mobile 用户
// 永远不会下载这个 chunk。Suspense fallback 给 null 即可——首屏的 React 树
// 会被 main.tsx 的 <Suspense fallback={<BootstrapScreen />}> 接住。
const DesktopShell = lazy(async () => {
  const mod = await import("./desktop-shell");
  return { default: mod.DesktopShell };
});

export function AppShell({ children }: PropsWithChildren) {
  const isDesktopLayout = useDesktopLayout();

  if (isDesktopLayout) {
    return (
      <Suspense fallback={null}>
        <DesktopShell>{children}</DesktopShell>
      </Suspense>
    );
  }

  return <MobileShell>{children}</MobileShell>;
}
