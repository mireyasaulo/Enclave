import { msg } from "@lingui/macro";
import type { LocationCardAttachment } from "@yinjie/contracts";
import { translateRuntimeMessage } from "@yinjie/i18n";

const t = translateRuntimeMessage;

const CHAT_LOCATION_SCENE_DEFS = [
  {
    id: "coffee_shop",
    title: msg`咖啡馆`,
    subtitle: msg`窗边有热咖啡和低声播放的爵士乐。`,
  },
  {
    id: "library",
    title: msg`图书馆`,
    subtitle: msg`安静的阅读区里，翻页声比说话声更清楚。`,
  },
  {
    id: "park",
    title: msg`公园`,
    subtitle: msg`树荫、长椅和慢下来的傍晚风。`,
  },
  {
    id: "gym",
    title: msg`健身房`,
    subtitle: msg`器械区和跑步机旁都有人来来往往。`,
  },
];

export type ChatLocationScene = {
  id: string;
  title: string;
  subtitle: string;
};

function getChatLocationScenes(): ChatLocationScene[] {
  return CHAT_LOCATION_SCENE_DEFS.map((def) => ({
    id: def.id,
    title: t(def.title),
    subtitle: t(def.subtitle),
  }));
}

export const CHAT_LOCATION_SCENES: ChatLocationScene[] = new Proxy(
  [] as ChatLocationScene[],
  {
    get(_target, prop, receiver) {
      const list = getChatLocationScenes();
      const value = Reflect.get(list, prop, receiver);
      return typeof value === "function" ? value.bind(list) : value;
    },
  },
);

export function buildLocationCardAttachment(
  sceneId: string,
): LocationCardAttachment | null {
  const scene = getChatLocationScenes().find((item) => item.id === sceneId);
  if (!scene) {
    return null;
  }

  return {
    kind: "location_card",
    sceneId: scene.id,
    title: scene.title,
    subtitle: scene.subtitle,
  };
}
