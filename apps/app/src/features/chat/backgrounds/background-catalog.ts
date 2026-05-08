import { msg } from "@lingui/macro";
import type { ChatBackgroundAsset } from "@yinjie/contracts";
import { translateRuntimeMessage } from "@yinjie/i18n";

const t = translateRuntimeMessage;

const CHAT_BACKGROUND_PRESET_DEFS = [
  { assetId: "amber-dunes", label: msg`暖沙晨光` },
  { assetId: "jade-garden", label: msg`青庭微风` },
  { assetId: "mist-lake", label: msg`雾湖清晨` },
  { assetId: "night-market", label: msg`夜市灯影` },
  { assetId: "paper-clouds", label: msg`云纸留白` },
];

export const CHAT_BACKGROUND_PRESETS: ChatBackgroundAsset[] =
  new Proxy([] as ChatBackgroundAsset[], {
    get(_target, prop, receiver) {
      const list = CHAT_BACKGROUND_PRESET_DEFS.map((def) =>
        buildPreset(def.assetId, t(def.label)),
      );
      const value = Reflect.get(list, prop, receiver);
      return typeof value === "function" ? value.bind(list) : value;
    },
  });

function buildPreset(assetId: string, label: string): ChatBackgroundAsset {
  const url = `/chat-backgrounds/${assetId}.svg`;

  return {
    source: "preset",
    assetId,
    url,
    thumbnailUrl: url,
    label,
  };
}
