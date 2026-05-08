import { useCallback, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getSystemStatus } from "@yinjie/contracts";
import { useRuntimeTranslator } from "@yinjie/i18n";
import { resolveDigitalHumanEntryGuardCopy } from "./digital-human-entry-guard";

type DigitalHumanEntryNotice = ReturnType<
  typeof resolveDigitalHumanEntryGuardCopy
>;

export function useDigitalHumanEntryGuard({
  baseUrl,
  enabled = true,
}: {
  baseUrl?: string;
  enabled?: boolean;
}) {
  const t = useRuntimeTranslator();
  const [entryNotice, setEntryNotice] = useState<DigitalHumanEntryNotice>(null);
  const [videoGuardKey, setVideoGuardKey] = useState<string | null>(
    null,
  );
  const systemStatusQuery = useQuery({
    queryKey: ["system-status", baseUrl],
    queryFn: () => getSystemStatus(baseUrl),
    enabled: enabled && Boolean(baseUrl),
  });

  const resetEntryGuard = useCallback(() => {
    setEntryNotice(null);
    setVideoGuardKey(null);
  }, []);

  const clearEntryNotice = useCallback(() => {
    setEntryNotice(null);
  }, []);

  const guardVideoEntry = useCallback(() => {
    setEntryNotice(null);

    const guardCopy = resolveDigitalHumanEntryGuardCopy(
      t,
      systemStatusQuery.data?.digitalHumanGateway,
    );

    if (guardCopy && videoGuardKey !== guardCopy.key) {
      setVideoGuardKey(guardCopy.key);
      setEntryNotice(guardCopy);
      return false;
    }

    setVideoGuardKey(null);
    return true;
  }, [systemStatusQuery.data?.digitalHumanGateway, t, videoGuardKey]);

  return {
    entryNotice,
    clearEntryNotice,
    guardVideoEntry,
    resetEntryGuard,
  };
}
