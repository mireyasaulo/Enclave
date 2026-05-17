import { useEffect, useState } from "react";
import { msg } from "@lingui/macro";
import { translateRuntimeMessage } from "@yinjie/i18n";
import { FARM_CONSUMABLE_CATALOG } from "@yinjie/contracts";
import { useDoFarmCheckin, useFarmCheckin } from "../use-farm-state";

const t = translateRuntimeMessage;

interface CheckinSheetProps {
  open: boolean;
  onClose: () => void;
}

export function CheckinSheet({ open, onClose }: CheckinSheetProps) {
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const query = useFarmCheckin();
  const doMutation = useDoFarmCheckin();

  useEffect(() => {
    if (!open) return;
    setErrorMsg(null);
    setSuccessMsg(null);
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  if (!open) return null;
  const data = query.data;

  function handleCheckin() {
    setErrorMsg(null);
    setSuccessMsg(null);
    doMutation.mutate(undefined, {
      onSuccess: (res) => {
        const r = res.reward;
        const parts: string[] = [`🪙+${r.coins}`];
        if (r.consumableId && r.consumableCount) {
          const def = FARM_CONSUMABLE_CATALOG[r.consumableId];
          parts.push(`${def?.emoji ?? ""} ${def?.nameZh ?? r.consumableId} ×${r.consumableCount}`);
        }
        setSuccessMsg(
          `${t(msg`签到成功！`)} ${parts.join(" ")} · ${t(msg`连签`)} ${res.checkin.streak} ${t(msg`天`)}`,
        );
      },
      onError: (err) => setErrorMsg((err as Error).message),
    });
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-stone-900/30 sm:items-center"
      onClick={onClose}
    >
      <div
        className="flex max-h-[80vh] w-full max-w-md flex-col rounded-t-3xl bg-white shadow-xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-stone-100 px-4 py-3">
          <h2 className="text-base font-semibold">📅 {t(msg`每日签到`)}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-2 py-1 text-sm text-stone-500 hover:bg-stone-100"
          >
            {t(msg`关闭`)}
          </button>
        </header>
        {errorMsg && (
          <div className="bg-rose-50 px-4 py-2 text-xs text-rose-600">{errorMsg}</div>
        )}
        {successMsg && (
          <div className="bg-emerald-50 px-4 py-2 text-xs text-emerald-700">{successMsg}</div>
        )}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {query.isLoading && <div className="text-xs text-stone-500">{t(msg`加载中…`)}</div>}
          {data && (
            <>
              <div className="mb-3 flex items-center justify-between rounded-2xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
                <span>
                  {t(msg`已连续签到`)}
                  <span className="mx-1 font-semibold text-base text-amber-700">
                    {data.streak}
                  </span>
                  {t(msg`天`)} · {t(msg`累计`)} {data.totalCheckins} {t(msg`次`)}
                </span>
              </div>
              <div className="grid grid-cols-7 gap-2">
                {data.rewards.map((r) => {
                  const reached = data.streak >= r.day;
                  const isNext =
                    data.canCheckinToday && data.todayReward.day === r.day;
                  return (
                    <div
                      key={r.day}
                      className={`flex flex-col items-center gap-1 rounded-xl border p-2 text-[10px] ${
                        isNext
                          ? "border-amber-400 bg-amber-50 ring-2 ring-amber-300"
                          : reached
                            ? "border-emerald-300 bg-emerald-50"
                            : "border-stone-200 bg-white"
                      }`}
                    >
                      <span className="text-[10px] font-medium text-stone-500">
                        {t(msg`第`)} {r.day} {t(msg`天`)}
                      </span>
                      <span className="text-xl">{reached ? "✅" : "🎁"}</span>
                      <span className="text-[10px] text-amber-700">🪙{r.coins}</span>
                      {r.consumableId && r.consumableCount && (
                        <span className="text-[10px] text-stone-500">
                          {FARM_CONSUMABLE_CATALOG[r.consumableId]?.emoji ?? ""}×{r.consumableCount}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 flex justify-center">
                <button
                  type="button"
                  onClick={handleCheckin}
                  disabled={!data.canCheckinToday || doMutation.isPending}
                  className="rounded-full bg-amber-500 px-6 py-2 text-sm font-medium text-white shadow disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {data.canCheckinToday
                    ? t(msg`点击签到`)
                    : t(msg`今天已签到，明天再来`)}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
