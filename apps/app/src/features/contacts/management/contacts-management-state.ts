import { useCallback, useEffect, useState } from "react";

export type ManagementScreen =
  | { type: "root" }
  | { type: "blacklist" }
  | { type: "permissions" }
  | { type: "permissions-detail"; characterId: string };

export function useManagementScreenStack(open: boolean) {
  const [stack, setStack] = useState<ManagementScreen[]>([{ type: "root" }]);

  const reset = useCallback(() => setStack([{ type: "root" }]), []);
  const push = useCallback(
    (screen: ManagementScreen) => setStack((cur) => [...cur, screen]),
    [],
  );
  const pop = useCallback(
    () => setStack((cur) => (cur.length > 1 ? cur.slice(0, -1) : cur)),
    [],
  );

  // 关闭弹窗后清栈，下次打开从根屏开始；原实现在 render 里调 queueMicrotask
  // 是 side-effect-in-render（StrictMode / concurrent 渲染下会多次入队、违反
  // React render 纯函数前提），改成 useEffect 才是正经写法。
  useEffect(() => {
    if (!open && stack.length > 1) {
      reset();
    }
  }, [open, reset, stack.length]);

  return {
    stack,
    current: stack[stack.length - 1],
    canGoBack: stack.length > 1,
    push,
    pop,
    reset,
  };
}
