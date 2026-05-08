import { useCallback, useState } from "react";

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

  if (!open && stack.length > 1) {
    queueMicrotask(reset);
  }

  return {
    stack,
    current: stack[stack.length - 1],
    canGoBack: stack.length > 1,
    push,
    pop,
    reset,
  };
}
