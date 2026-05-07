import type { TelemetryEventType } from "@yinjie/contracts";
import { _emitTyped } from "./index";

export function emitInternalEvent(
  eventName: string,
  eventType: TelemetryEventType,
  props: Record<string, unknown>,
): void {
  _emitTyped(eventName, eventType, props);
}
