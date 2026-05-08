import type { I18nAppSurface, SupportedLocale } from "../locales";

// Surface 级 text dictionary registry（运行时注册）。
//
// 历史背景：cloud-console 有 ~3750 行字典数据，原本直接放在这个文件里通过
// 静态 export，被 catalog-loaders.ts → app-locale-provider.tsx → @yinjie/i18n
// 的 entry re-export 拖到所有 surface 的 critical bundle，移动 web 端凭空多
// 下 ~70KB raw / ~20KB gzipped。
//
// 现在改成 registry 模式：surface 自己有字典数据时，单独导入对应 data 文件
// （比如 ./surface-text-dictionaries-cloud-console），那个 data 文件会主动
// 调 registerSurfaceTextDictionaryProvider 把自己挂上来。其它 surface 不
// 导入对应 data 文件 → 整坨数据 tree-shake 走。
//
// 兼容性：getSurfaceTextDictionary 的同步函数签名不变，cloud-console-i18n.ts
// 等老调用点不需要改；只需 cloud-console main.tsx 加一行 side-effect import。

type DictionaryProvider = (locale: SupportedLocale) => Map<string, string>;

const dictionaryProviders = new Map<I18nAppSurface, DictionaryProvider>();

export function registerSurfaceTextDictionaryProvider(
  surface: I18nAppSurface,
  provider: DictionaryProvider,
) {
  dictionaryProviders.set(surface, provider);
}

export function getSurfaceTextDictionary(
  surface: I18nAppSurface,
  locale: SupportedLocale,
): Map<string, string> {
  const provider = dictionaryProviders.get(surface);
  if (!provider) {
    return new Map();
  }
  return provider(locale);
}
